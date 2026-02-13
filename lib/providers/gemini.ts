/**
 * Google Gemini Provider Adapter
 * Supports Gemini 2.0 Flash, Gemini 1.5 Pro
 * Uses Google Generative AI REST API
 */

import {
  LLMProvider,
  GenerateParams,
  GenerateResult,
  ProviderError,
  parseJsonStrict,
  DEFAULT_TIMEOUT,
} from './base';

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
] as const;

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  models = [...GEMINI_MODELS];

  private apiKey: string;
  private timeout: number;

  constructor(apiKey: string, timeout: number = DEFAULT_TIMEOUT) {
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  async validateConfig(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}?key=${apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const { prompt, model, temperature = 0.7, maxTokens = 8192, responseFormat, systemPrompt } = params;

    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${this.apiKey}`;

    // Build contents array
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}\n\nUser: ${prompt}` }],
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    // Gemini JSON mode via response schema
    if (responseFormat?.type === 'json') {
      body.generationConfig = {
        ...body.generationConfig as object,
        responseMimeType: 'application/json',
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new ProviderError(
          `Gemini API error: ${errorMessage}`,
          'gemini',
          response.status
        );
      }

      const data = await response.json();

      // Extract text from Gemini response format
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
        error: `Gemini request failed: ${errorMessage}`,
      };
    }
  }

  private extractUsage(data: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): { input: number; output: number } | undefined {
    if (!data.usageMetadata) return undefined;
    return {
      input: data.usageMetadata.promptTokenCount || 0,
      output: data.usageMetadata.candidatesTokenCount || 0,
    };
  }
}

export function createGeminiProvider(apiKey: string, timeout?: number): GeminiProvider {
  return new GeminiProvider(apiKey, timeout);
}
