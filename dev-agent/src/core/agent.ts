/**
 * @file Agent Core ReAct Engine & State Machine
 * Implements the Loop pillar of mini-claude-code architecture with Self-Healing
 */

import { BaseTool, ToolExecutionContext, ToolResult } from '../tools/base.js';
import { ReadFileTool, ListDirectoryTool } from '../tools/file-read.js';
import { FilePatchTool } from '../tools/file-patch.js';
import { ShellExecTool } from '../tools/shell-exec.js';
import { CodeSearchTool } from '../tools/code-search.js';
import { SafetyGuard } from '../safety/guard.js';
import { ContextManager, ChatMessage } from './context.js';
import { MemoryStore, AgentSessionData } from './memory.js';
import { TerminalRenderer } from '../ui/renderer.js';
import { promptHITLConfirmation } from '../ui/prompt.js';

export interface AgentConfig {
  workspaceRoot: string;
  model?: string;
  maxIterations?: number;
  maxSelfHealingRetries?: number;
  autoApproveSafe?: boolean;
}

export interface AgentEvents {
  onThought?: (thought: string) => void;
  onToolStart?: (name: string, args: Record<string, any>) => void;
  onToolResult?: (name: string, result: ToolResult) => void;
  onDiff?: (diffText: string, filePath: string) => void;
  onCompacted?: (summary: string) => void;
  onStepProgress?: (step: number, total: number) => void;
  onStreamText?: (token: string) => void;
}

export type LLMCaller = (
  messages: ChatMessage[],
  tools: BaseTool[],
  options?: { temperature?: number }
) => Promise<{
  content: string;
  thought?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, any> }>;
}>;

export class AgentCore {
  private workspaceRoot: string;
  private tools: Map<string, BaseTool> = new Map();
  private contextManager: ContextManager;
  private memoryStore: MemoryStore;
  private safetyGuard: SafetyGuard;
  private renderer: TerminalRenderer;
  private patcher: FilePatchTool;
  private currentSessionId: string;
  private messages: ChatMessage[] = [];
  private llmCaller?: LLMCaller;

  constructor(
    private config: AgentConfig,
    private events?: AgentEvents
  ) {
    this.workspaceRoot = config.workspaceRoot;
    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.contextManager = new ContextManager();
    this.memoryStore = new MemoryStore(this.workspaceRoot);
    this.safetyGuard = new SafetyGuard(this.workspaceRoot);
    this.renderer = new TerminalRenderer();

    // Register 4 core tool capabilities
    this.patcher = new FilePatchTool();
    this.registerTool(new ReadFileTool());
    this.registerTool(new ListDirectoryTool());
    this.registerTool(this.patcher);
    this.registerTool(new ShellExecTool());
    this.registerTool(new CodeSearchTool());
  }

  public setLLMCaller(caller: LLMCaller): void {
    this.llmCaller = caller;
  }

  public registerTool(tool: BaseTool): void {
    this.tools.set(tool.schema.name, tool);
  }

