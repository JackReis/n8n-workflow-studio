'use client';

import * as React from 'react';
import { useAppStore, PROVIDERS, DynamicModel } from '@/lib/store';
import { cn } from '@/lib/utils';

// Provider SVG Icons
const ProviderIcons: Record<string, React.ReactNode> = {
  openrouter: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  groq: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  zai: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  ),
  glm5: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      <circle cx="12" cy="8" r="2"/>
    </svg>
  ),
};

// Provider brand colors
const ProviderColors: Record<string, { bg: string; text: string; border: string }> = {
  openrouter: { bg: 'bg-gradient-to-br from-violet-600 to-purple-700', text: 'text-violet-400', border: 'border-violet-500/30' },
  gemini: { bg: 'bg-gradient-to-br from-blue-500 to-cyan-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  groq: { bg: 'bg-gradient-to-br from-orange-500 to-amber-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  openai: { bg: 'bg-gradient-to-br from-emerald-500 to-teal-500', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  zai: { bg: 'bg-gradient-to-br from-rose-500 to-pink-500', text: 'text-rose-400', border: 'border-rose-500/30' },
  glm5: { bg: 'bg-gradient-to-br from-indigo-500 to-violet-600', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

export function ProviderSelector() {
  const {
    provider,
    setProvider,
    model,
    setModel,
    apiKeys,
    setApiKey,
    dynamicModels,
    connectedProviders,
    addConnectedProvider,
    removeConnectedProvider,
    isLoadingModels,
    setIsLoadingModels,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
  } = useAppStore();

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const currentApiKey = apiKeys[provider] || '';
  const isConnected = connectedProviders.includes(provider);

  // Get models from API or show default with free tags
  const availableModels = dynamicModels[provider] || currentProvider?.defaultModels?.map(m => ({
    id: m,
    name: m.includes(':free') ? `${m.split(':')[0]} (FREE)` : m,
  })) || [];

  // Fetch models from API
  const fetchModels = React.useCallback(async (providerId: string, apiKey: string) => {
    if (!apiKey || apiKey.length < 10) return;

    setIsLoadingModels(true);
    try {
      const response = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey }),
      });
      const data = await response.json();

      if (data.success && data.models?.length > 0) {
        const modelsWithFree = data.models.map((m: DynamicModel) => ({
          ...m,
          name: m.id.includes(':free') ? `${m.name || m.id} (FREE)` : (m.name || m.id),
        }));
        useAppStore.getState().setDynamicModels(providerId, modelsWithFree);
        addConnectedProvider(providerId);
        if (modelsWithFree[0]?.id) {
          setModel(modelsWithFree[0].id);
        }
      } else {
        removeConnectedProvider(providerId);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      removeConnectedProvider(providerId);
    } finally {
      setIsLoadingModels(false);
    }
  }, [addConnectedProvider, removeConnectedProvider, setIsLoadingModels, setModel]);

  // Fetch on API key change
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentApiKey) {
        fetchModels(provider, currentApiKey);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [provider, currentApiKey, fetchModels]);

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const prov = PROVIDERS.find((p) => p.id === newProvider);
    if (prov?.defaultModels?.[0]) {
      setModel(prov.defaultModels[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">LLM Provider</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select AI provider & configure</p>
        </div>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 gap-2">
        {PROVIDERS.map((p) => {
          const colors = ProviderColors[p.id] || ProviderColors.openrouter;
          const icon = ProviderIcons[p.id];
          const isConn = connectedProviders.includes(p.id);
          const isSelected = provider === p.id;

          return (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={cn(
                'relative w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200',
                'border',
                isSelected
                  ? `bg-slate-800/80 ${colors.border} shadow-lg shadow-${p.id}-500/5`
                  : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/40'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-r', colors.bg)} />
              )}

              {/* Icon */}
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0',
                colors.bg
              )}>
                {icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isConn ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs text-emerald-400">Connected</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Requires API key</span>
                  )}
                </div>
              </div>

              {/* Status Icon */}
              {isConn && (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">API Key</label>
          {currentProvider?.getKeyUrl && (
            <a
              href={currentProvider.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              Get API Key
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
        <div className="relative">
          <input
            type="password"
            placeholder={isConnected ? "●●●●●●●●●●●●●●●●" : "sk-..."}
            value={currentApiKey}
            onChange={(e) => setApiKey(provider, e.target.value)}
            className="w-full h-11 px-4 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {isConnected && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">...{currentApiKey.slice(-4)}</span>
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Model</label>
          {isLoadingModels && (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          )}
        </div>
        <select
          value={model}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModel(e.target.value)}
          className="w-full h-11 px-4 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '20px',
            paddingRight: '40px'
          }}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id} className="bg-slate-800 py-2">
              {m.name || m.id}
            </option>
          ))}
        </select>
        {model.includes(':free') && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Free tier available
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Parameters</h4>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Temperature</span>
            <span className="text-sm font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Max Tokens</span>
          </div>
          <input
            type="number"
            min="256"
            max="32768"
            step="256"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
            className="w-full h-10 px-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
