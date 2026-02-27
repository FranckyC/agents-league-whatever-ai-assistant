import { ClientSecretCredential, DefaultAzureCredential, TokenCredential } from "@azure/identity";

interface AIFoundryEnvironmentConfig {
  workflowAgentName: string;
  aiFoundryProjectEndpoint: string;
}

export const config = {
  aiFoundryProjectEndpoint: process.env.ENV_AZURE_DEPLOY_AI_FOUNDRY_PROJECT_ENDPOINT,
  tenantId: process.env.ENV_AZURE_APP_TENANT_ID,
  clientId: process.env.ENV_AZURE_APP_CLIENT_ID,
  clientSecret: process.env.ENV_AZURE_APP_CLIENT_SECRET,
  managedIdentityClientId: process.env.ENV_AZURE_DEPLOY_USER_MANAGED_IDENTITY_CLIENT_ID,
  runIsAzure: process.env.WEBSITE_SITE_NAME
};

export const getAIFoundryCredential = (): TokenCredential => { 

    const isAzure = !!config.runIsAzure;

    if (isAzure) {
      console.log("Running in Azure. Using user assigned managed identity credential.");
      
      const clientId = config.managedIdentityClientId;
      if (!clientId) {
        throw new Error("ENV_AZURE_DEPLOY_USER_MANAGED_IDENTITY_CLIENT_ID is not set");
      }

      return new DefaultAzureCredential({ managedIdentityClientId: clientId });
      
    } else {
      console.log("Running locally. Using SPN identity credential.");
      
      return new ClientSecretCredential(
        config.tenantId!,
        config.clientId!,
        config.clientSecret!,
      );
    }
};

export const getAIFoundryConfiguration = (): AIFoundryEnvironmentConfig =>  {

    const workflowAgentName = process.env["ENV_AZURE_DEPLOY_WORKFLOW_AGENT"];
    const aiFoundryProjectEndpoint = process.env["ENV_AZURE_DEPLOY_AI_FOUNDRY_PROJECT_ENDPOINT"];

    if (!workflowAgentName || !aiFoundryProjectEndpoint) {
        throw new Error(`Missing required environment variables. workflowAgentName: ${workflowAgentName}, aiFoundryProjectEndpoint: ${aiFoundryProjectEndpoint}`);
    }

    return { workflowAgentName, aiFoundryProjectEndpoint };
}