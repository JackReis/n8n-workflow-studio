/**
 * JSON Patch (RFC6902) Based Repair Utility
 *
 * Instead of rewriting full JSON, LLM outputs patches (add/remove/replace/move/copy)
 * that are applied to the original workflow. This is:
 * - More token-efficient (smaller LLM output)
 * - More precise (targeted fixes)
 * - Safer (preserves unchanged parts)
 */

import { applyPatch, Operation, createPatch } from 'rfc6902';
import type { n8nWorkflow, ValidationError } from './types';

/**
 * JSON Patch operation types (RFC6902)
 */
export type PatchOperation = Operation;

/**
 * Result of applying JSON patches
 */
export interface PatchResult {
  success: boolean;
  workflow?: n8nWorkflow;
  appliedCount: number;
  failedPatches: Array<{ patch: PatchOperation; error: string }>;
  error?: string;
}

/**
 * Parse JSON Patch array from LLM response
 */
export function parsePatchResponse(content: string): PatchOperation[] | null {
  // Remove potential markdown code blocks
  let cleaned = content.trim();

  // Remove ```json ... ``` wrapper
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Find JSON array
  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as PatchOperation[];
    }
    // Could be wrapped in an object
    if (typeof parsed === 'object' && parsed.patches) {
      return parsed.patches as PatchOperation[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply JSON Patch operations to a workflow
 */
export function applyPatches(
  workflow: n8nWorkflow,
  patches: PatchOperation[]
): PatchResult {
  const workflowCopy = JSON.parse(JSON.stringify(workflow));
  const failedPatches: Array<{ patch: PatchOperation; error: string }> = [];

  // Filter valid patches
  const validPatches: PatchOperation[] = [];
  for (const patch of patches) {
    if (!patch.op) {
      failedPatches.push({ patch, error: 'Missing "op" field' });
      continue;
    }
    if (!patch.path && patch.op !== 'add') {
      failedPatches.push({ patch, error: 'Missing "path" field' });
      continue;
    }
    validPatches.push(patch);
  }

  // Apply patches
  try {
    const results = applyPatch(workflowCopy, validPatches);

    // Check for failed patches (results contains undefined for success, error for failure)
    let appliedCount = 0;
    results.forEach((result, index) => {
      if (result === undefined || result === null) {
        appliedCount++;
      } else if (result instanceof Error) {
        failedPatches.push({ patch: validPatches[index], error: result.message });
      }
    });

    return {
      success: true,
      workflow: workflowCopy,
      appliedCount,
      failedPatches,
    };
  } catch (error) {
    return {
      success: false,
      appliedCount: 0,
      failedPatches,
      error: error instanceof Error ? error.message : 'Unknown patch error',
    };
  }
}

/**
 * Generate JSON Patch between two workflows
 * Useful for creating repair history/diff
 */
export function diffWorkflows(
  original: n8nWorkflow,
  repaired: n8nWorkflow
): PatchOperation[] {
  return createPatch(original, repaired) as PatchOperation[];
}

/**
 * System prompt for JSON Patch based repair
 */
export const PATCH_REPAIR_SYSTEM_PROMPT = `You are an n8n workflow repair assistant. Your task is to fix broken workflows using JSON Patch (RFC6902) operations.

IMPORTANT: Output ONLY a JSON array of patch operations. Do NOT output the full workflow.

JSON Patch Operations:
- {"op": "add", "path": "/nodes/0/parameters/value", "value": "new value"}
- {"op": "remove", "path": "/nodes/1/parameters/invalidField"}
- {"op": "replace", "path": "/nodes/0/typeVersion", "value": 2}
- {"op": "move", "from": "/nodes/0", "path": "/nodes/1"}
- {"op": "copy", "from": "/nodes/0/parameters", "path": "/nodes/1/parameters"}
- {"op": "test", "path": "/nodes/0/id", "value": "abc123"} // Validates before applying

Rules:
1. Path format: /nodes/0/parameters/url (use array indices)
2. Only fix reported errors - do not make unnecessary changes
3. Preserve node IDs and positions
4. Add missing required fields
5. Remove invalid fields
6. Fix type mismatches (string to number, etc.)

Output format: JSON array of patch operations only.`;

/**
 * Build prompt for JSON Patch repair
 */
export function buildPatchRepairPrompt(
  workflow: n8nWorkflow,
  errors: ValidationError[]
): string {
  return `Fix this n8n workflow using JSON Patch operations.

## Current Workflow (JSON)
\`\`\`json
${JSON.stringify(workflow, null, 2)}
\`\`\`

## Validation Errors to Fix
${errors.map((e, i) => `${i + 1}. [${e.code}] ${e.path}: ${e.message}`).join('\n')}

## Instructions
1. Analyze each error
2. Generate minimal JSON Patch operations to fix them
3. Output ONLY the patch array, nothing else

Output:`;
}

/**
 * Validate that patches are safe to apply
 */
export function validatePatches(patches: PatchOperation[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i] as unknown as Record<string, unknown>;

    if (!patch || typeof patch !== 'object') {
      errors.push(`Patch ${i}: invalid patch object`);
      continue;
    }

    const op = patch.op as string | undefined;

    if (!op) {
      errors.push(`Patch ${i}: missing "op" field`);
      continue;
    }

    const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
    if (!validOps.includes(op)) {
      errors.push(`Patch ${i}: invalid operation "${op}"`);
    }

    if (op !== 'add' && !patch.path) {
      errors.push(`Patch ${i}: missing "path" field for ${op} operation`);
    }

    if ((op === 'add' || op === 'replace') && !('value' in patch)) {
      errors.push(`Patch ${i}: missing "value" field for ${op} operation`);
    }

    if ((op === 'move' || op === 'copy') && !patch.from) {
      errors.push(`Patch ${i}: missing "from" field for ${op} operation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
