@description('User assigned identity resource ID')
param userAssignedIdentityResourceId string

param botDisplayName string

param botServiceName string

param botServiceSku string = 'F0'

param botAppDomain string

resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: last(split(userAssignedIdentityResourceId, '/'))
}

// Register your web service as a bot with the Bot Framework
resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  kind: 'azurebot'
  location: 'global'
  name: botServiceName
  properties: {
    displayName: botDisplayName
    endpoint: '${botAppDomain}/api/messages'
    msaAppId: userAssignedIdentity.properties.clientId
    msaAppMSIResourceId: userAssignedIdentity.id
    msaAppTenantId: userAssignedIdentity.properties.tenantId
    msaAppType:'UserAssignedMSI'
    disableLocalAuth: true
  }
  sku: {
    name: botServiceSku
  }
}

// Connect the bot service to Microsoft Teams
resource botServiceMsTeamsChannel 'Microsoft.BotService/botServices/channels@2021-03-01' = {
  parent: botService
  location: 'global'
  name: 'MsTeamsChannel'
  properties: {
    channelName: 'MsTeamsChannel'
  }
}

output botId string = botService.properties.msaAppId
