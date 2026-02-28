import {
  Dialog,
  DialogSet,
  DialogTurnStatus,
  WaterfallDialog,
  ComponentDialog,
  WaterfallStepContext,
  DialogTurnResult,
  DialogContext,
  DialogReason} from "@microsoft/agents-hosting-dialogs";
import {
  AgentStatePropertyAccessor,
  TurnContext,
} from "@microsoft/agents-hosting";
import { ActivityTypes } from "@microsoft/agents-activity";
import { AdaptiveCardHelper, CardAction, AuthCardData, ApprovalCardData, TicketFormCardData } from "../helpers/adaptiveCardHelper";
import { AgentService } from "../services/agentService";

const AGENT_DIALOG = "AGENT_DIALOG";
const MAIN_WATERFALL_DIALOG = "MAIN_WATERFALL_DIALOG";

/** Shape persisted in ConversationState to map channel ↔ agent conversations. */
interface AgentConversationMapping {
  /** The channel-level conversation ID (e.g. Teams thread / Copilot chat). */
  channelConversationId: string;
  /** The AI Foundry agent conversation ID. */
  agentConversationId: string;
  /** Whether the one-time disclaimer has already been shown in this conversation. */
  disclaimerShown?: boolean;
}

/**
 * Main dialog for the agent bot. Every conversation with the bot will be handled by this dialog.
 * 
 * Flow:
 *   1. agentResponseStep – invoke the agent (streaming). If an oauth_consent_request
 *      is received, send an Adaptive Card with "Sign In" + "Continue" and return
 *      EndOfTurn. When the user clicks "Continue", the dialog is resumed (via
 *      onContinueDialog override) and this step runs again with the previous
 *      response_id so the agent can continue. This loop repeats until the agent
 *      stops requesting consent or completes normally.
 */
export class AgentDialog extends ComponentDialog {
  
  private _agentService: AgentService;
  private _agentConversationAccessor: AgentStatePropertyAccessor;

