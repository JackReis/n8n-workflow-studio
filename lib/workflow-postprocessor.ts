/**
 * n8n Workflow Post-Processor
 * Automatically fixes common issues in generated workflows
 */

interface n8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: number[];
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}

interface n8nWorkflow {
  name: string;
  nodes: n8nNode[];
  connections: Record<string, unknown>;
  [key: string]: unknown;
}

interface PostProcessResult {
  workflow: n8nWorkflow;
  fixes: string[];
  wasFixed: boolean;
}

/**
 * Post-process generated n8n workflow to fix common issues
 */
export function postProcessWorkflow(workflow: n8nWorkflow): PostProcessResult {
  const fixes: string[] = [];

  if (!workflow || typeof workflow !== 'object') {
    return { workflow, fixes, wasFixed: false };
  }

  // Create a deep copy to avoid mutation
  let fixed = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;

  // 1. Fix Init connections format: [[{...}], [{...}]] -> [[{...}, {...}]]
  fixed = fixInitConnections(fixed, fixes);

  // 2. Fix IF node connections format
  fixed = fixIFConnections(fixed, fixes);

  // 3. Fix expression format in HTTP URLs
  fixed = fixHttpExpressions(fixed, fixes);

  // 4. Fix IF node conditions schema
  fixed = fixIFConditions(fixed, fixes);

  // 5. Add neverError to HTTP nodes
  fixed = addNeverErrorToHttp(fixed, fixes);

  // 6. Fix RSS Feed Read node type
  fixed = fixRSSNodeType(fixed, fixes);

  // 7. Fix HTTP body format (LLM requests)
  fixed = fixHttpBodyFormat(fixed, fixes);

  // 8. Fix query parameters format
  fixed = fixQueryParameters(fixed, fixes);

  // 9. Fix OpenAlex URL fallback
  fixed = fixOpenAlexUrl(fixed, fixes);

  // 10. Ensure all nodes have required fields
  fixed = ensureRequiredFields(fixed, fixes);

  return {
    workflow: fixed,
    fixes,
    wasFixed: fixes.length > 0,
  };
}

/**
 * Fix Init node connections - single output to multiple targets
 */
function fixInitConnections(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  if (!workflow.connections?.Init) return workflow;

  const initConn = workflow.connections.Init as { main?: unknown[][] };
  if (!initConn.main) return workflow;

  const main = initConn.main;

  // Check if it's the wrong format: [[{...}], [{...}]]
  if (Array.isArray(main) && main.length === 2) {
    const first = main[0];
    const second = main[1];

    // If both are arrays with single objects, merge them
    if (
      Array.isArray(first) && first.length === 1 &&
      Array.isArray(second) && second.length === 1
    ) {
      // Check if this is a Code node (single output)
      const initNode = workflow.nodes.find(n => n.name === 'Init');
      if (initNode?.type === 'n8n-nodes-base.code') {
        (workflow.connections.Init as { main: unknown[] }).main = [[first[0], second[0]]];
        fixes.push('Fixed Init connections: merged two output arrays into one');
      }
    }
  }

  return workflow;
}

/**
 * Fix IF node connections - ensure correct bracket structure
 */
function fixIFConnections(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const [nodeName, conn] of Object.entries(workflow.connections)) {
    const node = workflow.nodes.find(n => n.name === nodeName);
    if (node?.type !== 'n8n-nodes-base.if') continue;

    const main = (conn as { main?: unknown[] })?.main;
    if (!Array.isArray(main)) continue;

    // IF nodes should have exactly 2 outputs (true/false branches)
    // Format: [[...true targets...], [...false targets...]]
    for (let i = 0; i < main.length; i++) {
      const branch = main[i];
      if (!Array.isArray(branch)) continue;

      // Fix trailing double bracket: ]]] -> ]]
      const str = JSON.stringify(branch);
      if (str.includes(']]')) {
        const fixed = JSON.parse(str);
        main[i] = fixed;
        fixes.push(`Fixed ${nodeName} connections bracket structure`);
      }
    }
  }

  return workflow;
}

