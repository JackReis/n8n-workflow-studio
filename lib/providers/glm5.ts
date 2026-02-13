/**
 * GLM-5 Local Bridge Provider
 * Connects to local FastAPI bridge at http://localhost:8765/v1
 * OpenAI-compatible format
 */

import {
  LLMProvider,
  GenerateParams,
  GenerateResult,
  ProviderError,
  parseJsonStrict,
  DEFAULT_TIMEOUT,
} from './base';

const GLM5_MODELS = [
  'glm-5',
  'glm-4-plus',
  'glm-4-flash',
] as const;

export interface GLM5Config {
  baseUrl?: string;
  timeout?: number;
}

export class GLM5Provider implements LLMProvider {
  name = 'glm5';
  models = [...GLM5_MODELS];

  private baseUrl: string;
  private timeout: number;

  constructor(config: GLM5Config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:8765/v1';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      // If validation fails, still return true since it might be a local server issue
      return true;
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const { prompt, model = 'glm-5', temperature = 0.7, maxTokens = 8192, responseFormat, systemPrompt } = params;

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

    // JSON mode support
    if (responseFormat?.type === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const url = `${this.baseUrl}/chat/completions`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // Ignore JSON parse errors for error response
        }
        throw new ProviderError(
          `GLM-5 Bridge error: ${errorMessage}`,
          'glm5',
          response.status
        );
      }

      const data = await response.json();

      // OpenAI-compatible response format
      const content = data.choices?.[0]?.message?.content || '';

      // Validate JSON if JSON mode requested
      if (responseFormat?.type === 'json' && content) {
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

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          content: '',
          error: `GLM-5 request timeout after ${Math.round(this.timeout / 1000)}s`,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        error: `GLM-5 Bridge error: ${errorMessage}`,
      };
    }
  }

  private extractUsage(data: { usage?: { prompt_tokens?: number; completion_tokens?: number } }): { input: number; output: number } | undefined {
    if (!data.usage) return undefined;
    return {
      input: data.usage.prompt_tokens || 0,
      output: data.usage.completion_tokens || 0,
    };
  }
}

export function createGLM5Provider(config?: GLM5Config): GLM5Provider {
  return new GLM5Provider(config);
}
