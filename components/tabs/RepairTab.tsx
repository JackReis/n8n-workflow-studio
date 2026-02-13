'use client';

import * as React from 'react';
import { useAppStore, ValidationError } from '@/lib/store';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { DiffViewer } from '@/components/editor/DiffViewer';
import { cn } from '@/lib/utils';

// Sample broken workflow for testing
const SAMPLE_BROKEN_WORKFLOW = `{
  "name": "Test Workflow",
  "nodes": [
    {
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ],
  "connections": {}
}`;

export function RepairTab() {
  const {
    currentJson,
    setCurrentJson,
    repairedJson,
    setRepairedJson,
    validationErrors,
    setValidationErrors,
    validationResult,
    setValidationResult,
    isLoading,
    setIsLoading,
    addToHistory,
    provider,
    model,
    getApiKey,
  } = useAppStore();

  const [showDiff, setShowDiff] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCurrentJson(content);
        setValidationErrors([]);
        setValidationResult(null);
        setRepairedJson('');
        setShowDiff(false);
      };
      reader.readAsText(file);
    }
  };

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCurrentJson(content);
        setValidationErrors([]);
        setValidationResult(null);
        setRepairedJson('');
        setShowDiff(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Validate JSON
  const handleValidate = async () => {
    if (!currentJson) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonString: currentJson, fullValidation: true }),
      });
      const data = await response.json();

      // Store the full validation result
      setValidationResult(data);

      // Combine errors and warnings, marking warnings with severity
      const errors = (data.errors || []).map((e: ValidationError) => ({
        ...e,
        severity: e.severity || 'error'
      }));

      const warnings = (data.warnings || []).map((w: ValidationError) => ({
        ...w,
        severity: 'warning' as const
      }));

      setValidationErrors([...errors, ...warnings]);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult(null);
      setValidationErrors([
        {
          code: 'E000',
          message: 'Failed to validate JSON - ' + (error instanceof Error ? error.message : 'Unknown error'),
          path: '',
          severity: 'error' as const,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Repair JSON using LLM
  const handleRepair = async () => {
    if (!currentJson) return;

    const apiKey = getApiKey(provider);
    if (!apiKey) {
      setValidationErrors([
        ...validationErrors,
        {
          code: 'E001',
          message: 'Please enter an API key for ' + provider,
          path: '',
          severity: 'error',
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      // Parse JSON string to object for API
      let workflowObj;
      try {
        workflowObj = JSON.parse(currentJson);
      } catch {
        setValidationErrors([
          ...validationErrors,
          {
            code: 'E000',
            message: 'Invalid JSON format',
            path: '',
            severity: 'error',
          },
        ]);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: workflowObj,
          errors: validationErrors,
          provider,
          model,
          apiKey,
        }),
      });
      const data = await response.json();

      if (data.success && data.workflow) {
        const repairedStr = typeof data.workflow === 'string' ? data.workflow : JSON.stringify(data.workflow, null, 2);
        setRepairedJson(repairedStr);
        setShowDiff(true);
        addToHistory({
          type: 'repair',
          timestamp: new Date().toISOString(),
          provider,
          model,
          input: currentJson,
          output: repairedStr,
          errors: validationErrors,
          success: true,
        });
      } else {
        setValidationErrors([
          ...validationErrors,
          {
            code: 'E999',
            message: data.error || 'Repair failed',
            path: '',
            severity: 'error' as const,
          },
        ]);
      }
    } catch (error) {
      console.error('Repair error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Download repaired JSON
  const handleDownload = () => {
    const blob = new Blob([repairedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repaired-workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load sample
  const handleLoadSample = () => {
    setCurrentJson(SAMPLE_BROKEN_WORKFLOW);
    setValidationErrors([]);
    setRepairedJson('');
    setShowDiff(false);
  };

  // Convert errors to Monaco markers
  const errorMarkers = validationErrors
    .filter((e) => e.path)
    .map((e) => ({
      lineNumber: 1, // Would need proper JSON path parsing
      message: e.message,
      severity: e.severity as 'error' | 'warning',
    }));

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;
  const hasErrors = errorCount > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs sm:text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="hidden sm:inline">Upload</span>
        </button>

        <button
          onClick={handleLoadSample}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs sm:text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Sample</span>
        </button>

        <div className="hidden sm:block w-px h-6 bg-slate-700" />

        <button
          onClick={handleValidate}
          disabled={!currentJson || isLoading}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-xs sm:text-sm text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="hidden sm:inline">Validate</span>
        </button>

        <button
          onClick={handleRepair}
          disabled={!currentJson || !hasErrors || isLoading}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-xs sm:text-sm text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          <span className="hidden sm:inline">Fix with AI</span>
          <span className="sm:hidden">Fix</span>
        </button>

        {repairedJson && (
          <>
            <div className="flex-1" />
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all",
                showDiff
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700/60"
              )}
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="hidden sm:inline">{showDiff ? 'Hide Diff' : 'Show Diff'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs sm:text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </button>
          </>
        )}
      </div>

      {/* Main Content - Responsive: stack on mobile, side-by-side on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-white/10">
          {/* Upload Area / Editor */}
          <div
            className="flex-1 overflow-hidden"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {!currentJson ? (
              <div className="h-full flex items-center justify-center p-4 sm:p-8">
                <div
                  className="w-full max-w-lg p-4 sm:p-8 rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/30 text-center cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/50 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-white mb-1">Drop JSON file here</p>
                  <p className="text-xs sm:text-sm text-slate-500">or click to browse</p>
                </div>
              </div>
            ) : showDiff && repairedJson ? (
              <DiffViewer original={currentJson} modified={repairedJson} height="100%" />
            ) : (
              <MonacoEditor
                value={currentJson}
                onChange={setCurrentJson}
                errors={errorMarkers}
                height="100%"
              />
            )}
          </div>
        </div>

        {/* Error List - Responsive: bottom panel on mobile, side panel on desktop */}
        <div className="w-full lg:w-64 xl:w-72 flex flex-col min-h-0 bg-slate-900/50 max-h-[35vh] lg:max-h-none overflow-y-auto">
          {/* Error Header */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-medium text-white">Validation Results</h3>
              {validationErrors.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-2">
                  {errorCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                      {errorCount} error{errorCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                      {warningCount} warning{warningCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Content */}
          <div className="flex-1 overflow-y-auto">
            {!currentJson ? (
              <div className="p-4">
                <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">No JSON loaded</p>
                  <p className="text-xs text-slate-600 mt-1">Upload a file or click Sample</p>
                </div>
              </div>
            ) : !validationResult ? (
              <div className="p-4">
                <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-400">Click <span className="text-blue-400 font-medium">Validate</span> to check JSON</p>
                  <p className="text-xs text-slate-600 mt-1">or load a workflow file</p>
                </div>
              </div>
            ) : validationResult.valid && validationErrors.length === 0 ? (
              <div className="p-4">
                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-emerald-400 font-medium">Valid Workflow</p>
                  <p className="text-xs text-slate-400 mt-1">No errors or warnings found</p>
                  {validationResult.stats && (
                    <div className="mt-3 text-xs text-slate-500">
                      {validationResult.stats.nodeCount} nodes • Stage {validationResult.stage}
                    </div>
                  )}
                </div>
              </div>
            ) : errorCount === 0 && warningCount > 0 ? (
              <div className="p-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center mb-4">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-emerald-400">JSON is valid!</p>
                  <p className="text-xs text-slate-500 mt-1">{warningCount} suggestion{warningCount > 1 ? 's' : ''} below</p>
                </div>
                <div className="space-y-2">
                  {validationErrors.map((error, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40 transition-all"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-yellow-500/20">
                          <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                              {error.code}
                            </span>
                            {error.node && (
                              <span className="text-xs text-slate-500 truncate">{error.node}</span>
                            )}
                          </div>
                          <p className="text-sm text-yellow-300">{error.message}</p>
                          {error.suggestion && (
                            <p className="text-xs text-slate-500 mt-1.5 italic">{error.suggestion}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border transition-all',
                      error.severity === 'error'
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                        : 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5',
                        error.severity === 'error' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                      )}>
                        {error.severity === 'error' ? (
                          <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                            {error.code}
                          </span>
                          {error.node && (
                            <span className="text-xs text-slate-500 truncate">
                              {error.node}
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          'text-sm',
                          error.severity === 'error' ? 'text-red-300' : 'text-yellow-300'
                        )}>
                          {error.message}
                        </p>
                        {error.path && (
                          <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                            {error.path}
                          </p>
                        )}
                        {error.suggestion && (
                          <p className="text-xs text-slate-500 mt-1.5 italic">
                            {error.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