/**
 * Fix HTTP URL expressions: =url{{ var }} -> ={{ 'url' + var }}
 */
function fixHttpExpressions(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;

    const params = node.parameters as Record<string, unknown>;
    if (typeof params.url === 'string') {
      const url = params.url;

      // Pattern: =https://...{{ ... }}
      if (url.startsWith('=http') && url.includes('{{')) {
        // Fix the expression format
        // =https://api.com?q={{ $json.topic }}
        // -> ={{ 'https://api.com?q=' + encodeURIComponent($json.topic) }}

        const match = url.match(/^=(https?:\/\/[^{]+)\{\{\s*([^}]+)\s*\}\}(.*)$/);
        if (match) {
          const [, baseUrl, expression, suffix] = match;
          const encoded = expression.includes('encodeURIComponent')
            ? expression
            : `encodeURIComponent(${expression})`;
          params.url = `={{ '${baseUrl}' + ${encoded}${suffix ? ` + '${suffix}'` : ''} }}`;
          fixes.push(`Fixed ${node.name} URL expression format`);
        }
      }

      // Pattern: =https://... (without {{ but starts with =)
      // This might be a literal URL incorrectly prefixed
      if (url.startsWith('=http') && !url.includes('{{') && !url.includes('${')) {
        // Keep as expression
        params.url = `={{ '${url.slice(1)}' }}`;
        fixes.push(`Fixed ${node.name} URL to proper expression`);
      }
    }

    // Fix Authorization header
    const headerParams = params.headerParameters as { parameters?: Array<{ name: string; value: string }> } | undefined;
    if (headerParams?.parameters) {
      for (const header of headerParams.parameters) {
        if (header.name === 'Authorization' && header.value.startsWith('=Bearer {{')) {
          // Fix: =Bearer {{ $json.key }} -> ={{ 'Bearer ' + $json.key }}
          const match = header.value.match(/^=Bearer\s*\{\{\s*([^}]+)\s*\}\}$/);
          if (match) {
            header.value = `={{ 'Bearer ' + ${match[1]} }}`;
            fixes.push(`Fixed ${node.name} Authorization header format`);
          }
        }
      }
    }
  }

  return workflow;
}

/**
 * Fix IF node conditions to use typeVersion 2 schema
 */
function fixIFConditions(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.if') continue;

    // Ensure typeVersion is 2
    if (node.typeVersion !== 2) {
      node.typeVersion = 2;
      fixes.push(`Fixed ${node.name} typeVersion to 2`);
    }

    const params = node.parameters as Record<string, unknown>;
    const conditions = params.conditions as Record<string, unknown>;

    if (!conditions) continue;

    // Fix old boolean format to new schema
    if (Array.isArray(conditions.boolean)) {
      const newConditions = conditions.boolean.map((cond: Record<string, unknown>) => ({
        leftValue: cond.value1,
        rightValue: cond.value2,
        operator: { type: 'boolean', operation: 'equals' },
      }));

      params.conditions = {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: newConditions,
        combinator: params.combineOperation === 'all' ? 'and' : 'or',
      };

      delete params.combineOperation;
      fixes.push(`Fixed ${node.name} conditions to typeVersion 2 schema`);
    }

    // Fix ZAI_API_KEY == "" to isNotEmpty
    const conds = conditions.conditions as Array<Record<string, unknown>>;
    if (Array.isArray(conds)) {
      for (const cond of conds) {
        const rightValue = cond.rightValue;

        // If checking for non-empty API key
        if (
          typeof rightValue === 'string' &&
          rightValue === '' &&
          typeof cond.leftValue === 'string' &&
          cond.leftValue.toString().includes('API_KEY')
        ) {
          // Change to isNotEmpty
          cond.operator = { type: 'string', operation: 'isNotEmpty' };
          fixes.push(`Fixed ${node.name} API_KEY condition to isNotEmpty`);
        }
      }
    }
  }

  return workflow;
}

/**
 * Add neverError: true to HTTP request nodes
 */
