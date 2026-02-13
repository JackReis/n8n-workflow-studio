import {
  n8nWorkflow,
  n8nNode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ErrorCodes,
} from './schemas';
import { validateStage2 } from './rules';

// ============================================
// Node Type Registry (Common n8n nodes)
// ============================================

interface NodeTypeInfo {
  name: string;
  category: string;
  requiredParams?: string[];
  minTypeVersion?: number;
}

const NODE_TYPE_REGISTRY: Record<string, NodeTypeInfo> = {
  // Trigger nodes
  'n8n-nodes-base.manualTrigger': { name: 'Manual Trigger', category: 'trigger' },
  'n8n-nodes-base.scheduleTrigger': { name: 'Schedule Trigger', category: 'trigger', requiredParams: ['rule'] },
  'n8n-nodes-base.webhook': { name: 'Webhook', category: 'trigger', requiredParams: ['httpMethod', 'path'] },
  'n8n-nodes-base.formTrigger': { name: 'Form Trigger', category: 'trigger' },

  // Action nodes
  'n8n-nodes-base.httpRequest': { name: 'HTTP Request', category: 'action', requiredParams: ['url'] },
  'n8n-nodes-base.set': { name: 'Set', category: 'action' },
  'n8n-nodes-base.code': { name: 'Code', category: 'action' },
  'n8n-nodes-base.if': { name: 'IF', category: 'logic' },
  'n8n-nodes-base.switch': { name: 'Switch', category: 'logic' },
  'n8n-nodes-base.merge': { name: 'Merge', category: 'logic' },
  'n8n-nodes-base.splitInBatches': { name: 'Split In Batches', category: 'logic' },
  'n8n-nodes-base.wait': { name: 'Wait', category: 'logic' },
  'n8n-nodes-base.stopAndError': { name: 'Stop and Error', category: 'logic' },
  'n8n-nodes-base.errorTrigger': { name: 'Error Trigger', category: 'trigger' },

  // Data transformation
  'n8n-nodes-base.editFields': { name: 'Edit Fields', category: 'transform' },
  'n8n-nodes-base.filter': { name: 'Filter', category: 'transform' },
  'n8n-nodes-base.sort': { name: 'Sort', category: 'transform' },
  'n8n-nodes-base.limit': { name: 'Limit', category: 'transform' },
  'n8n-nodes-base.removeDuplicates': { name: 'Remove Duplicates', category: 'transform' },
  'n8n-nodes-base.aggregate': { name: 'Aggregate', category: 'transform' },
  'n8n-nodes-base.itemLists': { name: 'Item Lists', category: 'transform' },
  'n8n-nodes-base.flatten': { name: 'Flatten', category: 'transform' },

  // Integration nodes
  'n8n-nodes-base.googleSheets': { name: 'Google Sheets', category: 'integration' },
  'n8n-nodes-base.googleDocs': { name: 'Google Docs', category: 'integration' },
  'n8n-nodes-base.googleDrive': { name: 'Google Drive', category: 'integration' },
  'n8n-nodes-base.gmail': { name: 'Gmail', category: 'integration' },
  'n8n-nodes-base.slack': { name: 'Slack', category: 'integration' },
  'n8n-nodes-base.discord': { name: 'Discord', category: 'integration' },
  'n8n-nodes-base.telegram': { name: 'Telegram', category: 'integration' },
  'n8n-nodes-base.twitter': { name: 'Twitter', category: 'integration' },
  'n8n-nodes-base.notion': { name: 'Notion', category: 'integration' },
  'n8n-nodes-base.airtable': { name: 'Airtable', category: 'integration' },

  // Database
  'n8n-nodes-base.postgres': { name: 'PostgreSQL', category: 'database' },
  'n8n-nodes-base.mySql': { name: 'MySQL', category: 'database' },
  'n8n-nodes-base.mongoDb': { name: 'MongoDB', category: 'database' },
  'n8n-nodes-base.redis': { name: 'Redis', category: 'database' },

  // AI/LLM
  'n8n-nodes-base.openAi': { name: 'OpenAI', category: 'ai' },
  'n8n-nodes-base.lmChatOpenAi': { name: 'OpenAI Chat Model', category: 'ai' },
  'n8n-nodes-base.langChain': { name: 'LangChain', category: 'ai' },
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': { name: 'OpenAI Chat Model', category: 'ai' },
  '@n8n/n8n-nodes-langchain.chainLlm': { name: 'LLM Chain', category: 'ai' },

  // Flow control
  'n8n-nodes-base.executeWorkflow': { name: 'Execute Workflow', category: 'flow' },
  'n8n-nodes-base.executeCommand': { name: 'Execute Command', category: 'flow' },
  'n8n-nodes-base.readBinaryFile': { name: 'Read Binary File', category: 'io' },
  'n8n-nodes-base.writeBinaryFile': { name: 'Write Binary File', category: 'io' },
  'n8n-nodes-base.readWriteFile': { name: 'Read/Write File', category: 'io' },
  'n8n-nodes-base.moveBinaryData': { name: 'Move Binary Data', category: 'io' },
  'n8n-nodes-base.convertToFile': { name: 'Convert to File', category: 'io' },
  'n8n-nodes-base.compression': { name: 'Compression', category: 'io' },
  'n8n-nodes-base.ftp': { name: 'FTP', category: 'io' },
  'n8n-nodes-base.ssh': { name: 'SSH', category: 'io' },
};

