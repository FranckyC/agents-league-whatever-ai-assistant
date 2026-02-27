<#
.SYNOPSIS
    Deploys the agent application code to an Azure App Service.

.DESCRIPTION
    Builds, bundles, and deploys the agent Node.js application to a specified Azure Web App.
    Can be used standalone or called from the main deploy-solution.ps1 script.

.PARAMETER WebAppName
    The name of the Azure Web App to deploy to.

.PARAMETER ResourceGroupName
    The name of the Azure Resource Group containing the Web App.
    If not specified, defaults to the value from variables.local.ps1.

.EXAMPLE
    # Standalone usage
    .\deploy-app.ps1 -WebAppName "app-myagent-abc1" -ResourceGroupName "rg-my-resource-group"

.EXAMPLE
    # Using defaults from variables.local.ps1
    .\deploy-app.ps1 -WebAppName "app-myagent-abc1"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "The name of the Azure Web App to deploy to.")]
    [string]$WebAppName,

    [Parameter(Mandatory = $false, HelpMessage = "The name of the Azure Resource Group containing the Web App.")]
    [string]$ResourceGroupName
)

$ErrorActionPreference = "Stop"

#region Resolve Resource Group name from variables if not provided
if (-not $ResourceGroupName) {
    Write-Verbose "ResourceGroupName not provided, loading from variables.local.ps1..."
    . "$PSScriptRoot/variables.local.ps1"
    $ResourceGroupName = $ENV_AZURE_DEPLOYMENT_STACK_RG_NAME

    if (-not $ResourceGroupName) {
        throw "ResourceGroupName was not provided and could not be resolved from variables.local.ps1."
    }

    Write-Verbose "Resolved ResourceGroupName to '$ResourceGroupName'."
}
#endregion

#region Ensure Azure CLI is authenticated
$azAccount = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Verbose "Not connected to Azure CLI, connecting..."

    $tenantId = if ($ENV_AZURE_DEPLOY_TENANT_ID) { $ENV_AZURE_DEPLOY_TENANT_ID } else { $null }

    if ($tenantId) {
        az login --use-device-code --tenant $tenantId
    } else {
        az login --use-device-code
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI login failed."
    }
}
Write-Verbose "Azure CLI is authenticated."
#endregion

#region Build and bundle the application

$agentPath = Join-Path -Path $PSScriptRoot -ChildPath "../agent"
$distPath = Join-Path -Path $agentPath -ChildPath "dist"

Write-Verbose "Installing npm dependencies..."
Push-Location -Path $agentPath

try {
    npm i
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

    Write-Verbose "Bundling application with webpack..."
    npm run bundle
    if ($LASTEXITCODE -ne 0) { throw "npm run bundle failed." }
} finally {
    Pop-Location
}

#endregion

#region Package and deploy

Push-Location -Path $distPath

try {
    Write-Verbose "Set location to '$(Get-Location)'"

    Write-Verbose "Creating deployment package..."
    Compress-Archive * -DestinationPath app.zip -Force

    if (-not (Test-Path -Path app.zip)) {
        throw "The deployment package 'app.zip' was not created successfully."
    }

    Write-Verbose "Deploying App Service code to '$WebAppName' in resource group '$ResourceGroupName'..."
    az webapp deploy `
        --resource-group $ResourceGroupName `
        --name $WebAppName `
        --type zip `
        --src-path app.zip `
        --restart `
        --clean true `
        --track-status false

    if ($LASTEXITCODE -ne 0) {
        throw "Azure Web App deployment failed."
    }

    Write-Output "Application deployed successfully to '$WebAppName'."
} finally {
    Pop-Location
}

#endregion
