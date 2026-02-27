import { Citation, TurnContext } from "@microsoft/agents-hosting";
import { AIProjectClient } from "@azure/ai-projects/dist/commonjs/aiProjectClient";
import { AdaptiveCardHelper } from "../helpers/adaptiveCardHelper";

/** OAuth consent flow — returned when the MCP server requires authentication. */
export interface McpAuthRequest {
  consentLink: string;
  conversationId: string;
  inputQuery: string;
}

/** MCP tool approval flow — returned when a tool call needs user confirmation. */
export interface McpToolApprovalRequest {
  McpToolApprovalRequestId: string;
  toolName: string;
  toolArguments: string;
  serverLabel: string;
  conversationId: string;
  inputQuery: string;
  /** The response ID from the stream — used with previous_response_id to resume. */
  responseId: string;
}

/** Ticket form flow — returned when the agent emits SUBMIT_ISSUE so the user fills a form. */
export interface McpTicketFormRequest {
  conversationId: string;
  inputQuery: string;
}

/**
 * Result returned from the agent streaming invocation.
 * Exactly one of the outcomes will be set:
 * - Normal completion (empty object)
 * - Auth required (auth present)
 * - MCP tool approval required (approval present)
 * - Ticket form required (ticketForm present)
 */
export interface AgentStreamResult {
  auth?: McpAuthRequest;
  approval?: McpToolApprovalRequest;
  ticketForm?: McpTicketFormRequest;
}

/** A single debug event captured during stream processing. */
export interface DebugEvent {
  /** Monotonic sequence number (1-based). */
  seq: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Elapsed ms since the stream started. */
  elapsedMs: number;
  /** The event type from the streaming API. */
  eventType: string;
  /** Human-readable summary of the event. */
  summary: string;
  /** Optional structured detail (e.g. tool args, action IDs). */
  detail?: Record<string, any>;
}

/** Full debug snapshot for one agent invocation. */
export interface DebugInfo {
  inputQuery: string;
  conversationId: string | null;
  previousResponseId?: string;
  responseId?: string;
  streamStartedAt: string;
  streamEndedAt: string;
  totalDurationMs: number;
  citationCount: number;
  events: DebugEvent[];
}

interface ConversationResponse {
  id: string;
}

/**
 * Encapsulates all OpenAI / AI Foundry operations:
 * conversation creation, streaming responses, citation processing.
 */
export class AgentService {

  private _project: AIProjectClient;
  private _agentName: string;
  private _actionIdsToSkip: Set<string>;
  private _agentType: string | undefined;

  private static readonly MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  private static readonly MAX_LINK_BUFFER_SIZE = 500;
  private static readonly LINK_BUFFER_KEEP_SIZE = 100;
  private static readonly LINK_START_THRESHOLD = 50;

  private _linkBuffer: string = '';
  private _collectedCitations: Citation[] = [];
  private _skipContent: boolean = false;
  private _mcpInProgress: boolean = false;
  private _fullResponseText: string = '';

  // Debug collection state
  private _debugEvents: DebugEvent[] = [];
  private _debugSeq: number = 0;
  private _streamStartTime: number = 0;
  private _lastDebugInfo: DebugInfo | undefined;

  constructor(project: AIProjectClient, agentName: string) {
    this._project = project;
    this._agentName = agentName;
    this._actionIdsToSkip = new Set(['router-agent-node']);
  }

  /**
   * Create a new conversation with the agent.
   */
  async createConversation(inputQuery: string): Promise<ConversationResponse> {

    const items: any[] = [{
      type: "message",
      role: "user",
      content: inputQuery
    }];

    console.log(`[API] Creating conversation`);

    const client = await this._project.getOpenAIClient();
    const conversation = await client.conversations.create({
      items,
      metadata: { agent: this._agentName }
    });

    console.log(`[API] Conversation created successfully`);
    return conversation;
  }

