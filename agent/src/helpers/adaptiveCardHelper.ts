import { TurnContext } from "@microsoft/agents-hosting";
import { Activity, ActivityTypes } from "@microsoft/agents-activity";
import { DebugInfo, DebugEvent } from "../services/agentService";
import { getDisclaimerContent } from "../constants/disclaimers";

/** Actions sent via Adaptive Card Action.Submit buttons. */
export enum CardAction {
  AuthCompleted = 'auth_completed',
  ToolApproved = 'mcp_tool_approved',
  ToolDenied = 'mcp_tool_denied',
  TicketFormSubmitted = 'ticket_form_submitted',
}

/** Payload returned by the Auth card "Continue" button. */
export interface AuthCardData {
  action: CardAction.AuthCompleted;
  conversation_id: string;
  inputQuery: string;
}

/** Payload returned by the Approval card "Approve" / "Deny" buttons. */
export interface ApprovalCardData {
  action: CardAction.ToolApproved | CardAction.ToolDenied;
  approval_request_id: string;
  conversation_id: string;
  inputQuery: string;
  response_id: string;
  tool_name: string;
  tool_arguments: string;
  server_label: string;
}

/** Payload returned by the IT ticket form card "Submit Ticket" button. */
export interface TicketFormCardData {
  action: CardAction.TicketFormSubmitted;
  conversation_id: string;
  inputQuery: string;
  /** User-provided form values */
  subject: string;
  details: string;
  severity: string;
}

/** Parameters for sending the auth card. */
export interface SendAuthCardParams {
  consentLink: string;
  conversationId: string;
  inputQuery: string;
}

/** Parameters for sending the approval card. */
export interface SendApprovalCardParams {
  mcpToolApprovalRequestId: string;
  toolName: string;
  toolArguments: string;
  serverLabel: string;
  conversationId: string;
  inputQuery: string;
  responseId: string;
}

/** Parameters for updating the approval card with a decision. */
export interface UpdateApprovalCardParams {
  approved: boolean;
  toolName: string;
  toolArguments: string;
  serverLabel: string;
}

/** Parameters for sending the IT ticket form card. */
export interface SendTicketFormCardParams {
  conversationId: string;
  inputQuery: string;
}

/**
 * Helper class that builds and sends all Adaptive Cards used by the agent dialog.
 */
export class AdaptiveCardHelper {

