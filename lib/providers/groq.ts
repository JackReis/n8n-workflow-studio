/**
 * Groq Provider Adapter
 * Supports Llama and Mixtral models
 * OpenAI-compatible API format
 */

import {
  LLMProvider,
  GenerateParams,
  GenerateResult,
  ProviderError,
  parseJsonStrict,
  DEFAULT_TIMEOUT,
} from './base';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
] as const;

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider implements LLMProvider {
  name = 'groq';
  models = [...GROQ_MODELS];

  private apiKey: string;
  private timeout: number;
  private baseUrl: string;

  constructor(apiKey: string, timeout: number = DEFAULT_TIMEOUT, baseUrl?: string) {
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.baseUrl = baseUrl || GROQ_BASE_URL;
  }

  async validateConfig(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: this.getHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const { prompt, model, temperature = 0.7, maxTokens = 8192, responseFormat, systemPrompt } = params;

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    };

    // Groq supports JSON mode
    if (responseFormat?.type === 'json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new ProviderError(
          `Groq API error: ${errorMessage}`,
          'groq',
          response.status
        );
      }

      const data = await response.json();

      const content = data.choices?.[0]?.message?.content || '';

      // Validate JSON if JSON mode requested
      if (responseFormat?.type === 'json') {
        const { error } = parseJsonStrict(content);
        if (error) {
          return {
            content: '',
            error: `JSON parse error: ${error}`,
            usage: this.extractUsage(data),
          };
        }
      }

      return {
        content,
        usage: this.extractUsage(data),
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        return { content: '', error: error.message };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        error: `Groq request failed: ${errorMessage}`,
      };
    }
  }

  private getHeaders(key?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key || this.apiKey}`,
    };
  }

  private extractUsage(data: { usage?: { prompt_tokens?: number; completion_tokens?: number } }): { input: number; output: number } | undefined {
    if (!data.usage) return undefined;
    return {
      input: data.usage.prompt_tokens || 0,
      output: data.usage.completion_tokens || 0,
    };
  }
}

export function createGroqProvider(apiKey: string, timeout?: number, baseUrl?: string): GroqProvider {
  return new GroqProvider(apiKey, timeout, baseUrl);
}
