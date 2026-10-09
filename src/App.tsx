/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TabType } from './types/agent';
import { Header } from './components/Header';
import { TerminalStudio } from './components/TerminalStudio';
import { PatcherSandbox } from './components/PatcherSandbox';
import { SafetySandbox } from './components/SafetySandbox';
import { ContextSandbox } from './components/ContextSandbox';
import { ArchitectureView } from './components/ArchitectureView';
import { CodebaseExplorer } from './components/CodebaseExplorer';
import { TestRunner } from './components/TestRunner';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  const [activeModel, setActiveModel] = useState('claude-3-7-sonnet');
  const [tokenCount, setTokenCount] = useState(1480);
  const maxTokens = 128000;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header & Navigation Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeModel={activeModel}
        onModelChange={setActiveModel}
        tokenCount={tokenCount}
        maxTokens={maxTokens}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-y-auto">
        {activeTab === 'terminal' && (
          <TerminalStudio onUpdateTokens={setTokenCount} activeModel={activeModel} />
        )}
        {activeTab === 'patcher' && <PatcherSandbox />}
        {activeTab === 'safety' && <SafetySandbox />}
        {activeTab === 'context' && <ContextSandbox />}
        {activeTab === 'architecture' && <ArchitectureView />}
        {activeTab === 'code' && <CodebaseExplorer />}
        {activeTab === 'tests' && <TestRunner />}
      </main>

      {/* Global Status Bar */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-2 text-[11px] font-mono text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>DevAgent Engine: Autonomous ReAct Active</span>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <span>Surgical Levenshtein Patcher</span>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <span>Self-Healing Loop</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Sandbox: Workspace Root</span>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <span>Compaction Threshold: 75%</span>
        </div>
      </footer>
    </div>
  );
}