  /**
   * Invoke the agent with streaming and return an AgentStreamResult.
   * This method does NOT manage dialog state — it only processes the stream
   * and returns the result for the caller to handle.
   *
   * @param extraBodyItems Optional array of extra body items (e.g. mcp_approval_response)
   *                       to include in the request input sent to the agent.
   * @param previousResponseId When resuming after an approval decision, pass the
   *                           response ID that contained the mcp_approval_request.
   *                           This avoids replaying the full conversation history
   *                           (which would re-trigger approval requests in a loop).
   * @param debugMode When true, a debug Adaptive Card is attached to the final
   *                  streaming chunk via `setAttachments`.
   */
  async invokeAgentStreaming(
    inputQuery: string,
    conversationId: string | null,
    context: TurnContext,
    previousResponseId?: string,
    extraBodyItems?: any[],
    debugMode: boolean = false
  ): Promise<AgentStreamResult> {

    const client = await this._project.getOpenAIClient();

    // Resolve agent type once and cache — it won't change between invocations
    if (!this._agentType) {
      const agent = await this._project.agents.get(this._agentName);
      this._agentType = (agent as any).type ?? 'unknown';
      console.log(`[AGENT] Agent type resolved: ${this._agentType}`);
    }

    // Build the input:
    // - Normal flow: the user's text query
    // - Approval resume: only the mcp_approval_response item(s). The original
    //   user message is already in the conversation history so we don't re-send it.
    const input: any = (extraBodyItems && extraBodyItems.length > 0)
      ? extraBodyItems
      : inputQuery;

    const streamConfig: any = {
      input,
      stream: true
    };

    // Use previous_response_id for approval flow to avoid replaying the full
    // conversation history (which includes the mcp_approval_request and would
    // cause an infinite approval loop). For all other flows use conversation.
    if (previousResponseId) {
      console.log(`[STREAM] Using previous_response_id: ${previousResponseId}`);
      streamConfig.previous_response_id = previousResponseId;
    } else if (conversationId) {
      console.log(`[STREAM] Using conversation: ${conversationId}`);
      streamConfig.conversation = conversationId;
    }

    const responseStream = client.responses.stream(streamConfig, {
      body: {
        agent: {
          type: "agent_reference",
          name: this._agentName
        }
      }
    });

    // Start debug timing
    this._streamStartTime = Date.now();
    this.recordDebugEvent('stream.start', 'Stream started', {
      inputQuery,
      conversationId,
      previousResponseId,
      hasExtraBodyItems: !!(extraBodyItems && extraBodyItems.length > 0)
    });

    // Process streaming events as they arrive
    let currentResponseId: string | undefined;
    for await (const event of responseStream) {

      console.log(`event type: '${event.type}' with item type '${(event as any).item?.type}'`);

      if (event.type === "response.created") {
        currentResponseId = event.response.id;
        console.log(`Stream response created with ID: ${currentResponseId}`);
        this.recordDebugEvent('response.created', `Response created: ${currentResponseId}`, {
          responseId: currentResponseId,
          model: (event.response as any).model,
          status: (event.response as any).status,
        });
      }
      else if (event.type === "response.output_item.done") {
        const item = (event.item as any);
        // MCP Server auth — return AgentStreamResult so the caller can handle it
        if (item?.type === "oauth_consent_request") {
          const consentLink = item.consent_link;
          if (consentLink) {
            console.log(`[AUTH] oauth_consent_request received, response_id: ${conversationId}`);
            this.recordDebugEvent('oauth_consent_request', 'OAuth consent required', {
              consentLink,
              ...this.summarizeEventItem(item),
            });

            return {
              auth: {
                consentLink,
                conversationId: conversationId!,
                inputQuery
              }
            };
          }
        }
        // Generic output_item.done — capture item summary
        this.recordDebugEvent('response.output_item.done', `Output item done: ${item?.type ?? 'unknown'}`, {
          ...this.summarizeEventItem(item),
        });
      }
      else if (event.type === "response.output_item.added") {

        // Check if this is a workflow action with an action_id to filter
        const item = (event as any).item;
        if (item?.type === "workflow_action" && item?.action_id) {
          const actionId = item.action_id;
          console.log(`[ACTION] Workflow action detected: ${actionId}`);
          const skipped = this._actionIdsToSkip.has(actionId);
          this.recordDebugEvent('workflow_action', `Workflow action: ${actionId}${skipped ? ' (skipped)' : ''}`, {
            actionId,
            skipped,
            ...this.summarizeEventItem(item),
          });

          if (skipped) {
            console.log(`[ACTION] Skipping content for action_id: ${actionId}`);
            this._skipContent = true;
          } else {
            console.log(`[ACTION] Allowing content for action_id: ${actionId}`);
            this._skipContent = false;
          }
        } else if (item?.type === "mcp_approval_request") {
          const approvalId = item.id as string;
          const toolName = item.name as string;
          const toolArgs = item.arguments as string;
          const serverLabel = item.server_label as string;
          console.log(`[APPROVAL] mcp_approval_request received: tool=${toolName}, server=${serverLabel}, id=${approvalId}`);
          this.recordDebugEvent('mcp_approval_request', `Tool approval required: ${toolName} on ${serverLabel}`, {
            approvalId,
            toolName,
            toolArgs,
            serverLabel,
            ...this.summarizeEventItem(item),
          });

          return {
            approval: {
              McpToolApprovalRequestId: approvalId,
              toolName,
              toolArguments: toolArgs,
              serverLabel,
              conversationId: conversationId!,
              inputQuery,
              responseId: currentResponseId!
            }
          };
        } else {
          // Generic output_item.added — capture item summary
          this.recordDebugEvent('response.output_item.added', `Output item added: ${item?.type ?? 'unknown'}`, {
            ...this.summarizeEventItem(item),
          });
        }
      }
      else if (event.type === "response.output_text.delta") {

        // Skip content if we're in a filtered action
        if (this._skipContent) {
          continue;
        }

        // Process delta with link detection and send to Teams
        if (event.delta && context) {
          await this.processAndStreamText(event.delta, context);
        }
      }
      else if (event.type === "response.output_text.done") {

        // Skip content if we're in a filtered action
        if (this._skipContent) {
          console.log(`[STREAM] Skipping output_text.done due to filtered action`);
          this.recordDebugEvent('response.output_text.done', 'Text done (skipped — filtered action)', {
            textLength: event.text?.length ?? 0,
          });
          continue;
        }

        // Accumulate the full response text to detect markers like SUBMIT_ISSUE
        if (event.text) {
          this._fullResponseText += event.text;
        }

        console.log(`Response text done: ${event.text?.substring(0, 100)}...`);
        this.recordDebugEvent('response.output_text.done', `Text done (${event.text?.length ?? 0} chars)`, {
          textLength: event.text?.length ?? 0,
          textPreview: event.text?.substring(0, 300) ?? '',
        });

        // Only flush remaining buffer — strip SUBMIT_ISSUE marker if present
        if (context && this._linkBuffer) {
          // Remove the SUBMIT_ISSUE marker so it's never shown to the user
          this._linkBuffer = this._linkBuffer.replace(/\s*SUBMIT_ISSUE\s*$/, '');
          if (this._linkBuffer) {
            // Run through link detection so citations are properly collected
            await this.processAndStreamText(this._linkBuffer, context, true);
          }
          this._linkBuffer = '';
        }

      }
      else if (event.type === "response.completed") {
        console.log(`Response completed`);

        const lastOutput = event.response.output[event.response.output.length - 1];

        // Workflow agents must end with EndConversation — anything else is abnormal.
        // For non-workflow agents, skip this check and continue the flow normally.
        if (this._agentType === 'workflow' && lastOutput?.["kind"] !== 'EndConversation') {
          const outputType = lastOutput?.type ?? lastOutput?.["kind"] ?? 'unknown';
          console.warn(`[STREAM] Abnormal completion — last output kind: ${outputType}`);
          this.recordDebugEvent('response.completed', `Abnormal completion (last output: ${outputType})`, {
            lastOutputType: outputType,
            outputCount: event.response.output?.length ?? 0,
            outputTypes: event.response.output?.map((o: any) => o.type ?? o["kind"] ?? 'unknown'),
            usage: (event.response as any).usage,
          });

          await context.streamingResponse.queueTextChunk(
            `Sorry, something went wrong while generating the response. The agent did not produce a final message.`
          );
        } else {
          this.recordDebugEvent('response.completed', 'Response completed', {
            outputCount: event.response.output?.length ?? 0,
            outputTypes: event.response.output?.map((o: any) => o.type ?? o["kind"] ?? 'unknown'),
            usage: (event.response as any).usage,
          });
        }

    
      }
      else if (event.type === "response.failed") {

        const error = JSON.stringify(event.response.error);
        this.recordDebugEvent('response.failed', `Response failed: ${error}`, {
          error,
          status: (event.response as any).status,
          responseId: event.response.id,
        });
        await context.streamingResponse.queueTextChunk(`Sorry, something went wrong while generating the response: \n${error}`);
        console.error(`Response failed: ${error}`);

        throw new Error(`Response generation failed: ${error}`);
      }
      else if (event.type.startsWith('response.mcp_')) {
        // MCP tool execution events (e.g. mcp_call.in_progress, mcp_call.completed,
        // mcp_list_tools.in_progress, mcp_list_tools.completed, etc.)
        const item = (event as any).item;
        const toolName = item?.name ?? item?.tool_name;

        // Build rich detail for MCP events including arguments and output
        const mcpDetail = this.buildMcpEventDetail(item);

        // Send an informative update the first time we enter an MCP call
        if (!this._mcpInProgress) {
          this._mcpInProgress = true;
          const label = toolName ? `🔍 Fetching data using MCP tool "${toolName}"...` : '🔍 Fetching data using MCP tools...';
          console.log(`[MCP] ${label}`);
          await context.streamingResponse.queueInformativeUpdate(label);
        }

        this.recordDebugEvent(event.type, `${event.type}${toolName ? ` (${toolName})` : ''}`, mcpDetail);

        // Clear the flag when the MCP call finishes
        if (event.type.endsWith('.completed') || event.type.endsWith('.failed')) {
          this._mcpInProgress = false;
        }
      } else {
        const item = (event as any).item;
        const itemSummary = this.summarizeEventItem(item);
        console.log(`Received unhandled event type: ${event.type}`);
        this.recordDebugEvent(event.type, `Event: ${event.type}${item?.type ? ` (item: ${item.type})` : ''}`, itemSummary);
      }
    }

    // No auth or approval was needed — finalize the stream normally
    // Snapshot debug info before finalization resets state
    const streamEndedAt = new Date().toISOString();
    this._lastDebugInfo = {
      inputQuery,
      conversationId,
      previousResponseId,
      responseId: currentResponseId,
      streamStartedAt: new Date(this._streamStartTime).toISOString(),
      streamEndedAt,
      totalDurationMs: Date.now() - this._streamStartTime,
      citationCount: this._collectedCitations.length,
      events: [...this._debugEvents]
    };

    // Build debug card attachment if debug mode is enabled
    const debugAttachment = debugMode
      ? AdaptiveCardHelper.buildDebugCardAttachment(this._lastDebugInfo)
      : undefined;

    await this.finalizeStream(context, debugAttachment ? [debugAttachment] : undefined);

    // Check if the agent's response ends with the SUBMIT_ISSUE marker.
    // If so, we need to show a ticket form to the user instead of completing normally.
    const trimmedResponse = this._fullResponseText.trim();
    if (trimmedResponse.endsWith('SUBMIT_ISSUE')) {
      console.log('[STREAM] Detected SUBMIT_ISSUE marker — returning ticketForm result');
      this.recordDebugEvent('submit_issue_detected', 'SUBMIT_ISSUE marker detected in response text');

      return {
        ticketForm: {
          conversationId: conversationId!,
          inputQuery,
        }
      };
    }

    return {};
  }

