# LLM Provider Integration

## Supported Providers

| Provider | Models | Auth Method | API Format | Notes |
|----------|--------|-------------|------------|-------|
| **z.ai** | glm-5, glm-4.7 | API Key | OpenAI-compatible | Zhipu AI's LLM platform |
| **OpenAI** | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | API Key | Native SDK | Structured output supported |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | API Key | Google AI SDK | Fast inference |
| **OpenRouter** | 500+ models | API Key | OpenAI-compatible | Unified access to many models |
| **Groq** | llama-3.3-70b, llama-3.1-8b, mixtral-8x7b | API Key | OpenAI-compatible | Ultra-fast inference |

---

## Provider Architecture

### Interface

All providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  // Provider identifier
  name: string;

  // Available models
  models: string[];

  // Whether provider supports JSON schema response format
  supportsStructuredOutput: boolean;

  // Main generation method
  generate(params: GenerateParams): Promise<GenerateResult>;
}

interface GenerateParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: { type: 'json' };
  maxTokens?: number;
  temperature?: number;
}

interface GenerateResult {
  success: boolean;
  content?: string;      // Raw response text
  parsed?: unknown;      // Parsed JSON if responseFormat was json
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

### Registry Pattern

Providers are registered in `/lib/providers/index.ts`:

```typescript
import { zai } from './zai';
import { openai } from './openai';
import { gemini } from './gemini';
import { openrouter } from './openrouter';
import { groq } from './groq';

export const providers: Record<string, LLMProvider> = {
  zai,
  openai,
  gemini,
  openrouter,
  groq,
};

export function getProvider(name: string): LLMProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export function listProviders(): ProviderInfo[] {
  return Object.entries(providers).map(([id, p]) => ({
    id,
    name: p.name,
    models: p.models,
    supportsStructuredOutput: p.supportsStructuredOutput,
  }));
}
```

---

## Provider Implementations

### z.ai (Zhipu AI)

```typescript
// /lib/providers/zai.ts
import { LLMProvider } from './types';

export const zai: LLMProvider = {
  name: 'z.ai',
  models: ['glm-5', 'glm-4.7'],
  supportsStructuredOutput: true,

  async generate(params) {
    const response = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.1,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
      }),
    });

    // Parse response...
  },
};
```

### OpenAI

```typescript
// /lib/providers/openai.ts
import OpenAI from 'openai';
import { LLMProvider } from './types';

export const openai: LLMProvider = {
  name: 'OpenAI',
  models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  supportsStructuredOutput: true,

  async generate(params) {
    const client = new OpenAI({ apiKey: params.apiKey });

    const response = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.1,
      response_format: params.responseFormat,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    });

    // Parse response...
  },
};
```

### Gemini

```typescript
// /lib/providers/gemini.ts
import { LLMProvider } from './types';

export const gemini: LLMProvider = {
  name: 'Gemini',
  models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  supportsStructuredOutput: true,

  async generate(params) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.userPrompt }] }],
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 4096,
          temperature: params.temperature ?? 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    // Parse response...
  },
};
```

### OpenRouter

```typescript
// /lib/providers/openrouter.ts
import { LLMProvider } from './types';

export const openrouter: LLMProvider = {
  name: 'OpenRouter',
  models: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-pro-1.5',
    'meta-llama/llama-3.1-70b-instruct',
    // ... 500+ models
  ],
  supportsStructuredOutput: true,

  async generate(params) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
        'HTTP-Referer': 'https://n8n-studio.vercel.app',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.1,
        response_format: params.responseFormat,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      }),
    });

    // Parse response...
  },
};
```

### Groq

```typescript
// /lib/providers/groq.ts
import { LLMProvider } from './types';

export const groq: LLMProvider = {
  name: 'Groq',
  models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  supportsStructuredOutput: true,

  async generate(params) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.1,
        response_format: params.responseFormat,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      }),
    });

    // Parse response...
  },
};
```

---

## Adding a New Provider

### Step 1: Create Adapter File

Create `/lib/providers/newprovider.ts`:

```typescript
import { LLMProvider, GenerateParams, GenerateResult } from './types';

export const newprovider: LLMProvider = {
  name: 'NewProvider',
  models: ['model-1', 'model-2'],
  supportsStructuredOutput: true, // or false

  async generate(params: GenerateParams): Promise<GenerateResult> {
    try {
      // 1. Transform params to provider's API format
      // 2. Make API call
      // 3. Parse response
      // 4. Return result

      return {
        success: true,
        content: responseText,
        parsed: parsedJson,
        usage: { promptTokens, completionTokens },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
```

### Step 2: Register in Index

Add to `/lib/providers/index.ts`:

```typescript
import { newprovider } from './newprovider';

export const providers: Record<string, LLMProvider> = {
  // ... existing providers
  newprovider,
};
```

### Step 3: Add UI Support

The UI automatically picks up new providers from the registry. No UI changes needed if following the interface.

---

## API Key Setup

### z.ai (Zhipu AI)

1. Visit https://open.bigmodel.cn/
2. Create account / Sign in
3. Navigate to API Keys section
4. Generate new API key
5. Copy key (starts with alphanumeric)

### OpenAI

1. Visit https://platform.openai.com/
2. Create account / Sign in
3. Navigate to API Keys
4. Create new secret key
5. Copy key (starts with `sk-`)

### Gemini (Google AI)

1. Visit https://aistudio.google.com/
2. Sign in with Google account
3. Click "Get API Key"
4. Create new key or use existing
5. Copy the API key

### OpenRouter

1. Visit https://openrouter.ai/
2. Create account / Sign in
3. Navigate to Keys section
4. Create new key
5. Copy key (starts with `sk-or-`)

### Groq

1. Visit https://console.groq.com/
2. Create account / Sign in
3. Navigate to API Keys
4. Create new key
5. Copy key

---

## Error Handling

All providers should handle:

| Error Type | Handling |
|------------|----------|
| Invalid API Key | Return `{ success: false, error: 'Invalid API key' }` |
| Rate Limited | Return `{ success: false, error: 'Rate limited. Try again later.' }` |
| Model Not Found | Return `{ success: false, error: 'Model not available' }` |
| Network Error | Return `{ success: false, error: 'Network error. Check connection.' }` |
| Parse Error | Attempt JSON repair, then return error if still failing |

---

## Best Practices

1. **Temperature**: Use low temperature (0.1-0.3) for structured JSON output
2. **Max Tokens**: Set appropriately for workflow complexity (4096 minimum)
3. **Retry Logic**: Implement exponential backoff for rate limits
4. **Timeout**: Set reasonable timeouts (30-60 seconds)
5. **Streaming**: Not recommended for JSON generation (need complete response for parsing)
