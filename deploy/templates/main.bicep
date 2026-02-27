targetScope = 'subscription'

import {
  RBACPrincipalType
} from './types.bicep'

/*----------------------------------Params-------------------------------*/
@description('The environment unique name')
param environmentName string

param location string = deployment().location

@description('Resource group name where resources should be created')
param rgName string

@description('List of principals to configure for resource RBAC permissions')
param rbacPrincipalsList RBACPrincipalType[] = [
  {
    principalId: deployer().objectId
    principalType: 'ServicePrincipal'
  }
]

/*----------------------------------Variables---------------------------*/

var resourceToken = take(toLower(uniqueString(subscription().id, environmentName, location)), 4)
var resourceName = toLower(split(split(environmentName, '-')[0], '_')[0])

/*----------------------------------Resource group----------------------*/
module rg 'br/public:avm/res/resources/resource-group:0.4.1' = {
  name: 'dep-rg-${resourceToken}'
  params: {
    name: rgName
    location: location
  }
}

/*----------------------------------User Assigned Identity--------------*/
module userAssignedIdentityModule 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  scope: resourceGroup(rgName)
  name: 'dep-userAssignedIdentity-${resourceToken}'
  params: {
    name: 'id-${resourceName}-${resourceToken}'
  }
  dependsOn: [rg]
}

/*----------------------------------Bot Service----------------------------*/
module botService './bot.bicep' = {
  scope: resourceGroup(rgName)
  name: 'dep-bot-${resourceToken}'
  params: {
    botDisplayName: 'Whatever AI Assistant Agent'
    botAppDomain: 'https://${webAppModule.outputs.webAppDomain}'
    userAssignedIdentityResourceId: userAssignedIdentityModule.outputs.resourceId
    botServiceSku: 'F0' 
    botServiceName: 'bot-${resourceName}-${resourceToken}'
  }
}

/*----------------------------------WebApp----------------------------*/
module webAppModule './webapp.bicep' = {
  scope: resourceGroup(rgName)
  name: 'dep-site-${resourceToken}'
  params: {
    location: location
    appServiceName: 'plan-${resourceName}-${resourceToken}'
    siteName: 'app-${resourceName}-${resourceToken}'
    userAssignedIdentityResourceId: userAssignedIdentityModule.outputs.resourceId
    deploymentStorageAccountResourceId: saModule.outputs.resourceId
    applicationInsightsResourceId: appInsights.outputs.resourceId
  }
}

/*----------------------------------Storage Account---------------------*/
module saModule './sa.bicep' = {
  scope: resourceGroup(rgName)
  name: 'dep-sa-${resourceToken}'
  params: {
    rbacPrincipalsList: rbacPrincipalsList
    location: location
    storageAccountName: 'st${resourceName}${resourceToken}'
    userAssignedIdentityResourceName: userAssignedIdentityModule.outputs.name
  }
}

/*----------------------------------AI Foundry--------------------------*/
var rbacAiFoundryOpenAiContributorRoleAssignments = [
  for p in rbacPrincipalsList: {
    principalId: p.principalId
    principalType: p.principalType
    roleDefinitionIdOrName: 'Cognitive Services OpenAI Contributor'
  }
]

var rbacAiFoundryAzureAiUserRoleAssignments = [
  for p in rbacPrincipalsList: {
    principalId: p.principalId
    principalType: p.principalType
    roleDefinitionIdOrName: 'Azure AI User'
  }
]

var aiFoundryRoleAssignments = concat(
  rbacAiFoundryAzureAiUserRoleAssignments,
  rbacAiFoundryOpenAiContributorRoleAssignments,
  [
    {
      principalId: userAssignedIdentityModule.outputs.principalId
      principalType: 'ServicePrincipal'
      roleDefinitionIdOrName: 'Cognitive Services Contributor'
    }
    {
      principalId: userAssignedIdentityModule.outputs.principalId
      principalType: 'ServicePrincipal'
      roleDefinitionIdOrName: 'Cognitive Services OpenAI Contributor'
    }
    {
      principalId: userAssignedIdentityModule.outputs.principalId
      principalType: 'ServicePrincipal'
      roleDefinitionIdOrName: 'Azure AI User' // Needed for Azure Function to read agents
    }
  ]
)

