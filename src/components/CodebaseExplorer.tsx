import React, { useState } from 'react';
import { FileCode, Folder, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface CodeFile {
  path: string;
  name: string;
  category: 'bin' | 'core' | 'tools' | 'safety' | 'ui' | 'tests' | 'config';
  code: string;
}

const FILES: CodeFile[] = [
  {
    path: 'dev-agent/bin/cli.ts',
    name: 'cli.ts',
    category: 'bin',
    code: `#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'node:readline';
import { AgentCore } from '../src/core/agent.js';
import { MemoryStore } from '../src/core/memory.js';

const program = new Command();
program
  .name('dev-agent')
  .description('Autonomous CLI Coding Agent with ReAct loop, surgical patcher, and self-healing')
  .version('1.0.0')
  .argument('[prompt...]', 'Initial coding instruction or task')
  .option('-r, --resume [sessionId]', 'Resume a previous session by ID')
  .option('-m, --model <name>', 'LLM model to use', 'claude-3-7-sonnet')
  .option('-y, --yes', 'Automatically approve non-destructive tool operations', false)
  .option('-t, --test <command>', 'Execute self-healing loop around this test command')
  .action(async (promptArgs, options) => {
    // ...
  });`
  },
  {
    path: 'dev-agent/src/core/agent.ts',
    name: 'agent.ts',
    category: 'core',
    code: `/**
 * Agent Core ReAct Engine & State Machine
 * Implements Loop pillar with Self-Healing Test Workflow
 */
export class AgentCore {
  async runTask(userGoal: string) {
    // ReAct Loop:
    // User Input -> Context Check -> LLM Streaming -> Tool Dispatch -> Observation -> Self-Reflection
  }

  async runSelfHealingTest(testCommand: string) {
    // Iterative diagnosis and surgical repair upon test failure
  }
}`
  },
  {
    path: 'dev-agent/src/tools/file-patch.ts',
    name: 'file-patch.ts',
    category: 'tools',
    code: `/**
 * Industrial-Grade Surgical File Patcher
 * 1. Exact Substring Match
 * 2. Whitespace-Normalized Line Match
 * 3. Levenshtein Sliding Window Fuzzy Match
 * 4. Atomic Backup & Rollback
 */
export class FilePatchTool extends BaseTool {
  findMatch(fileContent: string, searchBlock: string, fuzzyThreshold = 0.80) {
    // Calculates edit distance and returns startLine, endLine, similarity
  }
  applyPatch(originalContent: string, filePath: string, searchBlock: string, replaceBlock: string) {
    // Preserves local indentation and produces unified diff
  }
}`
  },
  {
    path: 'dev-agent/src/core/context.ts',
    name: 'context.ts',
    category: 'core',
    code: `/**
 * Dynamic Context Budget, Shell Log Truncation & Auto-Compaction
 */
export class ContextManager {
  truncateShellOutput(output: string) {
    // Preserves Head (30 lines) + Tail (70 lines) when output exceeds 2000 tokens
  }
  compactHistory(messages: ChatMessage[]) {
    // High-density state summarization when context exceeds 75% limit
  }
}`
  },
  {
    path: 'dev-agent/src/safety/guard.ts',
    name: 'guard.ts',
    category: 'safety',
    code: `/**
 * Safety Guard Sandbox & Permission Interceptor
 */
export class SafetyGuard {
  validateCommand(cmd: string) {
    // Intercepts rm -rf /, git push --force, fork bombs, pipe exploits
  }
  validatePath(targetPath: string) {
    // Enforces path.resolve stays strictly inside workspace root sandbox
  }
}`
  },
  {
    path: 'dev-agent/src/safety/sanitizer.ts',
    name: 'sanitizer.ts',
    category: 'safety',
    code: `/**
 * Secret & Sensitive Credential Sanitizer
 * Masks API keys (Anthropic, OpenAI, AWS, GitHub) and shields .env files
 */
export function sanitizeOutput(text: string) {
  // Regex mask with [REDACTED_SECRET]
}`
  },
  {
    path: 'dev-agent/tests/patcher.test.ts',
    name: 'patcher.test.ts',
    category: 'tests',
    code: `import { describe, it, expect } from 'vitest';
import { FilePatchTool } from '../src/tools/file-patch.js';

describe('Surgical File Patcher', () => {
  it('finds exact matching blocks');
  it('tolerates indentation whitespace variations');
  it('finds fuzzy match when model has minor typos or altered comment');
  it('throws error on ambiguous duplicate search blocks');
});`
  }
];

export const CodebaseExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(FILES[2]); // Default file-patch.ts
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-100 font-semibold font-mono text-sm">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>DevAgent CLI Production Source Code</span>
            </div>
            <p className="text-zinc-400 text-xs mt-1">
              Full TypeScript (ESM) codebase implementing the complete mini-claude-code 4-pillar architecture.
            </p>
          </div>
          <div className="bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>npx tsx dev-agent/bin/cli.ts &quot;Fix the bug&quot;</span>
          </div>
        </div>
      </div>

      {/* Explorer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Tree List */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col font-mono text-xs">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-3.5 py-2.5 font-semibold text-zinc-200">
            Workspace Files
          </div>
          <div className="p-2 space-y-1">
            {FILES.map((f) => {
              const isSelected = selectedFile.path === f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full text-left px-2.5 py-1.5 rounded transition-colors flex items-center gap-2 ${
                    isSelected
                      ? 'bg-zinc-800 text-emerald-400 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.path.replace('dev-agent/', '')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code Content View */}
        <div className="lg:col-span-3 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col font-mono text-xs">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
            <span className="text-zinc-200 font-semibold">{selectedFile.path}</span>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 flex items-center gap-1.5 transition-colors text-[11px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-zinc-300 leading-relaxed whitespace-pre font-mono text-xs">
              {selectedFile.code}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
