[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Verbose "`tInitializing variables..."

. $PSScriptRoot/variables.local.ps1
Write-Verbose "Variables from local have been loaded..."

#region ----------------------------------------------------------[Azure resources deployment]---------------------------------------------------------
Import-Module Az.Accounts
Import-Module Az.Resources
Import-Module Az.Websites
Import-Module Az.KeyVault

Disable-AzContextAutosave | Out-Null

if (-not (Get-AzContext)) {
    Write-Verbose "Not connected to Azure Powershell, connecting..."
    Connect-AzAccount -TenantId $ENV_AZURE_DEPLOY_TENANT_ID -Subscription $ENV_AZURE_DEPLOY_SUBSCRIPTION_ID
}

if (!(az account show)) {
    Write-Verbose "Not connected to Azure CLI, connecting..."
    az login --use-device-code --tenant $ENV_AZURE_DEPLOY_TENANT_ID
}

try {

    $templateTemplateFilePath = Join-Path -Path $PSScriptRoot -ChildPath "./templates/main.bicep"

    $rbacPrincipalsList = @(
        @{
            principalId = (az ad signed-in-user show --query id -o tsv)
            principalType = "User"
        }
    )
    
    $templateParameterObject = @{
        rgName = $ENV_AZURE_DEPLOYMENT_STACK_RG_NAME
        environmentName = $ENV_AZURE_DEPLOYMENT_STACK_ENV_NAME
        rbacPrincipalsList =$rbacPrincipalsList
    }   
   
    # Need to install Bicep manually with PowerShell https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install#install-manually
    Write-Verbose "Deploying Azure resources with Bicep template..."
    $res = New-AzSubscriptionDeploymentStack `
        -Name $ENV_AZURE_DEPLOYMENT_STACK_ENV_NAME `
        -Location $ENV_AZURE_LOCATION `
        -TemplateFile $templateTemplateFilePath `
        -TemplateParameterObject  $templateParameterObject `
        -ActionOnUnmanage "deleteAll" `
        -DenySettingsMode "none" `
        -Force

    #region Azure AI Foundry agents configuration
    if ($configureAgent.IsPresent) {
        . "$PSScriptRoot/setup-agent.ps1" `
        -Manual:$Manual `
        -AzureFoundryProjectEndpointUrl $res.outputs.aiFoundryProjectEndpoint.Value `
        -AzureAiSearchFoundryConnectionResId $res.outputs.aiFoundryProjectConnectionAiSearchResourceId.Value
    }
    #endregion

    #region Azure App Service configuration

    Write-Verbose "`tUpdated Key Vault Value..."

    $KeyVaultValues = @{ 
        "USERMANAGEDIDENTITYCLIENTID" = $res.outputs.userManagedIdentityClientId.Value;
        "AZUREAPPINSIGHTSCONNECTIONSTRING" = $res.outputs.azureAppInsightsConnectionString.Value;
    }

    $KeyVaultValues.Keys | ForEach-Object {

        # Create or update secret
        Write-Information "Creating/Updating Secret '$_'..."
        if ($KeyVaultValues[$_]) {
            Set-AzKeyVaultSecret -VaultName $res.outputs.azureKeyVaultName.Value -Name $_ -SecretValue (ConvertTo-SecureString $KeyVaultValues[$_] -AsPlainText -Force) -ContentType "txt"
        }        
    }

    Write-Verbose "`tUpdating App Service settings..."

    $AppSettings = @{
        "ENV_AZURE_DEPLOY_AI_FOUNDRY_PROJECT_ENDPOINT" = $res.outputs.aiFoundryProjectEndpoint.Value;
        "ENV_AZURE_DEPLOY_USER_MANAGED_IDENTITY_CLIENT_ID" = "@Microsoft.KeyVault(SecretUri=https://$($res.outputs.azureKeyVaultName.Value).vault.azure.net/secrets/USERMANAGEDIDENTITYCLIENTID)"; # Used to connect to AI Foundry via manged identity
        "ENV_AZURE_DEPLOY_WORKFLOW_AGENT" = $ENV_AZURE_DEPLOY_AGENT_ID;
        "clientId" = "@Microsoft.KeyVault(SecretUri=https://$($res.outputs.azureKeyVaultName.Value).vault.azure.net/secrets/USERMANAGEDIDENTITYCLIENTID)"; # Used to connecto to bot service from app service via managed identity
        "tenantId" = $ENV_AZURE_DEPLOY_TENANT_ID; 
        "ENV_SP_TICKETS_LIST_URL" = $ENV_SP_TICKETS_LIST_URL;
        "ENV_AZURE_APP_INSIGHTS_CONNECTION_STRING"="@Microsoft.KeyVault(SecretUri=https://$($res.outputs.azureKeyVaultName.Value).vault.azure.net/secrets/AZUREAPPINSIGHTSCONNECTIONSTRING)";
    }
    
    Set-AzWebApp `
        -Name $res.outputs.webAppResourceName.Value `
        -ResourceGroupName $ENV_AZURE_DEPLOYMENT_STACK_RG_NAME `
        -AppSettings $AppSettings

    # Refresh key vault references

    Write-Verbose "`tRefreshing key vault references..."

    $token = az account get-access-token --resource "https://management.azure.com" | ConvertFrom-Json | Select-Object -ExpandProperty accessToken # Doesn't work with PowerShell

    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json' 
        'Accept' = 'application/json' 
    }
    
    $url = "https://management.azure.com$($res.outputs.webAppResourceId.Value)/config/configreferences/appsettings/refresh?api-version=2022-03-01"
    Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body (@{} | ConvertTo-Json)

    #endregion

    #region App Service Application code deployment

    Write-Verbose "`tDeploying App Service code..."

    & "$PSScriptRoot/deploy-app.ps1" `
        -WebAppName $res.outputs.webAppResourceName.Value `
        -ResourceGroupName $ENV_AZURE_DEPLOYMENT_STACK_RG_NAME `
        -Verbose:$VerbosePreference
    
    #endregion


    Write-Output "Deployment done!"

} catch {
    Write-Error "Deployment error ... $($_.Exception.Message)"
}