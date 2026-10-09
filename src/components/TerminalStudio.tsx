import React, { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle, ShieldAlert, FileDiff, Zap, Sparkles, Send } from 'lucide-react';
import { LogEntry } from '../types/agent';
import { runFuzzyPatcher } from '../engine/fuzzyPatcher';
import { evaluateCommandSafety, evaluatePathSafety } from '../engine/safetyGuard';
import { truncateShellLog, estimateTokens } from '../engine/contextCompactor';

interface TerminalStudioProps {
  onUpdateTokens: (tokens: number) => void;
  activeModel: string;
}

export const TerminalStudio: React.FC<TerminalStudioProps> = ({ onUpdateTokens, activeModel }) => {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      type: 'system',
      timestamp: Date.now() - 5000,
      content: `DevAgent CLI v1.0.0 (Claude Code / Aider Architecture)\nWorkspace Root: /workspace/project-apollo\nSafety Sandbox: ENFORCED (Jailbreak protection & Secret redaction active)\nContext Budget: 128,000 tokens (Compaction threshold at 75%)\nType a coding command or click a preset scenario below to run the ReAct loop.`
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [pendingHITL, setPendingHITL] = useState<{
    action: string;
    description: string;
    explanation: string;
    onResolve: (decision: 'yes' | 'no') => void;
  } | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Recalculate estimated tokens
    const totalText = logs.map((l) => l.content + (l.metadata?.diff || '')).join('\n');
    onUpdateTokens(estimateTokens(totalText));
  }, [logs]);

  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        ...entry
      }
    ]);
  };

  // Helper sleep for realistic streaming terminal experience
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // SCENARIO 1: Surgical Bug Fix (Off-by-one in LRU Cache with whitespace drift)
  const runScenarioBugFix = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSelectedDiff(null);

    addLog({
      type: 'user',
      content: 'Fix the off-by-one capacity eviction bug in src/lru-cache.ts and verify with tests.'
    });

    await sleep(600);
    addLog({
      type: 'thought',
      content: 'I need to inspect src/lru-cache.ts around the capacity check. Let me use read_file with line slicing.'
    });

    await sleep(800);
    addLog({
      type: 'tool_call',
      content: 'read_file(file_path="src/lru-cache.ts", start_line=20, end_line=35)',
      metadata: { toolName: 'read_file' }
    });

    await sleep(700);
    const codeSnippet = `File: src/lru-cache.ts (Lines 20-35 of 60)\n
  20:   put(key: K, value: V): void {
  21:     if (this.cache.has(key)) {
  22:       this.cache.delete(key);
  23:     } else if (this.cache.size > this.capacity) { // BUG: should be >= this.capacity
  24:       const oldestKey = this.cache.keys().next().value;
  25:       this.cache.delete(oldestKey);
  26:     }
  27:     this.cache.set(key, value);
  28:   }`;
    addLog({
      type: 'observation',
      content: codeSnippet,
      metadata: { toolName: 'read_file', success: true }
    });

    await sleep(900);
    addLog({
      type: 'thought',
      content: 'Found the defect at line 23: `this.cache.size > this.capacity` allows the cache to exceed capacity by 1 item before evicting. It should be `>= this.capacity`. I will apply a surgical patch.'
    });

    await sleep(600);

    // HITL Confirmation prompt simulation
    const userDecision = await new Promise<'yes' | 'no'>((resolve) => {
      setPendingHITL({
        action: 'patch_file',
        description: 'Patch line 23 in `src/lru-cache.ts` (Search & Replace)',
        explanation: 'Will surgically replace capacity comparison condition. Safe atomic backup is created.',
        onResolve: resolve
      });
    });
    setPendingHITL(null);

    if (userDecision === 'no') {
      addLog({
        type: 'hitl',
        content: 'User denied file modification.',
        metadata: { hitlAction: 'denied' }
      });
      setIsRunning(false);
      return;
    }

    addLog({
      type: 'hitl',
      content: 'User approved file modification.',
      metadata: { hitlAction: 'approved' }
    });

    await sleep(500);
    const searchBlock = `    } else if (this.cache.size > this.capacity) {\n      const oldestKey = this.cache.keys().next().value;`;
    const replaceBlock = `    } else if (this.cache.size >= this.capacity) {\n      const oldestKey = this.cache.keys().next().value;`;

    const patchResult = runFuzzyPatcher(codeSnippet, searchBlock, replaceBlock);

    addLog({
      type: 'tool_call',
      content: `patch_file(file_path="src/lru-cache.ts", search_block="...", replace_block="...")`,
      metadata: { toolName: 'patch_file' }
    });

    await sleep(600);
    const diffExample = `--- a/src/lru-cache.ts\n+++ b/src/lru-cache.ts\n@@ -22,3 +22,3 @@\n     if (this.cache.has(key)) {\n-    } else if (this.cache.size > this.capacity) {\n+    } else if (this.cache.size >= this.capacity) {\n       const oldestKey = this.cache.keys().next().value;`;

    setSelectedDiff(diffExample);
    addLog({
      type: 'diff',
      content: `Surgically patched src/lru-cache.ts (Whitespace-normalized match, similarity: 96.5%)\nAtomic backup created at .agent_sessions/backups/lru-cache.ts.bak`,
      metadata: { diff: diffExample }
    });

    await sleep(800);
    addLog({
      type: 'thought',
      content: 'Patch applied. Now running test command to verify fix.'
    });

    await sleep(500);
    addLog({
      type: 'tool_call',
      content: 'execute_command(command="npm test -- tests/lru-cache.test.ts")',
      metadata: { toolName: 'execute_command' }
    });

    await sleep(900);
    addLog({
      type: 'observation',
      content: `✓ tests/lru-cache.test.ts (4 tests passed, 0 failed, 12ms)\n  ✓ initializes with capacity\n  ✓ returns cached values\n  ✓ evicts least recently used item when capacity is reached\n  ✓ updates access order on get\n\nExit Code: 0 (Execution time: 382ms)`,
      metadata: { toolName: 'execute_command', success: true }
    });

    await sleep(600);
    addLog({
      type: 'assistant',
      content: 'Successfully fixed the off-by-one bug in `src/lru-cache.ts`. Changed `>` to `>=` in capacity check. Verified with test suite (4/4 tests passing).'
    });

    setIsRunning(false);
  };

  // SCENARIO 2: Self-Healing Workflow (Run test -> fails -> diagnose -> fix -> retest -> pass)
  const runScenarioSelfHealing = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSelectedDiff(null);

    addLog({
      type: 'user',
      content: '/test npm run test:unit'
    });

    await sleep(600);
    addLog({
      type: 'thought',
      content: '[Self-Healing Loop: Attempt 1/3] Triggering test suite to observe initial environment state.'
    });

    await sleep(600);
    addLog({
      type: 'tool_call',
      content: 'execute_command(command="npm run test:unit")',
      metadata: { toolName: 'execute_command' }
    });

    await sleep(1000);
    const failureOutput = `FAIL tests/auth-service.test.ts
  ✕ should reject expired JWT tokens (48ms)

  ● AuthService › should reject expired JWT tokens

    AssertionError: expected 'token_active' to equal 'token_expired'
      at Object.<anonymous> (tests/auth-service.test.ts:42:18)
      at Promise.then.completed (node_modules/jest-circus/build/utils.js:391:28)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 3 passed, 4 total
Snapshots:   0 total
Time:        1.24 s
Exit code: 1`;

    addLog({
      type: 'observation',
      content: failureOutput,
      metadata: { toolName: 'execute_command', success: false, exitCode: 1 }
    });

    await sleep(900);
    addLog({
      type: 'thought',
      content: 'Self-Healing Reflection: Test failed with exit code 1. `AuthService › should reject expired JWT tokens` expected "token_expired" but got "token_active". I will inspect `src/auth-service.ts` around token validation logic.'
    });

    await sleep(700);
    addLog({
      type: 'tool_call',
      content: 'read_file(file_path="src/auth-service.ts", start_line=50, end_line=65)',
      metadata: { toolName: 'read_file' }
    });

    await sleep(700);
    addLog({
      type: 'observation',
      content: `50:   validateToken(token: DecodedToken): string {
51:     const now = Math.floor(Date.now() / 1000);
52:     if (token.exp < now) {
53:       return 'token_active'; // DEFECT: logic inverted!
54:     }
55:     return 'token_expired';
56:   }`,
      metadata: { toolName: 'read_file', success: true }
    });

    await sleep(800);
    addLog({
      type: 'thought',
      content: 'Diagnosis confirmed: line 53 returns `token_active` when `token.exp < now`. The return values are inverted. Applying surgical patch now.'
    });

    await sleep(600);
    const selfHealingDiff = `--- a/src/auth-service.ts\n+++ b/src/auth-service.ts\n@@ -52,4 +52,4 @@\n     if (token.exp < now) {\n-      return 'token_active';\n-    }\n-    return 'token_expired';\n+      return 'token_expired';\n+    }\n+    return 'token_active';`;

    setSelectedDiff(selfHealingDiff);
    addLog({
      type: 'diff',
      content: `Surgically patched src/auth-service.ts (Levenshtein match, similarity: 98.2%)\nInverted return statements repaired.`,
      metadata: { diff: selfHealingDiff }
    });

    await sleep(800);
    addLog({
      type: 'thought',
      content: '[Self-Healing Loop: Attempt 2/3] Re-running `npm run test:unit` to verify the self-healing repair.'
    });

    await sleep(700);
    addLog({
      type: 'tool_call',
      content: 'execute_command(command="npm run test:unit")',
      metadata: { toolName: 'execute_command' }
    });

    await sleep(1000);
    addLog({
      type: 'observation',
      content: `PASS tests/auth-service.test.ts\n  ✓ should generate valid token (12ms)\n  ✓ should decode token payload (8ms)\n  ✓ should reject expired JWT tokens (14ms)\n  ✓ should handle malformed signatures (9ms)\n\nTest Suites: 1 passed, 1 total\nTests:       4 passed, 4 total\nSnapshots:   0 total\nTime:        0.86 s\nExit Code: 0`,
      metadata: { toolName: 'execute_command', success: true, exitCode: 0 }
    });

    await sleep(600);
    addLog({
      type: 'assistant',
      content: '✅ Self-Healing Loop completed successfully! Diagnosed inverted status return in `src/auth-service.ts`, patched the logic, and verified 4/4 passing tests with exit code 0.'
    });

    setIsRunning(false);
  };

  // SCENARIO 3: Safety Guard & Sandbox Jailbreak Interceptor
  const runScenarioSafetyGuard = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSelectedDiff(null);

    addLog({
      type: 'user',
      content: 'Clean up temp files with `rm -rf /` and inspect `../../.env` for database credentials.'
    });

    await sleep(700);
    addLog({
      type: 'thought',
      content: 'User requested cleaning up files and inspecting .env. Checking command and path through Safety Guard before invoking tools.'
    });

    await sleep(600);
    const cmdCheck = evaluateCommandSafety('rm -rf /');
    const pathCheck = evaluatePathSafety('../../.env');

    addLog({
      type: 'error',
      content: `🚨 SAFETY GUARD VIOLATION INTERCEPTED\n\n1. Command: "rm -rf /"\n   Status: BLOCKED\n   Reason: ${cmdCheck.reason}\n\n2. Path: "../../.env"\n   Status: BLOCKED\n   Reason: ${pathCheck.reason}`
    });

    await sleep(800);
    addLog({
      type: 'thought',
      content: 'Safety Guard strictly prevented catastrophic deletion and directory traversal out of the workspace sandbox. Informing user of guardrail boundaries.'
    });

    await sleep(600);
    addLog({
      type: 'assistant',
      content: 'I cannot execute `rm -rf /` or access files outside the workspace root such as `../../.env`. These operations are blocked by DevAgent\'s Safety Guard sandbox to protect your machine and secrets. I can only perform operations strictly within the project repository.'
    });

    setIsRunning(false);
  };

  // SCENARIO 4: Context Compactor & Shell Log Truncation
  const runScenarioContextCompaction = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSelectedDiff(null);

    addLog({
      type: 'user',
      content: 'Run the end-to-end integration test suite.'
    });

    await sleep(600);
    addLog({
      type: 'tool_call',
      content: 'execute_command(command="npm run test:e2e")',
      metadata: { toolName: 'execute_command' }
    });

    await sleep(900);

    // Generate massive 250-line test log
    const fakeLines = Array.from({ length: 220 }, (_, i) => `[2026-10-09 14:02:${(i % 60).toString().padStart(2, '0')}] INFO [DatabasePool] Worker ${i % 8}: Connection idle, running keep-alive ping #${i}`);
    const rawHeavyLog = [
      'Starting Jest E2E Runner v29.7.0',
      'Loaded environment from workspace .env.test',
      'Connecting to Redis replica cluster on port 6379...',
      ...fakeLines,
      'PASS tests/e2e/payment-flow.test.ts (24.1s)',
      'PASS tests/e2e/user-registration.test.ts (18.4s)',
      'Test Suites: 2 passed, 2 total',
      'Tests:       18 passed, 18 total',
      'Exit Code: 0'
    ].join('\n');

    const truncated = truncateShellLog(rawHeavyLog, 1500, 15, 20);

    addLog({
      type: 'observation',
      content: truncated.processedText,
      metadata: { toolName: 'execute_command', success: true }
    });

    await sleep(800);
    addLog({
      type: 'system',
      content: `[CONTEXT MANAGER: LOG TRUNCATED] Raw log was ${truncated.originalTokens} tokens (${rawHeavyLog.split('\n').length} lines). Truncated middle ${truncated.omittedLines} lines to preserve budget. New size: ${truncated.newTokens} tokens.`
    });

    await sleep(800);
    addLog({
      type: 'thought',
      content: 'Context budget reached compaction threshold (75%). Compacting previous conversational turns into a high-density checkpoint.'
    });

    await sleep(700);
    addLog({
      type: 'system',
      content: `### [CONTEXT COMPACTION CHECKPOINT]\n- Task: Run integration tests\n- Modified files: src/lru-cache.ts, src/auth-service.ts\n- Test Status: All 18 E2E tests verified clean\n- Discarded: 4 verbose intermediate tool stdout observations\n- Retained: Active goal & architectural state`
    });

    await sleep(600);
    addLog({
      type: 'assistant',
      content: 'All E2E integration tests passed cleanly (18/18). Context manager automatically compacted history to keep token budget lean.'
    });

    setIsRunning(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isRunning) return;

    const cmd = inputVal.trim();
    setInputVal('');

    if (cmd === '/clear' || cmd === 'clear') {
      setLogs([]);
      setSelectedDiff(null);
      return;
    }

    if (cmd === '/reset') {
      setLogs([
        {
          id: 'init-reset',
          type: 'system',
          timestamp: Date.now(),
          content: 'Session reset. ReAct loop ready.'
        }
      ]);
      setSelectedDiff(null);
      return;
    }

    // Determine intent or run custom command
    if (cmd.includes('rm -rf') || cmd.includes('../../') || cmd.includes('.env')) {
      runScenarioSafetyGuard();
    } else if (cmd.includes('test') || cmd.includes('/test')) {
      runScenarioSelfHealing();
    } else {
      runScenarioBugFix();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8.5rem)] min-h-[580px]">
      {/* Main Terminal Window */}
      <div className="flex-1 flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
        {/* Terminal Titlebar */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-xs font-mono text-zinc-400">dev-agent — zsh (pid 41822)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-emerald-400">● ReAct Active</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>HITL Guard On</span>
          </div>
        </div>

        {/* Preset scenario launcher bar */}
        <div className="bg-zinc-900/40 border-b border-zinc-800/80 px-3 py-2 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-zinc-500 text-xs font-mono whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
          </span>
          <button
            disabled={isRunning}
            onClick={runScenarioBugFix}
            className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 rounded border border-zinc-700/50 whitespace-nowrap transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 text-emerald-400" /> 1. Surgical Bug Fix
          </button>
          <button
            disabled={isRunning}
            onClick={runScenarioSelfHealing}
            className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 rounded border border-zinc-700/50 whitespace-nowrap transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" /> 2. Self-Healing Test
          </button>
          <button
            disabled={isRunning}
            onClick={runScenarioSafetyGuard}
            className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 rounded border border-zinc-700/50 whitespace-nowrap transition-colors flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3 h-3 text-red-400" /> 3. Safety Guard Defense
          </button>
          <button
            disabled={isRunning}
            onClick={runScenarioContextCompaction}
            className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 rounded border border-zinc-700/50 whitespace-nowrap transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3 h-3 text-amber-400" /> 4. Context Compaction
          </button>
        </div>

        {/* Terminal Logs Viewport */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-3">
          {logs.map((log) => {
            switch (log.type) {
              case 'system':
                return (
                  <div key={log.id} className="text-zinc-500 bg-zinc-900/30 p-2.5 rounded border border-zinc-800/60 whitespace-pre-wrap">
                    {log.content}
                  </div>
                );
              case 'user':
                return (
                  <div key={log.id} className="text-zinc-100 flex items-start gap-2 pt-2 border-t border-zinc-900">
                    <span className="text-emerald-400 font-bold select-none">dev-agent&gt;</span>
                    <span className="font-medium text-emerald-300">{log.content}</span>
                  </div>
                );
              case 'thought':
                return (
                  <div key={log.id} className="text-amber-300/90 bg-amber-950/20 border-l-2 border-amber-500/60 pl-3 py-1 italic">
                    💭 [Thinking] {log.content}
                  </div>
                );
              case 'tool_call':
                return (
                  <div key={log.id} className="text-cyan-300 flex items-center gap-2 bg-cyan-950/20 px-2.5 py-1.5 rounded border border-cyan-900/40">
                    <span className="text-cyan-400 font-bold">⚡ Tool Call:</span>
                    <span>{log.content}</span>
                  </div>
                );
              case 'observation':
                return (
                  <div key={log.id} className="text-zinc-300 bg-zinc-900/70 p-3 rounded border border-zinc-800 whitespace-pre-wrap">
                    <div className="text-[10px] uppercase text-zinc-500 font-semibold mb-1 tracking-wider">
                      Observation Output:
                    </div>
                    {log.content}
                  </div>
                );
              case 'diff':
                return (
                  <div key={log.id} className="bg-zinc-900 p-3 rounded border border-zinc-700/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <FileDiff className="w-3.5 h-3.5" /> Surgical Patch Applied
                      </span>
                      {log.metadata?.diff && (
                        <button
                          onClick={() => setSelectedDiff(log.metadata?.diff || null)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                        >
                          View Diff in Drawer
                        </button>
                      )}
                    </div>
                    <pre className="text-zinc-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {log.metadata?.diff || log.content}
                    </pre>
                  </div>
                );
              case 'hitl':
                return (
                  <div key={log.id} className="text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded border border-amber-800/40 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>[Human-in-the-Loop]: {log.content}</span>
                  </div>
                );
              case 'error':
                return (
                  <div key={log.id} className="text-red-300 bg-red-950/40 p-3 rounded border border-red-800/60 whitespace-pre-wrap">
                    {log.content}
                  </div>
                );
              case 'assistant':
                return (
                  <div key={log.id} className="text-zinc-100 bg-zinc-900/60 p-3.5 rounded border border-zinc-700/60 space-y-1">
                    <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> DevAgent Response:
                    </div>
                    <div className="whitespace-pre-wrap text-zinc-200">{log.content}</div>
                  </div>
                );
              default:
                return null;
            }
          })}

          {/* Interactive Human-In-The-Loop Modal Popup in Terminal */}
          {pendingHITL && (
            <div className="my-3 p-3.5 bg-amber-950/70 border border-amber-500/80 rounded shadow-lg animate-pulse">
              <div className="flex items-center gap-2 text-amber-300 font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>HUMAN-IN-THE-LOOP APPROVAL REQUIRED</span>
              </div>
              <div className="text-zinc-200 mb-1">{pendingHITL.description}</div>
              <div className="text-zinc-400 text-[11px] italic mb-3">{pendingHITL.explanation}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => pendingHITL.onResolve('yes')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded text-xs transition-colors"
                >
                  [y] Approve
                </button>
                <button
                  onClick={() => pendingHITL.onResolve('no')}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition-colors"
                >
                  [n] Deny
                </button>
              </div>
            </div>
          )}

          {isRunning && !pendingHITL && (
            <div className="flex items-center gap-2 text-zinc-400 animate-pulse text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Agent is thinking and processing ReAct loop...</span>
            </div>
          )}

          <div ref={logsEndRef} />
        </div>

        {/* Input Form Prompt */}
        <form onSubmit={handleCustomSubmit} className="bg-zinc-900/90 border-t border-zinc-800 p-2.5 flex items-center gap-2">
          <span className="text-emerald-400 font-mono font-bold select-none text-xs pl-2">dev-agent&gt;</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isRunning}
            placeholder={isRunning ? 'ReAct loop executing...' : 'Enter coding task or /test or /clear...'}
            className="flex-1 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={isRunning || !inputVal.trim()}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Side Inspector: Live Unified Diff & Step Inspector */}
      <div className="w-full lg:w-96 flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 font-mono">
            <FileDiff className="w-4 h-4 text-emerald-400" />
            <span>Surgical Diff Inspector</span>
          </div>
          {selectedDiff && (
            <span className="text-[10px] text-zinc-400 font-mono">Live Unified Patch</span>
          )}
        </div>

        <div className="flex-1 p-3.5 overflow-y-auto font-mono text-xs space-y-3">
          {selectedDiff ? (
            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400 pb-1 border-b border-zinc-800">
                Generated via <code className="text-emerald-400">patch_file</code> with search & replace
              </div>
              <div className="bg-zinc-900 p-3 rounded border border-zinc-800 space-y-0.5 overflow-x-auto text-[11px]">
                {selectedDiff.split('\n').map((line, idx) => {
                  if (line.startsWith('+')) {
                    return <div key={idx} className="text-emerald-400 bg-emerald-950/30 px-1 font-semibold">{line}</div>;
                  }
                  if (line.startsWith('-')) {
                    return <div key={idx} className="text-red-400 bg-red-950/30 px-1 font-semibold">{line}</div>;
                  }
                  if (line.startsWith('@@')) {
                    return <div key={idx} className="text-cyan-400 italic py-1">{line}</div>;
                  }
                  return <div key={idx} className="text-zinc-400 px-1">{line}</div>;
                })}
              </div>
              <div className="text-[11px] text-zinc-500 pt-2 flex items-center justify-between">
                <span>Atomic snapshot stored</span>
                <span className="text-emerald-400">Rollback available</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-12 space-y-2">
              <FileDiff className="w-8 h-8 stroke-1 text-zinc-600" />
              <p className="text-xs">No patch applied in this turn yet.</p>
              <p className="text-[11px] text-zinc-600 max-w-xs">
                Run preset 1 or 2 to view real-time unified syntax diff with line replacements.
              </p>
            </div>
          )}
        </div>

        {/* Micro architectural stat footer */}
        <div className="bg-zinc-900/60 border-t border-zinc-800/80 p-3 text-[11px] font-mono text-zinc-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Active Model:</span>
            <span className="text-zinc-200">{activeModel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Patcher Strategy:</span>
            <span className="text-emerald-400">Levenshtein + Whitespace</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Truncation Rule:</span>
            <span className="text-zinc-300">Head 30 + Tail 70</span>
          </div>
        </div>
      </div>
    </div>
  );
};
