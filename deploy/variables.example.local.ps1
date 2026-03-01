$ENV_AZURE_ENV_NAME="your-name"
$ENV_AZURE_LOCATION="eastus2"
$ENV_AZURE_DEPLOY_TENANT_ID=""
$ENV_AZURE_DEPLOY_SUBSCRIPTION_ID=""
$ENV_AZURE_DEPLOY_AGENT_ID="workflow-agent"
$ENV_AZURE_DEPLOYMENT_STACK_ENV_NAME = "agents-league-m365-demo-$ENV_AZURE_ENV_NAME"
$ENV_AZURE_DEPLOYMENT_STACK_RG_NAME="rg-$ENV_AZURE_DEPLOYMENT_STACK_ENV_NAME"
$ENV_SP_TICKETS_LIST_URL='https://{tenant}.sharepoint.com/sites/it-portal/Lists/Tickets'


# --------- Agent configuration ----------
$ENV_MICROSOFT_FOUNDRY_ENDPOINT_URL="https://cog-agents-<id>.services.ai.azure.com/api/projects/project-agents-<id>"
$ENV_MCP_SERVER_URL="https://app-agents-<id>.azurewebsites.net"
$ENV_RETRIEVAL_FILTER_EXPRESSION_HR='Path:\"https://{tenant}.sharepoint.com/sites/hr-portal/Shared%20Documents\"'
$ENV_RETRIEVAL_FILTER_EXPRESSION_IT='Path:\"https://{tenant}.sharepoint.com/sites/it-portal/Shared%20Documents\"'