import React from 'react';
import { BookOpen, RefreshCw, Wrench, Shield, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const pillars = [
    {
      id: 'loop',
      title: 'Pillar 1: Loop (ReAct & Self-Healing)',
      color: 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400',
      icon: <RefreshCw className="w-5 h-5 text-emerald-400" />,
      description: 'The autonomous driver and self-healing state machine.',
      features: [
        'User Input ➔ Build Context ➔ LLM Streaming (Reasoning + Tool Use) ➔ Execute ➔ Observation ➔ Reflection.',
        'Continuous Self-Healing Loop: Runs build/test commands, captures non-zero exit codes & stderr traces, synthesizes repair prompt, and retries up to 3-5 times.',
        'Session checkpointing to `.agent_sessions/<session_id>.json` for /resume capability.'
      ]
    },
    {
      id: 'tool',
      title: 'Pillar 2: Tool (Surgical Patch & Shell)',
      color: 'border-cyan-500/60 bg-cyan-950/20 text-cyan-400',
      icon: <Wrench className="w-5 h-5 text-cyan-400" />,
      description: 'Precise filesystem operations without catastrophic full-file overwrites.',
      features: [
        'patch_file: 3-stage matching tolerance (Exact ➔ Whitespace-Normalized ➔ Levenshtein Sliding Window).',
        'Atomic rollback buffer in memory before file modification to allow instant recovery.',
        'execute_command: Execa child processes with dynamic timeouts (60s default) and live stdout/stderr capture.',
        'read_file & search_code: Safe 1-indexed slicing and ripgrep-style workspace search.'
      ]
    },
    {
      id: 'permission',
      title: 'Pillar 3: Permission (Safety Guard & HITL)',
      color: 'border-amber-500/60 bg-amber-950/20 text-amber-400',
      icon: <Shield className="w-5 h-5 text-amber-400" />,
      description: 'Defensive boundaries protecting local environment and secrets.',
      features: [
        'Dangerous command blacklist interceptor: Blocks rm -rf /, git push --force, fork bombs, and raw disk writes.',
        'Workspace sandbox jailbreak protection: Validates path.resolve() stays strictly inside root.',
        'Secret sanitizer: Masks API keys, tokens, and protects .env files from LLM transmission.',
        'Human-in-the-Loop interactive confirmation: Prompts developer with [y]es / [n]o / [e]xplain on state mutations.'
      ]
    },
    {
      id: 'context',
      title: 'Pillar 4: Context (Token Budget & Compaction)',
      color: 'border-purple-500/60 bg-purple-950/20 text-purple-400',
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      description: 'Dynamic token budget management and context preservation.',
      features: [
        'Dynamic token estimation (~0.28 tokens/char, ~1 per CJK) across all conversation turns.',
        'Intelligent Shell Log Truncation: Keeps Head 30 lines (environment/test start) + Tail 70 lines (stack traces/exit code) when logs exceed 2000 tokens.',
        'Auto-Compaction: Triggers at 75% window budget to replace verbose intermediate tool outputs with a structured milestone summary.',
        'Rule injection: Pre-loads AGENT.md, CLAUDE.md, and .agentrules into System Prompt header.'
      ]
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold font-mono text-sm">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Core Architecture Specifications (miniclaudecode_typescript & Claude Code Spec)</span>
        </div>
        <p className="text-zinc-400 text-xs mt-1">
          Designed after the 4 foundational pillars: <strong>Loop</strong>, <strong>Tool</strong>, <strong>Permission</strong>, and <strong>Context</strong>.
        </p>
      </div>

      {/* ReAct Loop Flowchart */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 font-mono text-xs">
        <div className="text-zinc-200 font-semibold mb-3 flex items-center gap-2">
          <span>ReAct State Flow & Self-Healing Pipeline</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-center">
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-emerald-400 font-bold">1. User Input</div>
            <div className="text-[10px] text-zinc-500 mt-1">Task or /test command</div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-cyan-400 font-bold">2. Context</div>
            <div className="text-[10px] text-zinc-500 mt-1">Rules + Budget check</div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-amber-400 font-bold">3. LLM ReAct</div>
            <div className="text-[10px] text-zinc-500 mt-1">Thought + Tool Schema</div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-purple-400 font-bold">4. Guard & HITL</div>
            <div className="text-[10px] text-zinc-500 mt-1">[y]/[n]/[e] Confirmation</div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-rose-400 font-bold">5. Execution</div>
            <div className="text-[10px] text-zinc-500 mt-1">Patcher / Shell / Log</div>
          </div>
          <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
            <div className="text-emerald-400 font-bold">6. Self-Healing</div>
            <div className="text-[10px] text-zinc-500 mt-1">Iterative retry loop</div>
          </div>
        </div>
      </div>

      {/* 4 Core Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {pillars.map((p) => (
          <div key={p.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">{p.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 font-mono">{p.title}</h3>
                  <p className="text-xs text-zinc-400">{p.description}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-zinc-300 font-mono">
                {p.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-zinc-900/50 p-2 rounded border border-zinc-800/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
