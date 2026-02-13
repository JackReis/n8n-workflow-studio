/**
 * Intent Detection System
 * Analyzes user prompts to detect workflow requirements
 */

import type { SkillPattern, SkillCategory } from './types';
import { ALL_PATTERNS, getPatternsByCategory } from './patterns';

// Intent keywords mapping
const INTENT_KEYWORDS: Record<string, SkillCategory[]> = {
  // Trigger intents
  'schedule': ['trigger'],
  'cron': ['trigger'],
  'every hour': ['trigger'],
  'every day': ['trigger'],
  'daily': ['trigger'],
  'weekly': ['trigger'],
  'periodic': ['trigger'],

  'webhook': ['trigger'],
  'http request': ['trigger'],
  'api endpoint': ['trigger'],
  'receive': ['trigger'],
  'listen': ['trigger'],

  'rss': ['trigger'],
  'feed': ['trigger'],
  'rss feed': ['trigger'],

  'email trigger': ['trigger'],
  'incoming email': ['trigger'],

  // Integration intents
  'wordpress': ['integration'],
  'wp': ['integration'],
  'post to wordpress': ['integration'],

  'slack': ['integration', 'output'],
  'discord': ['integration', 'output'],
  'telegram': ['integration', 'output'],
  'notify': ['output'],
  'notification': ['output'],
  'alert': ['output'],
  'send message': ['output'],

  'google sheets': ['integration'],
  'spreadsheet': ['integration'],
  'sheets': ['integration'],

  'notion': ['integration'],
  'airtable': ['integration'],

  'database': ['integration'],
  'postgres': ['integration'],
  'mysql': ['integration'],
  'mongodb': ['integration'],
  'redis': ['integration'],

  's3': ['integration'],
  'aws': ['integration'],
  'storage': ['integration'],

  // Transform intents
  'transform': ['transform'],
  'extract': ['transform'],
  'parse': ['transform'],
  'convert': ['transform'],
  'format': ['transform'],
  'map': ['transform'],
  'filter': ['transform', 'logic'],
  'merge': ['transform'],
  'split': ['transform'],
  'aggregate': ['transform'],

  'json': ['transform'],
  'xml': ['transform'],
  'csv': ['transform'],

  'deduplicate': ['transform'],
  'remove duplicates': ['transform'],
  'unique': ['transform'],

  // AI/LLM intents
  'ai': ['transform'],
  'gpt': ['transform'],
  'llm': ['transform'],
  'openai': ['transform'],
  'chatgpt': ['transform'],
  'generate text': ['transform'],
  'summarize': ['transform'],
  'structured output': ['transform'],

  // Logic intents
  'if': ['logic'],
  'condition': ['logic'],
  'branch': ['logic'],
  'switch': ['logic'],
  'decision': ['logic'],

  // Error handling intents
  'error handling': ['error'],
  'retry': ['error'],
  'fallback': ['error'],
  'catch error': ['error'],
  'on error': ['error'],

  // Optimization intents
  'batch': ['optimization'],
  'rate limit': ['optimization'],
  'throttle': ['optimization'],
  'parallel': ['optimization'],
  'queue': ['optimization'],
};

// Service-specific pattern mapping
const SERVICE_PATTERNS: Record<string, string[]> = {
  'wordpress': ['integration-wordpress'],
  'wp': ['integration-wordpress'],
  'slack': ['integration-slack'],
  'rss': ['trigger-rss'],
  'webhook': ['trigger-webhook'],
  'schedule': ['trigger-schedule'],
  'ai': ['ai-structured-output', 'ai-repair-loop'],
  'gpt': ['ai-structured-output', 'ai-repair-loop'],
  'llm': ['ai-structured-output', 'ai-repair-loop'],
  'json': ['transform-json-extract'],
  'dedupe': ['transform-dedupe'],
  'duplicate': ['transform-dedupe'],
  'error': ['error-handling'],
};

export interface DetectedIntent {
  category: SkillCategory;
  confidence: number;
  matchedKeywords: string[];
  suggestedPatternIds: string[];
}

export interface WorkflowAnalysis {
  detectedIntents: DetectedIntent[];
  complexity: 'simple' | 'medium' | 'complex';
  suggestedPatterns: SkillPattern[];
  requiredIntegrations: string[];
  estimatedNodeCount: number;
}

/**
 * Analyze user prompt to detect workflow requirements
 */
