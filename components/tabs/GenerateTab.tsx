'use client';

import * as React from 'react';
import { useAppStore } from '@/lib/store';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { cn } from '@/lib/utils';

// Skill analysis type
interface SkillAnalysis {
  complexity: string;
  intents: Array<{ category: string; confidence: number; keywords: string[] }>;
  suggestedPatterns: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    bestPractices: string[];
  }>;
  requiredIntegrations: string[];
  estimatedNodeCount: number;
}

export function GenerateTab() {
  const {
    currentJson,
    setCurrentJson,
    repairedJson,
    setRepairedJson,
    validationErrors,
    setValidationErrors,
    isLoading,
    setIsLoading,
    addToHistory,
    provider,
    model,
    getApiKey,
  } = useAppStore();

  const [prompt, setPrompt] = React.useState('');
  const [skillAnalysis, setSkillAnalysis] = React.useState<SkillAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  // Analyze prompt with skills system
  const analyzePromptSkills = React.useCallback(async (text: string) => {
    if (!text.trim() || text.length < 10) {
      setSkillAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/skills/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, maxPatterns: 4 }),
      });
      const data = await response.json();

      if (data.success && data.analysis) {
        setSkillAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Skill analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Debounced skill analysis
  React.useEffect(() => {
    const timer = setTimeout(() => {
      analyzePromptSkills(prompt);
    }, 500);
    return () => clearTimeout(timer);
  }, [prompt, analyzePromptSkills]);

  // Generate workflow from prompt
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const apiKey = getApiKey(provider);
    if (!apiKey) {
      setValidationErrors([
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
      const response = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          mode: 'generate_workflow',
          input: { description: prompt },
          apiKey,
        }),
      });
      const data = await response.json();

      if (data.success && data.content) {
        setCurrentJson(data.content);
        setRepairedJson('');
        // Show parse warning as warning, not error (if present)
        if (data.error) {
          setValidationErrors([
            {
              code: 'W001',
              message: data.error,
              path: '',
              severity: 'warning',
            },
          ]);
        } else {
          setValidationErrors([]);
        }

        addToHistory({
          type: 'generate',
          timestamp: new Date().toISOString(),
          provider,
          model,
          input: prompt,
          output: data.content,
          errors: data.error ? [{ code: 'W001', message: data.error, path: '', severity: 'warning' }] : [],
          success: true,
        });
      } else {
        setValidationErrors([
          {
            code: 'E998',
            message: data.error || 'Generation failed',
            path: '',
            severity: 'error',
          },
        ]);
      }
    } catch (error) {
      console.error('Generation error:', error);
      setValidationErrors([
        {
          code: 'E997',
          message: 'Failed to connect to LLM API',
          path: '',
          severity: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Validate generated JSON
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
      setValidationErrors(data.errors || []);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Repair if validation fails
  const handleRepair = async () => {
    if (!currentJson) return;

    const apiKey = getApiKey(provider);
    if (!apiKey) {
      setValidationErrors([
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
      // Parse JSON for API
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
        setCurrentJson(repairedStr);
        setValidationErrors([]);
      }
    } catch (error) {
      console.error('Repair error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Download
  const handleDownload = () => {
    const jsonToDownload = repairedJson || currentJson;
    if (!jsonToDownload) return;

    const blob = new Blob([jsonToDownload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Example prompts
  const examplePrompts = [
    { text: 'Create an RSS feed reader that sends new items to Slack', icon: '📡' },
    { text: 'Build a webhook endpoint that transforms JSON and forwards to an API', icon: '🔗' },
    { text: 'Read Google Sheets and create tasks in Notion', icon: '📊' },
    { text: 'Email automation that triggers on form submissions', icon: '📧' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isLoading}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-xs sm:text-sm text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          )}
          <span className="hidden sm:inline">Generate</span>
          <span className="sm:hidden">Gen</span>
        </button>

        <div className="hidden sm:block w-px h-6 bg-slate-700" />

        <button
          onClick={handleValidate}
          disabled={!currentJson || isLoading}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs sm:text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">Validate</span>
        </button>

        <button
          onClick={handleRepair}
          disabled={!currentJson || validationErrors.length === 0 || isLoading}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs sm:text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="hidden sm:inline">Auto-Fix</span>
          <span className="sm:hidden">Fix</span>
        </button>

        {currentJson && (
          <>
            <div className="flex-1" />
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
        {/* Prompt Section */}
        <div className="w-full lg:w-72 xl:w-80 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-900/30 max-h-[40vh] lg:max-h-none overflow-y-auto">
          {/* Prompt Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-white">Describe Your Workflow</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tell the AI what you want to build</p>
          </div>

          {/* Prompt Input */}
          <div className="flex-1 p-4 overflow-y-auto">
            <textarea
              placeholder="Describe the n8n workflow you want to create in detail..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
            />

            {/* Skill Analysis Panel */}
            {skillAnalysis && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Skills Analysis
                  </h4>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    skillAnalysis.complexity === 'simple' && 'bg-green-500/20 text-green-400',
                    skillAnalysis.complexity === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                    skillAnalysis.complexity === 'complex' && 'bg-orange-500/20 text-orange-400'
                  )}>
                    {skillAnalysis.complexity}
                  </span>
                </div>

                {/* Detected Intents */}
                {skillAnalysis.intents.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-2">Detected Intents</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillAnalysis.intents.slice(0, 4).map((intent, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-300">
                          {intent.category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Patterns */}
                {skillAnalysis.suggestedPatterns.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-2">Patterns to Apply</p>
                    <div className="space-y-1.5">
                      {skillAnalysis.suggestedPatterns.slice(0, 3).map((pattern, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/30">
                          <div className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            pattern.category === 'trigger' && 'bg-blue-400',
                            pattern.category === 'integration' && 'bg-purple-400',
                            pattern.category === 'transform' && 'bg-green-400',
                            pattern.category === 'output' && 'bg-yellow-400',
                            pattern.category === 'error' && 'bg-red-400'
                          )} />
                          <span className="text-xs text-slate-300 truncate">{pattern.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Integrations */}
                {skillAnalysis.requiredIntegrations.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Integrations: {skillAnalysis.requiredIntegrations.join(', ')}</span>
                  </div>
                )}

                {/* Estimated Node Count */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30 text-xs text-slate-500">
                  <span>Estimated nodes: {skillAnalysis.estimatedNodeCount}</span>
                  <span>{skillAnalysis.suggestedPatterns.length} patterns matched</span>
                </div>
              </div>
            )}

            {/* Analyzing indicator */}
            {isAnalyzing && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Analyzing prompt...</span>
              </div>
            )}

            {/* Example prompts */}
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Try an example</p>
              <div className="space-y-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example.text)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-left hover:bg-slate-800/50 hover:border-slate-600/40 transition-all group"
                  >
                    <span className="text-lg">{example.icon}</span>
                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                      {example.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden">
            {!currentJson ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-slate-400 mb-1">Generated workflow will appear here</p>
                  <p className="text-sm text-slate-600">Enter a prompt and click Generate</p>
                </div>
              </div>
            ) : (
              <MonacoEditor
                value={repairedJson || currentJson}
                onChange={setCurrentJson}
                height="100%"
              />
            )}
          </div>

          {/* Error list */}
          {validationErrors.length > 0 && (
            <div className="border-t border-white/10 bg-slate-900/50 max-h-40 overflow-y-auto">
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-xs font-medium text-slate-500">
                  {validationErrors.filter(e => e.severity === 'error').length} error(s), {validationErrors.filter(e => e.severity === 'warning').length} warning(s)
                </p>
              </div>
              <div className="p-2 space-y-1">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded-lg text-sm',
                      error.severity === 'error'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-yellow-500/10 text-yellow-300'
                    )}
                  >
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 flex-shrink-0">
                      {error.code}
                    </span>
                    <span>{error.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
