/**
 * Stage 0: Multi-Workflow & JSON Extraction
 *
 * Handles:
 * - JSON array of workflows (multi-workflow export)
 * - Multiple JSON blocks in text (extraction)
 * - Pre-validation cleanup
 */

import {
  ValidationError,
  ValidationWarning,
  ErrorCodes,
} from './schemas';

// ============================================
// JSON Extraction Utilities
// ============================================

/**
 * Extract all JSON objects from text
 * Handles markdown code blocks, multiple JSON objects, etc.
 */
export function extractJsonBlocks(text: string): string[] {
  const blocks: string[] = [];

  // 1. Try to extract from markdown code blocks first
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{') || content.startsWith('[')) {
      blocks.push(content);
    }
  }

  // If found code blocks, return those
  if (blocks.length > 0) {
    return blocks;
  }

  // 2. Extract top-level JSON objects using brace matching
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

    if (char === '"' && !escape) {
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
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // 3. Also check for JSON arrays
  depth = 0;
  start = -1;
  inString = false;
  escape = false;

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

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '[') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return blocks;
}

/**
 * Parse JSON safely with detailed error
 */
export function parseJsonSafe(text: string): { data: unknown; error?: string } {
  try {
    return { data: JSON.parse(text) };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
    return { data: null, error: errorMessage };
  }
}

// ============================================
// Stage 0 Validation
// ============================================

export interface Stage0Result {
  workflows: unknown[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  rawCount: number;
}

/**
 * Stage 0: Accept and parse input
 * - Handles JSON array of workflows
 * - Extracts JSON from text with multiple blocks
 */
export function validateStage0(input: unknown): Stage0Result {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const workflows: unknown[] = [];

  // Case 1: Already parsed object
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    // Check if it's a workflow or wrapped
    const obj = input as Record<string, unknown>;
    if ('nodes' in obj && 'connections' in obj) {
      workflows.push(input);
    } else if ('workflow' in obj && typeof obj.workflow === 'object') {
      workflows.push(obj.workflow);
    } else if ('workflows' in obj && Array.isArray(obj.workflows)) {
      workflows.push(...obj.workflows);
    } else {
      // Try to use as-is
      workflows.push(input);
    }
    return { workflows, errors, warnings, rawCount: 1 };
  }

  // Case 2: Array of workflows
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      if (item && typeof item === 'object') {
        workflows.push(item);
      } else {
        warnings.push({
          code: ErrorCodes.INVALID_JSON,
          message: `Array item ${i} is not a valid object, skipping`,
          severity: 'warning',
        });
      }
    }
    return { workflows, errors, warnings, rawCount: input.length };
  }

  // Case 3: String input (needs parsing)
  if (typeof input === 'string') {
    const trimmed = input.trim();

    // Try direct parse first
    const { data, error } = parseJsonSafe(trimmed);

    if (!error && data !== null) {
      // Recursively handle parsed result
      return validateStage0(data);
    }

    // Extract JSON blocks from text
    const blocks = extractJsonBlocks(trimmed);

    if (blocks.length === 0) {
      errors.push({
        code: ErrorCodes.INVALID_JSON,
        message: `No valid JSON found in input: ${error || 'No JSON blocks detected'}`,
        severity: 'error',
        suggestion: 'Provide valid JSON or JSON inside markdown code blocks',
      });
      return { workflows, errors, warnings, rawCount: 0 };
    }

    // Parse each block
    for (let i = 0; i < blocks.length; i++) {
      const { data: blockData, error: blockError } = parseJsonSafe(blocks[i]);

      if (blockError) {
        warnings.push({
          code: ErrorCodes.INVALID_JSON,
          message: `JSON block ${i + 1} parse error: ${blockError}`,
          severity: 'warning',
        });
        continue;
      }

      // Handle array within block
      if (Array.isArray(blockData)) {
        workflows.push(...blockData.filter((item): item is object =>
          item !== null && typeof item === 'object'
        ));
      } else if (blockData && typeof blockData === 'object') {
        workflows.push(blockData);
      }
    }

    if (workflows.length === 0) {
      errors.push({
        code: ErrorCodes.INVALID_JSON,
        message: 'No valid workflow JSON objects found in input',
        severity: 'error',
        suggestion: 'Ensure input contains valid n8n workflow JSON',
      });
    }

    return { workflows, errors, warnings, rawCount: blocks.length };
  }

  // Case 4: Null/undefined
  errors.push({
    code: ErrorCodes.INVALID_JSON,
    message: 'Input is null, undefined, or invalid type',
    severity: 'error',
    suggestion: 'Provide a valid n8n workflow JSON',
  });

  return { workflows, errors, warnings, rawCount: 0 };
}

