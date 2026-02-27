[CmdletBinding()]
Param()

$ErrorActionPreference = "Stop"

. $PSScriptRoot/scripts/Replace-Tokens.ps1

Write-Verbose "`tInitializing variables..."

# Load correct variables according to the targeted environnement
. $PSScriptRoot/variables.local.ps1
Write-Verbose "Variables from local have been loaded..."


#region ----------------------------------------------------------[Azure resources deployment]---------------------------------------------------------
Import-Module Az.Accounts

Disable-AzContextAutosave | Out-Null

$IsLogged = !!(az account show)

if (-not($IsLogged)) {
    az login --use-device-code --tenant $ENV_AZURE_DEPLOY_TENANT_ID
}

#region Azure AI Foundry configuration

    $token = az account get-access-token --resource "https://ai.azure.com" | ConvertFrom-Json | Select-Object -ExpandProperty accessToken # Doesn't work with PowerShell

    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json' 
        'Accept' = 'application/json' 
    }

    try {

        #region Azure AI Foundry agents configuration
        
        $Tokens = @{
            ENV_MCP_SERVER_URL = $ENV_MCP_SERVER_URL
            ENV_RETRIEVAL_FILTER_EXPRESSION_HR = $ENV_RETRIEVAL_FILTER_EXPRESSION_HR
            ENV_RETRIEVAL_FILTER_EXPRESSION_IT = $ENV_RETRIEVAL_FILTER_EXPRESSION_IT
        }

        # Create or update agents
        $agentsFolder = Join-Path -Path $PSScriptRoot -ChildPath "agents"

        # Remove existing file
        Get-ChildItem -Path $agentsFolder -Filter *.json -File | Remove-Item -Force
        
        # Replace tokens in agents template files
        Get-ChildItem -Path $agentsFolder -Filter *.template -File | Sort-Object Name | ForEach-Object {

                Write-Verbose "Processing agent template file: $($_.Name)"
                            
                $outputFileName = $_.Name -replace '\.template$', ''
                $outputFilePath = Join-Path -Path $_.DirectoryName -ChildPath $outputFileName
                
                Replace-Tokens `
                    -InputFile $($_.FullName) `
                    -OutputFile $outputFilePath `
                    -Tokens $Tokens `
                    -StartTokenPattern "{{" `
                    -EndTokenPattern "}}"
        }

        Get-ChildItem -Path $agentsFolder -Filter *.json -File | Sort-Object Name | ForEach-Object {

            Write-Verbose "Processing agent file: $($_.Name)"

            $agentPayload = Get-Content -Path $_.FullName -Raw | ConvertFrom-Json
            $agentName = $agentPayload.name
            $url = "$ENV_MICROSOFT_FOUNDRY_ENDPOINT_URL/agents/$($agentName)?api-version=2025-11-15-preview"

            Invoke-RestMethod -Uri $url -Headers $headers -Method Get -SkipHttpErrorCheck -StatusCodeVariable "statusCode" | Out-Null
            if ($statusCode -eq 404) {
                Write-Verbose "Creating agent '$agentName'..."
                $url = "$ENV_MICROSOFT_FOUNDRY_ENDPOINT_URL/agents?api-version=2025-11-15-preview"
                Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body ($agentPayload | ConvertTo-Json -Depth 24) | Out-Null
            } else {

                Write-Verbose "Agent '$agentName' already exists. Updating..."
                $url = "$ENV_MICROSOFT_FOUNDRY_ENDPOINT_URL/agents/$($agentName)?api-version=2025-11-15-preview"
                Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body ($agentPayload | ConvertTo-Json -Depth 24) | Out-Null                
            }
        }


        #endregion

    } catch {
        Write-Error $_.Exception.Message
    }

#endregion
