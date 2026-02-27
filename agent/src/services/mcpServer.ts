import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { GraphService, CopilotDataSource, CopilotRetrievalRequest } from "./graphService";
import { OtelAgentTracer } from "../helpers/otelTracer";
import { SpanKind, SpanStatusCode, context as otelContext } from "@opentelemetry/api";

/**
 * Manages stateless MCP server instances.
 * Each request gets a fresh server + transport pair — no session tracking needed.
 */
export class McpServerManager {

    private _telemetry: OtelAgentTracer;

    constructor(telemetry: OtelAgentTracer) {
        this._telemetry = telemetry;
    }

    /**
     * Creates a new MCP server instance with registered tools.
     */
    createServer(): McpServer {

        const mcpServer = new McpServer({
            name: "enteprise-search-mcp-tools",
            version: "1.0.0"
        });

        // @ts-ignore — deep Zod inference triggers TS2589 in registerTool generics
        mcpServer.registerTool(
            "copilot_retrieval",
            {
                description: "Retrieve data for grounding purposes for Human Resources and Information Technology topics",
                inputSchema: {
                    queryString: z.string().describe('User query optimized for keywords search'),
                    filterExpression: z.string().optional().describe('The filter expression to use for search according to the datasource. For SharePoint documents search, use the filter expression \'Path:"https://mytenant.sharepoint.com/sites/mysite/Shared%20Documents/MyFolder*"\''),
                    dataSource: z.enum(['externalItem', 'sharePoint']).default('sharePoint').describe('The type of item to search for. For documents use "sharePoint", for DailyHub use "externalItem"'),
                    connections: z.array(z.string()).default([]).describe('Array of connection IDs for external data sources. Use default only when dataSource is set to "externalItem" for DailyHub content retrieval'),
                    language: z.enum(['fr-FR', 'en-US']).nullable().default(null).describe("The language of the input query. 'fr-CA' for French, 'en-US' for English. If the language cannot be determined, use null"),
                },
            },
            async ({ queryString, filterExpression, dataSource, connections, language }, extra) => {
                const tracer = await this._telemetry.getTracer();
                return tracer.startActiveSpan('mcp.tool.copilot_retrieval', {
                    kind: SpanKind.SERVER,    
                    attributes: {
                        "gen_ai.operation.type": "custom_tool_call",   
                        "gen_ai.system": "az.ai.agents",
                        "gen_ai.provider.name": "microsoft.agents"
                    }
                }, async (span) => {
                try {
                    span.setAttribute('mcp.tool.name', 'copilot_retrieval');
                    span.setAttribute('mcp.tool.dataSource', dataSource ?? 'sharePoint');
                    span.setAttribute('mcp.tool.queryString', queryString);

                    // Use the Bearer token from the incoming Authorization header
                    const token = extra.authInfo?.token;
                    if (!token) {
                        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing Bearer token' });
                        span.end();
                        return {
                            content: [{ type: "text" as const, text: 'Missing Authorization Bearer token in request' }],
                            isError: true,
                        };
                    }
                    const graphService = new GraphService(token);

                    // Build the retrieval request
                    const request: CopilotRetrievalRequest = {
                        queryString,
                        resourceMetadata: ['title','path','webUrl','url'],
                        dataSource: dataSource as CopilotDataSource,
                        filterExpression,
                        ...(dataSource === 'externalItem' && connections?.length > 0
                            ? {
                                dataSourceConfiguration: {
                                    externalItem: {
                                        connections: connections.map(c => ({ connectionId: c }))
                                    }
                                }
                            }
                            : {}
                        ),
                    };

                    const results = await graphService.searchCopilotDataForGrounding(request, language ?? undefined);

                    span.setAttribute('mcp.tool.resultCount', results.length);
                    span.setStatus({ code: SpanStatusCode.OK });
                    span.end();

                    return {
                        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
                    };
                } catch (error) {
                    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                    span.recordException(error instanceof Error ? error : new Error(String(error)));
                    span.end();
                    return {
                        content: [{ type: "text" as const, text: `Failed to call retrieval API: ${error}` }],
                        isError: true,
                    };
                }
                });
            }
        );

        // @ts-ignore — deep Zod inference triggers TS2589 in registerTool generics
        mcpServer.registerTool(
            "submit_ticket",
            {
                description: "Create an IT support ticket to report an issue. NEVER submit a ticket without knowing all information required to fill out the form, including the severity level. Always ask the user for more details if the information provided is not sufficient.",
                inputSchema: {
                    subject: z.string().describe("Subject of the issue"),
                    details: z.string().describe("Details of the issue describing the problem more in-depth"),
                    severity: z.enum(["Critical", "Medium", "Low"]).describe("Severity level of the issue"),
                },
            },
            async ({ subject, details, severity }, extra) => {
                const tracer = await this._telemetry.getTracer();
                return tracer.startActiveSpan('mcp.tool.submit_ticket', {
                    kind: SpanKind.SERVER,    
                    attributes: {
                        "gen_ai.operation.type": "custom_tool_call",   
                        "gen_ai.system": "az.ai.agents",
                        "gen_ai.provider.name": "microsoft.agents"
                    }
                }, async (span) => {
                try {
                    span.setAttribute('mcp.tool.name', 'submit_ticket');
                    span.setAttribute('mcp.tool.ticket.subject', subject);
                    span.setAttribute('mcp.tool.ticket.severity', severity);

                    const token = extra.authInfo?.token;
                    if (!token) {
                        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing Bearer token' });
                        span.end();
                        return {
                            content: [{ type: "text" as const, text: 'Missing Authorization Bearer token in request' }],
                            isError: true,
                        };
                    }

                    const listUrl = process.env.ENV_SP_TICKETS_LIST_URL;
                    if (!listUrl) {
                        span.setStatus({ code: SpanStatusCode.ERROR, message: 'ENV_SP_TICKETS_LIST_URL not configured' });
                        span.end();
                        return {
                            content: [{ type: "text" as const, text: 'ENV_SP_TICKETS_LIST_URL environment variable is not configured' }],
                            isError: true,
                        };
                    }

                    const graphService = new GraphService(token);

                    await graphService.createListItem(listUrl, {
                        fields: {
                            Title: subject,
                            ticketDetails: details,
                            ticketSeverity: severity,
                        }
                    });

                    console.log(`[MCP] IT ticket created — Subject: "${subject}", Severity: ${severity}`);

                    span.setStatus({ code: SpanStatusCode.OK });
                    span.end();

                    return {
                        content: [{ type: "text" as const, text: `IT ticket created successfully.\nSubject: ${subject}\nSeverity: ${severity}` }],
                    };
                } catch (error) {
                    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                    span.recordException(error instanceof Error ? error : new Error(String(error)));
                    span.end();
                    return {
                        content: [{ type: "text" as const, text: `Failed to create IT ticket: ${error}` }],
                        isError: true,
                    };
                }
                });
            }
        );

        return mcpServer;
    }

    /**
     * Creates a stateless StreamableHTTPServerTransport and connects it to a fresh MCP server.
     * No session ID is generated — each request is independent.
     */
    async createTransport(): Promise<StreamableHTTPServerTransport> {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        const server = this.createServer();
        await server.connect(transport);

        return transport;
    }
}