module aiFoundry './ai-foundry.bicep' = {
  scope: resourceGroup(rgName)
  name: 'dep-aiFoundry-${resourceToken}'
  params: {
    location: 'eastus2' // Necessary to get the Agents Service MCP OAuth Passthrough
    kind: 'AIServices'
    name: 'cog-${resourceName}-${resourceToken}'
    sku: 'S0'
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        userAssignedIdentityModule.outputs.resourceId
      ]
    }
    allowProjectManagement: true
    appInsightsResourceId: appInsights.?outputs.resourceId ?? ''
    appInsightsApiKey: appInsights.outputs.connectionString
    project: 'project-${resourceName}-${resourceToken}'
    roleAssignments: aiFoundryRoleAssignments
  }
}

/*----------------------------------Log Analytics workspace-------------*/
module logAnalyticsWorkspace 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  scope: resourceGroup(rgName)
  name: 'dep-logAnalyticsWorkspace-${resourceToken}'
  params: {
    name: 'log-${resourceName}-${resourceToken}'

    location: location
    linkedStorageAccounts: [
      {
        name: 'Query'
        storageAccountIds: [
          saModule.outputs.resourceId
        ]
      }
    ]

    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'

    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        userAssignedIdentityModule.outputs.resourceId
      ]
    }

    roleAssignments: [
      {
        principalId: userAssignedIdentityModule.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Monitoring Contributor'
      }
    ]
  }
}

/*----------------------------------App Insights------------------------*/
module appInsights 'br/public:avm/res/insights/component:0.6.0' = {
  scope: resourceGroup(rgName)
  name: 'dep-appInsights-${resourceToken}'
  params: {
    name: 'appi-${resourceName}-${resourceToken}'

    location: location

    kind: 'web'

    linkedStorageAccountResourceId: saModule.outputs.resourceId
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId

    publicNetworkAccessForIngestion:'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    forceCustomerStorageForProfiler: false
    retentionInDays: 90

    disableIpMasking: false
    disableLocalAuth: false

    roleAssignments: [
      {
        principalId: userAssignedIdentityModule.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Monitoring Contributor'
      }
      {
        principalId: userAssignedIdentityModule.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Monitoring Metrics Publisher'
      }
      {
        principalId: userAssignedIdentityModule.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Application Insights Component Contributor'
      }
    ]
  }
}

/*----------------------------------Key Vault---------------------------*/
module kvModule './kv.bicep' = {
  scope: resourceGroup(rgName)
  name: 'dep-kv-${resourceToken}'
  params: {
    kvName: 'kv-${resourceName}-${resourceToken}'
    location: location
    rbacPrincipalsList: rbacPrincipalsList
    userAssignedIdentityResourceName: userAssignedIdentityModule.outputs.name
  }
  dependsOn: [rg]
}

/*----------------------------------Outputs-----------------------------*/
output userManagedIdentityResourceId string = userAssignedIdentityModule.outputs.resourceId
output userManagedIdentityName string = userAssignedIdentityModule.outputs.name
output userManagedIdentityClientId string = userAssignedIdentityModule.outputs.clientId
output aiFoundryResourceName string = aiFoundry.?outputs.aiFoundryResourceName ?? ''
output aiFoundryProjectEndpoint string = aiFoundry.?outputs.aiFoundryProjectEndpoint ?? ''
output azureKeyVaultName string = kvModule.outputs.kvName
output botWebAppDomain string = webAppModule.outputs.webAppDomain
output botId string = botService.outputs.botId
output webAppResourceName string = webAppModule.outputs.webAppResourceName
output webAppResourceId string = webAppModule.outputs.webAppResourceId
output azureAppInsightsConnectionString string = appInsights.outputs.connectionString

