/**
 * Repair Prompts
 * Conservative n8n workflow repair prompts
 */

import type { n8nWorkflow, ValidationError } from './types';

// ============================================
// HARD CONSTRAINTS for n8n JSON Generator
// ============================================

export const GENERATOR_HARD_CONSTRAINTS = `
## CRITICAL OUTPUT RULES

1. OUTPUT FORMAT:
   - Return ONLY raw JSON (no markdown code blocks, no explanations)
   - If multiple workflows: output JSON ARRAY of workflows
   - Start with { or [ and end with } or ]

2. n8n EXPRESSIONS:
   - NEVER use mustache templating inside plain strings (no '{{ }}' inside non-expression strings)
   - If a dynamic value is needed, the ENTIRE field must be an expression starting with '={{ '
   - CORRECT: url: '={{ "https://api.example.com?q=" + encodeURIComponent($json.query) }}'
   - WRONG: url: 'https://api.example.com?q={{ $json.query }}'
   - WRONG: url: '=https://api.example.com?q={{ $json.query }}'

3. MERGE NODE POLICY:
   - For aggregating/combining streams: Mode MUST be 'append'
   - NEVER use mode='combine' or mode='multiplex' for aggregation use-cases
   - 'append' simply concatenates all input items

4. LOOPING POLICY:
   - Prefer Split Out node for arrays (cleaner, less error-prone)
   - Use SplitInBatches (Loop Over Items) ONLY if:
     * You wire the 'loop' output back to continue iteration
     * You wire the 'done' output for when all items processed
   - Without proper loop-back + done wiring, SplitInBatches will fail

5. CREDENTIALS:
   - NEVER include credentials object in exported workflow JSON
   - For HTTP auth: use headerParameters with expression
   - Set authentication: 'none' or omit the field
   - Authorization header: '={{ "Bearer " + $json.config.API_KEY }}'

6. GRAPH COMPLETENESS:
   - Every non-trigger node MUST be reachable from at least one trigger
   - No orphan nodes allowed
   - Every "final" node must be reachable (no dead-end branches that should connect)
   - Check: all nodes should have incoming connections (except triggers)
`;

export const GENERATOR_SYSTEM_PROMPT = `You are an expert n8n workflow JSON generator.

${GENERATOR_HARD_CONSTRAINTS}

## WORKFLOW DESIGN PATTERNS

### Pattern: Array Processing
1. Use Split Out to explode array into items
2. Process each item in linear flow
3. Use Merge (mode: append) to collect results

### Pattern: API Aggregation
1. Multiple parallel HTTP requests
2. Merge (mode: append) all results
3. Code node for dedupe/filter/sort/limit

### Pattern: RSS + Keyword Search
1. Manual/Schedule trigger
2. Split Out for keywords array
3. For each: check cache → API calls → normalize → update cache
4. Parallel RSS branch with Split Out
5. Merge ALL with mode: append
6. Final Code node: dedupe, filter, sort, limit

## OUTPUT CHECKLIST
Before returning JSON, verify:
- [ ] All nodes have unique id and name
- [ ] All connections reference existing node names
- [ ] No mustache in plain strings
- [ ] Merge nodes use mode: append for aggregation
- [ ] Every node is reachable from a trigger
`;

// Legacy aliases for backwards compatibility
export const REPAIR_SYSTEM_PROMPT_ENHANCED = GENERATOR_SYSTEM_PROMPT;

export const REPAIR_SYSTEM_PROMPT = `You are an n8n workflow JSON repair expert.

CRITICAL RULES:
1. Return ONLY valid JSON. No explanations. No markdown.
2. DO NOT rename existing nodes arbitrarily
3. DO NOT add new nodes unless absolutely required
4. DO NOT change the workflow semantics
5. Fix ONLY the specific errors mentioned
6. Preserve all existing node IDs and names
7. Maintain the same JSON structure
8. Do not add comments to the JSON

OUTPUT FORMAT:
- Return the complete corrected workflow JSON
- No code blocks, no markdown
- Start with { and end with }
- Ensure all strings are properly escaped`;

export const REPAIR_SYSTEM_PROMPT_STRICT = `You are an n8n workflow JSON repair expert with STRICT preservation rules.

ABSOLUTE RULES:
1. OUTPUT: ONLY raw JSON. No explanations, no markdown, no code blocks.
2. PRESERVE: All node.id values must remain EXACTLY the same
3. PRESERVE: All node.name values must remain EXACTLY the same (unless invalid)
4. PRESERVE: All node positions must remain the same
5. MINIMAL: Change ONLY what is explicitly broken
6. NO_NEW_NODES: Do not add any new nodes
7. NO_SEMANTIC_CHANGES: Do not change the logic or flow
8. FIX_TARGETS: Address only the listed errors

COMMON FIXES:
- Missing required fields: Add with sensible defaults
- Invalid type: Cast to correct type
- Broken connections: Remove or fix node references
- Invalid parameters: Correct to valid values

Return the fixed JSON object directly.`;

/**
 * Build repair prompt with ONLY current errors
 */
export function buildRepairPrompt(
  workflow: n8nWorkflow,
  errors: ValidationError[]
): string {
  const errorList = errors
    .map(e => {
      let msg = `- ${e.message}`;
      if (e.path) msg += ` at path: ${e.path}`;
      if (e.code) msg += ` (code: ${e.code})`;
      return msg;
    })
    .join('\n');

  return `Fix this n8n workflow JSON. Only fix these errors:

${errorList}

Current workflow:
${JSON.stringify(workflow, null, 2)}

Return the corrected JSON. NO explanations. NO markdown. NO code blocks.`;
}

/**
 * Build targeted repair prompt for specific node
 */
export function buildNodeRepairPrompt(
  workflow: n8nWorkflow,
  nodeIndex: number,
  errors: ValidationError[]
): string {
  const node = workflow.nodes[nodeIndex];
  const nodeErrors = errors.filter(e => 'nodeIndex' in e && (e as { nodeIndex?: number }).nodeIndex === nodeIndex);

  return `Fix this specific n8n node. Errors to fix:

${nodeErrors.map(e => `- ${e.message} at ${e.path || 'unknown'}`).join('\n')}

Node (index ${nodeIndex}):
${JSON.stringify(node, null, 2)}

Workflow context - other node names: ${workflow.nodes.map((n, i) => i !== nodeIndex ? n.name : null).filter(Boolean).join(', ')}

Return the corrected node JSON only. NO explanations.`;
}

/**
 * Build connection repair prompt
 */
export function buildConnectionRepairPrompt(
  workflow: n8nWorkflow,
  errors: ValidationError[]
): string {
  const connectionErrors = errors.filter(e =>
    (e.path && e.path.includes('connections')) || e.message.toLowerCase().includes('connection')
  );

  return `Fix the connections in this n8n workflow. Errors:

${connectionErrors.map(e => `- ${e.message}`).join('\n')}

Available nodes: ${workflow.nodes.map(n => `"${n.name}"`).join(', ')}

Current connections:
${JSON.stringify(workflow.connections, null, 2)}

Return ONLY the corrected connections object. NO explanations.`;
}
