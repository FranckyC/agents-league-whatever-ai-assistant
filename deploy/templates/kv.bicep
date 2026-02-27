import {
  RBACPrincipalType
} from './types.bicep'

@description('A list of Azure Active Directory principals (users, groups, or service principals) and their types to be assigned specific roles for resource access')
param rbacPrincipalsList RBACPrincipalType[]

@description('User assigned identity to be assigned to this resource')
param userAssignedIdentityResourceName string

@description('Key Vault resource name')
param kvName string

@description('Region location')
param location string

resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityResourceName
}

var rbacKeyVaultRoleAssignments = [
  for p in rbacPrincipalsList: {
    principalId: p.principalId
    principalType: p.principalType
    roleDefinitionIdOrName: 'Key Vault Administrator'
  }
]

var keyVaultRoleAssignments = concat(rbacKeyVaultRoleAssignments, [
  {
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionIdOrName: 'Key Vault Crypto Service Encryption User'
  }
  {
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionIdOrName: 'Key Vault Certificates Officer'
  }
  {
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionIdOrName: 'Key Vault Secrets Officer'
  }
])

module kv 'br/public:avm/res/key-vault/vault:0.13.0' = {
  params: {
    name: kvName

    location: location
    sku: 'standard'
    enableVaultForDeployment: true
    enableVaultForDiskEncryption: true
    enableVaultForTemplateDeployment: true
    enablePurgeProtection: false
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90

    publicNetworkAccess: 'Enabled'

    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'      
    }
    
    roleAssignments: keyVaultRoleAssignments
  }
}

output kvName string = kvName
