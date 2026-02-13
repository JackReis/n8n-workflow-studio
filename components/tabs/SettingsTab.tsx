'use client';

import * as React from 'react';
import { useAppStore, PROVIDERS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function SettingsTab() {
  const {
    provider,
    setProvider,
    model,
    setModel,
    apiKeys,
    setApiKey,
    clearApiKeys,
    clearHistory,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
  } = useAppStore();

  const currentProvider = PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* API Keys Section */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configure API keys for LLM providers. Keys are stored locally and never sent to our servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PROVIDERS.map((p) => (
              <div key={p.id} className="space-y-2">
                <Label htmlFor={`key-${p.id}`} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                      provider === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    {p.icon || p.name[0]}
                  </span>
                  {p.name}
                </Label>
                <Input
                  id={`key-${p.id}`}
                  type="password"
                  placeholder={`Enter ${p.name} API key...`}
                  value={apiKeys[p.id] || ''}
                  onChange={(e) => setApiKey(p.id, e.target.value)}
                />
              </div>
            ))}

            <Button variant="destructive" size="sm" onClick={clearApiKeys}>
              Clear All API Keys
            </Button>
          </CardContent>
        </Card>

        {/* Generation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>
              Configure default parameters for LLM generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Temperature: {temperature.toFixed(1)}</Label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Lower = more deterministic, Higher = more creative
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="256"
                max="32768"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Model Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Model Presets</CardTitle>
            <CardDescription>
              Quick access to common model configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.flatMap((p) =>
                (p.defaultModels || []).slice(0, 2).map((m: string) => (
                  <button
                    key={`${p.id}-${m}`}
                    onClick={() => {
                      setProvider(p.id);
                      setModel(m);
                    }}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors',
                      provider === p.id && model === m
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <p className="text-sm font-medium">{m}</p>
                    <p className="text-xs text-muted-foreground">{p.name}</p>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export, import, or clear your local data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const settings = {
                  provider,
                  model,
                  temperature,
                  maxTokens,
                  exportedAt: new Date().toISOString(),
                };
                const data = JSON.stringify(settings, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'n8n-studio-settings.json';
                a.click();
                URL.revokeObjectURL(url);
              }}>
                Export Settings
              </Button>
              <Button variant="destructive" size="sm" onClick={clearHistory}>
                Clear History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>n8n Workflow Studio</strong> - A multi-LLM tool for generating and repairing n8n workflow JSON files.
            </p>
            <p>
              This tool uses your own API keys (BYOK - Bring Your Own Key) and does not store or transmit your keys to any third party.
            </p>
            <p className="pt-2">
              Supported providers: {PROVIDERS.map((p) => p.name).join(', ')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
