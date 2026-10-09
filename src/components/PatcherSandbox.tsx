import React, { useState, useMemo } from 'react';
import { Scissors, Check, X, Sparkles, RefreshCw, Undo2, ArrowRight } from 'lucide-react';
import { runFuzzyPatcher, stringSimilarity } from '../engine/fuzzyPatcher';

const DEFAULT_ORIGINAL = `export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxTokens: number;
  private windowMs: number;

  constructor(maxTokens: number = 60, windowMs: number = 60000) {
    this.maxTokens = maxTokens;
    this.windowMs = windowMs;
  }

  public isAllowed(clientIp: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(clientIp) || [];
    
    // Filter timestamps within sliding window
    const valid = timestamps.filter(t => now - t < this.windowMs);
    
    if (valid.length >= this.maxTokens) {
      return false; // Rate limit exceeded
    }

    valid.push(now);
    this.requests.set(clientIp, valid);
    return true;
  }
}`;

const DEFAULT_SEARCH = `    // Filter timestamps within sliding window
    const valid = timestamps.filter(t => now - t < this.windowMs);
    
    if (valid.length >= this.maxTokens) {
      return false; // Rate limit exceeded
    }`;

const DEFAULT_REPLACE = `    // Filter timestamps within sliding window using binary search optimization
    const windowStart = now - this.windowMs;
    const valid = timestamps.filter(t => t > windowStart);
    
    if (valid.length >= this.maxTokens) {
      metrics.recordThrottle(clientIp);
      return false;
    }`;