function addNeverErrorToHttp(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;

    const params = node.parameters as Record<string, unknown>;
    if (!params.options) {
      params.options = {};
    }

    const options = params.options as Record<string, unknown>;
    if (!options.response) {
      options.response = { response: { responseFormat: 'json', neverError: true } };
      fixes.push(`Added neverError to ${node.name}`);
    } else {
      const resp = options.response as Record<string, unknown>;
      if (!resp.response) {
        resp.response = { responseFormat: 'json', neverError: true };
        fixes.push(`Added neverError to ${node.name}`);
      } else {
        const respResp = resp.response as Record<string, unknown>;
        if (respResp.neverError !== true) {
          respResp.neverError = true;
          fixes.push(`Enabled neverError on ${node.name}`);
        }
      }
    }
  }

  return workflow;
}

/**
 * Fix RSS Feed Read node type (common mistake: using httpRequest)
 */
function fixRSSNodeType(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    // Check if this looks like an RSS node but has wrong type
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const params = node.parameters as Record<string, unknown>;
      const url = params.url as string;

      // Check if URL contains RSS-related fields
      if (
        node.name.toLowerCase().includes('rss') ||
        (typeof url === 'string' && url.includes('rss_url'))
      ) {
        node.type = 'n8n-nodes-base.rssFeedRead';
        node.typeVersion = 1;
        fixes.push(`Fixed ${node.name} type from httpRequest to rssFeedRead`);
      }
    }
  }

  return workflow;
}

/**
 * Ensure all nodes have required fields
 */
function ensureRequiredFields(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    // Ensure position is valid
    if (!Array.isArray(node.position) || node.position.length !== 2) {
      node.position = [240, 300];
      fixes.push(`Fixed ${node.name} position`);
    }

    // Ensure parameters object exists
    if (!node.parameters) {
      node.parameters = {};
      fixes.push(`Added empty parameters to ${node.name}`);
    }
  }

  return workflow;
}

/**
 * Fix HTTP body format for LLM requests
 * Converts bodyParameters to specifyBody + jsonBody
 */
function fixHttpBodyFormat(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;

    const params = node.parameters as Record<string, unknown>;
    const nodeName = node.name.toLowerCase();

    // Check if this is an LLM request
    if (!nodeName.includes('llm') && !nodeName.includes('chat')) continue;

    // Check if using bodyParameters (wrong format)
    if (params.bodyParameters && !params.jsonBody) {
      const bodyParams = params.bodyParameters as { parameters?: Array<{ name: string; value: string }> };

      if (bodyParams.parameters) {
        // Extract the body structure
        const bodyObj: Record<string, unknown> = {};

        for (const param of bodyParams.parameters) {
          let value: unknown = param.value;

          // Try to parse JSON values
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as string if not valid JSON
            }
          }

          bodyObj[param.name] = value;
        }

        // Convert to jsonBody format
        params.specifyBody = 'json';
        params.sendBody = true;
        params.jsonBody = `={{ (${JSON.stringify(bodyObj)}) }}`;

        delete params.bodyParameters;

        fixes.push(`Fixed ${node.name} HTTP body format from bodyParameters to jsonBody`);
      }
    }
  }

  return workflow;
}

/**
 * Fix HTTP query parameters format
 * Converts options.qs to queryParametersUi
 */
function fixQueryParameters(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;

    const params = node.parameters as Record<string, unknown>;
    const options = params.options as Record<string, unknown> | undefined;

    // Check if using options.qs (old/wrong format)
    if (options?.qs) {
      const qs = options.qs as Record<string, unknown>;

      // Convert to queryParametersUi
      const parameters: Array<{ name: string; value: string }> = [];

      for (const [key, value] of Object.entries(qs)) {
        parameters.push({
          name: key,
          value: typeof value === 'string' && value.startsWith('={{')
            ? value
            : String(value),
        });
      }

      params.sendQuery = true;
      params.queryParametersUi = { parameter: parameters };

      delete options.qs;

      fixes.push(`Fixed ${node.name} query params from options.qs to queryParametersUi`);
    }
  }

  return workflow;
}

/**
 * Fix OpenAlex URL fallback
 * OpenAlex id field is already a URL, don't prepend
 */
