/**
 * Production-Quality Gates for n8n Workflows
 *
 * These are CRITICAL validation rules that catch common LLM generation errors.
 * Based on real-world n8n workflow patterns and pitfalls.
 */

import type { n8nWorkflow, ValidationError } from './schemas';

export interface ProductionGateResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  fixes: AutoFixResult[];
}

export interface AutoFixResult {
  nodeIndex: number;
  nodeName: string;
  field: string;
  original: string;
  fixed: string;
  gate: string;
}

/**
 * GATE 1: Expression Syntax Validation + AutoFix
 *
 * n8n expressions MUST use: ={{ <JS expression> }}
 * NOT mustache: {{ }} (this breaks URL fields)
 * NOT inline: =https://...{{...}}
 */
export function validateExpressionSyntax(workflow: n8nWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // Pattern for invalid mustache in expressions (without = prefix)
  const mustachePattern = /\{\{[^}]+\}\}/;
  // Pattern for URL with inline mustache (broken pattern)
  const urlMustachePattern = /=https?:\/\/[^\s]*\{\{/;

  for (const node of workflow.nodes || []) {
    const nodeParams = JSON.stringify(node.parameters || {});

    // Check for mustache without = prefix
    if (mustachePattern.test(nodeParams)) {
      // Check if it's a valid expression
      const matches = nodeParams.match(/\{\{[^}]+\}\}/g) || [];
      for (const match of matches) {
        // If the match is not preceded by =, it's invalid
        const contextPattern = new RegExp(`[^=]\\s*${escapeRegex(match)}`);
        if (contextPattern.test(nodeParams) && !nodeParams.includes(`=${match}`)) {
          errors.push({
            code: 'GATE001',
            path: `nodes[${workflow.nodes.indexOf(node)}].parameters`,
            message: `Invalid mustache syntax found. Use ={{ expression }} not {{ expression }}`,
            severity: 'error',
          });
        }
      }
    }

    // Check for URL with inline mustache (broken pattern)
    if (urlMustachePattern.test(nodeParams)) {
      errors.push({
        code: 'GATE001',
        path: `nodes[${workflow.nodes.indexOf(node)}].parameters.url`,
        message: `URL with inline mustache detected. Use ={{ \`https://...\${encodeURIComponent(var)}\` }}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * DETERMINISTIC AUTO-FIX: HTTP URL Expression
 *
 * Converts broken URL patterns to valid n8n expressions:
 * BAD:  "=https://api.com?q={{ encodeURIComponent($json.q) }}"
 * GOOD: "={{ 'https://api.com?q=' + encodeURIComponent($json.q) }}"
 */
export function autoFixHttpUrlExpressions(workflow: n8nWorkflow): { workflow: n8nWorkflow; fixes: AutoFixResult[] } {
  const fixes: AutoFixResult[] = [];
  const workflowCopy = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;

  // Pattern: URL starting with =https?:// containing {{ }}
  const brokenUrlPattern = /^=(https?:\/\/[^\s]*)\{\{\s*([^}]+)\s*\}\}(.*)$/;

  for (let i = 0; i < workflowCopy.nodes.length; i++) {
    const node = workflowCopy.nodes[i];
    const params = node.parameters as Record<string, unknown>;

    if (params?.url && typeof params.url === 'string') {
      const url = params.url;
      const match = url.match(brokenUrlPattern);

      if (match) {
        const [, prefix, expr, suffix] = match;

        // Build the fixed expression
        // Handle multiple {{ }} patterns
        let fixedUrl = url;

        // If only one mustache at the end
        if (!suffix.trim() && !url.slice(match[0].length).includes('{{')) {
          // Simple case: =https://...{{ expr }}
          fixedUrl = `={{ '${prefix}' + ${expr.trim()} }}`;
        } else {
          // Complex case: multiple {{ }} - convert to template literal
          // Split by {{ and join with ${
          const parts = url.slice(1).split(/\{\{\s*/); // Remove leading =
          let result = "={{ `";
          for (let j = 0; j < parts.length; j++) {
            const part = parts[j];
            const closingBrace = part.indexOf('}}');
            if (closingBrace !== -1) {
              // This part contains a closing }}
              const beforeClose = part.slice(0, closingBrace).trim();
              const afterClose = part.slice(closingBrace + 2);
              result += `\${${beforeClose}}${afterClose}`;
            } else {
              result += part;
            }
          }
          result += "` }}";
          fixedUrl = result;
        }

        params.url = fixedUrl;
        fixes.push({
          nodeIndex: i,
          nodeName: node.name,
          field: 'parameters.url',
          original: url,
          fixed: fixedUrl,
          gate: 'GATE001',
        });
      }
    }
  }

  return { workflow: workflowCopy, fixes };
}

