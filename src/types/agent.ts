/**
 * @file Core Types for DevAgent Web Studio
 */

export type TabType = 'terminal' | 'patcher' | 'safety' | 'context' | 'architecture' | 'code' | 'tests';

export interface LogEntry {
  id: string;
  type: 'user' | 'thought' | 'tool_call' | 'hitl' | 'observation' | 'diff' | 'system' | 'assistant' | 'error';
  timestamp: number;
  content: string;
  metadata?: {
    toolName?: string;
    args?: Record<string, any>;
    diff?: string;
    success?: boolean;
    similarity?: number;
    matchType?: string;
    tokens?: number;
    exitCode?: number;
    hitlAction?: string;
  };
}

export interface PresetScenario {
  id: string;
  title: string;
  description: string;
  prompt: string;
  badge: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
  content?: string;
  description?: string;
}
