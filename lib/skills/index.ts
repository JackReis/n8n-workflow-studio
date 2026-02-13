/**
 * n8n Workflow Skills System
 * Main entry point for skill-based workflow generation
 *
 * This module provides:
 * - Intent detection from user prompts
 * - Pattern matching and suggestion
 * - Enhanced prompt generation with best practices
 * - Workflow templates and examples
 */

// Internal imports for use within this module
import { analyzePrompt as _analyzePrompt, getBestPatterns as _getBestPatterns } from './intent';
import { getAllPatterns as _getAllPatterns } from './executor';

// Types
export type {
  SkillCategory,
  SkillPattern,
  SkillExample,
  SkillContext,
  SkillEnhancedPrompt,
} from './types';

export { N8N_NODE_TYPES, COMMON_FIELD_MAPPINGS } from './types';

// Patterns
export {
  ALL_PATTERNS,
  PATTERN_MAP,
  getPatternsByCategory,
  getPatternsByNodeType,
  // Individual patterns
  ScheduleTriggerPattern,
  WebhookTriggerPattern,
  RSSTriggerPattern,
  JSONExtractionPattern,
  DataDeduplicationPattern,
  StructuredOutputPattern,
  AIRepairLoopPattern,
  WordPressRESTPattern,
  SlackNotificationPattern,
  ErrorHandlingPattern,
} from './patterns';

// Intent detection - re-exported
export const analyzePrompt = _analyzePrompt;
export const getBestPatterns = _getBestPatterns;
export { requiresPattern } from './intent';

export type { DetectedIntent, WorkflowAnalysis } from './intent';

// Executor - re-exported
export const getAllPatterns = _getAllPatterns;
export {
  buildEnhancedPrompt,
  createSkillContext,
  getPatternById,
  formatPatternsForDisplay,
} from './executor';

/**
 * Quick skill check for a user prompt
 * Returns analysis summary for debugging/display
 */
export function quickSkillCheck(prompt: string): {
  complexity: string;
  intents: string[];
  patterns: string[];
  integrations: string[];
} {
  const analysis = _analyzePrompt(prompt);

  return {
    complexity: analysis.complexity,
    intents: analysis.detectedIntents.map(i => `${i.category} (${(i.confidence * 100).toFixed(0)}%)`),
    patterns: analysis.suggestedPatterns.map(p => p.name),
    integrations: analysis.requiredIntegrations,
  };
}
