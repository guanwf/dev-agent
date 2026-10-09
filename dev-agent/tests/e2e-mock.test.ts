/**
 * @file End-to-End ReAct Agent Loop Test with Mock LLM
 */

import { describe, it, expect, vi } from 'vitest';
import { AgentCore, LLMCaller } from '../src/core/agent.js';
import { ChatMessage } from '../src/core/context.js';
import { BaseTool } from '../src/tools/base.js';

describe('Autonomous Agent ReAct Loop', () => {
  it('orchestrates reasoning, tool execution, and final answer', async () => {
    let callStep = 0;

    // Deterministic Mock LLM simulates a 3-step ReAct cycle:
    // Step 1: Read code
    // Step 2: Patch code
    // Step 3: Complete with answer
    const mockLLM: LLMCaller = async (messages: ChatMessage[], tools: BaseTool[]) => {
      callStep++;

      if (callStep === 1) {
        return {
          thought: 'I need to check the contents of src/calculator.ts to inspect the bug.',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              name: 'read_file',
              arguments: { file_path: 'src/calculator.ts', start_line: 1, end_line: 10 }
            }
          ]
        };
      }

      if (callStep === 2) {
        // Model observed the file, now issues a surgical patch
        return {
          thought: 'I located the off-by-one error at line 5. Let me patch it surgically.',
          content: '',
          tool_calls: [
            {
              id: 'call_2',
              name: 'patch_file',
              arguments: {
                file_path: 'src/calculator.ts',
                search_block: 'return a + b + 1;',
                replace_block: 'return a + b;'
              }
            }
          ]
        };
      }

      // Step 3: Conclude
      return {
        thought: 'The patch has been applied and verified. Ready to conclude.',
        content: 'I have successfully identified and fixed the off-by-one bug in src/calculator.ts.'
      };
    };

    const thoughtsRecorded: string[] = [];
    const toolsCalled: string[] = [];

    const agent = new AgentCore(
      {
        workspaceRoot: '/mock/workspace',
        autoApproveSafe: true
      },
      {
        onThought: (t) => thoughtsRecorded.push(t),
        onToolStart: (name) => toolsCalled.push(name)
      }
    );

    // Mock tool implementations to avoid physical disk calls in this unit test
    const mockReadTool: any = {
      schema: { name: 'read_file', description: '', parameters: { type: 'object', properties: {}, required: [] } },
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: '1: export function add(a: number, b: number) {\n2:   return a + b + 1;\n3: }'
      })
    };

    const mockPatchTool: any = {
      schema: { name: 'patch_file', description: '', parameters: { type: 'object', properties: {}, required: [] } },
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: 'Successfully applied patch to "src/calculator.ts" (exact match, similarity: 100%)',
        metadata: { diff: '--- src/calculator.ts\n+++ src/calculator.ts\n- return a + b + 1;\n+ return a + b;' }
      })
    };

    agent.registerTool(mockReadTool);
    agent.registerTool(mockPatchTool);
    agent.setLLMCaller(mockLLM);

    await agent.initWorkspace();
    const result = await agent.runTask('Fix the addition bug in src/calculator.ts');

    expect(result.success).toBe(true);
    expect(result.finalAnswer).toContain('fixed the off-by-one bug');
    expect(callStep).toBe(3);
    expect(thoughtsRecorded.length).toBe(3);
    expect(toolsCalled).toEqual(['read_file', 'patch_file']);
  });
});