  /**
   * Sends an Adaptive Card with "Sign In" and "Continue" buttons.
   */
  static async sendAuthCard(context: TurnContext, params: SendAuthCardParams): Promise<void> {
    const { consentLink, conversationId, inputQuery } = params;
    const authCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: 'Authentication Required',
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'TextBlock',
            text: 'Please click "Sign In" to open the authentication page in a new window. After completing authentication, return here and click "Continue".',
            wrap: true
          }
        ],
        actions: [
          {
            type: 'Action.OpenUrl',
            title: 'Sign In',
            url: consentLink
          },
          {
            type: 'Action.Submit',
            title: 'Continue',
            data: {
              action: CardAction.AuthCompleted,
              conversation_id: conversationId,
              inputQuery: inputQuery
            } as AuthCardData
          }
        ]
      }
    };

    const message = {
      type: ActivityTypes.Message,
      text: 'Authentication required to proceed.',
      attachments: [authCard],
      entities: [
        {
          type: "https://schema.org/Message",
          "@type": "Message",
          "@context": "https://schema.org",
          "@id": "",
          additionalType: ["AIGeneratedContent"]
        },
      ],
    };

    await context.sendActivity(message as any);
  }

  /**
   * Sends an Adaptive Card showing the tool invocation details with "Approve" and "Deny" buttons.
   */
  static async sendApprovalCard(context: TurnContext, params: SendApprovalCardParams): Promise<void> {
    const { mcpToolApprovalRequestId, toolName, toolArguments, serverLabel, conversationId, inputQuery, responseId } = params;
    const formattedArgs = AdaptiveCardHelper.formatArguments(toolArguments);

    const approvalCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: 'Tool Approval Required',
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'TextBlock',
            text: `The MCP server **${serverLabel}** is requesting permission to run a tool.`,
            wrap: true
          },
          {
            type: 'FactSet',
            facts: [
              { title: 'Tool', value: toolName },
              { title: 'Server', value: serverLabel }
            ]
          },
          {
            type: 'TextBlock',
            text: 'Arguments:',
            weight: 'bolder',
            spacing: 'medium'
          },
          {
            type: 'TextBlock',
            text: formattedArgs,
            wrap: true,
            fontType: 'monospace',
            size: 'small'
          }
        ],
        actions: [
          {
            type: 'Action.Submit',
            title: 'Approve',
            style: 'positive',
            data: {
              action: CardAction.ToolApproved,
              approval_request_id: mcpToolApprovalRequestId,
              conversation_id: conversationId,
              inputQuery: inputQuery,
              response_id: responseId,
              tool_name: toolName,
              tool_arguments: toolArguments,
              server_label: serverLabel
            } as ApprovalCardData
          },
          {
            type: 'Action.Submit',
            title: 'Deny',
            style: 'destructive',
            data: {
              action: CardAction.ToolDenied,
              approval_request_id: mcpToolApprovalRequestId,
              conversation_id: conversationId,
              inputQuery: inputQuery,
              response_id: responseId,
              tool_name: toolName,
              tool_arguments: toolArguments,
              server_label: serverLabel
            } as ApprovalCardData
          }
        ]
      }
    };

    const message = {
      type: ActivityTypes.Message,
      text: 'Tool approval required to proceed.',
      attachments: [approvalCard],
      entities: [
        {
          type: "https://schema.org/Message",
          "@type": "Message",
          "@context": "https://schema.org",
          "@id": "",
          additionalType: ["AIGeneratedContent"]
        },
      ],
    };

    await context.sendActivity(message as any);
  }

  /**
   * Sends an Adaptive Card form for the user to fill in IT ticket details
   * (Subject, Details, Severity) instead of having the LLM guess the values.
   */
  static async sendTicketFormCard(context: TurnContext, params: SendTicketFormCardParams): Promise<void> {
    const { conversationId, inputQuery } = params;

    const ticketFormCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.5',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: '🎫 Submit an IT Ticket',
            weight: 'bolder',
            size: 'large',
          },
          {
            type: 'TextBlock',
            text: 'Please fill in the details below to create a new IT support ticket.',
            wrap: true,
          },
          {
            type: 'TextBlock',
            text: 'Subject',
            weight: 'bolder',
            spacing: 'medium',
          },
          {
            type: 'Input.Text',
            id: 'subject',
            placeholder: 'Brief summary of the issue',
            isRequired: true,
            errorMessage: 'Subject is required.',
          },
          {
            type: 'TextBlock',
            text: 'Details',
            weight: 'bolder',
            spacing: 'medium',
          },
          {
            type: 'Input.Text',
            id: 'details',
            placeholder: 'Describe the problem in detail',
            isMultiline: true,
            isRequired: true,
            errorMessage: 'Details are required.',
          },
          {
            type: 'TextBlock',
            text: 'Severity',
            weight: 'bolder',
            spacing: 'medium',
          },
          {
            type: 'Input.ChoiceSet',
            id: 'severity',
            style: 'compact',
            isRequired: true,
            errorMessage: 'Please select a severity level.',
            choices: [
              { title: '🔴 Critical', value: 'Critical' },
              { title: '🟡 Medium', value: 'Medium' },
              { title: '🟢 Low', value: 'Low' },
            ],
          },
        ],
        actions: [
          {
            type: 'Action.Submit',
            title: 'Submit Ticket',
            style: 'positive',
            data: {
              action: CardAction.TicketFormSubmitted,
              conversation_id: conversationId,
              inputQuery: inputQuery,
            },
          },
        ],
      },
    };

    const message = {
      type: ActivityTypes.Message,
      attachments: [ticketFormCard],
      entities: [
        {
          type: "https://schema.org/Message",
          "@type": "Message",
          "@context": "https://schema.org",
          "@id": "",
          additionalType: ["AIGeneratedContent"],
        },
      ],
    };

    await context.sendActivity(message as any);
  }

  /**
   * Replaces the approval Adaptive Card with a read-only version showing the
   * user's decision (Approved / Denied). This disables further interaction.
   */
  static async updateApprovalCardWithDecision(context: TurnContext, params: UpdateApprovalCardParams): Promise<void> {
    const { approved, toolName, toolArguments, serverLabel } = params;
    const statusText = approved ? '✅ Approved' : '❌ Denied';
    const statusColor = approved ? 'good' : 'attention';
    const formattedArgs = AdaptiveCardHelper.formatArguments(toolArguments);

    const updatedCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.5',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: 'Tool Approval',
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'TextBlock',
            text: `Decision: **${statusText}**`,
            wrap: true,
            color: statusColor
          },
          {
            type: 'FactSet',
            facts: [
              { title: 'Tool', value: toolName },
              { title: 'Server', value: serverLabel }
            ]
          },
          {
            type: 'TextBlock',
            text: 'Arguments:',
            weight: 'bolder',
            spacing: 'medium'
          },
          {
            type: 'TextBlock',
            text: formattedArgs,
            wrap: true,
            fontType: 'monospace',
            size: 'small'
          }
        ]
      }
    };

    const updatedActivity = Activity.fromObject({
      type: ActivityTypes.Message,
      id: context.activity.replyToId,
      attachments: [updatedCard]
    });

    await context.updateActivity(updatedActivity);
  }

  /**
   * Try to pretty-print tool arguments JSON; fall back to raw string.
   */
  private static formatArguments(toolArguments: string): string {
    try {
      return JSON.stringify(JSON.parse(toolArguments), null, 2);
    } catch {
      return toolArguments;
    }
  }

  /** Map event types to emoji icons for the timeline. */
  private static eventIcon(eventType: string): string {
    const icons: Record<string, string> = {
      'stream.start': '🚀',
      'response.created': '📝',
      'response.completed': '✅',
      'response.failed': '❌',
      'oauth_consent_request': '🔑',
      'mcp_approval_request': '🛡️',
      'workflow_action': '⚙️',
      'response.output_item.added': '➕',
      'response.output_item.done': '📦',
      'response.output_text.done': '💬',
    };
    if (icons[eventType]) return icons[eventType];
    // MCP tool execution events
    if (eventType.startsWith('response.mcp_')) return '🔌';
    return '📌';
  }

  /**
   * Render a `Record<string, any>` detail object as Adaptive Card body elements.
   * Flat string/number/boolean values become a FactSet; nested objects render
   * as monospace JSON blocks — giving a clean tree-view feel.
   */
  private static buildDetailElements(detail: Record<string, any>): any[] {
    const facts: { title: string; value: string }[] = [];
    const complexBlocks: any[] = [];

    for (const [key, value] of Object.entries(detail)) {
      if (value === null || value === undefined) {
        facts.push({ title: key, value: 'null' });
      } else if (typeof value === 'object') {
        complexBlocks.push({
          type: 'Container',
          spacing: 'small',
          items: [
            {
              type: 'TextBlock',
              text: `**${key}**`,
              size: 'small',
              weight: 'bolder',
            },
            {
              type: 'TextBlock',
              text: JSON.stringify(value, null, 2),
              wrap: true,
              fontType: 'monospace',
              size: 'small',
            },
          ],
        });
      } else {
        const display = typeof value === 'string' && value.length > 200
          ? AdaptiveCardHelper.truncate(String(value), 200)
          : String(value);
        facts.push({ title: key, value: display });
      }
    }

    const elements: any[] = [];
    if (facts.length > 0) {
      elements.push({ type: 'FactSet', facts });
    }
    elements.push(...complexBlocks);
    return elements;
  }

  /**
   * Builds an Adaptive Card attachment containing debug information about the agent invocation.
   * Uses Action.ShowCard so the debug detail is collapsed by default.
   * Each timeline event is expandable — events with detail data show a nested
   * card with a FactSet / formatted JSON when clicked.
   *
   * @returns The card as an Attachment object suitable for `setAttachments` or `sendActivity`.
   */
  static buildDebugCardAttachment(debugInfo: DebugInfo): any {

    // Build collapsible timeline items — each event is its own ActionSet
    const timelineItems: any[] = debugInfo.events.map((evt: DebugEvent) => {
      const icon = AdaptiveCardHelper.eventIcon(evt.eventType);
      const headerText = `${icon}  \`#${evt.seq}\`  **+${evt.elapsedMs}ms** — ${evt.summary}`;

      // Events WITHOUT detail — plain text row
      if (!evt.detail) {
        return {
          type: 'TextBlock',
          text: headerText,
          size: 'small',
          wrap: true,
          spacing: 'small',
          separator: evt.seq > 1,
        };
      }

      // Events WITH detail — expandable via Action.ShowCard
      return {
        type: 'ActionSet',
        spacing: 'small',
        actions: [
          {
            type: 'Action.ShowCard',
            title: `${icon}  #${evt.seq}  +${evt.elapsedMs}ms — ${evt.summary}`,
            style: 'positive',
            card: {
              type: 'AdaptiveCard',
              body: AdaptiveCardHelper.buildDetailElements(evt.detail),
            }
          }
        ]
      };
    });

    const debugCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.5',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: '🐛 Debug Information',
            weight: 'bolder',
            size: 'medium'
          },
          {
            type: 'TextBlock',
            text: '_Debug mode is on. Send `/debug off` to disable._',
            size: 'small',
            isSubtle: true,
            wrap: true
          }
        ],
        actions: [
          // --- Overview section (collapsed) ---
          {
            type: 'Action.ShowCard',
            title: '📋 Overview',
            card: {
              type: 'AdaptiveCard',
              body: [
                {
                  type: 'FactSet',
                  facts: [
                    { title: 'Input', value: AdaptiveCardHelper.truncate(debugInfo.inputQuery, 120) },
                    { title: 'Conversation ID', value: debugInfo.conversationId ?? '(new)' },
                    ...(debugInfo.previousResponseId ? [{ title: 'Previous Response ID', value: debugInfo.previousResponseId }] : []),
                    { title: 'Response ID', value: debugInfo.responseId ?? 'N/A' },
                    { title: 'Duration', value: `${debugInfo.totalDurationMs}ms` },
                    { title: 'Citations', value: String(debugInfo.citationCount) },
                    { title: 'Events', value: String(debugInfo.events.length) }
                  ]
                }
              ]
            }
          },
          // --- Timeline section (collapsed, tree-view with expandable events) ---
          {
            type: 'Action.ShowCard',
            title: `⏱️ Event Timeline (${debugInfo.events.length})`,
            card: {
              type: 'AdaptiveCard',
              body: [
                // Timeline events
                ...(timelineItems.length > 0
                  ? timelineItems
                  : [{
                      type: 'TextBlock',
                      text: 'No events recorded.',
                      isSubtle: true,
                      size: 'small'
                    }])
              ]
            }
          },
          // --- Reset Conversation button — posts "/reset" as user message to reuse existing handler ---
          {
            type: 'Action.Submit',
            title: '🔄 Reset Conversation',
            data: {
              msteams: {
                type: 'imBack',
                value: '/reset',
              },
            },
          }
        ]
      }
    };

    return debugCard;
  }

  /**
   * Sends a one-time disclaimer Adaptive Card for the given locale.
   * Uses the same pattern as sendAuthCard / sendApprovalCard.
   */
  static async sendDisclaimerCard(context: TurnContext, locale?: string | null): Promise<void> {
    const content = getDisclaimerContent(locale);

    const disclaimerCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.5',
        msTeams: { width: 'Full' },
        body: [
          {
            type: 'TextBlock',
            text: content.title,
            weight: 'bolder',
            size: 'large',
            wrap: true,
          },
          {
            type: 'ColumnSet',
            separator: true,
            spacing: 'medium',
            columns: [
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'Container',
                    style: 'warning',
                    bleed: true,
                    spacing: 'small',
                    items: [
                      {
                        type: 'TextBlock',
                        text: content.aiAccuracyTitle,
                        weight: 'bolder',
                        size: 'medium',
                        wrap: true,
                      },
                      {
                        type: 'TextBlock',
                        text: content.aiAccuracyBody,
                        wrap: true,
                        size: 'small',
                      },
                    ],
                  },
                  {
                    type: 'Container',
                    style: 'accent',
                    bleed: true,
                    spacing: 'small',
                    items: [
                      {
                        type: 'TextBlock',
                        text: content.dataPrivacyTitle,
                        weight: 'bolder',
                        size: 'medium',
                        wrap: true,
                      },
                      {
                        type: 'TextBlock',
                        text: content.dataPrivacyBody,
                        wrap: true,
                        size: 'small',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'TextBlock',
            text: content.acceptance,
            wrap: true,
            size: 'small',
            isSubtle: true,
            spacing: 'medium',
            horizontalAlignment: 'center',
          },
        ],
      },
    };

    const message = {
      type: ActivityTypes.Message,
      text: '',
      attachments: [disclaimerCard],
      entities: [
        {
          type: "https://schema.org/Message",
          "@type": "Message",
          "@context": "https://schema.org",
          "@id": "",
          additionalType: ["AIGeneratedContent"]
        },
      ],
    };

    await context.sendActivity(message as any);
  }

  /**
   * Sends an Adaptive Card containing debug information as a standalone message.
   * Convenience wrapper around `buildDebugCardAttachment` for cases where the
   * card cannot be attached to the stream (e.g. non-streaming channels).
   */
  static async sendDebugCard(context: TurnContext, debugInfo: DebugInfo): Promise<void> {
    const debugCard = AdaptiveCardHelper.buildDebugCardAttachment(debugInfo);

    const message = {
      type: ActivityTypes.Message,
      text: 'Debug information for this response.',
      attachments: [debugCard],
      entities: [
        {
          type: "https://schema.org/Message",
          "@type": "Message",
          "@context": "https://schema.org",
          "@id": "",
          additionalType: ["AIGeneratedContent"]
        },
      ],
    };

    await context.sendActivity(message as any);
  }

  /** Truncate a string for display in cards. */
  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
