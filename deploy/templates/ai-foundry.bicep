param location string

param kind string

param sku string

param name string

import { managedIdentityAllType } from 'br/public:avm/utl/types/avm-common-types:0.5.1'
param managedIdentities managedIdentityAllType?

param allowProjectManagement bool

param roleAssignments object[]

param project string

param appInsightsResourceId string

param appInsightsApiKey string

var formattedUserAssignedIdentities = reduce(
  map((managedIdentities.?userAssignedResourceIds ?? []), (id) => { '${id}': {} }),
  {},
  (cur, next) => union(cur, next)
)

var identity = !empty(managedIdentities)
  ? {
      type: (managedIdentities.?systemAssigned ?? false)
        ? (!empty(managedIdentities.?userAssignedResourceIds ?? {}) ? 'SystemAssigned, UserAssigned' : 'SystemAssigned')
        : (!empty(managedIdentities.?userAssignedResourceIds ?? {}) ? 'UserAssigned' : null)
      userAssignedIdentities: !empty(formattedUserAssignedIdentities) ? formattedUserAssignedIdentities : null
    }
  : null

var builtInRoleNames = {
  'Azure AI User': subscriptionResourceId(
    'Microsoft.Authorization/roleDefinitions',
    '53ca6127-db72-4b80-b1b0-d745d6d5456d'
  )
  'Cognitive Services Contributor': subscriptionResourceId(
    'Microsoft.Authorization/roleDefinitions',
    '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68'
  )
  'Cognitive Services OpenAI Contributor': subscriptionResourceId(
    'Microsoft.Authorization/roleDefinitions',
    'a001fd3d-188f-4b5d-821b-7da978bf7442'
  )
  Contributor: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
  Owner: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8e3af657-a8ff-443c-a75c-2fe8c4bcb635')
  Reader: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
  'Role Based Access Control Administrator': subscriptionResourceId(
    'Microsoft.Authorization/roleDefinitions',
    'f58310d9-a9f6-439a-9e8d-f62e7b41a168'
  )
  'User Access Administrator': subscriptionResourceId(
    'Microsoft.Authorization/roleDefinitions',
    '18d7d88d-d35e-4fb5-a5c3-7773c20a72d9'
  )
}

var formattedRoleAssignments = [
  for (roleAssignment, index) in (roleAssignments ?? []): union(roleAssignment, {
    roleDefinitionId: builtInRoleNames[?roleAssignment.roleDefinitionIdOrName] ?? (contains(
        roleAssignment.roleDefinitionIdOrName,
        '/providers/Microsoft.Authorization/roleDefinitions/'
      )
      ? roleAssignment.roleDefinitionIdOrName
      : subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAssignment.roleDefinitionIdOrName))
  })
]

/* Azure AI Foundry configuration */
resource aiFoundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: name
  location: location
  identity: identity
  kind: kind
  sku: {
    name: sku
  }
  properties: {
    customSubDomainName: name

    publicNetworkAccess: 'Enabled'

    allowProjectManagement: allowProjectManagement

    disableLocalAuth: false

    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource aiFoundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-04-01-preview' = {
  name: project
  parent: aiFoundryAccount
  location: location
  identity: identity
  properties: {
    description: 'AI Foundry Project ${project}'
  }
}

@batchSize(1)
resource aiFoundryRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (roleAssignment, index) in (formattedRoleAssignments ?? []): {
    name: roleAssignment.?name ?? guid(aiFoundryAccount.id, roleAssignment.principalId, roleAssignment.roleDefinitionId)
    properties: {
      roleDefinitionId: roleAssignment.roleDefinitionId
      principalId: roleAssignment.principalId
      description: roleAssignment.?description
      principalType: roleAssignment.?principalType
      condition: roleAssignment.?condition
      conditionVersion: !empty(roleAssignment.?condition) ? (roleAssignment.?conditionVersion ?? '2.0') : null
      delegatedManagedIdentityResourceId: roleAssignment.?delegatedManagedIdentityResourceId
    }
    scope: aiFoundryAccount
  }
]

/* Azure AI Foundry Models */
resource aiFoundryProjectDeployment_gpt_4_1 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: aiFoundryAccount
  name: 'gpt-4.1'
  sku: {
    name: 'GlobalStandard'
    capacity: 100
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1'
      version: '2025-04-14'
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
    currentCapacity: 100
    raiPolicyName: 'Microsoft.DefaultV2'
  }
}

/* Azure AI Foundry Connections */
resource aiFoundryProjectAppInsightsConnection 'Microsoft.CognitiveServices/accounts/projects/connections@2025-04-01-preview' = {
  parent: aiFoundryProject
  name: '${project}-conn-appin'
  properties: {
    authType: 'ApiKey'
    category: 'AppInsights'
    peRequirement: 'NotRequired'
    peStatus: 'NotApplicable'
    isSharedToAll: false
    target: appInsightsResourceId
    useWorkspaceManagedIdentity: false
    credentials: {
      key: appInsightsApiKey
    }
    metadata: {
      ApiType: 'Azure'
      ResourceId: appInsightsResourceId
    }
  }
}

/* Outputs */
output aiFoundryResourceName string = aiFoundryAccount.name
output aiFoundryResourceId string = aiFoundryAccount.id
output aiFoundryProjectEndpoint string = 'https://${aiFoundryAccount.name}.services.ai.azure.com/api/projects/${aiFoundryProject.name}'


