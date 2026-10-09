/**
 * @file Controlled shell execution tool with streaming and timeout
 * Corresponds to Module C in the functional specification
 */

import { execa } from 'execa';
import { BaseTool, ToolExecutionContext, ToolResult, ToolSchema } from './base.js';
import { SafetyGuard } from '../safety/guard.js';
import { sanitizeOutput } from '../safety/sanitizer.js';

export class ShellExecTool extends BaseTool {
  readonly schema: ToolSchema = {
    name: 'execute_command',
    description: 'Executes a bash/shell command in the workspace. Supports timeouts and captures stdout/stderr.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command line to run'
        },
        timeout_seconds: {
          type: 'number',
          description: 'Max execution time before process killed (default 60 seconds)'
        }
      },
      required: ['command']
    },
    isDestructive: true
  };

  async execute(
    args: { command: string; timeout_seconds?: number },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { command, timeout_seconds = 60 } = args;
    const guard = new SafetyGuard(context.workspaceRoot);

    // 1. Safety Guard Check
    const check = guard.validateCommand(command);
    if (!check.allowed) {
      return {
        success: false,
        output: '',
        error: `Command blocked by Safety Guard: ${check.reason}`
      };
    }

    // 2. HITL Confirmation Check
    if (check.requiresHITLConfirmation && context.confirmAction) {
      const decision = await context.confirmAction(`Execute command: \`${command}\``, { command });
      if (decision === 'no') {
        return {
          success: false,
          output: 'Command execution aborted by user.',
          error: 'User denied permission'
        };
      }
    }

    const timeoutMs = Math.max(1000, timeout_seconds * 1000);

    try {
      // Execute command via execa
      const child = execa(command, {
        cwd: context.workspaceRoot,
        shell: true,
        timeout: timeoutMs,
        all: true,
        reject: false,
        env: {
          ...process.env,
          CI: '1',
          FORCE_COLOR: '0',
          PAGER: 'cat'
        }
      });

      // Stream output if listener attached
      if (context.onStreamOutput && child.all) {
        child.all.on('data', (chunk: Buffer | string) => {
          context.onStreamOutput?.(chunk.toString());
        });
      }

      const result = await child;
      const combinedOutput = result.all || `${result.stdout || ''}\n${result.stderr || ''}`;
      const { cleanText } = sanitizeOutput(combinedOutput);

      const isSuccess = result.exitCode === 0;

      return {
        success: isSuccess,
        output: cleanText || '(No output produced)',
        error: !isSuccess ? `Process exited with code ${result.exitCode}` : undefined,
        metadata: {
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          durationMs: result.durationMs
        }
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Execution failed: ${err.message}`
      };
    }
  }
}
