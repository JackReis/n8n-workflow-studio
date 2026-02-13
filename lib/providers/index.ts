/**
 * LLM Provider Registry and Factory
 * Unified exports for all providers
 */

// Base types
export type {
  LLMProvider,
  GenerateParams,
  GenerateResult,
  ProviderConfig,
  RetryConfig,
} from './base';

export {
  ProviderError,
  maskApiKey,
  parseJsonStrict,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY,
} from './base';

// Provider implementations
export { ZaiProvider, createZaiProvider } from './zai';
export { OpenAIProvider, createOpenAIProvider } from './openai';
export { GeminiProvider, createGeminiProvider } from './gemini';
export { OpenRouterProvider, createOpenRouterProvider } from './openrouter';
export { GroqProvider, createGroqProvider } from './groq';
export { GLM5Provider, createGLM5Provider, type GLM5Config } from './glm5';

// Provider types
import type { LLMProvider } from './base';
import { ZaiProvider } from './zai';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import { GroqProvider } from './groq';
import { GLM5Provider } from './glm5';

export type ProviderName = 'zai' | 'openai' | 'gemini' | 'openrouter' | 'groq' | 'glm5';

export interface ProviderRegistryOptions {
  timeout?: number;
}

/**
 * Create a provider instance by name
 */
export function createProvider(
  name: ProviderName,
  apiKey: string,
  options?: ProviderRegistryOptions
): LLMProvider {
  const timeout = options?.timeout;

  switch (name) {
    case 'zai':
      return new ZaiProvider(apiKey, timeout);
    case 'openai':
      return new OpenAIProvider(apiKey, timeout);
    case 'gemini':
      return new GeminiProvider(apiKey, timeout);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, timeout);
    case 'groq':
      return new GroqProvider(apiKey, timeout);
    case 'glm5':
      // GLM-5 uses local bridge at http://localhost:8765/v1
      // API key is ignored - bridge handles auth internally
      return new GLM5Provider({ timeout });
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * Get list of available providers and their models
 */
export function getAvailableProviders(): Record<ProviderName, string[]> {
  return {
    zai: new ZaiProvider('dummy').models,
    openai: new OpenAIProvider('dummy').models,
    gemini: new GeminiProvider('dummy').models,
    openrouter: new OpenRouterProvider('dummy').models,
    groq: new GroqProvider('dummy').models,
    glm5: new GLM5Provider().models,
  };
}

/**
 * Validate provider configuration
 */
export async function validateProvider(
  name: ProviderName,
  apiKey: string
): Promise<boolean> {
  const provider = createProvider(name, apiKey);
  return provider.validateConfig(apiKey);
}

/**
 * Get provider instance (alias for createProvider)
 * Provided for compatibility with task spec
 */
export const getProvider = createProvider;