// ============================================
// Stage 3: Semantic Validation
// ============================================

/**
 * Stage 3 performs semantic validation:
 * - Node type registry validation
 * - Expression validation ({{$json...}})
 * - Parameter completeness checks
 */
export function validateStage3(workflow: n8nWorkflow): ValidationResult {
  // First run Stage 2 to ensure basic structure is valid
  const stage2Result = validateStage2(workflow);

  const errors: ValidationError[] = [...stage2Result.errors];
  const warnings: ValidationWarning[] = [...stage2Result.warnings];

  // Skip semantic checks if Stage 2 failed
  if (!stage2Result.valid) {
    return {
      valid: false,
      errors,
      warnings,
      stage: 3,
      stats: stage2Result.stats,
    };
  }

  // Validate each node semantically
  for (const node of workflow.nodes) {
    validateNodeSemantics(node, errors, warnings);
  }

  // Validate expressions in string parameters
  validateExpressions(workflow, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stage: 3,
    stats: stage2Result.stats,
  };
}

// ============================================
// Node Semantic Validation
// ============================================

function validateNodeSemantics(
  node: n8nNode,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const nodeType = NODE_TYPE_REGISTRY[node.type];

  // Check if node type is known
  if (!nodeType) {
    // Check if it's a community node
    if (node.type.includes('@')) {
      warnings.push({
        code: ErrorCodes.UNKNOWN_NODE_TYPE,
        message: `Node "${node.name}" uses community node type "${node.type}"`,
        node: node.name,
        suggestion: 'Ensure the community node is installed in your n8n instance',
      });
    } else {
      warnings.push({
        code: ErrorCodes.UNKNOWN_NODE_TYPE,
        message: `Unknown node type "${node.type}" for node "${node.name}"`,
        node: node.name,
        suggestion: 'Check if the node type is correct and the node is available',
      });
    }
    return;
  }

  // Check required parameters for known node types
  if (nodeType.requiredParams && nodeType.requiredParams.length > 0) {
    for (const param of nodeType.requiredParams) {
      const value = node.parameters[param];
      if (value === undefined || value === null || value === '') {
        errors.push({
          code: ErrorCodes.EMPTY_PARAMETERS,
          message: `Node "${node.name}" (${nodeType.name}) is missing required parameter "${param}"`,
          severity: 'error',
          node: node.name,
          suggestion: `Add the "${param}" parameter to the node`,
        });
      }
    }
  }

  // Check for common parameter issues
  checkCommonParameterIssues(node, nodeType, warnings);
}

function checkCommonParameterIssues(
  node: n8nNode,
  nodeType: NodeTypeInfo,
  warnings: ValidationWarning[]
): void {
  // HTTP Request node: check URL
  if (node.type === 'n8n-nodes-base.httpRequest') {
    const url = node.parameters.url as string | undefined;
    if (url && typeof url === 'string') {
      try {
        new URL(url);
      } catch {
        // Check if it's an expression
        if (!url.includes('{{')) {
          warnings.push({
            code: ErrorCodes.EMPTY_PARAMETERS,
            message: `Node "${node.name}" has an invalid URL: ${url}`,
            node: node.name,
            suggestion: 'Provide a valid URL or use an expression',
          });
        }
      }
    }
  }

  // Check for credentials requirement
  const credentialRequiredTypes = [
    'n8n-nodes-base.googleSheets',
    'n8n-nodes-base.gmail',
    'n8n-nodes-base.slack',
    'n8n-nodes-base.discord',
    'n8n-nodes-base.telegram',
    'n8n-nodes-base.openAi',
    'n8n-nodes-base.postgres',
    'n8n-nodes-base.mySql',
    'n8n-nodes-base.mongoDb',
  ];

  if (credentialRequiredTypes.includes(node.type)) {
    if (!node.credentials || Object.keys(node.credentials).length === 0) {
      warnings.push({
        code: ErrorCodes.MISSING_CREDENTIALS,
        message: `Node "${node.name}" (${nodeType.name}) typically requires credentials`,
        node: node.name,
        suggestion: 'Add credentials to authenticate with the service',
      });
    }
  }
}

// ============================================
// Expression Validation
// ============================================

