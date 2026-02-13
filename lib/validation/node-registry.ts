/**
 * Node Registry - Arity/Ports Validator
 *
 * Defines input/output counts for n8n node types
 * Used to validate graph connectivity correctness
 */

import type { ValidationWarning } from './schemas';

// ============================================
// Node Arity Definitions
// ============================================

export interface NodeArity {
  inputs: number; // -1 = variable/unlimited
  outputs: number; // -1 = variable/unlimited
  inputLabels?: string[]; // Optional names for inputs
  outputLabels?: string[]; // Optional names for outputs
}

/**
 * Node type registry with arity information
 * Based on n8n core nodes
 */
export const NODE_REGISTRY: Record<string, NodeArity> = {
  // Triggers (0 inputs, 1 output)
  'n8n-nodes-base.manualTrigger': { inputs: 0, outputs: 1 },
  'n8n-nodes-base.scheduleTrigger': { inputs: 0, outputs: 1 },
  'n8n-nodes-base.webhook': { inputs: 0, outputs: 1 },
  'n8n-nodes-base.formTrigger': { inputs: 0, outputs: 1 },
  'n8n-nodes-base.errorTrigger': { inputs: 0, outputs: 1 },

  // Logic nodes
  'n8n-nodes-base.if': {
    inputs: 1,
    outputs: 2,
    outputLabels: ['true', 'false'],
  },
  'n8n-nodes-base.switch': {
    inputs: 1,
    outputs: -1, // Variable based on rules
  },
  'n8n-nodes-base.merge': {
    inputs: 2,
    outputs: 1,
    inputLabels: ['Input 1', 'Input 2'],
  },
  'n8n-nodes-base.splitInBatches': {
    inputs: 1,
    outputs: 2,
    outputLabels: ['loop', 'done'],
  },
  'n8n-nodes-base.wait': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.stopAndError': { inputs: 1, outputs: 0 },

  // Action nodes (1 input, 1 output)
  'n8n-nodes-base.httpRequest': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.set': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.code': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.editFields': { inputs: 1, outputs: 1 },

  // Data transformation (1 input, 1 output)
  'n8n-nodes-base.splitOut': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.filter': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.sort': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.limit': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.removeDuplicates': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.aggregate': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.itemLists': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.flatten': { inputs: 1, outputs: 1 },

  // Integration nodes (1 input, 1 output)
  'n8n-nodes-base.rssFeedRead': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.googleSheets': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.gmail': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.slack': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.discord': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.telegram': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.notion': { inputs: 1, outputs: 1 },

  // Database nodes (1 input, 1 output)
  'n8n-nodes-base.postgres': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.mySql': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.mongoDb': { inputs: 1, outputs: 1 },
  'n8n-nodes-base.redis': { inputs: 1, outputs: 1 },

  // Flow control
  'n8n-nodes-base.executeWorkflow': { inputs: 1, outputs: 1 },
};

// ============================================
// Arity Validation
// ============================================