export const PatcherSandbox: React.FC = () => {
  const [originalCode, setOriginalCode] = useState(DEFAULT_ORIGINAL);
  const [searchBlock, setSearchBlock] = useState(DEFAULT_SEARCH);
  const [replaceBlock, setReplaceBlock] = useState(DEFAULT_REPLACE);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.80);
  const [history, setHistory] = useState<string[]>([]);

  // Compute live match
  const patchResult = useMemo(() => {
    return runFuzzyPatcher(originalCode, searchBlock, replaceBlock, fuzzyThreshold);
  }, [originalCode, searchBlock, replaceBlock, fuzzyThreshold]);

  // Apply patch to original code
  const handleApply = () => {
    if (patchResult.success && patchResult.patchedContent) {
      setHistory((prev) => [...prev, originalCode]);
      setOriginalCode(patchResult.patchedContent);
    }
  };

  const handleRollback = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setOriginalCode(prev);
    }
  };

  // Preset drift mutators to test fuzzy resilience
  const injectWhitespaceDrift = () => {
    // Convert 4 spaces to 8 spaces / tab mix
    const drifted = searchBlock.split('\n').map((l) => '    ' + l.trimStart()).join('\n');
    setSearchBlock(drifted);
  };

  const injectTypoDrift = () => {
    // Model wrote slight comment typo
    const modified = searchBlock.replace('Filter timestamps within sliding window', 'Filter active timestamps inside sliding window period');
    setSearchBlock(modified);
  };

  const resetBlocks = () => {
    setOriginalCode(DEFAULT_ORIGINAL);
    setSearchBlock(DEFAULT_SEARCH);
    setReplaceBlock(DEFAULT_REPLACE);
    setHistory([]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Strategy Description */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-100 font-semibold font-mono text-sm">
              <Scissors className="w-4 h-4 text-emerald-400" />
              <span>Surgical File Patcher — 3-Stage Tolerance Engine</span>
            </div>
            <p className="text-zinc-400 text-xs mt-1">
              Never rewrite whole files. DevAgent matches code through: 1) Exact substring, 2) Whitespace & indentation normalization, and 3) Levenshtein sliding window distance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={injectWhitespaceDrift}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Indent Drift Test
            </button>
            <button
              onClick={injectTypoDrift}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Typo Drift Test
            </button>
            <button
              onClick={resetBlocks}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-700 transition-colors"
              title="Reset"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Match Engine Status Card */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-3 rounded border text-xs font-mono ${
            patchResult.match?.matchType === 'exact'
              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Stage 1: Exact Match</span>
              {patchResult.match?.matchType === 'exact' ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4" />}
            </div>
            <div className="text-[11px] mt-1 text-zinc-400">Verbatim substring matching</div>
          </div>

          <div className={`p-3 rounded border text-xs font-mono ${
            patchResult.match?.matchType === 'whitespace-normalized'
              ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Stage 2: Whitespace-Normalized</span>
              {patchResult.match?.matchType === 'whitespace-normalized' ? <Check className="w-4 h-4 text-cyan-400" /> : <X className="w-4 h-4" />}
            </div>
            <div className="text-[11px] mt-1 text-zinc-400">Tolerates tabs vs spaces & indentation offset</div>
          </div>

          <div className={`p-3 rounded border text-xs font-mono ${
            patchResult.match?.matchType === 'fuzzy-levenshtein'
              ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Stage 3: Levenshtein Window</span>
              {patchResult.match?.matchType === 'fuzzy-levenshtein' ? <Check className="w-4 h-4 text-amber-400" /> : <X className="w-4 h-4" />}
            </div>
            <div className="text-[11px] mt-1 text-zinc-400">
              Similarity: {patchResult.match ? `${(patchResult.match.similarity * 100).toFixed(1)}%` : 'N/A'} (Threshold: {(fuzzyThreshold * 100).toFixed(0)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Editor & Input Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Original Codebase */}
        <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-300 font-semibold">Target File (src/rate-limiter.ts)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={history.length === 0}
                onClick={handleRollback}
                className="px-2 py-0.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 flex items-center gap-1"
              >
                <Undo2 className="w-3.5 h-3.5" /> Rollback ({history.length})
              </button>
            </div>
          </div>
          <div className="p-3">
            <textarea
              value={originalCode}
              onChange={(e) => setOriginalCode(e.target.value)}
              rows={16}
              className="w-full bg-zinc-900/50 text-zinc-200 font-mono text-xs p-3 rounded border border-zinc-800/80 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Search Block & Replace Block */}
        <div className="flex flex-col space-y-4">
          {/* Search Block */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono">
              <span className="text-red-400 font-semibold">search_block (Context to locate)</span>
              <span className="text-zinc-500 text-[11px]">{searchBlock.split('\n').length} lines</span>
            </div>
            <div className="p-3">
              <textarea
                value={searchBlock}
                onChange={(e) => setSearchBlock(e.target.value)}
                rows={6}
                className="w-full bg-zinc-900/50 text-zinc-200 font-mono text-xs p-3 rounded border border-zinc-800/80 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Replace Block */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-semibold">replace_block (Surgical injection)</span>
              <span className="text-zinc-500 text-[11px]">{replaceBlock.split('\n').length} lines</span>
            </div>
            <div className="p-3">
              <textarea
                value={replaceBlock}
                onChange={(e) => setReplaceBlock(e.target.value)}
                rows={6}
                className="w-full bg-zinc-900/50 text-zinc-200 font-mono text-xs p-3 rounded border border-zinc-800/80 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Threshold Slider & Apply Patch Controls */}
      <div className="bg-zinc-900/70 border border-zinc-800 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-zinc-400 whitespace-nowrap">Fuzzy Threshold:</span>
          <input
            type="range"
            min="0.6"
            max="0.99"
            step="0.01"
            value={fuzzyThreshold}
            onChange={(e) => setFuzzyThreshold(parseFloat(e.target.value))}
            className="w-36 accent-emerald-500 cursor-pointer"
          />
          <span className="text-zinc-200 font-semibold">{(fuzzyThreshold * 100).toFixed(0)}%</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {patchResult.success ? (
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold rounded flex items-center gap-2 transition-colors"
            >
              <span>Apply Patch Surgically</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="text-red-400 flex items-center gap-1.5">
              <X className="w-4 h-4" />
              <span>{patchResult.error || 'Cannot match block'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Unified Diff Output Viewport */}
      {patchResult.diffText && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 text-xs font-mono text-zinc-300 font-semibold flex items-center justify-between">
            <span>Unified Diff Preview (git diff)</span>
            <span className="text-zinc-500 text-[11px]">Calculated via npm:diff</span>
          </div>
          <div className="p-4 font-mono text-xs overflow-x-auto space-y-1">
            {patchResult.diffText.split('\n').map((line, idx) => {
              if (line.startsWith('+')) {
                return <div key={idx} className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded">{line}</div>;
              }
              if (line.startsWith('-')) {
                return <div key={idx} className="text-red-400 bg-red-950/30 px-2 py-0.5 rounded">{line}</div>;
              }
              if (line.startsWith('@@')) {
                return <div key={idx} className="text-cyan-400 py-1">{line}</div>;
              }
              return <div key={idx} className="text-zinc-500 px-2">{line}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};
