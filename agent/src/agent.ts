import { AIProjectClient } from "@azure/ai-projects";
import { ActivityTypes } from "@microsoft/agents-activity";
import { AgentApplication, AgentStatePropertyAccessor, ConversationState, Storage, TurnContext, TurnState, UserState } from "@microsoft/agents-hosting";
import { getAIFoundryConfiguration, getAIFoundryCredential } from "./config";
import { AgentDialog } from "./dialogs/agentDialog";
import { AgentService } from "./services/agentService";

/** Regex to match /debug on or /debug off (case-insensitive, with optional whitespace). */
const DEBUG_COMMAND_PATTERN = /^\s*\/debug\s+(on|off)\s*$/i;
/** Regex to match /reset (case-insensitive, with optional whitespace). */
const RESET_COMMAND_PATTERN = /^\s*\/reset\s*$/i;

export class CustomAgentWorkflow extends AgentApplication<TurnState> {

  private conversationState: ConversationState;
  private userState: UserState;
  private agentDialog: AgentDialog;
  private agentDialogState: AgentStatePropertyAccessor;
  private debugStateAccessor: AgentStatePropertyAccessor;
  private agentConversationAccessor: AgentStatePropertyAccessor;

  constructor (storage: Storage) {

    super({
      storage: storage
    });

    const { workflowAgentName, aiFoundryProjectEndpoint } = getAIFoundryConfiguration();
    const project  = new AIProjectClient(aiFoundryProjectEndpoint, getAIFoundryCredential());

    // Create conversation and user state with in-memory storage provider.
    this.conversationState = new ConversationState(storage);
    this.userState = new UserState(storage);
    const agentService = new AgentService(project, "workflow-agent");
    this.agentDialogState = this.conversationState.createProperty("DialogState");
    this.debugStateAccessor = this.userState.createProperty("DebugMode");

    // Tracks the mapping between a channel conversation and the agent (Foundry) conversation.
    // When the channel conversation ID changes (e.g. user starts a new chat in Copilot)
    // a fresh agent conversation is created to avoid history conflicts.
    this.agentConversationAccessor = this.conversationState.createProperty("AgentConversationMapping");

    this.agentDialog = new AgentDialog(agentService, this.agentConversationAccessor);

    this._onMessage = this._onMessage.bind(this);
    this.onActivity(ActivityTypes.Message, this._onMessage);
  }

  private async _onMessage(context: TurnContext, state: TurnState) {
     // Handle /debug on|off command
     const text = (context.activity.text ?? '').trim();
     const debugMatch = DEBUG_COMMAND_PATTERN.exec(text);
     if (debugMatch) {
       const enabled = debugMatch[1].toLowerCase() === 'on';
       await this.debugStateAccessor.set(context, enabled);
       await context.sendActivity(`🐛 Debug mode **${enabled ? 'enabled' : 'disabled'}** for you across all conversations.`);
       return;
     }

     // Handle /reset command — clear the agent conversation mapping to start fresh
     if (RESET_COMMAND_PATTERN.test(text)) {
       await this.agentConversationAccessor.set(context, undefined);
       await context.sendActivity('🔄 Conversation has been reset. Your next message will start a new agent conversation.');
       return;
     }

     // Pass debug flag into turnState so the dialog can read it
     const debugEnabled = (await this.debugStateAccessor.get(context)) ?? false;
     (context.turnState as any).debugMode = debugEnabled;

     // Action.Submit on Adaptive Cards may arrive as a Message with activity.value
     // instead of an Invoke. Route these to the dialog as well so the auth flow works.
     await this.agentDialog.run(context, this.agentDialogState);
  }

  public async run(context: TurnContext) {
    await super.run(context);

    // Save any state changes. The load happened during the execution of the Dialog.
    await this.conversationState.saveChanges(context, false);
    await this.userState.saveChanges(context, false);
  }
}