import React from 'react';
import { Terminal, Shield, Cpu, Scissors, FileCode, PlayCircle, BookOpen, Sparkles } from 'lucide-react';
import { TabType } from '../types/agent';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeModel: string;
  onModelChange: (model: string) => void;
  tokenCount: number;
  maxTokens: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  activeModel,
  onModelChange,
  tokenCount,
  maxTokens
}) => {
  const tokenRatio = tokenCount / maxTokens;
  const tokenPercent = (tokenRatio * 100).toFixed(1);

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'terminal', label: 'Terminal Studio', icon: <Terminal className="w-4 h-4" /> },
    { id: 'patcher', label: 'Fuzzy Patcher', icon: <Scissors className="w-4 h-4" /> },
    { id: 'safety', label: 'Safety Guard', icon: <Shield className="w-4 h-4" /> },
    { id: 'context', label: 'Context Budget', icon: <Cpu className="w-4 h-4" /> },
    { id: 'architecture', label: 'Architecture', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'code', label: 'CLI Codebase', icon: <FileCode className="w-4 h-4" /> },
    { id: 'tests', label: 'Test Suite', icon: <PlayCircle className="w-4 h-4" /> }
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Meta info without pill enclosures */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-mono font-bold text-sm shadow-sm">
              &gt;_
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-100 text-sm tracking-tight font-mono">DevAgent</span>
                <span className="text-zinc-500 text-xs">v1.0.0</span>
                <span className="text-zinc-600 text-xs" aria-hidden="true">·</span>
                <span className="text-zinc-400 text-xs hidden sm:inline">Claude Code & Aider Spec</span>
              </div>
            </div>
          </div>

          {/* Model selector & Token budget gauge */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="hidden md:flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-500">Context:</span>
              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    tokenRatio > 0.75 ? 'bg-red-500' : tokenRatio > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, tokenRatio * 100))}%` }}
                />
              </div>
              <span className={tokenRatio > 0.75 ? 'text-red-400' : 'text-zinc-300'}>
                {tokenCount.toLocaleString()} / {maxTokens.toLocaleString()} ({tokenPercent}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5 border border-zinc-800 rounded bg-zinc-900/60 px-2 py-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <select
                aria-label="Select AI Model"
                value={activeModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="claude-3-7-sonnet" className="bg-zinc-900 text-zinc-200">Claude 3.7 Sonnet (ReAct Engine)</option>
                <option value="gemini-2.5-flash" className="bg-zinc-900 text-zinc-200">Gemini 2.5 Flash</option>
                <option value="deterministic-mock" className="bg-zinc-900 text-zinc-200">Deterministic Mock LLM</option>
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Interactive Segmented Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto py-1.5 border-t border-zinc-900/60 no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