export function analyzePrompt(prompt: string): WorkflowAnalysis {
  const lowerPrompt = prompt.toLowerCase();

  // Detect intents
  const intentMap = new Map<SkillCategory, DetectedIntent>();

  for (const [keyword, categories] of Object.entries(INTENT_KEYWORDS)) {
    if (lowerPrompt.includes(keyword)) {
      for (const category of categories) {
        const existing = intentMap.get(category);
        if (existing) {
          existing.matchedKeywords.push(keyword);
          existing.confidence = Math.min(existing.confidence + 0.15, 1.0);
        } else {
          intentMap.set(category, {
            category,
            confidence: 0.3,
            matchedKeywords: [keyword],
            suggestedPatternIds: [],
          });
        }
      }
    }
  }

  // Find suggested patterns based on service keywords
  const suggestedPatternIds = new Set<string>();
  const requiredIntegrations = new Set<string>();

  for (const [service, patternIds] of Object.entries(SERVICE_PATTERNS)) {
    if (lowerPrompt.includes(service)) {
      patternIds.forEach(id => suggestedPatternIds.add(id));

      // Track integrations
      if (['wordpress', 'slack', 'discord', 'telegram', 'notion', 'airtable',
           'postgres', 'mysql', 'mongodb', 'redis', 's3'].includes(service)) {
        requiredIntegrations.add(service);
      }
    }
  }

  // Add patterns based on detected categories
  const detectedIntents = Array.from(intentMap.values());
  for (const intent of detectedIntents) {
    const categoryPatterns = getPatternsByCategory(intent.category);
    for (const pattern of categoryPatterns) {
      suggestedPatternIds.add(pattern.id);
    }
  }

  // Get actual pattern objects
  const suggestedPatterns = ALL_PATTERNS.filter(p => suggestedPatternIds.has(p.id));

  // Estimate complexity
  const complexity = estimateComplexity(detectedIntents, suggestedPatterns, prompt);

  // Estimate node count
  const estimatedNodeCount = estimateNodeCount(suggestedPatterns, prompt);

  return {
    detectedIntents: detectedIntents.sort((a, b) => b.confidence - a.confidence),
    complexity,
    suggestedPatterns,
    requiredIntegrations: Array.from(requiredIntegrations),
    estimatedNodeCount,
  };
}

/**
 * Estimate workflow complexity
 */
function estimateComplexity(
  intents: DetectedIntent[],
  patterns: SkillPattern[],
  prompt: string
): 'simple' | 'medium' | 'complex' {
  let score = 0;

  // Base complexity from intent count
  score += intents.length * 2;

  // Pattern complexity
  score += patterns.length * 3;

  // Check for complex keywords
  const complexKeywords = [
    'conditional', 'branch', 'loop', 'iterate', 'parallel',
    'error handling', 'retry', 'fallback', 'validation',
    'multiple', 'several', 'many', 'complex', 'advanced'
  ];
  const lowerPrompt = prompt.toLowerCase();
  for (const keyword of complexKeywords) {
    if (lowerPrompt.includes(keyword)) score += 3;
  }

  // Integration complexity
  const integrationCount = patterns.filter(p => p.category === 'integration').length;
  score += integrationCount * 4;

  if (score <= 8) return 'simple';
  if (score <= 20) return 'medium';
  return 'complex';
}

/**
 * Estimate number of nodes needed
 */
function estimateNodeCount(patterns: SkillPattern[], prompt: string): number {
  let count = 1; // At least a trigger

  // Each pattern typically needs 2-3 nodes
  count += patterns.length * 2;

  // Check for specific indicators
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('transform') || lowerPrompt.includes('convert')) count += 2;
  if (lowerPrompt.includes('validate') || lowerPrompt.includes('check')) count += 1;
  if (lowerPrompt.includes('notify') || lowerPrompt.includes('send')) count += 1;
  if (lowerPrompt.includes('store') || lowerPrompt.includes('save')) count += 1;
  if (lowerPrompt.includes('ai') || lowerPrompt.includes('gpt')) count += 2;

  return Math.max(count, 3);
}

/**
 * Get best matching patterns for a prompt
 */
export function getBestPatterns(prompt: string, maxPatterns: number = 5): SkillPattern[] {
  const analysis = analyzePrompt(prompt);

  // Sort patterns by relevance
  const scoredPatterns = analysis.suggestedPatterns.map(pattern => {
    let score = 0;

    // Check if pattern keywords are in prompt
    const patternKeywords = [
      pattern.name.toLowerCase(),
      pattern.description.toLowerCase(),
      ...pattern.nodeTypes.map(t => t.toLowerCase()),
    ];

    const lowerPrompt = prompt.toLowerCase();
    for (const keyword of patternKeywords) {
      const words = keyword.split(/[\s-]+/);
      for (const word of words) {
        if (word.length > 2 && lowerPrompt.includes(word)) {
          score += 1;
        }
      }
    }

    // Boost patterns that match detected intents
    const matchingIntents = analysis.detectedIntents.filter(
      i => i.category === pattern.category
    );
    score += matchingIntents.reduce((sum, i) => sum + i.confidence * 5, 0);

    return { pattern, score };
  });

  // Sort by score and return top patterns
  return scoredPatterns
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPatterns)
    .map(sp => sp.pattern);
}

/**
 * Quick check if prompt requires specific pattern
 */
export function requiresPattern(prompt: string, patternId: string): boolean {
  const analysis = analyzePrompt(prompt);
  return analysis.suggestedPatterns.some(p => p.id === patternId);
}
