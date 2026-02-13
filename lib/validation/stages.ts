import {
  n8nWorkflow,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ErrorCodes,
} from './schemas';

// ============================================
// Stage 1: JSON Parse & Basic Shape
// ============================================

/**
 * Stage 1 validates the most basic structure:
 * - Valid JSON (if parsing from string)
 * - Root is an object
 * - Has nodes array
 * - Has connections object
 */
export function validateStage1(json: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if input is null or undefined
  if (json === null || json === undefined) {
    errors.push({
      code: ErrorCodes.INVALID_JSON,
      message: 'Input is null or undefined',
      severity: 'error',
      suggestion: 'Provide a valid n8n workflow JSON object',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  // Check root type is object
  if (typeof json !== 'object' || Array.isArray(json)) {
    errors.push({
      code: ErrorCodes.NOT_AN_OBJECT,
      message: 'Root element must be an object',
      severity: 'error',
      path: '$',
      suggestion: 'The workflow JSON must be an object, not an array or primitive',
    });
    return { valid: false, errors, warnings, stage: 1 };
  }

  const obj = json as Record<string, unknown>;

  // Check nodes exists and is array
  if (!('nodes' in obj)) {
    errors.push({
      code: ErrorCodes.MISSING_NODES,
      message: 'Missing required "nodes" property',
      severity: 'error',
      path: '$.nodes',
      suggestion: 'Add a "nodes" array to the workflow',
    });
  } else if (!Array.isArray(obj.nodes)) {
    errors.push({
      code: ErrorCodes.NODES_NOT_ARRAY,
      message: '"nodes" must be an array',
      severity: 'error',
      path: '$.nodes',
      suggestion: 'Convert the nodes property to an array',
    });
  }

  // Check connections exists and is object
  if (!('connections' in obj)) {
    errors.push({
      code: ErrorCodes.MISSING_CONNECTIONS,
      message: 'Missing required "connections" property',
      severity: 'error',
      path: '$.connections',
      suggestion: 'Add a "connections" object to the workflow',
    });
  } else if (typeof obj.connections !== 'object' || Array.isArray(obj.connections)) {
    errors.push({
      code: ErrorCodes.CONNECTIONS_NOT_OBJECT,
      message: '"connections" must be an object',
      severity: 'error',
      path: '$.connections',
      suggestion: 'Convert the connections property to an object',
    });
  }

  // If nodes array exists, count unique node types
  const nodeTypes: Record<string, number> = {};
  if (Array.isArray(obj.nodes)) {
    for (const node of obj.nodes) {
      if (node && typeof node === 'object' && 'type' in node) {
        const type = String((node as Record<string, unknown>).type);
        nodeTypes[type] = (nodeTypes[type] || 0) + 1;
      }
    }
  }

  // Count connections
  let connectionCount = 0;
  if (obj.connections && typeof obj.connections === 'object' && !Array.isArray(obj.connections)) {
    const connections = obj.connections as Record<string, unknown>;
    for (const sourceConn of Object.values(connections)) {
      if (sourceConn && typeof sourceConn === 'object') {
        const conn = sourceConn as Record<string, unknown>;
        if ('main' in conn && Array.isArray(conn.main)) {
          for (const outputs of conn.main) {
            if (Array.isArray(outputs)) {
              connectionCount += outputs.length;
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stage: 1,
    stats: {
      nodeCount: Array.isArray(obj.nodes) ? obj.nodes.length : 0,
      connectionCount,
      nodeTypes,
    },
  };
}

// ============================================
// Stage 1 with JSON string parsing
// ============================================

export function validateStage1FromString(jsonString: string): ValidationResult {
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
          suggestion: 'Fix JSON syntax errors (missing quotes, commas, brackets, etc.)',
        },
      ],
      warnings: [],
      stage: 1,
    };
  }

  return validateStage1(parsed);
}

// ============================================
// Quick validation check (Stage 1 only)
// ============================================

export function isValidBasicShape(json: unknown): boolean {
  const result = validateStage1(json);
  return result.valid;
}

export function isValidBasicShapeFromString(jsonString: string): boolean {
  const result = validateStage1FromString(jsonString);
  return result.valid;
}
