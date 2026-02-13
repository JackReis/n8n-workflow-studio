'use client';

import * as React from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { RepairTab } from '@/components/tabs/RepairTab';
import { GenerateTab } from '@/components/tabs/GenerateTab';
import { useAppStore, PROVIDERS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// History Tab Component
function HistoryTab() {
  const { history, clearHistory } = useAppStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-semibold text-white">Operation History</h2>
          <p className="text-sm text-slate-400">View your past operations</p>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearHistory} className="border-slate-600 hover:bg-slate-700">
            Clear All
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 rounded-2xl bg-slate-800/30 border border-slate-700/50">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-300">No operations yet</p>
              <p className="text-sm text-slate-500 mt-1">Your repair and generate history will appear here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={item.id || index}
                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    item.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {item.type === 'repair' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white capitalize">{item.type}</span>
                      {item.provider && item.model && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                          {item.model.split('/').pop()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.success
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {item.success ? 'Success' : 'Failed'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab() {
  const { apiKeys, clearApiKeys, temperature, setTemperature, maxTokens, setMaxTokens } = useAppStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white">Settings</h2>
        <p className="text-sm text-slate-400">Configure your preferences</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* API Keys */}
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <h3 className="text-lg font-medium text-white mb-1">API Keys</h3>
            <p className="text-sm text-slate-400 mb-4">
              Keys are stored locally in your browser and never sent to our servers.
            </p>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      p.id === 'openrouter' ? 'bg-purple-500/20 text-purple-400' :
                      p.id === 'gemini' ? 'bg-blue-500/20 text-blue-400' :
                      p.id === 'groq' ? 'bg-orange-500/20 text-orange-400' :
                      p.id === 'openai' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {p.name[0]}
                    </div>
                    <span className="text-slate-300">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {apiKeys[p.id] ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-sm text-slate-400 font-mono">
                          ****{apiKeys[p.id].slice(-4)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">Not configured</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={clearApiKeys} className="mt-4 border-red-500/30 text-red-400 hover:bg-red-500/10">
              Clear All Keys
            </Button>
          </div>

          {/* Generation Settings */}
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <h3 className="text-lg font-medium text-white mb-4">Generation Settings</h3>

            <div className="space-y-5">
              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Temperature</label>
                  <span className="text-sm text-purple-400 font-mono">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Deterministic</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Max Tokens</label>
                <input
                  type="number"
                  min="256"
                  max="32768"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Maximum length of generated response</p>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <h3 className="text-lg font-medium text-white mb-2">About n8n Workflow Studio</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              A powerful multi-LLM tool for generating and repairing n8n workflow JSON files.
              Built with Next.js, Monaco Editor, and shadcn/ui. Bring Your Own Key (BYOK) -
              all LLM calls are made directly from your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
          {/* Tab Headers */}
          <div className="border-b border-white/10 px-2 sm:px-4 lg:px-6 bg-slate-900/50 backdrop-blur-sm overflow-x-auto">
            <TabsList className="h-12 sm:h-14 bg-transparent gap-0.5 sm:gap-1 flex-nowrap">
              <TabsTrigger
                value="repair"
                className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/30 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg border border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm">Repair</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="generate"
                className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/30 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg border border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-xs sm:text-sm">Generate</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg border border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm">History</span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-slate-500/20 data-[state=active]:text-slate-300 data-[state=active]:border-slate-500/30 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg border border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm">Settings</span>
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <TabsContent value="repair" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
            <RepairTab />
          </TabsContent>
          <TabsContent value="generate" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
            <GenerateTab />
          </TabsContent>
          <TabsContent value="history" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="settings" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
