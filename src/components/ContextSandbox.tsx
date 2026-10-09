import React, { useState } from 'react';
import { Cpu, Zap, ArrowDown, Scissors, RefreshCw, Layers } from 'lucide-react';
import { truncateShellLog, estimateTokens, generateCompactedSummary } from '../engine/contextCompactor';

const SAMPLE_MASSIVE_LOG = [
  'PASS tests/unit/parser.test.ts',
  'PASS tests/unit/tokenizer.test.ts',
  ...Array.from({ length: 180 }, (_, i) => `[DEBUG 14:22:${(i % 60).toString().padStart(2, '0')}] [DB-Worker-${i % 4}] Heartbeat ACK from worker node, latency ${(i * 3) % 25}ms, active sockets: 14`),
  'FAIL tests/unit/patcher.test.ts',
  '  ✕ should tolerate indentation mismatch (34ms)',
  '',
  '  ● Surgical File Patcher › should tolerate indentation mismatch',
  '',
  '    AssertionError: expected false to be true',
  '      at Object.<anonymous> (tests/unit/patcher.test.ts:48:19)',
  '      at Promise.then.completed (node_modules/vitest/dist/index.js:142:11)',
  '',
  'Test Suites: 1 failed, 2 passed, 3 total',
  'Tests:       1 failed, 14 passed, 15 total',
  'Snapshots:   0 total',
  'Time:        3.42 s',
  'Exit Code: 1'
].join('\n');

export const ContextSandbox: React.FC = () => {
  const [rawLog, setRawLog] = useState(SAMPLE_MASSIVE_LOG);
  const [maxTokens, setMaxTokens] = useState(1500);
  const [headLines, setHeadLines] = useState(15);
  const [tailLines, setTailLines] = useState(20);

  const truncationResult = truncateShellLog(rawLog, maxTokens, headLines, tailLines);

  const [compactedTurns] = useState([
    { role: 'user', content: 'Inspect the test suite and fix the tokenizer bugs.' },
    { role: 'assistant', content: 'Analyzing parser files and locating discrepancies.' },
    { role: 'tool', tool: 'patch_file', diff: '--- a/src/tokenizer.ts\n+++ b/src/tokenizer.ts', content: 'Patched tokenizer.ts' },
    { role: 'tool', tool: 'execute_command', content: 'Executed tests' },
    { role: 'assistant', content: 'Refactored regex groups.' }
  ]);

  const compactionSummary = generateCompactedSummary(compactedTurns);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold font-mono text-sm">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Dynamic Context Budget & Shell Log Truncation — Module A</span>
        </div>
        <p className="text-zinc-400 text-xs mt-1">
          Industrial LLMs degrade or hit context windows when inundated with 500-line shell output dumps. DevAgent protects token budgets through intelligent Head+Tail log truncation and auto-compaction checkpoints.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded">
          <div className="text-zinc-500">Raw Input Tokens</div>
          <div className="text-lg font-bold text-zinc-200 mt-1">{truncationResult.originalTokens.toLocaleString()}</div>
          <div className="text-[11px] text-zinc-500">{rawLog.split('\n').length} lines</div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded">
          <div className="text-zinc-500">Truncated Tokens</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{truncationResult.newTokens.toLocaleString()}</div>
          <div className="text-[11px] text-zinc-500">
            {truncationResult.wasTruncated ? `Saved ${Math.max(0, truncationResult.originalTokens - truncationResult.newTokens)} tokens` : 'Within budget'}
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded">
          <div className="text-zinc-500">Preserved Boundaries</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">Head {headLines} + Tail {tailLines}</div>
          <div className="text-[11px] text-zinc-500">Omitted {truncationResult.omittedLines} lines</div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded">
          <div className="text-zinc-500">Compaction Trigger</div>
          <div className="text-lg font-bold text-amber-400 mt-1">75% Window</div>
          <div className="text-[11px] text-zinc-500">Checkpoint summarizer</div>
        </div>
      </div>

      {/* Log Truncation Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-300 font-semibold">Raw Subprocess Output (stdout / stderr)</span>
            <button
              onClick={() => setRawLog(SAMPLE_MASSIVE_LOG)}
              className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-[11px]"
            >
              <RefreshCw className="w-3 h-3" /> Reset Log
            </button>
          </div>
          <div className="p-3">
            <textarea
              value={rawLog}
              onChange={(e) => setRawLog(e.target.value)}
              rows={14}
              className="w-full bg-zinc-900/40 text-zinc-300 font-mono text-xs p-3 rounded border border-zinc-800 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" />
              <span>Truncated Output (Sent to Model ReAct Context)</span>
            </span>
            <span className="text-zinc-500 text-[11px]">
              {truncationResult.wasTruncated ? 'Middle Pruned' : 'Unchanged'}
            </span>
          </div>
          <div className="p-3">
            <div className="w-full h-[278px] bg-zinc-900/40 text-zinc-200 font-mono text-xs p-3 rounded border border-zinc-800/80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {truncationResult.processedText}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Compaction Checkpoint Preview */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between text-xs font-mono">
          <span className="text-amber-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>Auto-Compaction High-Density State Checkpoint</span>
          </span>
          <span className="text-zinc-500 text-xs">Triggered when budget &ge; 75%</span>
        </div>
        <div className="p-4 font-mono text-xs">
          <div className="bg-zinc-900/70 p-3.5 rounded border border-amber-900/40 text-amber-200/90 whitespace-pre-wrap leading-relaxed">
            {compactionSummary.summary}
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Replaces dozens of multi-turn tool observations with one compact state snapshot.</span>
            <span className="text-emerald-400 font-semibold">Tokens Saved: ~{compactionSummary.tokensSaved}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