  /**
   * Reset internal streaming state before each invocation.
   */
  resetStreamingState(): void {
    this._linkBuffer = '';
    this._collectedCitations = [];
    this._skipContent = false;
    this._mcpInProgress = false;
    this._fullResponseText = '';
    this._debugEvents = [];
    this._debugSeq = 0;
    this._streamStartTime = 0;
    this._lastDebugInfo = undefined;
  }

  /**
   * Returns the debug info collected during the last completed stream invocation.
   */
  get lastDebugInfo(): DebugInfo | undefined {
    return this._lastDebugInfo;
  }

  /**
   * Build a rich detail record for MCP-related events.
   * Unlike the generic `summarizeEventItem`, this preserves the full `arguments`
   * (parsed as JSON when possible) and the full `output` so they appear
   * in the debug card without truncation.
   */
  private buildMcpEventDetail(item: any): Record<string, any> | undefined {
    if (!item || typeof item !== 'object') return undefined;

    const detail: Record<string, any> = {};

    // Scalar identifiers
    if (item.id) detail.id = item.id;
    if (item.type) detail.type = item.type;
    if (item.name) detail.toolName = item.name;
    if (item.tool_name) detail.toolName = item.tool_name;
    if (item.server_label) detail.serverLabel = item.server_label;
    if (item.status) detail.status = item.status;

    // Tool call arguments — parse JSON string into object for structured display
    if (item.arguments) {
      try {
        detail.arguments = typeof item.arguments === 'string'
          ? JSON.parse(item.arguments)
          : item.arguments;
      } catch {
        detail.arguments = item.arguments;
      }
    }

    // Tool output / result — keep full content for inspection
    if (item.output) {
      try {
        detail.output = typeof item.output === 'string'
          ? JSON.parse(item.output)
          : item.output;
      } catch {
        detail.output = item.output;
      }
    }

    // Error information if present
    if (item.error) detail.error = item.error;

    return Object.keys(detail).length > 0 ? detail : undefined;
  }