  constructor(agentService: AgentService, agentConversationAccessor: AgentStatePropertyAccessor) {

    super(AGENT_DIALOG);

    this._agentService = agentService;
    this._agentConversationAccessor = agentConversationAccessor;

    this.addDialog(
      new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
        this.agentResponseStep.bind(this),
      ])
    );

    this.initialDialogId = MAIN_WATERFALL_DIALOG;
  }

  async run(context: TurnContext, dialogState: AgentStatePropertyAccessor) {

    const dialogSet = new DialogSet(dialogState);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    let dialogTurnResult = await dialogContext.continueDialog();
    if (dialogTurnResult && dialogTurnResult.status === DialogTurnStatus.empty) {
      dialogTurnResult = await dialogContext.beginDialog(this.id);
    }
  }

  /**
   * Override onContinueDialog to handle Invoke activities (Adaptive Card Action.Submit).
   * The default WaterfallDialog.continueDialog() ignores non-Message activities,
   * so we intercept invokes here and resume the waterfall manually with the
   * auth data from the activity value.
   */
  protected async onContinueDialog(innerDC: DialogContext): Promise<DialogTurnResult> {

    const activity = innerDC.context.activity;

    // Check if this is an Adaptive Card Action.Submit with our action
    if (activity.type === ActivityTypes.Invoke || activity.value) {

      const value = activity.value as AuthCardData | ApprovalCardData | TicketFormCardData;

      if (value?.action === CardAction.AuthCompleted || value?.action === CardAction.ToolApproved || value?.action === CardAction.ToolDenied || value?.action === CardAction.TicketFormSubmitted) {
        console.log(`[DIALOG] Received ${value.action} invoke, resuming waterfall`);

        // Replace the approval card with a read-only version showing the decision
        // The updateActivity doesn'T work for Copilot channel for now :/
        if ((value.action === CardAction.ToolApproved || value.action === CardAction.ToolDenied) && (innerDC.context.activity.channelData?.productContext  != 'COPILOT')) {
          const approved = value.action === CardAction.ToolApproved;
          await AdaptiveCardHelper.updateApprovalCardWithDecision(
            innerDC.context,
            {
              approved,
              toolName: value.tool_name,
              toolArguments: value.tool_arguments,
              serverLabel: value.server_label
            }
          );
        }
        
        // Get the active waterfall dialog instance
        const instance = innerDC.activeDialog;
        if (instance) {
          const dialog = innerDC.findDialog(instance.id);

          if (dialog) {
            // WaterfallDialog.resumeDialog calls runStep(stepIndex + 1).
            // We want to re-enter the SAME step (agentResponseStep, index 0),
            // so we set stepIndex to -1 so that -1 + 1 = 0.
            instance.state.stepIndex = -1;
            
            // Resume the waterfall with the action data as result
            return await dialog.resumeDialog(innerDC, DialogReason.nextCalled, value);
          }
        }
      }
    }

    // Default behavior for Message activities
    return await innerDC.continueDialog();
  }

  //#region Dialog steps

  /**
   * Process the user input and invoke the agent to get a response.
   * 
   * This step handles the full oauth consent loop:
   * - Invokes the agent with streaming
   * - If the agent returns an oauth_consent_request, sends an auth card and
   *   returns EndOfTurn to wait for the user
   * - When the user clicks "Continue", onContinueDialog resumes this step
   *   with the auth data as stepContext.result
   * - The step detects the auth data and re-invokes the agent with
   *   previous_response_id, repeating until no more consent is needed
   * - On normal completion, finalizes the stream and ends the dialog
   */
  public async agentResponseStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {

      const context: TurnContext = stepContext.context;

      // Check if we're resuming after an auth card click, approval decision, or ticket form submission
      const resumeData = stepContext.result as AuthCardData | ApprovalCardData | TicketFormCardData | undefined;
      const isAuthResume = resumeData?.action === CardAction.AuthCompleted;
      const isApprovalResume = resumeData?.action === CardAction.ToolApproved || resumeData?.action === CardAction.ToolDenied;
      const isTicketFormResume = resumeData?.action === CardAction.TicketFormSubmitted;
      
      let inputQuery: string;
      let conversationId: string | undefined;
      let previousResponseId: string | undefined;
      let approvalResponseItems: any[] | undefined;
      let showDisclaimer = false;

      if (isAuthResume) {
        const authData = resumeData as AuthCardData;
        console.log('[AGENT] Resuming after auth with conversation_id:', authData.conversation_id);
        inputQuery = authData.inputQuery;
        conversationId = authData.conversation_id;

      } else if (isApprovalResume) {
        const approvalData = resumeData as ApprovalCardData;
        const approved = approvalData.action === CardAction.ToolApproved;
        console.log(`[AGENT] Resuming after tool ${approved ? 'approval' : 'denial'}, conversation_id: ${approvalData.conversation_id}, response_id: ${approvalData.response_id}`);
        inputQuery = approvalData.inputQuery;
        conversationId = approvalData.conversation_id;
        previousResponseId = approvalData.response_id;

        approvalResponseItems = [
          {
            type: 'mcp_approval_response',
            approval_request_id: approvalData.approval_request_id,
            approve: approved,
            ...(!approved ? { reason: 'User denied the tool invocation' } : {})
          }
        ];

      } else if (isTicketFormResume) {
        const ticketData = resumeData as TicketFormCardData;
        console.log(`[AGENT] Resuming after ticket form submission, conversation_id: ${ticketData.conversation_id}`);
        // Feed the user-provided form values back to the agent as a developer-injected
        // message so it calls submit_ticket with exactly these values.
        inputQuery = [
          `[SYSTEM] The user has filled the IT ticket form with the following information:`,
          `- Subject: ${ticketData.subject}`,
          `- Details: ${ticketData.details}`,
          `- Severity: ${ticketData.severity}`,
          ``,
          `**YOU MUST** Call the submit_ticket tool now with exactly these values. Do not modify them.`
        ].join('\n');
        conversationId = ticketData.conversation_id;

      } else {
        inputQuery = context.activity.text;

        // Resolve the agent conversation ID from persisted state.
        // If the channel conversation ID has changed (user started a new chat)
        // we discard the old mapping and will create a fresh agent conversation.
        const channelConvId = context.activity.conversation?.id;
        const mapping = await this._agentConversationAccessor.get(context) as AgentConversationMapping | undefined;

        if (mapping && mapping.channelConversationId === channelConvId) {
          // Same channel conversation — reuse the agent conversation for history continuity
          conversationId = mapping.agentConversationId;
          console.log(`[AGENT] Reusing agent conversation ${conversationId} for channel conversation ${channelConvId}`);

          // Mark disclaimer to be shown once per conversation (before the first response)
          if (!mapping.disclaimerShown) {
            showDisclaimer = true;
          }
        } else {
          // New or changed channel conversation — will create a fresh agent conversation below
          conversationId = undefined;
          showDisclaimer = true;
          if (mapping) {
            console.log(`[AGENT] Channel conversation changed (was ${mapping.channelConversationId}, now ${channelConvId}). Creating new agent conversation.`);
          }
        }
      }

      // Show one-time disclaimer before the first agent response in this conversation
      if (showDisclaimer) {
        await AdaptiveCardHelper.sendDisclaimerCard(context);

        // Persist disclaimerShown for existing mappings (new mappings handle it at creation)
        const currentMapping = await this._agentConversationAccessor.get(context) as AgentConversationMapping | undefined;
        if (currentMapping && !currentMapping.disclaimerShown) {
          currentMapping.disclaimerShown = true;
          await this._agentConversationAccessor.set(context, currentMapping);
        }
      }
      
      // Configure streaming response
      await context.streamingResponse.reset();
      await context.streamingResponse.setDelayInMs(200);
      await context.streamingResponse.setGeneratedByAILabel(true);
      await context.streamingResponse.setFeedbackLoop(false);
      await context.streamingResponse.queueInformativeUpdate('🚀 Working on your answer...');

      // Reset streaming state before each invocation
      this._agentService.resetStreamingState();

      // Check if debug mode is enabled for this user
      const debugMode = (context.turnState as any).debugMode ?? false;

      // Invoke the agent
      let streamResult;
      if (conversationId) {
        // Continue with existing conversation (possibly with approval response)
        streamResult = await this._agentService.invokeAgentStreaming(inputQuery, conversationId, context, previousResponseId, approvalResponseItems, debugMode);
      } else {
        // New conversation — create it and persist the channel ↔ agent mapping
        const conversation = await this._agentService.createConversation(inputQuery);
        conversationId = conversation.id;

        const channelConvId = context.activity.conversation?.id;
        if (channelConvId) {
          const newMapping: AgentConversationMapping = {
            channelConversationId: channelConvId,
            agentConversationId: conversationId,
            disclaimerShown: true,
          };
          await this._agentConversationAccessor.set(context, newMapping);
          console.log(`[AGENT] Persisted mapping: channel=${channelConvId} → agent=${conversationId}`);
        }

        streamResult = await this._agentService.invokeAgentStreaming(inputQuery, conversationId, context, undefined, undefined, debugMode);
      }

      // If the agent needs auth, send the consent card and wait
      if (streamResult.auth) {
        console.log('[AGENT] OAuth consent required, sending auth card');

        await context.streamingResponse.queueTextChunk('Authentication to an external service is required to proceed.');
        await context.streamingResponse.endStream();

        await AdaptiveCardHelper.sendAuthCard(context, {
          consentLink: streamResult.auth.consentLink,
          conversationId: streamResult.auth.conversationId,
          inputQuery: streamResult.auth.inputQuery
        });
        
        // Return EndOfTurn — the dialog stays on this step.
        // When the user clicks "Continue", onContinueDialog will resume
        // this step with the auth data via resumeDialog.
        return Dialog.EndOfTurn;
      }

      // If the agent needs tool approval, send the approval card and wait
      if (streamResult.approval) {
        console.log('[AGENT] MCP tool approval required, sending approval card');

        await context.streamingResponse.queueTextChunk('A tool is requesting your approval before it can run.');
        await context.streamingResponse.endStream();

        const approvalRequest = streamResult.approval;
        await AdaptiveCardHelper.sendApprovalCard(context, {
          mcpToolApprovalRequestId: approvalRequest.McpToolApprovalRequestId,
          toolName: approvalRequest.toolName,
          toolArguments: approvalRequest.toolArguments,
          serverLabel: approvalRequest.serverLabel,
          conversationId: approvalRequest.conversationId,
          inputQuery: approvalRequest.inputQuery,
          responseId: approvalRequest.responseId
        });

        return Dialog.EndOfTurn;
      }

      // If the agent emitted SUBMIT_ISSUE, show the ticket form card and wait
      if (streamResult.ticketForm) {
        console.log('[AGENT] SUBMIT_ISSUE detected, sending ticket form card');

        await AdaptiveCardHelper.sendTicketFormCard(context, {
          conversationId: streamResult.ticketForm.conversationId,
          inputQuery: streamResult.ticketForm.inputQuery
        });

        return Dialog.EndOfTurn;
      }

      // Normal completion — stream was already finalized in invokeAgentStreaming
      // (debug card, if enabled, was attached to the final streaming chunk)

      return await stepContext.endDialog();
  }

  //#endregion
}