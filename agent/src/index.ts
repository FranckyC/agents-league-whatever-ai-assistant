import { CloudAdapter, loadAuthConfigFromEnv, MemoryStorage, TurnContext } from "@microsoft/agents-hosting";
import express, { Router } from 'express'
import cors from 'cors';
import { CustomAgentWorkflow } from "./agent";
import { messagesRouter } from "./routes/messages";
import { mcpRouter } from "./routes/mcp";
import { OtelAgentTracer } from "./helpers/otelTracer";
import { getAIFoundryCredential, config } from "./config";

const onTurnErrorHandler = async (context: TurnContext, error: Error) => {

  console.error(`\n [onTurnError] unhandled error: ${error}`);

  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  await context.sendActivity(
    `The bot encountered unhandled error:\n ${error.message}`
  );
  await context.sendActivity(
    "To continue to run this bot, please fix the bot source code."
  );
};

const storage = new MemoryStorage();;
const customAgent = new CustomAgentWorkflow(storage);

customAgent.adapter.onTurnError = onTurnErrorHandler;

let authConfig = loadAuthConfigFromEnv();
let adapter = customAgent.adapter as CloudAdapter;

const port = process.env.PORT || 3978;
const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenTelemetry tracer — deferred until after server starts listening
const telemetry = new OtelAgentTracer(
  'enterprise-search-mcp-tools',
  config.aiFoundryProjectEndpoint!,
  getAIFoundryCredential()
);

// Create different routes for our agent
const router = Router();
router.use(messagesRouter(adapter, customAgent, authConfig));

const mcp = mcpRouter(telemetry);
router.use(mcp.router);

// Register all API routes
app.use('/api', router);

app.listen(port, async () => {
  console.log(`\n[SERVER] Server listening to port ${port} for appId ${authConfig.clientId}`);

  // Eagerly initialize the OTEL tracer now that the server is up
  telemetry.getTracer().then(() => {
    console.log('[OTEL] Tracer initialized successfully');
  }).catch((err) => {
    console.error('[OTEL] Failed to initialize tracer (will retry on first use):', err);
  });

  // Pre-warm the MCP server (lazy-loads MCP SDK, Zod, Graph client in the background)
  mcp.warmUp().then(() => {
    console.log('[MCP] Server manager warmed up successfully');
  }).catch((err) => {
    console.error('[MCP] Failed to warm up server manager (will retry on first request):', err);
  });
}).on('error', (error) => {
  console.error(`[SERVER] Error occurred: ${error}`);
});