  /**
   * Extract a user-friendly summary of an event item for debug display.
   * Keeps scalar fields, truncates long strings, and omits internal noise.
   */
  private summarizeEventItem(item: any): Record<string, any> | undefined {
    if (!item || typeof item !== 'object') return undefined;

    const MAX_STR = 300;
    const truncate = (s: string) => s.length > MAX_STR ? s.substring(0, MAX_STR) + '…' : s;

    const summary: Record<string, any> = {};
    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) continue;
      // Skip noisy internal arrays that are better inspected elsewhere
      if (key === 'content' && Array.isArray(value)) {
        summary[key] = `[${value.length} item(s)]`;
        continue;
      }
      if (typeof value === 'string') {
        summary[key] = truncate(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        summary[key] = value;
      } else if (Array.isArray(value)) {
        summary[key] = `[${value.length} item(s)]`;
      } else if (typeof value === 'object') {
        // Keep shallow objects as-is; deeply nested will be JSON-rendered by the card
        summary[key] = value;
      }
    }
    return Object.keys(summary).length > 0 ? summary : undefined;
  }

  /** Record a debug event with automatic sequencing and timing. */
  private recordDebugEvent(eventType: string, summary: string, detail?: Record<string, any>): void {
    this._debugSeq++;
    this._debugEvents.push({
      seq: this._debugSeq,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - this._streamStartTime,
      eventType,
      summary,
      ...(detail ? { detail } : {})
    });
  }

  //#region Streaming helpers

  private async processAndStreamText(text: string, context: TurnContext, flushBuffer: boolean = false): Promise<void> {

    const processedContent = this.processContentWithLinkDetection(text);
    if (processedContent) {
      console.log(`[STREAM] Sending chunk: "${processedContent.substring(0, 100)}${processedContent.length > 100 ? '...' : ''}"`);
      await context.streamingResponse.queueTextChunk(processedContent);
    }

    // Flush any remaining buffer content if requested
    if (flushBuffer && this._linkBuffer) {
      console.log(`[STREAM] Flushing remaining buffer: "${this._linkBuffer}"`);
      await context.streamingResponse.queueTextChunk(this._linkBuffer);
      this._linkBuffer = '';
    }
  }

  private processContentWithLinkDetection(content: string): string {
    this._linkBuffer += content;
    let outputContent = '';

    const linkPattern = AgentService.MARKDOWN_LINK_PATTERN;
    linkPattern.lastIndex = 0;

    let lastMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(this._linkBuffer)) !== null) {
      const startPos = lastMatch
        ? lastMatch.index + lastMatch[0].length
        : 0;
      outputContent += this._linkBuffer.substring(startPos, match.index);

      const linkText = match[1];
      const linkUrl = match[2].trim();

      this._collectedCitations.push({
        title: linkText,
        url: linkUrl,
        content: linkText,
        filepath: linkUrl
      } as Citation);

      const citationNumber = this._collectedCitations.length;
      console.log(`[CITATION] Added citation ${citationNumber}: ${linkText} -> ${linkUrl}`);
      outputContent += `${linkText}[${citationNumber}]`;
      lastMatch = match;
    }

    if (lastMatch !== null) {
      const remainingContent = this._linkBuffer.substring(lastMatch.index + lastMatch[0].length);
      const lastBracketIndex = remainingContent.lastIndexOf('[');

      if (lastBracketIndex !== -1 && lastBracketIndex > remainingContent.length - AgentService.LINK_START_THRESHOLD) {
        outputContent += remainingContent.substring(0, lastBracketIndex);
        this._linkBuffer = remainingContent.substring(lastBracketIndex);
      } else {
        outputContent += remainingContent;
        this._linkBuffer = '';
      }
    } else if (this._linkBuffer.length > AgentService.MAX_LINK_BUFFER_SIZE) {
      const lastBracketIndex = this._linkBuffer.lastIndexOf('[');
      if (lastBracketIndex > AgentService.LINK_BUFFER_KEEP_SIZE) {
        outputContent = this._linkBuffer.substring(0, lastBracketIndex);
        this._linkBuffer = this._linkBuffer.substring(lastBracketIndex);
      } else {
        outputContent = this._linkBuffer.substring(0, this._linkBuffer.length - AgentService.LINK_BUFFER_KEEP_SIZE);
        this._linkBuffer = this._linkBuffer.substring(this._linkBuffer.length - AgentService.LINK_BUFFER_KEEP_SIZE);
      }
    }

    return outputContent;
  }

  private async finalizeStream(context: TurnContext, attachments?: any[]): Promise<void> {
    if (this._collectedCitations.length > 0) {
      console.log(`[CITATION] Setting ${this._collectedCitations.length} citations`);
      await context.streamingResponse.setCitations(this._collectedCitations);
    }

    if (attachments && attachments.length > 0) {
      console.log(`[STREAM] Setting ${attachments.length} attachment(s) on final message`);
      context.streamingResponse.setAttachments(attachments);
    }

    await context.streamingResponse.endStream();

    // Reset streaming state but preserve _lastDebugInfo so the caller can read it
    this._linkBuffer = '';
    this._collectedCitations = [];
    this._skipContent = false;
    this._mcpInProgress = false;
    this._debugEvents = [];
    this._debugSeq = 0;
    this._streamStartTime = 0;
  }

  //#endregion
}