/**
 * GATE 2: Merge Node Mode Validation
 *
 * Different sources should use Merge "append" mode.
 * "combine" + "multiplex" creates cross-products (exponential items).
 */
export function validateMergeMode(workflow: n8nWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of workflow.nodes || []) {
    if (node.type === 'n8n-nodes-base.merge') {
      const mode = (node.parameters as Record<string, unknown>)?.mode;
      const options = (node.parameters as Record<string, unknown>)?.options as Record<string, unknown> | undefined;

      // Check for dangerous modes
      if (mode === 'combine' || mode === 'multiplex') {
        errors.push({
          code: 'GATE002',
          path: `nodes[${workflow.nodes.indexOf(node)}].parameters.mode`,
          message: `Merge mode "${mode}" creates cross-products. Use "append" to combine different sources.`,
          severity: 'error',
        });
      }

      // Check for keepKey mismatch
      if (mode === 'keepKeyCompatible' && !options?.output) {
        errors.push({
          code: 'GATE002',
          path: `nodes[${workflow.nodes.indexOf(node)}].parameters`,
          message: `Merge keepKeyCompatible mode needs proper output configuration.`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}

/**
 * DETERMINISTIC AUTO-FIX: Merge Mode
 *
 * Converts dangerous merge modes to safe "append" mode.
 */
export function autoFixMergeMode(workflow: n8nWorkflow): { workflow: n8nWorkflow; fixes: AutoFixResult[] } {
  const fixes: AutoFixResult[] = [];
  const workflowCopy = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;

  for (let i = 0; i < workflowCopy.nodes.length; i++) {
    const node = workflowCopy.nodes[i];

    if (node.type === 'n8n-nodes-base.merge') {
      const params = node.parameters as Record<string, unknown>;

      if (params?.mode === 'combine' || params?.mode === 'multiplex') {
        const original = JSON.stringify(params);
        params.mode = 'append';
        params.options = { output: 'all' };

        fixes.push({
          nodeIndex: i,
          nodeName: node.name,
          field: 'parameters.mode',
          original,
          fixed: JSON.stringify(params),
          gate: 'GATE002',
        });
      }
    }
  }

  return { workflow: workflowCopy, fixes };
}

/**
 * GATE 3: Cardinality Validation
 *
 * Final output should be a SINGLE item.
 * Check if Build Final / Aggregate node receives multiple items.
 */
export function validateCardinality(workflow: n8nWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // Find final output nodes (typically named "Build Final", "Aggregate", "Output")
  const finalNodeNames = ['build final', 'aggregate', 'output', 'final', 'result'];
  const aggregateTypes = ['n8n-nodes-base.aggregate', 'n8n-nodes-base.code'];

  for (const node of workflow.nodes || []) {
    const nodeNameLower = node.name.toLowerCase();

    // Check if this is a final aggregation node
    if (
      finalNodeNames.some(n => nodeNameLower.includes(n)) ||
      aggregateTypes.includes(node.type)
    ) {
      // Check if it has aggregation logic
      if (node.type === 'n8n-nodes-base.code') {
        const code = (node.parameters as Record<string, unknown>)?.jsCode as string || '';
        if (
          !code.includes('return [') &&
          !code.includes('.map(') &&
          !code.includes('items.reduce') &&
          code.includes('return {')
        ) {
          errors.push({
            code: 'GATE003',
            path: `nodes[${workflow.nodes.indexOf(node)}].parameters.jsCode`,
            message: `Final Code node should aggregate to single item. Use return [{ json: aggregatedResult }]`,
            severity: 'warning',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * GATE 4: XML/API Response Parsing
 *
 * arXiv and similar APIs return ATOM/XML, not JSON.
 * "item.json.entry" assumption will fail.
 * Must use string response + Code node with regex/DOMParser.
 */
export function validateXMLParsing(workflow: n8nWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // Find HTTP Request nodes that might fetch XML
  for (const node of workflow.nodes || []) {
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = (node.parameters as Record<string, unknown>)?.url as string || '';
      const params = node.parameters as Record<string, unknown>;

      // Check for known XML endpoints
      const xmlEndpoints = ['arxiv.org', '.xml', 'atom', 'rss'];
      const isXmlEndpoint = xmlEndpoints.some(e => url.toLowerCase().includes(e));

      if (isXmlEndpoint) {
        // Check if response format is correctly set
        const options = params?.options as Record<string, unknown> | undefined;
        const response = options?.response as Record<string, unknown> | undefined;

        // If expecting JSON from XML endpoint
        if (params?.jsonParameters === true || (response?.responseFormat === 'json')) {
          errors.push({
            code: 'GATE004',
            path: `nodes[${workflow.nodes.indexOf(node)}].parameters`,
            message: `XML endpoint detected but expecting JSON. Use response format "string" then parse with Code node.`,
            severity: 'error',
          });
        }

        // Check if there's a follow-up Code node for parsing
        const connections = workflow.connections?.[node.name]?.main?.[0] || [];
        if (connections.length > 0) {
          const nextNodeName = connections[0].node;
          const nextNode = workflow.nodes.find(n => n.name === nextNodeName);

          if (nextNode?.type === 'n8n-nodes-base.code') {
            const code = (nextNode.parameters as Record<string, unknown>)?.jsCode as string || '';
            // Check if code handles string response
            if (!code.includes('textContent') && !code.includes('regex') && !code.includes('match') && !code.includes('XMLParser')) {
              errors.push({
                code: 'GATE004',
                path: `nodes[${workflow.nodes.indexOf(nextNode)}].parameters.jsCode`,
                message: `XML parsing Code node should use regex or XML parser for string response.`,
                severity: 'warning',
              });
            }
          }
        }
      }

      // Check for entry assumption in URL
      if (url.includes('arxiv') && !url.includes('max_results')) {
        errors.push({
          code: 'GATE004',
          path: `nodes[${workflow.nodes.indexOf(node)}].parameters.url`,
          message: `arXiv API should include max_results parameter to limit response size.`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}

/**
 * GATE 5: Credentials Validation
 *
 * Workflows should work WITHOUT credentials for testing.
 * Use environment variables with fallbacks.
 */
export function validateCredentials(workflow: n8nWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of workflow.nodes || []) {
    if (node.credentials && Object.keys(node.credentials).length > 0) {
      // Check if there's a fallback mechanism
      const hasEnvFallback = JSON.stringify(node.parameters || {}).includes('$env');

      if (!hasEnvFallback) {
        errors.push({
          code: 'GATE005',
          path: `nodes[${workflow.nodes.indexOf(node)}].credentials`,
          message: `Node requires credentials without fallback. Consider using $env variables with conditional logic.`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}

/**
 * Run all production gates
 */
export function runProductionGates(workflow: n8nWorkflow): ProductionGateResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  // Run each gate
  const gateResults = [
    { name: 'Expression Syntax', errors: validateExpressionSyntax(workflow) },
    { name: 'Merge Mode', errors: validateMergeMode(workflow) },
    { name: 'Cardinality', errors: validateCardinality(workflow) },
    { name: 'XML Parsing', errors: validateXMLParsing(workflow) },
    { name: 'Credentials', errors: validateCredentials(workflow) },
  ];

  for (const result of gateResults) {
    for (const error of result.errors) {
      if (error.severity === 'error') {
        allErrors.push({ ...error, message: `[${result.name}] ${error.message}` });
      } else {
        allWarnings.push({ ...error, message: `[${result.name}] ${error.message}` });
      }
    }
  }

  // Calculate score
  const errorCount = allErrors.length;
  const warningCount = allWarnings.length;
  const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

  // Assign grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return {
    passed: errorCount === 0,
    errors: allErrors,
    warnings: allWarnings,
    score,
    grade,
    fixes: [],
  };
}

/**
 * Run production gates with deterministic auto-fix
 * This applies fixes without calling LLM
 */
export function runProductionGatesWithAutoFix(workflow: n8nWorkflow): {
  result: ProductionGateResult;
  fixedWorkflow: n8nWorkflow;
  allFixes: AutoFixResult[];
} {
  let currentWorkflow = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;
  const allFixes: AutoFixResult[] = [];

  // Apply auto-fixes in order
  const urlFix = autoFixHttpUrlExpressions(currentWorkflow);
  if (urlFix.fixes.length > 0) {
    currentWorkflow = urlFix.workflow;
    allFixes.push(...urlFix.fixes);
  }

  const mergeFix = autoFixMergeMode(currentWorkflow);
  if (mergeFix.fixes.length > 0) {
    currentWorkflow = mergeFix.workflow;
    allFixes.push(...mergeFix.fixes);
  }

  // Re-run validation on fixed workflow
  const result = runProductionGates(currentWorkflow);
  result.fixes = allFixes;

  return {
    result,
    fixedWorkflow: currentWorkflow,
    allFixes,
  };
}

/**
 * Production-grade system prompt addition
 */
export const PRODUCTION_RULES_PROMPT = `
## PRODUCTION QUALITY GATES (CRITICAL)

Your workflow will be validated against these gates. If any fail, the workflow will be rejected.

### GATE 1: Expression Syntax
- n8n expressions MUST use: ={{ <JS expression> }}
- NEVER use bare mustache: {{ variable }}
- NEVER use inline URL: =https://api.com?q={{query}}
- CORRECT: ={{ \`https://api.com?q=\${encodeURIComponent($json.query)}\` }}

### GATE 2: Merge Mode
- When combining items from DIFFERENT sources, use Merge node with mode: "append"
- NEVER use "combine" with "multiplex" - this creates exponential cross-products
- CORRECT: Merge node, mode: "append", options: { output: "all" }

### GATE 3: Cardinality
- Final output MUST be exactly ONE item
- Use Aggregate or Code node to combine multiple items into single array
- CORRECT: return [{ json: { items: $input.all().map(i => i.json), total: $input.all().length } }]

### GATE 4: XML/API Response
- arXiv, RSS, and similar APIs return XML, not JSON
- Set HTTP Request response format to "string"
- Parse XML in Code node using regex or XML parser
- CORRECT: const xml = $input.first().json.data; const matches = xml.match(/<entry>(.*?)<\\/entry>/gs);

### GATE 5: Credentials
- Workflows MUST work without hardcoded credentials
- Use $env variables: {{$env.API_KEY}}
- Add IF node to check if API key exists before calling LLM
- CORRECT: IF node condition: ={{ $env.ZAI_API_KEY && $env.ZAI_API_KEY.length > 0 }}
`;

/**
 * SUPER PROMPT for GLM-5
 * Use this as system prompt for best results
 */
export const SUPER_PROMPT_N8N = `You generate n8n workflow JSON.

ABSOLUTE OUTPUT RULES
- Output ONLY a SINGLE JSON OBJECT (not an array). Start with { and end with }.
- No markdown, no explanations, no code fences.
- Must include: name, nodes[], connections{}.
- Every node MUST include: id (uuid), name, type, typeVersion (number), position [x,y], parameters {}.

N8N EXPRESSION RULES (CRITICAL)
- Never embed {{ ... }} inside normal strings.
- Any expression MUST be a full n8n expression string starting with "={{" and ending with "}}".
- For HTTP Request URLs: if dynamic, the entire url field MUST be an expression:
  GOOD:  "url": "={{ 'https://example.com?q=' + encodeURIComponent($json.q) }}"
  BAD:   "url": "=https://example.com?q={{ encodeURIComponent($json.q) }}"

DESIGN RULES
- Prefer query parameters fields over manual URL concatenation when possible.
- Use Split in Batches for loops, and connect loop->next->back correctly.
- If you use Merge after an IF, be aware Merge can trigger both branches; design accordingly.

VALIDATION TARGET
- The output must pass strict validation: object root, nodes array, connections object, valid node fields, and expression-safe strings.
`;

// Helper function
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
