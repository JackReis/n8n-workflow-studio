import {
  n8nWorkflow,
  n8nNode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ErrorCodes,
  ConnectionTarget,
  NodeConnections,
} from './schemas';

// ============================================
// Stage 2: n8n Structural Rules
// ============================================

/**
 * Stage 2 validates n8n-specific structural rules:
 * - Each node has required fields (id, name, type)
 * - typeVersion is a number
 * - position is [number, number]
 * - parameters is an object
 * - Connections reference valid nodes
 */
export function validateStage2(workflow: n8nWorkflow): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Build lookup maps
  const nodeNameSet = new Set<string>();
  const nodeIdSet = new Set<string>();
  const nodeNameToId = new Map<string, string>();

  // Validate each node
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];
    const path = `$.nodes[${i}]`;

    validateNode(node, path, i, errors, warnings, nodeNameSet, nodeIdSet, nodeNameToId);
  }

  // Validate connections
  validateConnections(workflow, nodeNameSet, errors, warnings);

  // Build stats
  const nodeTypes: Record<string, number> = {};
  for (const node of workflow.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  let connectionCount = 0;
  for (const sourceConn of Object.values(workflow.connections)) {
    if (sourceConn.main) {
      for (const outputs of sourceConn.main) {
        connectionCount += outputs.length;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stage: 2,
    stats: {
      nodeCount: workflow.nodes.length,
      connectionCount,
      nodeTypes,
    },
  };
}

// ============================================
// Node Validation
// ============================================

function validateNode(
  node: n8nNode,
  path: string,
  index: number,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  nodeNameSet: Set<string>,
  nodeIdSet: Set<string>,
  nodeNameToId: Map<string, string>
): void {
  // Check name (required)
  if (!node.name || typeof node.name !== 'string' || node.name.trim() === '') {
    errors.push({
      code: ErrorCodes.NODE_MISSING_NAME,
      message: `Node at index ${index} is missing a valid name`,
      severity: 'error',
      path: `${path}.name`,
      suggestion: 'Add a unique name to the node',
    });
  } else {
    // Check for duplicate names
    if (nodeNameSet.has(node.name)) {
      errors.push({
        code: ErrorCodes.NODE_DUPLICATE_NAME,
        message: `Duplicate node name: "${node.name}"`,
        severity: 'error',
        path,
        node: node.name,
        suggestion: 'Each node must have a unique name',
      });
    } else {
      nodeNameSet.add(node.name);
    }
  }

  // Check type (required)
  if (!node.type || typeof node.type !== 'string' || node.type.trim() === '') {
    errors.push({
      code: ErrorCodes.NODE_MISSING_TYPE,
      message: `Node "${node.name || `at index ${index}`}" is missing a valid type`,
      severity: 'error',
      path: `${path}.type`,
      node: node.name,
      suggestion: 'Add a valid n8n node type (e.g., "n8n-nodes-base.httpRequest")',
    });
  }

  // Check id (recommended but not strictly required by n8n)
  if (node.id !== undefined) {
    if (typeof node.id !== 'string') {
      errors.push({
        code: ErrorCodes.NODE_MISSING_ID,
        message: `Node "${node.name}" has an invalid id type`,
        severity: 'error',
        path: `${path}.id`,
        node: node.name,
        suggestion: 'Node id should be a string (UUID format recommended)',
      });
    } else if (nodeIdSet.has(node.id)) {
      errors.push({
        code: ErrorCodes.NODE_DUPLICATE_ID,
        message: `Duplicate node id: "${node.id}"`,
        severity: 'error',
        path,
        node: node.name,
        suggestion: 'Each node must have a unique id',
      });
    } else {
      nodeIdSet.add(node.id);
      if (node.name) {
        nodeNameToId.set(node.name, node.id);
      }
    }
  } else {
    // Generate a warning for missing id (n8n will auto-generate, but it's better to have one)
    warnings.push({
      code: 'W100',
      message: `Node "${node.name}" has no id - n8n will auto-generate one`,
      path: `${path}.id`,
      node: node.name,
      suggestion: 'Consider adding a unique id to the node',
    });
  }

  // Check typeVersion (n8n allows decimals like 1.2)
  if (node.typeVersion === undefined) {
    errors.push({
      code: ErrorCodes.NODE_INVALID_TYPE_VERSION,
      message: `Node "${node.name}" is missing typeVersion`,
      severity: 'error',
      path: `${path}.typeVersion`,
      node: node.name,
      suggestion: 'Add a typeVersion (usually 1 or higher)',
    });
  } else if (typeof node.typeVersion !== 'number' || node.typeVersion < 1) {
    errors.push({
      code: ErrorCodes.NODE_INVALID_TYPE_VERSION,
      message: `Node "${node.name}" has invalid typeVersion: ${node.typeVersion}`,
      severity: 'error',
      path: `${path}.typeVersion`,
      node: node.name,
      suggestion: 'typeVersion must be a positive number (decimals like 1.2 are allowed)',
    });
  }

  // Check position
  if (!node.position) {
    errors.push({
      code: ErrorCodes.NODE_INVALID_POSITION,
      message: `Node "${node.name}" is missing position`,
      severity: 'error',
      path: `${path}.position`,
      node: node.name,
      suggestion: 'Add a position array [x, y]',
    });
  } else if (!Array.isArray(node.position) || node.position.length !== 2) {
    errors.push({
      code: ErrorCodes.NODE_INVALID_POSITION,
      message: `Node "${node.name}" has invalid position format`,
      severity: 'error',
      path: `${path}.position`,
      node: node.name,
      suggestion: 'Position must be an array [x, y]',
    });
  } else if (typeof node.position[0] !== 'number' || typeof node.position[1] !== 'number') {
    errors.push({
      code: ErrorCodes.NODE_INVALID_POSITION,
      message: `Node "${node.name}" has non-numeric position values`,
      severity: 'error',
      path: `${path}.position`,
      node: node.name,
      suggestion: 'Position values must be numbers',
    });
  }

  // Check parameters
  if (node.parameters === undefined) {
    errors.push({
      code: ErrorCodes.NODE_PARAMETERS_NOT_OBJECT,
      message: `Node "${node.name}" is missing parameters object`,
      severity: 'error',
      path: `${path}.parameters`,
      node: node.name,
      suggestion: 'Add a parameters object (can be empty {})',
    });
  } else if (typeof node.parameters !== 'object' || Array.isArray(node.parameters)) {
    errors.push({
      code: ErrorCodes.NODE_PARAMETERS_NOT_OBJECT,
      message: `Node "${node.name}" parameters must be an object`,
      severity: 'error',
      path: `${path}.parameters`,
      node: node.name,
      suggestion: 'Convert parameters to an object',
    });
  }
}

// ============================================
// Connection Validation
// ============================================

function validateConnections(
  workflow: n8nWorkflow,
  nodeNameSet: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { connections, nodes } = workflow;

  for (const [sourceName, sourceConnections] of Object.entries(connections)) {
    // Check source node exists
    if (!nodeNameSet.has(sourceName)) {
      errors.push({
        code: ErrorCodes.CONN_SOURCE_NOT_FOUND,
        message: `Connection source node "${sourceName}" not found in nodes`,
        severity: 'error',
        path: `$.connections["${sourceName}"]`,
        suggestion: 'Remove the connection or add the missing source node',
      });
      continue;
    }

    // Validate connection structure
    if (!sourceConnections || typeof sourceConnections !== 'object') {
      errors.push({
        code: ErrorCodes.CONN_INVALID_FORMAT,
        message: `Invalid connection format for source "${sourceName}"`,
        severity: 'error',
        path: `$.connections["${sourceName}"]`,
        suggestion: 'Connection must be an object with "main" array',
      });
      continue;
    }

    const conn = sourceConnections as NodeConnections;

    // Validate main connections
    if (conn.main) {
      if (!Array.isArray(conn.main)) {
        errors.push({
          code: ErrorCodes.CONN_INVALID_FORMAT,
          message: `"main" must be an array for source "${sourceName}"`,
          severity: 'error',
          path: `$.connections["${sourceName}"].main`,
          suggestion: 'Convert main to an array of connection arrays',
        });
        continue;
      }

      for (let outputIndex = 0; outputIndex < conn.main.length; outputIndex++) {
        const outputs = conn.main[outputIndex];

        if (!Array.isArray(outputs)) {
          errors.push({
            code: ErrorCodes.CONN_INVALID_FORMAT,
            message: `Output ${outputIndex} for source "${sourceName}" must be an array`,
            severity: 'error',
            path: `$.connections["${sourceName}"].main[${outputIndex}]`,
            suggestion: 'Each output must be an array of connection targets',
          });
          continue;
        }

        for (let connIndex = 0; connIndex < outputs.length; connIndex++) {
          const target = outputs[connIndex];

          // Validate target structure
          if (!target || typeof target !== 'object') {
            errors.push({
              code: ErrorCodes.CONN_INVALID_FORMAT,
              message: `Invalid connection target at ${sourceName}[${outputIndex}][${connIndex}]`,
              severity: 'error',
              path: `$.connections["${sourceName}"].main[${outputIndex}][${connIndex}]`,
              suggestion: 'Target must be an object with node, type, and index',
            });
            continue;
          }

          const connTarget = target as ConnectionTarget;

          // Check target node name
          if (!connTarget.node || typeof connTarget.node !== 'string') {
            errors.push({
              code: ErrorCodes.CONN_INVALID_FORMAT,
              message: `Missing target node name in connection from "${sourceName}"`,
              severity: 'error',
              path: `$.connections["${sourceName}"].main[${outputIndex}][${connIndex}].node`,
              suggestion: 'Add a valid target node name',
            });
            continue;
          }

          // Check target node exists
          if (!nodeNameSet.has(connTarget.node)) {
            errors.push({
              code: ErrorCodes.CONN_TARGET_NOT_FOUND,
              message: `Connection target node "${connTarget.node}" not found (from "${sourceName}")`,
              severity: 'error',
              path: `$.connections["${sourceName}"].main[${outputIndex}][${connIndex}]`,
              suggestion: 'Remove the connection or add the missing target node',
            });
          }

          // Validate index
          if (connTarget.index !== undefined) {
            if (typeof connTarget.index !== 'number' || !Number.isInteger(connTarget.index) || connTarget.index < 0) {
              errors.push({
                code: ErrorCodes.CONN_INVALID_INDEX,
                message: `Invalid connection index for target "${connTarget.node}"`,
                severity: 'error',
                path: `$.connections["${sourceName}"].main[${outputIndex}][${connIndex}].index`,
                suggestion: 'Index must be a non-negative integer',
              });
            }
          }

          // Validate type
          if (!connTarget.type) {
            warnings.push({
              code: 'W200',
              message: `Connection from "${sourceName}" to "${connTarget.node}" has no type specified`,
              path: `$.connections["${sourceName}"].main[${outputIndex}][${connIndex}]`,
              suggestion: 'Consider adding type (usually "main")',
            });
          }
        }
      }
    }
  }
}

// ============================================
// Full Validation (Stage 1 + Stage 2)
// ============================================

export function validateWorkflow(workflow: unknown): ValidationResult {
  // Run Stage 1 first
  const stage1Result = validateStage1Basic(workflow);

  if (!stage1Result.valid) {
    return stage1Result;
  }

  // Run Stage 2
  const typedWorkflow = workflow as n8nWorkflow;
  return validateStage2(typedWorkflow);
}

// Helper that doesn't duplicate Stage 1 logic
function validateStage1Basic(json: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (json === null || json === undefined) {
    errors.push({
      code: ErrorCodes.INVALID_JSON,
      message: 'Input is null or undefined',
      severity: 'error',
      suggestion: 'Provide a valid n8n workflow JSON object',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  if (typeof json !== 'object' || Array.isArray(json)) {
    errors.push({
      code: ErrorCodes.NOT_AN_OBJECT,
      message: 'Root element must be an object',
      severity: 'error',
      path: '$',
      suggestion: 'The workflow JSON must be an object',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  const obj = json as Record<string, unknown>;

  if (!('nodes' in obj)) {
    errors.push({
      code: ErrorCodes.MISSING_NODES,
      message: 'Missing required "nodes" property',
      severity: 'error',
      path: '$.nodes',
      suggestion: 'Add a "nodes" array to the workflow',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  if (!Array.isArray(obj.nodes)) {
    errors.push({
      code: ErrorCodes.NODES_NOT_ARRAY,
      message: '"nodes" must be an array',
      severity: 'error',
      path: '$.nodes',
      suggestion: 'Convert the nodes property to an array',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  if (!('connections' in obj)) {
    errors.push({
      code: ErrorCodes.MISSING_CONNECTIONS,
      message: 'Missing required "connections" property',
      severity: 'error',
      path: '$.connections',
      suggestion: 'Add a "connections" object to the workflow',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  if (typeof obj.connections !== 'object' || Array.isArray(obj.connections)) {
    errors.push({
      code: ErrorCodes.CONNECTIONS_NOT_OBJECT,
      message: '"connections" must be an object',
      severity: 'error',
      path: '$.connections',
      suggestion: 'Convert the connections property to an object',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  return { valid: true, errors: [], warnings: [], stage: 1 };
}

// ============================================
// Validation from string
// ============================================

export function validateWorkflowFromString(jsonString: string): ValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
    return {
      valid: false,
      errors: [
        {
          code: ErrorCodes.INVALID_JSON,
          message: `Invalid JSON: ${errorMessage}`,
          severity: 'error',
          suggestion: 'Fix JSON syntax errors',
        },
      ],
      warnings: [],
      stage: 1,
    };
  }

  return validateWorkflow(parsed);
}
