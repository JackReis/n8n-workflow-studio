/**
 * POST /api/providers/models
 * Fetches available models from the provider API using the provided API key
 */

import { NextRequest, NextResponse } from 'next/server';

interface ModelsRequest {
  provider: string;
  apiKey: string;
}

interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
  context_length?: number;
}

interface ModelsResponse {
  success: boolean;
  models: ModelInfo[];
  provider: string;
  error?: string;
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error('Failed to fetch OpenAI models');
  const data = await response.json();
  return data.data
    .filter((m: any) => m.id.includes('gpt'))
    .map((m: any) => ({
      id: m.id,
      name: m.id,
      owned_by: m.owned_by,
    }));
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error('Failed to fetch Groq models');
  const data = await response.json();
  return data.data.map((m: any) => ({
    id: m.id,
    name: m.id,
    owned_by: m.owned_by,
  }));
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error('Failed to fetch OpenRouter models');
  const data = await response.json();
  return data.data.map((m: any) => ({
    id: m.id,
    name: m.name || m.id,
    owned_by: m.id.split('/')[0],
    context_length: m.context_length,
  }));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );
  if (!response.ok) throw new Error('Failed to fetch Gemini models');
  const data = await response.json();
  return (data.models || [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name,
    }));
}

async function fetchZaiModels(apiKey: string): Promise<ModelInfo[]> {
  // z.ai uses OpenAI-compatible format
  try {
    const response = await fetch('https://api.z.ai/api/anthropic/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      // Fallback to known models if API doesn't support listing
      return [
        { id: 'glm-5', name: 'GLM-5' },
        { id: 'glm-4.7', name: 'GLM-4.7' },
        { id: 'glm-4-flash', name: 'GLM-4 Flash' },
      ];
    }
    const data = await response.json();
    return data.data?.map((m: any) => ({
      id: m.id,
      name: m.id,
    })) || [];
  } catch {
    // Fallback
    return [
      { id: 'glm-5', name: 'GLM-5' },
      { id: 'glm-4.7', name: 'GLM-4.7' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash' },
    ];
  }
}

async function fetchGLM5Models(baseUrl?: string): Promise<ModelInfo[]> {
  // GLM-5 Local Bridge - try to fetch models, fallback to defaults
  const url = baseUrl || 'http://localhost:8765/v1';
  try {
    const response = await fetch(`${url}/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      // Fallback to known models
      return [
        { id: 'glm-5', name: 'GLM-5 (Local)' },
        { id: 'glm-4-plus', name: 'GLM-4 Plus (Local)' },
        { id: 'glm-4-flash', name: 'GLM-4 Flash (Local)' },
      ];
    }
    const data = await response.json();
    return data.data?.map((m: any) => ({
      id: m.id,
      name: `${m.id} (Local)`,
    })) || [
      { id: 'glm-5', name: 'GLM-5 (Local)' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus (Local)' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Local)' },
    ];
  } catch {
    // Local server might not be running, return defaults
    return [
      { id: 'glm-5', name: 'GLM-5 (Local)' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus (Local)' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Local)' },
    ];
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ModelsResponse>> {
  try {
    const { provider, apiKey }: ModelsRequest = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({
        success: false,
        models: [],
        provider: provider || 'unknown',
        error: 'Provider and API key are required',
      }, { status: 400 });
    }

    let models: ModelInfo[] = [];

    switch (provider) {
      case 'openai':
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'groq':
        models = await fetchGroqModels(apiKey);
        break;
      case 'openrouter':
        models = await fetchOpenRouterModels(apiKey);
        break;
      case 'gemini':
        models = await fetchGeminiModels(apiKey);
        break;
      case 'zai':
        models = await fetchZaiModels(apiKey);
        break;
      case 'glm5':
        // GLM-5 Local Bridge - apiKey can be baseUrl or empty
        models = await fetchGLM5Models(apiKey || undefined);
        break;
      default:
        return NextResponse.json({
          success: false,
          models: [],
          provider,
          error: `Unknown provider: ${provider}`,
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      models,
      provider,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      models: [],
      provider: 'unknown',
      error: errorMessage,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'Provider Models API',
    usage: 'POST with { provider: string, apiKey: string }',
    supportedProviders: ['openai', 'groq', 'openrouter', 'gemini', 'zai', 'glm5'],
  });
}
