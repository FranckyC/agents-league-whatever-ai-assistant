# 
<#
.SYNOPSIS
    Package Copilot Agents

.DESCRIPTION
    Package Copilot Agents
.NOTES
    Version:        1.0
    Author:         Franck Cornu
    Creation Date:  19/03/2025
    Purpose/Change: Initial script development

.EXAMPLE

    Package all agent:
    > package-agent.ps1 Env LOCAL
#>

[CmdletBinding()]
Param (

    [Parameter(Mandatory = $True)]
    [ValidateNotNullOrEmpty()]
    [ValidateSet('LOCAL','CI')]
    [string]$Env,

    [Parameter(Mandatory = $True)]
    [string]$AppVersion
)

$ErrorActionPreference = "Stop"

. $PSScriptRoot/scripts/Replace-Tokens.ps1

Write-Verbose "`tInitializing variables..."

# Load correct variables according to the targeted environnement
switch ($Env) {
    'CI' {
        . $PSScriptRoot/variables.ci.ps1
        Write-Verbose "Variables from CI have been loaded..."
    }

    'LOCAL' {
        . $PSScriptRoot/variables.local.ps1
        Write-Verbose "Variables from local have been loaded..."
    }
}

# More info about TeamsFx CI/CD deployment: 
# https://github.com/OfficeDev/TeamsFx/blob/main/docs/cicd_insider/others-script-cd-template.sh

$appFolderPath = Join-Path -Path $PSScriptRoot -ChildPath "../agents"
Write-Verbose "[TeamsFx] Set path to '$appFolderPath'..."

$agentsToDeploy = $ENV_DEPLOY_COPILOT_AGENTS.Split(",")
Get-ChildItem -Path $appFolderPath -Directory | Where-Object { $agentsToDeploy.IndexOf($_.Name) -gt -1 } | ForEach-Object {
    
    Set-Location "$($_.FullName)/agent"

    $agentFolderName = $_.Name

    Write-Verbose "Packaging agent '$($_.Name)'..."

    # > Generate TeamsFx .env file for that environment according to the loaded environment variables
    $Tokens = @{}
    (Get-Variable -Scope Local | Where-Object { $_.Name.StartsWith("ENV_") }) | ForEach-Object { $Tokens[$_.Name] = $_.Value }

    Replace-Tokens `
    -InputFile ".\env\.env.ci.template" `
    -OutputFile ".\env\.env.$ENV_DEPLOY_COPILOT_TEAMSFX_ENV" `
    -Tokens $Tokens `
    -StartTokenPattern "{{" `
    -EndTokenPattern "}}"

    # > Update manifest version
    if ($AppVersion) {
        $ManifestTemplateFilePath = ".\appPackage\manifest.json"
        $ManifestFile = Get-Content $ManifestTemplateFilePath -Raw | ConvertFrom-Json
        $ManifestFile.version = $AppVersion
        $ManifestFile | ConvertTo-Json -depth 32 | Set-Content $ManifestTemplateFilePath
    }

    Write-Verbose "[TeamsFx] Package Teams application..."
    atk package --env $ENV_DEPLOY_COPILOT_TEAMSFX_ENV -i false -f (Get-Location) --output-package-file "./appPackage/build/$($agentFolderName)_$AppVersion.$ENV_DEPLOY_COPILOT_TEAMSFX_ENV.zip"

    if ($LASTEXITCODE) {
        throw "Error during TeamsFx deployment"
    }

    Pop-Location
}

Set-Location $PSScriptRoot 

Write-Verbose "Done!"