// ============================================
// Semantic Rule Violations (New Error Codes)
// ============================================

export const SemanticErrorCodes = {
  INVALID_URL_EXPRESSION: 'E301',
  MUSTACHE_IN_STRING: 'E302',
  MERGE_COMBINE_MODE: 'E303',
  SPLIT_NO_LOOP_BACK: 'E304',
  ORPHAN_NODE: 'E305',
  UNREACHABLE_NODE: 'E306',
} as const;

/**
 * Check for invalid URL expressions
 * URLs starting with '=' but not '={{' are invalid
 */
export function checkInvalidUrlExpressions(
  workflow: { nodes: Array<{ name: string; type: string; parameters: Record<string, unknown> }> },
  warnings: ValidationWarning[]
): void {
  for (const node of workflow.nodes) {
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = node.parameters.url;
      if (typeof url === 'string') {
        // Check for invalid patterns
        if (url.startsWith('=') && !url.startsWith('={{')) {
          warnings.push({
            code: SemanticErrorCodes.INVALID_URL_EXPRESSION,
            message: `Node "${node.name}" has invalid URL expression: "${url.slice(0, 50)}..."`,
            node: node.name,
            path: 'parameters.url',
            severity: 'error',
            suggestion: 'Use full expression: \'={{ "https://..." + $json.param }}\'',
          });
        }
        // Check for mustache inside non-expression string
        if (!url.startsWith('=') && url.includes('{{') && url.includes('}}')) {
          warnings.push({
            code: SemanticErrorCodes.MUSTACHE_IN_STRING,
            message: `Node "${node.name}" has mustache in plain string URL`,
            node: node.name,
            path: 'parameters.url',
            severity: 'error',
            suggestion: 'Convert to full expression: \'={{ "..." + value }}\'',
          });
        }
      }
    }
  }
}

/**
 * Check for mustache templating in non-expression strings
 */