function fixOpenAlexUrl(workflow: n8nWorkflow, fixes: string[]): n8nWorkflow {
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.code') continue;

    if (!node.name.toLowerCase().includes('openalex')) continue;

    const params = node.parameters as Record<string, unknown>;
    let jsCode = params.jsCode as string;

    if (!jsCode) continue;

    // Fix common mistake: https://openalex.org/${i.id}
    // OpenAlex id is already a URL like "https://openalex.org/W12345"
    if (jsCode.includes('https://openalex.org/${') || jsCode.includes("https://openalex.org/' + i.id")) {
      // The fix: use i.id directly, or i.primary_location?.source?.homepage_url || i.id
      jsCode = jsCode.replace(
        /`https:\/\/openalex\.org\/\$\{i\.id\}`/g,
        'i.id'
      );
      jsCode = jsCode.replace(
        /'https:\/\/openalex\.org\/' \+ i\.id/g,
        'i.id'
      );

      params.jsCode = jsCode;
      fixes.push(`Fixed ${node.name} OpenAlex URL fallback (id is already URL)`);
    }
  }

  return workflow;
}

/**
 * Remove markdown code fences from LLM output
 */
export function stripCodeFences(content: string): string {
  if (!content) return content;

  let cleaned = content.trim();

  // Remove ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/,'');
    cleaned = cleaned.trim();
  }

  return cleaned;
}

/**
 * Try to complete/repair truncated JSON
 * Useful when LLM output is cut off due to token limits
 */
export function completeTruncatedJson(content: string): { json: string; wasCompleted: boolean } {
  if (!content) return { json: content, wasCompleted: false };

  let cleaned = content.trim();

  // First strip code fences
  cleaned = stripCodeFences(cleaned);

  // Try to parse as-is
  try {
    JSON.parse(cleaned);
    return { json: cleaned, wasCompleted: false };
  } catch {
    // Continue to repair attempts
  }

  // Count brackets
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  const missingBraces = openBraces - closeBraces;
  const missingBrackets = openBrackets - closeBrackets;

  if (missingBraces <= 0 && missingBrackets <= 0) {
    // Brackets balanced but still invalid - try other repairs
    return { json: cleaned, wasCompleted: false };
  }

  // Try to complete the JSON
  let completed = cleaned;

  // If ends with incomplete string or value, try to close it
  if (/"[^"]*$/.test(completed)) {
    // Incomplete string - close it
    completed = completed + '"';
  }

  // Remove trailing comma if present
  completed = completed.replace(/,(\s*)$/, '$1');

  // Add missing closing brackets
  // We need to add them in reverse order of opening
  // But we don't know the exact order, so try common patterns

  // Simple approach: add all missing brackets at the end
  for (let i = 0; i < missingBrackets; i++) {
    completed += ']';
  }
  for (let i = 0; i < missingBraces; i++) {
    completed += '}';
  }

  // Try to parse
  try {
    JSON.parse(completed);
    return { json: completed, wasCompleted: true };
  } catch {
    // More aggressive repair: try to find last valid position
    // and truncate from there
    const cutPoints = [
      /,\s*$/,
      /:\s*$/,
      /\[\s*$/,
      /\{\s*$/,
    ];

    for (const pattern of cutPoints) {
      const match = completed.match(pattern);
      if (match && match.index !== undefined) {
        const truncated = completed.substring(0, match.index);

        // Count brackets in truncated
        const tOpenBraces = (truncated.match(/\{/g) || []).length;
        const tCloseBraces = (truncated.match(/\}/g) || []).length;
        const tOpenBrackets = (truncated.match(/\[/g) || []).length;
        const tCloseBrackets = (truncated.match(/\]/g) || []).length;

        let repaired = truncated;
        for (let i = 0; i < (tOpenBrackets - tCloseBrackets); i++) {
          repaired += ']';
        }
        for (let i = 0; i < (tOpenBraces - tCloseBraces); i++) {
          repaired += '}';
        }

        try {
          JSON.parse(repaired);
          return { json: repaired, wasCompleted: true };
        } catch {
          continue;
        }
      }
    }
  }

  // Could not repair
  return { json: cleaned, wasCompleted: false };
}
