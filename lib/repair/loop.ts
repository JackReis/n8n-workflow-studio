/**
 * Repair Loop Algorithm
 * Conservative n8n workflow repair with iterative fixing
 * Supports both full JSON rewrite and JSON Patch (RFC6902) modes
 */

import type {
  n8nWorkflow,
  ValidationError,
  RepairConfig,
  RepairResult,
  RepairAttempt,
  RepairValidationResult
} from './types';
import type { LLMProvider } from '@/lib/providers/base';
import { DEFAULT_REPAIR_CONFIG } from './types';
import { REPAIR_SYSTEM_PROMPT, buildRepairPrompt } from './prompts';
import {
  applyPatches,
  parsePatchResponse,
  buildPatchRepairPrompt,
  PATCH_REPAIR_SYSTEM_PROMPT,
} from './patch';

/**
 * Parse JSON strictly with detailed error
 */
function parseStrictJSON(content: string): n8nWorkflow | null {
  // Remove potential markdown code blocks
  let cleaned = content.trim();

  // Remove ```json ... ``` wrapper
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Remove any leading/trailing text
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as n8nWorkflow;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate workflow structure (basic validation)
 */
function validateWorkflowStructure(workflow: unknown): RepairValidationResult {
  const errors: ValidationError[] = [];

  if (typeof workflow !== 'object' || workflow === null) {
    return { valid: false, errors: [{ code: 'E001', path: '', message: 'Workflow must be an object', severity: 'error' }] };
  }

  const w = workflow as Record<string, unknown>;

  // Check required fields
  // name is optional in n8n workflows

  if (!Array.isArray(w.nodes)) {
    errors.push({ code: 'E002', path: 'nodes', message: 'Workflow nodes must be an array', severity: 'error' });
  } else {
    // Validate each node
    w.nodes.forEach((node: unknown, index: number) => {
      if (typeof node !== 'object' || node === null) {
        errors.push({ code: 'E003', path: `nodes[${index}]`, message: 'Node must be an object', severity: 'error' });
        return;
      }

      const n = node as Record<string, unknown>;

      if (typeof n.id !== 'string' || !n.id) {
        errors.push({ code: 'E004', path: `nodes[${index}].id`, message: 'Node id must be a non-empty string', severity: 'error' });
      }

      if (typeof n.name !== 'string' || !n.name) {
        errors.push({ code: 'E005', path: `nodes[${index}].name`, message: 'Node name must be a non-empty string', severity: 'error' });
      }

      if (typeof n.type !== 'string' || !n.type) {
        errors.push({ code: 'E006', path: `nodes[${index}].type`, message: 'Node type must be a non-empty string', severity: 'error' });
      }

      if (typeof n.typeVersion !== 'number') {
        errors.push({ code: 'E007', path: `nodes[${index}].typeVersion`, message: 'Node typeVersion must be a number', severity: 'error' });
      }

      if (!Array.isArray(n.position) || n.position.length !== 2) {
        errors.push({ code: 'E008', path: `nodes[${index}].position`, message: 'Node position must be [x, y] array', severity: 'error' });
      }

      if (typeof n.parameters !== 'object') {
        errors.push({ code: 'E009', path: `nodes[${index}].parameters`, message: 'Node parameters must be an object', severity: 'error' });
      }
    });
  }

  if (typeof w.connections !== 'object' && w.connections !== undefined) {
    errors.push({ code: 'E010', path: 'connections', message: 'Workflow connections must be an object', severity: 'error' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Preserve critical workflow properties during repair
 */
function preserveWorkflowProperties(
  original: n8nWorkflow,
  repaired: n8nWorkflow,
  config: RepairConfig
): n8nWorkflow {
  // Create a map of original nodes by ID for reference
  const originalNodeMap = new Map(
    original.nodes.map(n => [n.id, n])
  );

  // Process repaired nodes
  const preservedNodes = repaired.nodes.map((node, index) => {
    const originalNode = originalNodeMap.get(node.id) || original.nodes[index];

    if (config.preserveNodeIds && originalNode) {
      node.id = originalNode.id;
    }

    if (config.preserveNodeNames && originalNode && originalNode.name === node.name) {
      // Keep original name if it's the same
    }

    // Preserve position if it was accidentally changed
    if (originalNode && Array.isArray(originalNode.position)) {
      node.position = [...originalNode.position] as [number, number];
    }

    return node;
  });

  return {
    ...repaired,
    nodes: preservedNodes,
    name: repaired.name || original.name
  };
}

/**
 * Main repair loop algorithm
 * Automatically chooses patch mode or full rewrite based on config
 */
export async function repairLoop(
  workflow: n8nWorkflow,
  errors: ValidationError[],
  provider: LLMProvider,
  config: Partial<RepairConfig> = {}
): Promise<RepairResult> {
  const finalConfig: RepairConfig = { ...DEFAULT_REPAIR_CONFIG, ...config };

  // Use patch mode by default (more efficient)
  if (finalConfig.patchMode !== false) {
    return patchBasedRepair(workflow, errors, provider, config);
  }

  // Fallback to full rewrite mode
  return fullRewriteRepair(workflow, errors, provider, config);
}

/**
 * Full JSON rewrite repair (legacy mode)
 */
async function fullRewriteRepair(
  workflow: n8nWorkflow,
  errors: ValidationError[],
  provider: LLMProvider,
  config: Partial<RepairConfig> = {}
): Promise<RepairResult> {
  const finalConfig: RepairConfig = { ...DEFAULT_REPAIR_CONFIG, ...config };
  const repairHistory: RepairAttempt[] = [];

  let currentWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep clone
  let currentErrors = [...errors];

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    // 1. Build repair prompt with ONLY current errors
    const prompt = buildRepairPrompt(currentWorkflow, currentErrors);

    // 2. Call LLM for repair
    let result;
    try {
      result = await provider.generate({
        prompt,
        model: finalConfig.model,
        responseFormat: { type: 'json' },
        systemPrompt: REPAIR_SYSTEM_PROMPT,
        temperature: finalConfig.temperature || 0.1
      });
    } catch (error) {
      // LLM call failed, continue to next attempt
      repairHistory.push({
        attempt,
        inputErrors: currentErrors,
        outputErrors: currentErrors,
        fixedCount: 0,
        newErrorCount: 0
      });
      continue;
    }

    // 3. Parse repaired JSON
    const repaired = parseStrictJSON(result.content);
    if (!repaired) {
      // JSON parse failed, retry
      repairHistory.push({
        attempt,
        inputErrors: currentErrors,
        outputErrors: currentErrors,
        fixedCount: 0,
        newErrorCount: 0
      });
      continue;
    }

    // 4. Preserve critical properties
    const preservedRepaired = preserveWorkflowProperties(
      currentWorkflow,
      repaired,
      finalConfig
    );

    // 5. Validate repaired workflow
    const validation = validateWorkflowStructure(preservedRepaired);

    // Record attempt
    const fixedCount = currentErrors.length - validation.errors.length;
    repairHistory.push({
      attempt,
      inputErrors: currentErrors,
      outputErrors: validation.errors,
      fixedCount: Math.max(0, fixedCount),
      newErrorCount: Math.max(0, -fixedCount)
    });

    if (validation.valid) {
      return {
        success: true,
        workflow: preservedRepaired,
        attempts: attempt,
        repairHistory
      };
    }

    // 6. Update for next attempt
    currentErrors = validation.errors;
    currentWorkflow = preservedRepaired;

    // If no progress made, stop early
    if (attempt > 1 && validation.errors.length >= currentErrors.length) {
      // Not making progress
      break;
    }
  }

  return {
    success: false,
    workflow: currentWorkflow,
    attempts: finalConfig.maxAttempts,
    finalErrors: currentErrors,
    repairHistory
  };
}

/**
 * Quick single-attempt repair
 */
export async function quickRepair(
  workflow: n8nWorkflow,
  errors: ValidationError[],
  provider: LLMProvider,
  model: string = DEFAULT_REPAIR_CONFIG.model
): Promise<n8nWorkflow | null> {
  const result = await repairLoop(workflow, errors, provider, {
    maxAttempts: 1,
    model
  });

  return result.success ? result.workflow : null;
}

/**
 * Validate and repair in one step
 */
export async function validateAndRepair(
  workflow: n8nWorkflow,
  provider: LLMProvider,
  config: Partial<RepairConfig> = {}
): Promise<RepairResult> {
  const validation = validateWorkflowStructure(workflow);

  if (validation.valid) {
    return {
      success: true,
      workflow,
      attempts: 0
    };
  }

  return repairLoop(workflow, validation.errors, provider, config);
}

/**
 * JSON Patch based repair (more efficient than full rewrite)
 * LLM outputs RFC6902 patches instead of full JSON
 */
export async function patchBasedRepair(
  workflow: n8nWorkflow,
  errors: ValidationError[],
  provider: LLMProvider,
  config: Partial<RepairConfig> = {}
): Promise<RepairResult> {
  const finalConfig: RepairConfig = { ...DEFAULT_REPAIR_CONFIG, ...config };
  const repairHistory: RepairAttempt[] = [];

  let currentWorkflow = JSON.parse(JSON.stringify(workflow));
  let currentErrors = [...errors];

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    // 1. Build patch repair prompt
    const prompt = buildPatchRepairPrompt(currentWorkflow, currentErrors);

    // 2. Call LLM for patches
    let result;
    try {
      result = await provider.generate({
        prompt,
        model: finalConfig.model,
        responseFormat: { type: 'json' },
        systemPrompt: PATCH_REPAIR_SYSTEM_PROMPT,
        temperature: finalConfig.temperature || 0.1
      });
    } catch (error) {
      repairHistory.push({
        attempt,
        inputErrors: currentErrors,
        outputErrors: currentErrors,
        fixedCount: 0,
        newErrorCount: 0
      });
      continue;
    }

    // 3. Parse patches
    const patches = parsePatchResponse(result.content);
    if (!patches || patches.length === 0) {
      repairHistory.push({
        attempt,
        inputErrors: currentErrors,
        outputErrors: currentErrors,
        fixedCount: 0,
        newErrorCount: 0
      });
      continue;
    }

    // 4. Apply patches
    const patchResult = applyPatches(currentWorkflow, patches);

    if (!patchResult.success) {
      repairHistory.push({
        attempt,
        inputErrors: currentErrors,
        outputErrors: currentErrors,
        fixedCount: 0,
        newErrorCount: 0
      });
      continue;
    }

    // 5. Validate patched workflow
    const validation = validateWorkflowStructure(patchResult.workflow!);

    // Record attempt
    const fixedCount = currentErrors.length - validation.errors.length;
    repairHistory.push({
      attempt,
      inputErrors: currentErrors,
      outputErrors: validation.errors,
      fixedCount: Math.max(0, fixedCount),
      newErrorCount: Math.max(0, -fixedCount)
    });

    if (validation.valid) {
      return {
        success: true,
        workflow: patchResult.workflow!,
        attempts: attempt,
        repairHistory
      };
    }

    // 6. Update for next attempt
    currentErrors = validation.errors;
    currentWorkflow = patchResult.workflow!;

    // If no progress, stop early
    if (attempt > 1 && validation.errors.length >= currentErrors.length) {
      break;
    }
  }

  return {
    success: false,
    workflow: currentWorkflow,
    attempts: finalConfig.maxAttempts,
    finalErrors: currentErrors,
    repairHistory
  };
}
