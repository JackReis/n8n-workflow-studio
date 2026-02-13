'use client';

import * as React from 'react';
import { ProviderSelector } from './ProviderSelector';
import { useAppStore } from '@/lib/store';

// n8n-style logo SVG
const LogoIcon = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
    <rect x="2" y="2" width="28" height="28" rx="8" className="fill-purple-600" />
    <path d="M10 16L14 12V20L10 16Z" className="fill-white" />
    <path d="M18 12L22 16L18 20V12Z" className="fill-white" />
    <circle cx="16" cy="16" r="2" className="fill-white" />
  </svg>
);

export function Sidebar() {
  const { clearApiKeys, connectedProviders } = useAppStore();
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClearKeys = () => {
    if (showConfirm) {
      clearApiKeys();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 lg:w-64 xl:w-72 2xl:w-80
          border-r border-white/5 bg-slate-950/95 backdrop-blur-xl
          flex flex-col h-full
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
              <LogoIcon />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">Workflow Studio</h1>
              <p className="text-xs text-slate-500 truncate">Multi-LLM n8n Tool</p>
            </div>
          </div>
        </div>

        {/* Provider Settings - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <ProviderSelector />
        </div>

        {/* Connected Providers */}
        {connectedProviders.length > 0 && (
          <div className="px-3 sm:px-4 py-3 border-t border-white/5">
            <p className="text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-2">Active</p>
            <div className="flex flex-wrap gap-1.5">
              {connectedProviders.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 sm:p-4 border-t border-white/5">
          <button
            onClick={handleClearKeys}
            className={`w-full h-10 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              showConfirm
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="truncate">{showConfirm ? 'Confirm Clear' : 'Clear API Keys'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-3 border-t border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-600">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="truncate">BYOK — Keys never leave browser</span>
          </div>
        </div>
      </aside>
    </>
  );
}