export function checkMustacheInStrings(
  workflow: { nodes: Array<{ name: string; type: string; parameters: Record<string, unknown> }> },
  warnings: ValidationWarning[]
): void {
  function checkObject(obj: unknown, path: string, nodeName: string): void {
    if (typeof obj === 'string') {
      // Skip if it's already an expression
      if (obj.startsWith('={{')) return;

      // Check for mustache
      if (obj.includes('{{') && obj.includes('}}')) {
        warnings.push({
          code: SemanticErrorCodes.MUSTACHE_IN_STRING,
          message: `Node "${nodeName}" has mustache in non-expression string at ${path}`,
          node: nodeName,
          path,
          severity: 'error',
          suggestion: 'Use full expression: \'={{ ... }}\'',
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => checkObject(item, `${path}[${i}]`, nodeName));
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        checkObject(value, `${path}.${key}`, nodeName);
      }
    }
  }

  for (const node of workflow.nodes) {
    checkObject(node.parameters, 'parameters', node.name);
  }
}

/**
 * Check for Merge nodes with combine mode in aggregation contexts
 */
export function checkMergeNodeMode(
  workflow: { nodes: Array<{ name: string; type: string; parameters: Record<string, unknown> }> },
  warnings: ValidationWarning[]
): void {
  for (const node of workflow.nodes) {
    if (node.type === 'n8n-nodes-base.merge') {
      const mode = node.parameters.mode as string | undefined;

      // Modes that aggregate data should use 'append'
      const aggregationModes = ['combine', 'multiplex', 'keepKeyMatches', 'mergeByPosition'];

      if (mode && aggregationModes.includes(mode)) {
        warnings.push({
          code: SemanticErrorCodes.MERGE_COMBINE_MODE,
          message: `Node "${node.name}" uses mode="${mode}" which may not aggregate correctly`,
          node: node.name,
          path: 'parameters.mode',
          severity: 'warning',
          suggestion: 'For aggregating streams, use mode="append"',
        });
      }
    }
  }
}

/**
 * Check for SplitInBatches without loop-back wiring
 */
export function checkSplitInBatchesWiring(
  workflow: {
    nodes: Array<{ name: string; type: string }>;
    connections: Record<string, unknown>;
  },
  warnings: ValidationWarning[]
): void {
  const splitNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.splitInBatches');

  if (splitNodes.length === 0) return;

  const connections = workflow.connections as Record<string, Record<string, unknown>>;

  for (const node of splitNodes) {
    const nodeConn = connections[node.name] as Record<string, Array<Array<{ node: string }>>> | undefined;

    if (!nodeConn) {
      warnings.push({
        code: SemanticErrorCodes.SPLIT_NO_LOOP_BACK,
        message: `Node "${node.name}" (SplitInBatches) has no connections configured`,
        node: node.name,
        severity: 'error',
        suggestion: 'SplitInBatches requires "loop" output wired back, and "done" for completion',
      });
      continue;
    }

    // Check for 'done' output
    const mainOutputs = nodeConn.main as Array<Array<{ node: string }>> | undefined;
    if (!mainOutputs || mainOutputs.length < 2) {
      warnings.push({
        code: SemanticErrorCodes.SPLIT_NO_LOOP_BACK,
        message: `Node "${node.name}" (SplitInBatches) may be missing "done" output wiring`,
        node: node.name,
        severity: 'warning',
        suggestion: 'Ensure output[0] is "loop" (wired back) and output[1] is "done"',
      });
    }
  }
}

/**
 * Check for orphan/unreachable nodes
 */
export function checkGraphReachability(
  workflow: {
    nodes: Array<{ name: string; type: string }>;
    connections: Record<string, unknown>;
  },
  warnings: ValidationWarning[]
): { reachable: Set<string>; orphans: string[] } {
  const triggerTypes = [
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.scheduleTrigger',
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.formTrigger',
    'n8n-nodes-base.errorTrigger',
  ];

  const nodeNames = new Set(workflow.nodes.map(n => n.name));
  const triggerNodes = workflow.nodes.filter(n => triggerTypes.includes(n.type));

  if (triggerNodes.length === 0) {
    warnings.push({
      code: SemanticErrorCodes.ORPHAN_NODE,
      message: 'No trigger node found in workflow',
      severity: 'error',
      suggestion: 'Add a trigger node (Manual, Schedule, Webhook, etc.)',
    });
    return { reachable: new Set(), orphans: [...nodeNames] };
  }

  // Build reverse graph (who connects to whom)
  const connections = workflow.connections as Record<string, Record<string, Array<Array<{ node: string }>>>>;
  const incoming: Map<string, Set<string>> = new Map();

  for (const nodeName of nodeNames) {
    incoming.set(nodeName, new Set());
  }

  for (const [sourceName, outputs] of Object.entries(connections)) {
    if (!outputs.main) continue;
    for (const outputList of outputs.main) {
      if (!Array.isArray(outputList)) continue;
      for (const target of outputList) {
        if (target && target.node && nodeNames.has(target.node)) {
          incoming.get(target.node)?.add(sourceName);
        }
      }
    }
  }

  // BFS from triggers
  const reachable = new Set<string>();
  const queue = triggerNodes.map(n => n.name);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    // Find nodes connected from current
    const outputs = connections[current];
    if (outputs?.main) {
      for (const outputList of outputs.main) {
        if (!Array.isArray(outputList)) continue;
        for (const target of outputList) {
          if (target && target.node && nodeNames.has(target.node) && !reachable.has(target.node)) {
            queue.push(target.node);
          }
        }
      }
    }
  }

  // Find orphans
  const orphans: string[] = [];
  for (const nodeName of nodeNames) {
    if (!reachable.has(nodeName)) {
      const node = workflow.nodes.find(n => n.name === nodeName);
      const isTrigger = node && triggerTypes.includes(node.type);

      if (!isTrigger) {
        orphans.push(nodeName);
        warnings.push({
          code: SemanticErrorCodes.UNREACHABLE_NODE,
          message: `Node "${nodeName}" is not reachable from any trigger`,
          node: nodeName,
          severity: 'warning',
          suggestion: 'Connect this node to the workflow or remove it',
        });
      }
    }
  }

  return { reachable, orphans };
}

/**
 * Run all semantic checks
 */
export function runSemanticChecks(
  workflow: {
    nodes: Array<{ name: string; type: string; parameters: Record<string, unknown> }>;
    connections: Record<string, unknown>;
  }
): { warnings: ValidationWarning[]; stats: { reachableCount: number; orphanCount: number } } {
  const warnings: ValidationWarning[] = [];

  checkInvalidUrlExpressions(workflow, warnings);
  checkMustacheInStrings(workflow, warnings);
  checkMergeNodeMode(workflow, warnings);
  checkSplitInBatchesWiring(workflow, warnings);
  const { reachable, orphans } = checkGraphReachability(workflow, warnings);

  return {
    warnings,
    stats: {
      reachableCount: reachable.size,
      orphanCount: orphans.length,
    },
  };
}
