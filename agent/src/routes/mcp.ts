import { Router, Request, Response, IRouter } from 'express';
import { OtelAgentTracer } from '../helpers/otelTracer';
import { JwtValidator } from '../helpers/jwtValidator';
import { config } from '../config';
import { propagation, context } from '@opentelemetry/api';

// Lazy-loaded to avoid pulling in heavy MCP SDK + Zod + Graph dependencies at startup
let _McpServerManagerModule: typeof import('../services/mcpServer') | null = null;
async function getMcpServerManager() {
    if (!_McpServerManagerModule) {
        _McpServerManagerModule = await import('../services/mcpServer');
    }
    return _McpServerManagerModule;
}

/**
 * Extracts a Bearer token from the Authorization header and attaches it to
 * `req.auth` so the MCP SDK forwards it as `extra.authInfo` in tool callbacks.
 */
function attachAuthInfo(req: Request): void {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        (req as any).auth = { token, clientId: 'mcp-client', scopes: [] };
    }
}

export interface McpRouterResult {
    router: IRouter;
    /** Pre-loads the MCP SDK and creates the McpServerManager in the background.
     *  Safe to call after `app.listen` so the first real request doesn't pay the cold-start cost. */
    warmUp: () => Promise<void>;
}

export function mcpRouter(telemetry: OtelAgentTracer): McpRouterResult {
    const router = Router();

    // --- JWT validation setup ---
    const mcpTenantId = config.tenantId;

    let jwtValidator: JwtValidator | null = null;
    if (mcpTenantId) {
        jwtValidator = new JwtValidator({
            tenantId: mcpTenantId,
        });
        console.log(`[MCP] JWT validation enabled — tenant: ${mcpTenantId}`);
    } else {
        console.warn('[MCP] JWT validation is DISABLED — tenant ID is not set');
    }

    // McpServerManager is created lazily on first request to avoid loading
    // heavy dependencies (MCP SDK, Zod, Graph client) at server startup.
    let mcpManager: InstanceType<typeof import('../services/mcpServer').McpServerManager> | null = null;

    async function getManager() {
        if (!mcpManager) {
            const { McpServerManager } = await getMcpServerManager();
            mcpManager = new McpServerManager(telemetry);
        }
        return mcpManager;
    }

    /** Pre-warms the lazy module + manager so the first request is fast. */
    async function warmUp(): Promise<void> {
        await getManager();
    }

    // Handle POST requests — each request gets a fresh stateless server + transport
    router.post('/mcp', async (req: Request, res: Response) => {
        attachAuthInfo(req);

        // --- Validate the JWT token before processing ---
        const token = (req as any).auth?.token as string | undefined;

        if (jwtValidator) {
            if (!token) {
                res.status(401).json({
                    jsonrpc: '2.0',
                    error: { code: -32001, message: 'Missing Authorization Bearer token' },
                    id: null,
                });
                return;
            }

            const validationError = await jwtValidator.validate(token);
            if (validationError) {
                console.warn(`[MCP] JWT validation failed (${validationError.status}): ${validationError.error}`);
                res.status(validationError.status).json({
                    jsonrpc: '2.0',
                    error: { code: -32001, message: `Unauthorized: ${validationError.error}` },
                    id: null,
                });
                return;
            }
        }

        // Extract OpenTelemetry context propagated from the caller's headers
        const activeContext = propagation.extract(context.active(), req.headers);

        try {
            const manager = await getManager();
            const transport = await manager.createTransport();
            // Run the transport handler within the extracted trace context
            await context.with(activeContext, async () => {
                await transport.handleRequest(req, res, req.body);
            });
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error',
                    },
                    id: null,
                });
            }
        }
    });

    // GET and DELETE are not applicable in stateless mode — return 405
    router.get('/mcp', (_req: Request, res: Response) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method Not Allowed: SSE streams are not supported in stateless mode',
            },
            id: null,
        });
    });

    router.delete('/mcp', (_req: Request, res: Response) => {
        res.status(405).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method Not Allowed: Session termination is not supported in stateless mode',
            },
            id: null,
        });
    });

    return { router, warmUp };
}
