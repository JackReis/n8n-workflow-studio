/**
 * Base interfaces for LLM providers
 * Unified interface for multi-provider support
 */

export interface LLMProvider {
  name: string;
  models: string[];
  generate(params: GenerateParams): Promise<GenerateResult>;
  validateConfig(apiKey: string): Promise<boolean>;
}

export interface GenerateParams {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json' };
  systemPrompt?: string;
}

export interface GenerateResult {
  content: string;
  usage?: { input: number; output: number };
  error?: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Base error class for provider errors
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Mask API key for safe logging (shows only last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `****${key.slice(-4)}`;
}

/**
 * Extract the first complete JSON object using brace matching
 * This handles cases where LLM adds text after the JSON
 */
function extractJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        // Found complete JSON object
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Safely parse JSON with multiple repair strategies
 * Handles empty content, markdown code blocks, and common JSON errors
 */
export function parseJsonStrict(content: string): { data: unknown; error?: string } {
  // Handle empty or whitespace-only content
  if (!content || content.trim() === '') {
    return { data: null, error: 'Empty response from LLM' };
  }

  let cleanContent = content.trim();

  // Strategy 0: Try to extract from markdown code blocks first
  const codeBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanContent = codeBlockMatch[1].trim();
  }

  // Strategy 1: Try direct parse first
  try {
    const data = JSON.parse(cleanContent);
    return { data };
  } catch {
    // Continue to extraction strategies
  }

  // Strategy 2: Extract JSON using brace matching (handles trailing text)
  const extracted = extractJsonObject(cleanContent);
  if (extracted) {
    try {
      const data = JSON.parse(extracted);
      return { data };
    } catch {
      // Continue to repair strategies
    }
  }

  // Strategy 3: Fix common JSON issues
  const fixed = fixCommonJsonIssues(extracted || cleanContent);
  try {
    const data = JSON.parse(fixed);
    return { data };
  } catch {
    // Continue to more aggressive repair
  }

  // Strategy 4: Aggressive repair - rebuild JSON structure
  const rebuilt = rebuildJson(extracted || cleanContent);
  try {
    const data = JSON.parse(rebuilt);
    return { data };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown JSON parse error';
    return { data: null, error: errorMessage };
  }
}

/**
 * Aggressive JSON rebuild - extract valid structure even from malformed JSON
 */
function rebuildJson(content: string): string {
  let result = content;

  // Fix control characters first (most common issue with LLM output)
  result = fixControlCharsInStrings(result);

  // Fix multiple consecutive escapes
  result = result.replace(/\\{2,}/g, '\\');

  // Fix broken escape sequences (backslash before non-escape char)
  result = result.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

  // Fix missing commas between array elements (when } is followed by {)
  result = result.replace(/(\})\s*(\{)/g, '$1,$2');

  // Fix missing commas between string array elements
  // Pattern: "value" \n "value" -> "value", "value"
  result = result.replace(/(")\s*\n\s*(")/g, '$1,$2');

  // Remove trailing commas before closing brackets
  result = result.replace(/,(\s*[\]}])/g, '$1');

  // Try to balance brackets (add missing closing brackets)
  const openBraces = (result.match(/\{/g) || []).length;
  const closeBraces = (result.match(/\}/g) || []).length;
  const openBrackets = (result.match(/\[/g) || []).length;
  const closeBrackets = (result.match(/\]/g) || []).length;

  // Add missing closing brackets at the end
  for (let i = 0; i < openBraces - closeBraces; i++) {
    result += '}';
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    result += ']';
  }

  return result;
}

/**
 * Fix common JSON formatting issues from LLM output
 */
function fixCommonJsonIssues(json: string): string {
  let fixed = json;

  // 0. Fix control characters in strings FIRST (before any other processing)
  // This handles raw newlines, tabs, etc. inside string values
  fixed = fixControlCharsInStrings(fixed);

  // 1. Remove trailing commas before ] or }
  fixed = fixed.replace(/,(\s*[\]}])/g, '$1');

  // 2. Remove JavaScript-style comments (but be careful not to break URLs)
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  // Only remove // comments that are not URLs (http://, https://)
  fixed = fixed.replace(/([^:])\/\/.*$/gm, '$1');

  // 3. Fix unquoted property names: {name: ...} -> {"name": ...}
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // 4. Fix single quotes to double quotes (carefully)
  // Only replace single quotes that look like string delimiters
  if (fixed.includes("'")) {
    // Replace ' at start of value: : 'value' -> : "value"
    fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');
    // Replace ' at start of array element: ['value'] -> ["value"]
    fixed = fixed.replace(/\[\s*'([^']*)'/g, '["$1"');
    fixed = fixed.replace(/,\s*'([^']*)'/g, ', "$1"');
  }

  // 5. Fix missing commas between object properties in arrays
  // Pattern: } \n { -> }, {
  fixed = fixed.replace(/(\})\s*(\{)/g, '$1,$2');

  // 6. Fix multiple consecutive backslash escapes (e.g., \\\\n -> \\n)
  fixed = fixed.replace(/\\{2,}([nrt"\\/])/g, '\\$1');

  // 7. Fix unescaped backslashes before regular chars (but not escape sequences)
  // Be careful not to break valid escape sequences: \" \\ \/ \b \f \n \r \t \uXXXX
  fixed = fixed.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');

  // 8. Remove any text before first { and after last }
  const firstBrace = fixed.indexOf('{');
  const lastBrace = fixed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    fixed = fixed.slice(firstBrace, lastBrace + 1);
  }

  return fixed;
}

/**
 * Fix control characters inside JSON string values
 * Handles actual newlines, tabs, etc. that should be escaped
 */
function fixControlCharsInStrings(json: string): string {
  // Process character by character, tracking if we're inside a string
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      // Inside a string - escape control characters
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Other control characters - use unicode escape
        result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Default timeout for API calls (5 minutes - LLM responses can be slow for complex workflows)
 */
export const DEFAULT_TIMEOUT = 300000;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
};
