/**
 * @file Dynamic Context Budget, Shell Log Truncation & Auto-Compaction Manager
 * Corresponds to Context module in mini-claude-code architecture
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  thought?: string;
}

export interface ContextConfig {
  maxContextTokens: number;      // e.g., 128000 or 200000
  compactionThreshold: number;   // e.g., 0.75 (75%)
  maxShellLogTokens: number;     // e.g., 2000 tokens
}

export interface CompactedState {
  originalMessageCount: number;
  compressedSummary: string;
  filesModified: string[];
  activeGoals: string[];
  timestamp: number;
}

/**
 * Estimates token count based on character and word density (~3.8 chars/token)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // CJK characters count as ~1 token each; latin characters count as ~0.25-0.3 tokens
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x4e00 && code < 0x9fa5) {
      count += 1;
    } else {
      count += 0.28;
    }
  }
  return Math.ceil(count);
}

export class ContextManager {
  private config: ContextConfig;

  constructor(config?: Partial<ContextConfig>) {
    this.config = {
      maxContextTokens: config?.maxContextTokens ?? 128_000,
      compactionThreshold: config?.compactionThreshold ?? 0.75,
      maxShellLogTokens: config?.maxShellLogTokens ?? 2_000
    };
  }

  /**
   * Loads workspace configuration rules (AGENT.md, CLAUDE.md, .agentrules)
   */
  async loadWorkspaceRules(workspaceRoot: string): Promise<string> {
    const candidates = ['AGENT.md', 'CLAUDE.md', '.agentrules', '.cursorrules'];
    const loadedRules: string[] = [];

    for (const file of candidates) {
      try {
        const fullPath = path.resolve(workspaceRoot, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        loadedRules.push(`--- Workspace Rules from ${file} ---\n${content.trim()}`);
      } catch {
        // File does not exist, continue
      }
    }

    return loadedRules.join('\n\n');
  }

  /**
   * Intelligently truncates excessive shell logs (e.g. >2000 tokens)
   * Preserves Head (command, environment, test init: 30 lines) + Tail (last 70 lines: error traces & exit code)
   */
  truncateShellOutput(output: string, commandStr?: string): { text: string; wasTruncated: boolean; savedTokens: number } {
    const estimated = estimateTokens(output);
    if (estimated <= this.config.maxShellLogTokens) {
      return { text: output, wasTruncated: false, savedTokens: 0 };
    }

    const lines = output.split('\n');
    if (lines.length <= 100) {
      return { text: output, wasTruncated: false, savedTokens: 0 };
    }

    const headLineCount = 30;
    const tailLineCount = 70;
    const omittedLineCount = lines.length - headLineCount - tailLineCount;

    if (omittedLineCount <= 0) {
      return { text: output, wasTruncated: false, savedTokens: 0 };
    }

    const head = lines.slice(0, headLineCount).join('\n');
    const tail = lines.slice(lines.length - tailLineCount).join('\n');

    const banner = `\n\n... [DEV-AGENT LOG TRUNCATION: Omitted ${omittedLineCount} lines (${Math.round((omittedLineCount / lines.length) * 100)}% of log) to preserve context budget] ...\n\n`;

    const truncated = `${head}${banner}${tail}`;
    const truncatedTokens = estimateTokens(truncated);
    const saved = Math.max(0, estimated - truncatedTokens);

    return {
      text: truncated,
      wasTruncated: true,
      savedTokens: saved
    };
  }

  /**
   * Calculates total token consumption of message history
   */
  calculateHistoryTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => {
      let msgTokens = estimateTokens(msg.content);
      if (msg.thought) msgTokens += estimateTokens(msg.thought);
      if (msg.tool_calls) {
        msgTokens += estimateTokens(JSON.stringify(msg.tool_calls));
      }
      return sum + msgTokens + 4; // overhead per message
    }, 0);
  }

  /**
   * Checks if context reached the compaction threshold
   */
  isCompactionNeeded(messages: ChatMessage[]): boolean {
    const currentTokens = this.calculateHistoryTokens(messages);
    const budgetLimit = this.config.maxContextTokens * this.config.compactionThreshold;
    return currentTokens >= budgetLimit;
  }

  /**
   * Compresses message history into high-density state summary
   * Clears old repetitive tool invocations while retaining essential project state
   */
  compactHistory(messages: ChatMessage[]): { compactedMessages: ChatMessage[]; state: CompactedState } {
    const originalCount = messages.length;
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    // Extract modified files mentioned in patches
    const filesModified = new Set<string>();
    nonSystem.forEach((m) => {
      if (m.content.includes('Successfully applied patch to "')) {
        const match = m.content.match(/Successfully applied patch to "([^"]+)"/);
        if (match) filesModified.add(match[1]);
      }
    });

    // Retain the last 4-6 most recent interactive turns
    const recentWindow = 6;
    const toCompact = nonSystem.slice(0, Math.max(0, nonSystem.length - recentWindow));
    const recentTurns = nonSystem.slice(Math.max(0, nonSystem.length - recentWindow));

    const actionsSummary = toCompact
      .map((m) => {
        if (m.role === 'user') return `User requested: ${m.content.slice(0, 100)}`;
        if (m.role === 'assistant' && m.thought) return `Agent planned: ${m.thought.slice(0, 100)}`;
        if (m.role === 'tool') return `Tool result: ${m.name} -> ${m.content.slice(0, 80)}`;
        return null;
      })
      .filter(Boolean)
      .slice(-10)
      .join('\n- ');

    const summaryContent = [
      `### [CONTEXT COMPACTION CHECKPOINT]`,
      `Earlier conversation steps were compressed to save token budget.`,
      `Files modified so far: ${Array.from(filesModified).join(', ') || 'None'}`,
      `Key recent actions:`,
      actionsSummary ? `- ${actionsSummary}` : 'Initial instructions processed.'
    ].join('\n');

    const summaryMessage: ChatMessage = {
      role: 'user',
      content: summaryContent
    };

    const compactedMessages: ChatMessage[] = [
      ...systemMessages,
      summaryMessage,
      ...recentTurns
    ];

    const state: CompactedState = {
      originalMessageCount: originalCount,
      compressedSummary: summaryContent,
      filesModified: Array.from(filesModified),
      activeGoals: [],
      timestamp: Date.now()
    };

    return { compactedMessages, state };
  }
}
