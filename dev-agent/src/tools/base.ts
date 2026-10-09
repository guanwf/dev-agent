/**
 * @file Base tool abstraction and schemas for DevAgent
 * Corresponds to the Tool module in mini-claude-code architecture
 */

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: {
    type: string;
  };
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required: string[];
  };
  isDestructive?: boolean;
}

export interface ToolExecutionContext {
  workspaceRoot: string;
  sessionId: string;
  onStreamOutput?: (chunk: string) => void;
  confirmAction?: (description: string, metadata?: Record<string, unknown>) => Promise<'yes' | 'no' | 'explain'>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseTool {
  abstract readonly schema: ToolSchema;

  /**
   * Executes the tool with the provided arguments and runtime context.
   */
  abstract execute(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
}