const EXPRESSION_REGEX = /\{\{([^}]+)\}\}/g;
const JSON_PATH_REGEX = /^\$json(\.[a-zA-Z0-9_.[\]"']+)*/;
const ITEMS_PATH_REGEX = /^\$item(\(\d+\))?(\.[a-zA-Z0-9_.[\]"']+)*/;
const NODE_PATH_REGEX = /^\$node\(["'][^"']+["']\)(\.[a-zA-Z0-9_.[\]"']+)*/;

function validateExpressions(workflow: n8nWorkflow, warnings: ValidationWarning[]): void {
  for (const node of workflow.nodes) {
    validateExpressionsInObject(node.parameters, `$.nodes["${node.name}"].parameters`, node.name, warnings);
  }
}

function validateExpressionsInObject(
  obj: Record<string, unknown>,
  path: string,
  nodeName: string,
  warnings: ValidationWarning[]
): void {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`;

    if (typeof value === 'string') {
      validateExpression(value, currentPath, nodeName, warnings);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          validateExpression(value[i], `${currentPath}[${i}]`, nodeName, warnings);
        } else if (value[i] && typeof value[i] === 'object') {
          validateExpressionsInObject(value[i] as Record<string, unknown>, `${currentPath}[${i}]`, nodeName, warnings);
        }
      }
    } else if (value && typeof value === 'object') {
      validateExpressionsInObject(value as Record<string, unknown>, currentPath, nodeName, warnings);
    }
  }
}

function validateExpression(
  text: string,
  path: string,
  nodeName: string,
  warnings: ValidationWarning[]
): void {
  const expressions = text.match(EXPRESSION_REGEX);
  if (!expressions) return;

  for (const expr of expressions) {
    const inner = expr.slice(2, -2).trim();

    // Check for common expression issues
    if (inner.includes('undefined')) {
      warnings.push({
        code: ErrorCodes.EXPRESSION_WARNING,
        message: `Potential "undefined" in expression at ${path}`,
        node: nodeName,
        path,
        suggestion: 'Check if the referenced value might be undefined at runtime',
      });
    }

    // Check for potentially problematic paths
    if (!isValidExpressionPath(inner)) {
      // Only warn for paths that look like they should be valid
      if (inner.startsWith('$') && !inner.includes('runOnceForAllItems') && !inner.includes('runForEachItem')) {
        warnings.push({
          code: ErrorCodes.EXPRESSION_WARNING,
          message: `Expression "${expr}" may have an invalid path`,
          node: nodeName,
          path,
          suggestion: 'Verify the expression path is correct',
        });
      }
    }
  }
}

function isValidExpressionPath(expr: string): boolean {
  // Common valid expressions
  if (JSON_PATH_REGEX.test(expr)) return true;
  if (ITEMS_PATH_REGEX.test(expr)) return true;
  if (NODE_PATH_REGEX.test(expr)) return true;

  // Built-in functions and variables
  const validPrefixes = [
    '$json', '$item', '$node', '$workflow', '$execution', '$env',
    '$now', '$today', '$moment', '$jmespath', '$binary',
    'Object.', 'Array.', 'Math.', 'String.', 'Number.', 'Boolean.',
    'Date.', 'JSON.', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'Object.keys', 'Object.values', 'Object.entries',
  ];

  for (const prefix of validPrefixes) {
    if (expr.startsWith(prefix)) return true;
  }

  // Simple property access without $ prefix might be valid
  if (/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(expr)) {
    return true;
  }

  // Function calls
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\(/.test(expr)) {
    return true;
  }

  return false;
}

// ============================================
// Full Validation (All Stages)
// ============================================

export function validateWorkflowFull(workflow: unknown): ValidationResult {
  // Stage 1: Basic shape
  if (workflow === null || workflow === undefined) {
    return {
      valid: false,
      errors: [{
        code: ErrorCodes.INVALID_JSON,
        message: 'Input is null or undefined',
        severity: 'error',
        suggestion: 'Provide a valid n8n workflow JSON object',
      }],
      warnings: [],
      stage: 1,
    };
  }

  if (typeof workflow !== 'object' || Array.isArray(workflow)) {
    return {
      valid: false,
      errors: [{
        code: ErrorCodes.NOT_AN_OBJECT,
        message: 'Root element must be an object',
        severity: 'error',
        path: '$',
        suggestion: 'The workflow JSON must be an object',
      }],
      warnings: [],
      stage: 1,
    };
  }

  const obj = workflow as Record<string, unknown>;

  if (!('nodes' in obj) || !Array.isArray(obj.nodes)) {
    return {
      valid: false,
      errors: [{
        code: ErrorCodes.MISSING_NODES,
        message: 'Missing or invalid "nodes" array',
        severity: 'error',
        path: '$.nodes',
        suggestion: 'Add a "nodes" array to the workflow',
      }],
      warnings: [],
      stage: 1,
    };
  }

  if (!('connections' in obj) || typeof obj.connections !== 'object') {
    return {
      valid: false,
      errors: [{
        code: ErrorCodes.MISSING_CONNECTIONS,
        message: 'Missing or invalid "connections" object',
        severity: 'error',
        path: '$.connections',
        suggestion: 'Add a "connections" object to the workflow',
      }],
      warnings: [],
      stage: 1,
    };
  }

  // All stages passed basic checks, run full semantic validation
  return validateStage3(workflow as n8nWorkflow);
}

export function validateWorkflowFullFromString(jsonString: string): ValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    return validateWorkflowFull(parsed);
  } catch (e) {
    return {
      valid: false,
      errors: [{
        code: ErrorCodes.INVALID_JSON,
        message: `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
        severity: 'error',
        suggestion: 'Fix JSON syntax errors',
      }],
      warnings: [],
      stage: 1,
    };
  }
}