export interface ArityViolation {
  node: string;
  type: 'output_exceeded' | 'input_conflict' | 'unknown_node';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Get arity for a node type
 */
export function getNodeArity(nodeType: string): NodeArity | null {
  // Check exact match
  if (NODE_REGISTRY[nodeType]) {
    return NODE_REGISTRY[nodeType];
  }

  // Check prefix match for versioned nodes (e.g., @n8n/n8n-nodes-langchain.xxx)
  for (const [key, arity] of Object.entries(NODE_REGISTRY)) {
    if (nodeType.includes(key.replace('n8n-nodes-base.', ''))) {
      return arity;
    }
  }

  // Default for unknown nodes: assume 1 input, 1 output
  return null;
}

/**
 * Validate graph arity (input/output connections)
 */
export function validateGraphArity(
  nodes: Array<{ name: string; type: string }>,
  connections: Record<string, { main?: Array<Array<{ node: string; type?: string; index?: number }>> }>
): ArityViolation[] {
  const violations: ArityViolation[] = [];
  const nodeNames = new Set(nodes.map(n => n.name));
  const nodeTypes = new Map(nodes.map(n => [n.name, n.type]));

  // Track incoming connections per input index per node
  const incomingCount = new Map<string, Map<number, string[]>>();

  // Initialize
  for (const name of nodeNames) {
    incomingCount.set(name, new Map());
  }

  // Analyze connections
  for (const [sourceName, outputs] of Object.entries(connections)) {
    const sourceType = nodeTypes.get(sourceName);
    const sourceArity = sourceType ? getNodeArity(sourceType) : null;

    if (!outputs.main) continue;

    // Check output index validity
    for (let outputIndex = 0; outputIndex < outputs.main.length; outputIndex++) {
      const outputList = outputs.main[outputIndex];

      // Check if source supports this output index
      if (sourceArity && sourceArity.outputs > 0 && outputIndex >= sourceArity.outputs) {
        violations.push({
          node: sourceName,
          type: 'output_exceeded',
          message: `Node "${sourceName}" has ${sourceArity.outputs} output(s) but connection uses output index ${outputIndex}`,
          details: { maxOutputs: sourceArity.outputs, usedIndex: outputIndex },
        });
      }

      if (!Array.isArray(outputList)) continue;

      // Track incoming connections
      for (const target of outputList) {
        if (!target.node || !nodeNames.has(target.node)) continue;

        const targetType = nodeTypes.get(target.node);
        const targetArity = targetType ? getNodeArity(targetType) : null;
        const inputIndex = target.index ?? 0;

        // Get or create array for this input index
        const nodeIncoming = incomingCount.get(target.node)!;
        if (!nodeIncoming.has(inputIndex)) {
          nodeIncoming.set(inputIndex, []);
        }
        nodeIncoming.get(inputIndex)!.push(sourceName);

        // Check if target has limited inputs
        if (targetArity && targetArity.inputs > 0 && inputIndex >= targetArity.inputs) {
          violations.push({
            node: target.node,
            type: 'input_conflict',
            message: `Node "${target.node}" has ${targetArity.inputs} input(s) but connection targets input index ${inputIndex}`,
            details: { maxInputs: targetArity.inputs, usedIndex: inputIndex },
          });
        }
      }
    }
  }

  // Check for multiple connections to same input index
  for (const [nodeName, inputMap] of incomingCount) {
    for (const [inputIndex, sources] of inputMap) {
      if (sources.length > 1) {
        const nodeType = nodeTypes.get(nodeName);
        const arity = nodeType ? getNodeArity(nodeType) : null;

        // This is only an error for nodes with fixed inputs (like Merge)
        if (arity && arity.inputs > 0 && arity.inputs <= 2) {
          violations.push({
            node: nodeName,
            type: 'input_conflict',
            message: `Node "${nodeName}" input ${inputIndex} has ${sources.length} connections but should have at most 1. Sources: ${sources.join(', ')}`,
            details: { inputIndex, sources, maxPerInput: 1 },
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Convert arity violations to validation warnings
 */
export function arityViolationsToWarnings(violations: ArityViolation[]): ValidationWarning[] {
  return violations.map(v => ({
    code: `ARITY_${v.type.toUpperCase()}`,
    message: v.message,
    node: v.node,
    severity: 'error' as const,
    suggestion: getSuggestion(v),
  }));
}

function getSuggestion(violation: ArityViolation): string {
  switch (violation.type) {
    case 'output_exceeded':
      return 'Remove connections from non-existent output index or split into multiple paths';
    case 'input_conflict':
      return 'Use Merge node to combine multiple inputs, or fix connection targeting';
    case 'unknown_node':
      return 'Check if node type is correct and supported';
    default:
      return 'Review node connections';
  }
}

/**
 * Quick check if a merge node is properly connected
 */
export function validateMergeNodeConnections(
  nodes: Array<{ name: string; type: string; parameters?: Record<string, unknown> }>,
  connections: Record<string, unknown>
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const conn = connections as Record<string, { main?: Array<Array<{ node: string }>> }>;

  // Find all merge nodes
  const mergeNodes = nodes.filter(n => n.type === 'n8n-nodes-base.merge');

  for (const mergeNode of mergeNodes) {
    // Check mode
    const mode = mergeNode.parameters?.mode as string;
    if (mode === 'combine' || mode === 'multiplex') {
      warnings.push({
        code: 'MERGE_MODE_WARNING',
        message: `Merge node "${mergeNode.name}" uses mode="${mode}". For aggregation, use mode="append"`,
        node: mergeNode.name,
        severity: 'warning',
        suggestion: 'Change mode to "append" for combining streams',
      });
    }

    // Count incoming connections
    let incomingCount = 0;
    for (const [, outputs] of Object.entries(conn)) {
      if (!outputs.main) continue;
      for (const outputList of outputs.main) {
        if (!Array.isArray(outputList)) continue;
        for (const target of outputList) {
          if (target.node === mergeNode.name) {
            incomingCount++;
          }
        }
      }
    }

    if (incomingCount > 2) {
      warnings.push({
        code: 'MERGE_TOO_MANY_INPUTS',
        message: `Merge node "${mergeNode.name}" has ${incomingCount} incoming connections but only supports 2 inputs`,
        node: mergeNode.name,
        severity: 'error',
        suggestion: 'Chain multiple Merge nodes or reduce incoming connections',
      });
    }
  }

  return warnings;
}