  public getSessionId(): string {
    return this.currentSessionId;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Initializes agent workspace context & system instructions
   */
  async initWorkspace(sessionId?: string): Promise<void> {
    if (sessionId) {
      const restored = await this.memoryStore.loadSession(sessionId);
      if (restored) {
        this.currentSessionId = restored.sessionId;
        this.messages = restored.messages;
        return;
      }
    }

    const workspaceRules = await this.contextManager.loadWorkspaceRules(this.workspaceRoot);

    const systemPrompt = [
      `You are DevAgent, an industrial-grade autonomous coding agent running inside the developer's local terminal.`,
      `Your architecture follows the ReAct paradigm (Reasoning + Acting):`,
      `1. Formulate a hypothesis or thought before calling tools.`,
      `2. Never rewrite whole large files blindly. Use \`patch_file\` with search_block and replace_block.`,
      `3. Always verify changes using test or build commands.`,
      `4. If a test fails, trigger the self-healing loop: analyze the stderr stack trace, diagnose root cause, and apply a surgical fix.`,
      workspaceRules ? `\nWorkspace Specific Guidelines:\n${workspaceRules}` : ''
    ].filter(Boolean).join('\n\n');

    this.messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
  }

  /**
   * Main ReAct Execution Loop (User -> LLM -> Tool -> Observation -> Loop)
   */
  async runTask(userGoal: string): Promise<{ success: boolean; finalAnswer: string; iterations: number }> {
    this.messages.push({
      role: 'user',
      content: userGoal
    });

    const maxIterations = this.config.maxIterations ?? 15;
    let iteration = 0;
    let finalAnswer = '';

    while (iteration < maxIterations) {
      iteration++;
      this.events?.onStepProgress?.(iteration, maxIterations);

      // Check context compaction threshold
      if (this.contextManager.isCompactionNeeded(this.messages)) {
        const { compactedMessages, state } = this.contextManager.compactHistory(this.messages);
        this.messages = compactedMessages;
        this.events?.onCompacted?.(state.compressedSummary);
      }

      // Query LLM
      if (!this.llmCaller) {
        throw new Error('LLMCaller is not configured for AgentCore');
      }

      const toolList = Array.from(this.tools.values());
      const response = await this.llmCaller(this.messages, toolList);

      // Render thoughts
      if (response.thought) {
        this.renderer.renderThought(response.thought);
        this.events?.onThought?.(response.thought);
      }

      // If no tool calls, the task is finished
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalAnswer = response.content;
        this.renderer.renderAssistantMessage(finalAnswer);
        this.messages.push({
          role: 'assistant',
          content: response.content,
          thought: response.thought
        });
        break;
      }

      // Record assistant message with tool calls
      this.messages.push({
        role: 'assistant',
        content: response.content || '',
        thought: response.thought,
        tool_calls: response.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }))
      });

      // Execute tool calls sequentially
      for (const call of response.tool_calls) {
        this.renderer.renderToolCall(call.name, call.arguments);
        this.events?.onToolStart?.(call.name, call.arguments);

        const tool = this.tools.get(call.name);
        let toolResult: ToolResult;

        if (!tool) {
          toolResult = {
            success: false,
            output: '',
            error: `Unknown tool "${call.name}". Available tools: ${Array.from(this.tools.keys()).join(', ')}`
          };
        } else {
          // Execution context with Human-in-the-Loop hook
          const executionContext: ToolExecutionContext = {
            workspaceRoot: this.workspaceRoot,
            sessionId: this.currentSessionId,
            onStreamOutput: (chunk) => this.events?.onStreamText?.(chunk),
            confirmAction: async (desc, meta) => {
              if (this.config.autoApproveSafe && !tool.schema.isDestructive) {
                return 'yes';
              }
              return await promptHITLConfirmation(desc, JSON.stringify(meta));
            }
          };

          try {
            toolResult = await tool.execute(call.arguments, executionContext);
          } catch (err: any) {
            toolResult = {
              success: false,
              output: '',
              error: `Tool execution threw an exception: ${err.message}`
            };
          }
        }

        // Apply intelligent truncation if shell output was large
        if (call.name === 'execute_command' && toolResult.output) {
          const { text } = this.contextManager.truncateShellOutput(toolResult.output, call.arguments.command);
          toolResult.output = text;
        }

        this.renderer.renderObservation(call.name, toolResult.success, toolResult.output || toolResult.error || '');
        this.events?.onToolResult?.(call.name, toolResult);

        if (toolResult.metadata?.diff) {
          this.renderer.renderDiff(toolResult.metadata.diff as string);
          this.events?.onDiff?.(toolResult.metadata.diff as string, call.arguments.file_path || '');
        }

        // Push observation back into conversation
        this.messages.push({
          role: 'tool',
          name: call.name,
          tool_call_id: call.id,
          content: toolResult.success
            ? toolResult.output
            : `Tool failed: ${toolResult.error}\nOutput:\n${toolResult.output}`
        });
      }

      // Persist session checkpoint
      await this.saveCurrentSession();
    }

    return {
      success: true,
      finalAnswer,
      iterations: iteration
    };
  }

  /**
   * Self-Healing Workflow: executes test, analyzes failure, and initiates auto-repair
   */
  async runSelfHealingTest(testCommand: string): Promise<{ passed: boolean; attempts: number }> {
    const maxRetries = this.config.maxSelfHealingRetries ?? 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`\n🔍 [Self-Healing Loop: Attempt ${attempt}/${maxRetries}] Running: \`${testCommand}\`...`);

      const shellTool = this.tools.get('execute_command') as ShellExecTool;
      const result = await shellTool.execute(
        { command: testCommand },
        { workspaceRoot: this.workspaceRoot, sessionId: this.currentSessionId }
      );

      if (result.success) {
        console.log(`\n✅ Tests passed cleanly on attempt ${attempt}! Self-healing succeeded.`);
        return { passed: true, attempts: attempt };
      }

      console.log(`\n❌ Test failed with exit code ${result.metadata?.exitCode}. Auto-healing diagnosis initiated...`);

      const repairPrompt = [
        `Automated test command \`${testCommand}\` failed on attempt ${attempt}/${maxRetries}.`,
        `Exit code: ${result.metadata?.exitCode}`,
        `Test output and error trace:`,
        result.output,
        `Please inspect the stack trace, locate the exact file and line causing the failure, and apply a surgical patch to fix the bug.`
      ].join('\n\n');

      await this.runTask(repairPrompt);
    }

    return { passed: false, attempts: attempt };
  }

  /**
   * Persists session to disk
   */
  private async saveCurrentSession(): Promise<void> {
    const sessionData: AgentSessionData = {
      sessionId: this.currentSessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspaceRoot: this.workspaceRoot,
      messages: this.messages,
      metadata: {
        totalTokens: this.contextManager.calculateHistoryTokens(this.messages),
        patchesApplied: 0,
        commandsExecuted: 0,
        model: this.config.model || 'claude-3-7-sonnet'
      }
    };

    await this.memoryStore.saveSession(sessionData);
  }
}
