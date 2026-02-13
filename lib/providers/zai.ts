/**
 * z.ai Provider Adapter
 * Supports GLM-5, GLM-4.7, GLM-4-flash models
 * Uses OpenAI-compatible Chat Completions API
 *
 * Endpoints:
 * - Normal: https://api.z.ai/api/paas/v4/chat/completions
 * - Coding Plan: https://api.z.ai/api/coding/paas/v4/chat/completions
 */

import {
  LLMProvider,
  GenerateParams,
  GenerateResult,
  ProviderError,
  parseJsonStrict,
  DEFAULT_TIMEOUT,
} from './base';

const ZAI_MODELS = [
  'glm-5',
  'glm-4.7',
  'glm-4-flash',
] as const;

// Correct Z.ai Chat Completions endpoint (OpenAI-compatible)
const ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
// Coding plan endpoint (alternative)
const ZAI_CODING_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

export class ZaiProvider implements LLMProvider {
  name = 'z.ai';
  models = [...ZAI_MODELS];

  private apiKey: string;
  private timeout: number;
  private baseUrl: string;

  constructor(apiKey: string, timeout: number = DEFAULT_TIMEOUT, useCodingEndpoint: boolean = false) {
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.baseUrl = useCodingEndpoint ? ZAI_CODING_URL : ZAI_BASE_URL;
  }

  async validateConfig(apiKey: string): Promise<boolean> {
    try {
      // Quick validation with a minimal request
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify({
          model: 'glm-4-flash',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      return response.ok || response.status === 400; // 400 means auth passed, bad request
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

    // Only add response_format if JSON mode is explicitly requested
    // Some Z.ai endpoints may not support this
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
        const errorText = await response.text().catch(() => 'Unknown error');
        // Provide more helpful error messages
        let errorMsg = `z.ai API error (${response.status})`;
        if (response.status === 401) {
          errorMsg = 'Invalid API key for z.ai. Check your API key.';
        } else if (response.status === 404) {
          errorMsg = 'API endpoint not found. The endpoint may have changed.';
        } else if (response.status === 429) {
          errorMsg = 'Rate limited. Please wait and try again.';
        } else if (response.status === 500 || response.status === 502 || response.status === 503) {
          errorMsg = `z.ai server error (${response.status}). Try again later.`;
        } else {
          errorMsg = `${errorMsg}: ${errorText.slice(0, 200)}`;
        }
        throw new ProviderError(errorMsg, 'z.ai', response.status);
      }

      const data = await response.json();

      // OpenAI-compatible response format
      const content = data.choices?.[0]?.message?.content || '';

      // Check for empty response
      if (!content || content.trim() === '') {
        // Some models return empty content with finish_reason
        const finishReason = data.choices?.[0]?.finish_reason;
        return {
          content: '',
          error: `Empty response from model (finish_reason: ${finishReason || 'unknown'}). Try increasing max_tokens or simplifying the prompt.`,
          usage: this.extractUsage(data),
        };
      }

      // If JSON mode requested, validate the response
      if (responseFormat?.type === 'json') {
        const { error } = parseJsonStrict(content);
        if (error) {
          return {
            content: '',
            error: `JSON parse error: ${error}. Model may not have returned valid JSON.`,
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
        error: `z.ai request failed: ${errorMessage}`,
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

export function createZaiProvider(apiKey: string, timeout?: number): ZaiProvider {
  return new ZaiProvider(apiKey, timeout);
}
