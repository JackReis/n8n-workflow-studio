/**
 * Skill Executor
 * Enhances LLM prompts with patterns, best practices, and constraints
 */

import type { SkillPattern, SkillEnhancedPrompt, SkillContext } from './types';
import { analyzePrompt, getBestPatterns } from './intent';
import { ALL_PATTERNS, PATTERN_MAP } from './patterns';
// Production rules available for advanced mode
// import { SUPER_PROMPT_N8N, PRODUCTION_RULES_PROMPT } from '@/lib/validation/production-gates';

// Production-grade system prompts with n8n best practices
const BASE_SYSTEM_PROMPTS = {
  generate_workflow: `You are an expert n8n workflow JSON generator. Output ONLY valid JSON - NO markdown code fences, NO explanations.

🚨 CRITICAL OUTPUT RULES:
- Output MUST start with { and end with }
- NO \`\`\`json or \`\`\` code fences - output RAW JSON only
- NO comments, NO trailing commas
- Double quotes ONLY
- NO "{{ ... }}" in any string - use full expressions "={{ ... }}"

📋 n8n NODE TYPES (use EXACTLY these):
- RSS Feed: n8n-nodes-base.rssFeedRead (NOT httpRequest!)
- HTTP API: n8n-nodes-base.httpRequest
- Code: n8n-nodes-base.code
- IF/Switch: n8n-nodes-base.if (typeVersion: 2)
- Merge: n8n-nodes-base.merge (mode: "append" or "combine")
- Split: n8n-nodes-base.splitOut

🔗 CONNECTIONS FORMAT:
CORRECT - Single output to multiple targets:
  "Init": { "main": [[{"node": "A", "type": "main", "index": 0}, {"node": "B", "type": "main", "index": 0}]] }
WRONG: "Init": { "main": [[{...}], [{...}]] }

CORRECT - IF node (two outputs):
  "IF Node": {
    "main": [
      [{"node": "True Branch", "type": "main", "index": 0}],
      [{"node": "False Branch", "type": "main", "index": 0}]
    ]
  }

📝 EXPRESSION FORMAT:
CORRECT: "url": "={{ 'https://api.example.com?q=' + encodeURIComponent($json.topic) }}"
WRONG: "url": "=https://api.example.com?q={{ $json.topic }}"
CORRECT: "value": "={{ 'Bearer ' + $json.api_key }}"
WRONG: "value": "=Bearer {{ $json.api_key }}"

🌐 HTTP REQUEST - QUERY PARAMETERS (v4.2):
Use queryParametersUi NOT options.qs:
{
  "sendQuery": true,
  "queryParametersUi": {
    "parameter": [
      { "name": "q", "value": "={{ $json.topic }}" },
      { "name": "per_page", "value": "5" }
    ]
  }
}

🌐 HTTP REQUEST - JSON BODY (v4.2):
Use specifyBody: "json" + jsonBody expression:
{
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ ({ model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] }) }}"
}
WRONG: bodyParameters with stringified JSON

🌐 HTTP REQUEST OPTIONS:
{
  "options": {
    "timeout": "={{ $json.config.timeout_ms || 12000 }}",
    "response": { "response": { "responseFormat": "json", "neverError": true } }
  }
}

🔧 IF NODE CONDITIONS (typeVersion: 2):
{
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true },
      "conditions": [
        { "leftValue": "={{ $json.enabled }}", "rightValue": true, "operator": { "type": "boolean", "operation": "equals" } },
        { "leftValue": "={{ $json.api_key }}", "rightValue": "", "operator": { "type": "string", "operation": "isNotEmpty" } }
      ],
      "combinator": "and"
    }
  }
}

🤖 LLM CONTEXT PRESERVATION:
Prepare LLM node MUST include __baseData:
  return [{ json: {
    __baseData: { items, config, stats, topics, run_id, generated_at },
    config,
    llm_body: { messages: [...] }
  }}];

LLM HTTP MUST use jsonBody referencing __baseData:
  "jsonBody": "={{ ({
    model: $json.__baseData.config.ZAI_MODEL,
    messages: $json.llm_body.messages,
    response_format: { type: 'json_object' },
    temperature: 0.2
  }) }}"

Apply Summaries MUST read from Prepare LLM:
  const prepNode = $('Prepare LLM').first().json;
  const baseData = prepNode.__baseData;
  const llmResponse = $input.first().json;

📦 CODE NODE - RUN ID PATTERN:
In Init node:
  const st = $getWorkflowStaticData('global');
  st.runs = (st.runs || 0) + 1;
  return [{ json: { rss_feeds, topics, config, run_id: st.runs } }];

In Finalize node:
  const init = $('Init').first().json;
  run_id: init.run_id

📦 CACHE GATE - TTL PRUNE PATTERN:
const st = $getWorkflowStaticData('global');
if (!st.cache) st.cache = {};
const now = Date.now();
const ttl = config.cache_ttl_minutes * 60 * 1000;

// PRUNE old entries
for (const k in st.cache) {
  if (now - st.cache[k].ts_epoch_ms > ttl) delete st.cache[k];
}

📦 NORMALIZED ITEM SCHEMA:
{
  source: "rss|hn|github|crossref|openalex",
  topic: string|null,
  title: string,
  url: string,
  published_at: string|null,
  raw_score: number,
  score: number,
  summary_raw: string|null,
  summary: null,
  meta: { author: string|null, venue: string|null, cached: boolean }
}

📦 WORKFLOW TEMPLATE:
{
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {
    "Manual Trigger": { "main": [[{"node": "Next", "type": "main", "index": 0}]] }
  }
}

Generate the n8n workflow JSON now. Output RAW JSON only, no markdown.`,

  repair_workflow: `You are an n8n workflow repair specialist. Output ONLY valid JSON.

🚨 OUTPUT RULES:
- NO \`\`\`json code fences - RAW JSON only
- Fix broken JSON structure
- Double quotes only, no trailing commas

COMMON FIXES:
1. Remove code fences (\`\`\`json ... \`\`\`)
2. Fix connections format: [[{...}, {...}]] not [[{...}], [{...}]]
3. Fix expressions: "={{ 'url' + var }}" not "=url{{ var }}"
4. Fix IF conditions: use typeVersion 2 schema with operator object
5. Remove trailing commas before ] or }
6. Ensure all brackets are balanced
7. Fix HTTP body: use specifyBody: "json" + jsonBody expression
8. Fix query params: use queryParametersUi not options.qs`,

  enhance_workflow: `You are an n8n workflow optimizer. Output ONLY valid JSON.

🚨 OUTPUT RULES:
- NO \`\`\`json code fences - RAW JSON only
- Add error handling with neverError: true
- Add context preservation for LLM steps
- Fix HTTP body to use specifyBody: "json"
- Fix query params to use queryParametersUi
- Double quotes only, no trailing commas`,

  custom: `You are a helpful assistant. When generating n8n workflows, output RAW JSON only - NO markdown code fences.`,
};

/**
 * Build an enhanced prompt for workflow generation
 */
export function buildEnhancedPrompt(
  userPrompt: string,
  mode: 'generate_workflow' | 'repair_workflow' | 'enhance_workflow' = 'generate_workflow',
  options: {
    includeExamples?: boolean;
    maxPatterns?: number;
    customConstraints?: string[];
    targetComplexity?: 'simple' | 'medium' | 'complex';
  } = {}
): SkillEnhancedPrompt {
  const {
    includeExamples = true,
    maxPatterns = 5,
    customConstraints = [],
    targetComplexity,
  } = options;

  // Analyze the prompt to detect intents
  const analysis = analyzePrompt(userPrompt);

  // Get best matching patterns
  const patterns = getBestPatterns(userPrompt, maxPatterns);

  // Build pattern context
  const patternContext = buildPatternContext(patterns, includeExamples);

  // Build constraints
  const constraints = buildConstraints(patterns, analysis, customConstraints, targetComplexity);

  // Build enhanced system prompt
  const systemPrompt = buildSystemPrompt(mode, patterns, constraints);

  // Build enhanced user prompt
  const enhancedUserPrompt = buildUserPrompt(userPrompt, patterns, analysis);

  return {
    systemPrompt,
    userPrompt: enhancedUserPrompt,
    patterns,
    constraints,
    examples: patternContext.examples,
  };
}

/**
 * Build pattern context for the prompt
 */
function buildPatternContext(
  patterns: SkillPattern[],
  includeExamples: boolean
): { bestPractices: string; mistakes: string; examples: string; templates: string } {
  const bestPractices: string[] = [];
  const mistakes: string[] = [];
  const examples: string[] = [];
  const templates: string[] = [];

  for (const pattern of patterns) {
    // Add best practices
    if (pattern.bestPractices.length > 0) {
      bestPractices.push(`\n### ${pattern.name}\n${pattern.bestPractices.map(p => `- ${p}`).join('\n')}`);
    }

    // Add common mistakes to avoid
    if (pattern.commonMistakes.length > 0) {
      mistakes.push(`\n### ${pattern.name} - AVOID THESE:\n${pattern.commonMistakes.map(m => `- ${m}`).join('\n')}`);
    }

    // Add examples if requested
    if (includeExamples && pattern.examples.length > 0) {
      for (const example of pattern.examples) {
        examples.push(`\n### Example: ${example.name}\n${example.description}\n${example.explanation}`);
        if (Object.keys(example.workflow).length > 0) {
          examples.push(`Template: ${JSON.stringify(example.workflow, null, 2)}`);
        }
      }
    }

    // Add node templates
    const template = pattern.template as { nodes?: unknown[] };
    if (template.nodes && Array.isArray(template.nodes)) {
      templates.push(`\n### ${pattern.name} Template:\n${JSON.stringify(template.nodes, null, 2)}`);
    }
  }

  return {
    bestPractices: bestPractices.join('\n'),
    mistakes: mistakes.join('\n'),
    examples: examples.join('\n'),
    templates: templates.join('\n'),
  };
}

/**
 * Build constraints list
 */
function buildConstraints(
  patterns: SkillPattern[],
  analysis: ReturnType<typeof analyzePrompt>,
  customConstraints: string[],
  targetComplexity?: 'simple' | 'medium' | 'complex'
): string[] {
  const constraints: string[] = [
    // JSON output rules
    'Output RAW JSON only - NO markdown code fences (```json)',
    'No trailing commas before ] or }',
    'Double quotes ONLY - no single quotes',

    // Node requirements
    'All nodes must have unique UUID v4 ids',
    'All nodes must have valid n8n type identifiers',
    'Position arrays must be [number, number] format',
    'Connections must reference existing node names',

    // n8n specific rules
    'RSS feeds MUST use n8n-nodes-base.rssFeedRead type (NOT httpRequest)',
    'Expressions MUST use ={{ "string" + var }} format (NOT =string{{ var }})',
    'IF nodes MUST use typeVersion 2 with operator object in conditions',
    'HTTP nodes MUST include neverError: true in options for error handling',

    // Connection format
    'Single output to multiple nodes: [[{...}, {...}]] NOT [[{...}], [{...}]]',
    'IF node outputs: [[true_branch], [false_branch]] (two separate arrays)',

    // LLM context
    'LLM HTTP steps MUST preserve context via __baseData in previous node',
  ];

  // Add complexity constraint
  const complexity = targetComplexity || analysis.complexity;
  if (complexity === 'simple') {
    constraints.push(`Keep workflow simple: max ${Math.min(analysis.estimatedNodeCount, 5)} nodes`);
  } else if (complexity === 'complex') {
    constraints.push('Create comprehensive workflow with proper error handling');
  }

  // Add pattern-specific constraints
  for (const pattern of patterns) {
    constraints.push(`Follow ${pattern.name} pattern for ${pattern.category} logic`);
  }

  // Add integration constraints
  if (analysis.requiredIntegrations.length > 0) {
    constraints.push(`Must integrate with: ${analysis.requiredIntegrations.join(', ')}`);
  }

  // Add custom constraints
  constraints.push(...customConstraints);

  return constraints;
}

/**
 * Build the enhanced system prompt
 */
function buildSystemPrompt(
  mode: 'generate_workflow' | 'repair_workflow' | 'enhance_workflow',
  patterns: SkillPattern[],
  constraints: string[]
): string {
  const basePrompt = BASE_SYSTEM_PROMPTS[mode];

  // Add pattern-specific system instructions
  const patternInstructions = patterns.map(p => {
    const nodeTypes = p.nodeTypes.join(', ');
    return `\n\n## ${p.name} (${p.category})\n${p.description}\nNode types: ${nodeTypes}`;
  }).join('');

  // Add constraints
  const constraintText = constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');

  return `${basePrompt}

${patternInstructions}

## CONSTRAINTS (MUST FOLLOW):
${constraintText}

## NODE TYPE REFERENCE:
- Triggers: n8n-nodes-base.manualTrigger, n8n-nodes-base.scheduleTrigger, n8n-nodes-base.webhook
- HTTP: n8n-nodes-base.httpRequest, n8n-nodes-base.graphql
- Transform: n8n-nodes-base.code, n8n-nodes-base.set, n8n-nodes-base.editFields
- Logic: n8n-nodes-base.if, n8n-nodes-base.switch, n8n-nodes-base.filter
- AI: @n8n/n8n-nodes-langchain.openAi, @n8n/n8n-nodes-langchain.chatOpenAi
- Integrations: n8n-nodes-base.slack, n8n-nodes-base.googleSheets, n8n-nodes-base.notion
- Utility: n8n-nodes-base.merge, n8n-nodes-base.splitOut, n8n-nodes-base.aggregate
- Error: n8n-nodes-base.errorTrigger, n8n-nodes-base.stop`;
}

/**
 * Build the enhanced user prompt
 */
function buildUserPrompt(
  originalPrompt: string,
  patterns: SkillPattern[],
  analysis: ReturnType<typeof analyzePrompt>
): string {
  const sections: string[] = [];

  // Original request
  sections.push(`USER REQUEST:\n${originalPrompt}`);

  // Detected context
  sections.push(`\nDETECTED REQUIREMENTS:
- Complexity: ${analysis.complexity}
- Estimated nodes: ${analysis.estimatedNodeCount}
- Integrations needed: ${analysis.requiredIntegrations.length > 0 ? analysis.requiredIntegrations.join(', ') : 'None specific'}
- Detected intents: ${analysis.detectedIntents.map(i => i.category).join(', ') || 'General workflow'}`);

  // Pattern guidance
  if (patterns.length > 0) {
    sections.push(`\nRECOMMENDED PATTERNS TO APPLY:`);
    for (const pattern of patterns) {
      sections.push(`\n### ${pattern.name}\n${pattern.description}`);
      if (pattern.bestPractices.length > 0) {
        sections.push(`Best practices:\n${pattern.bestPractices.slice(0, 3).map(p => `  - ${p}`).join('\n')}`);
      }
    }
  }

  // Output instruction
  sections.push(`\nGenerate the complete n8n workflow JSON now. Output ONLY valid JSON.`);

  return sections.join('\n');
}

/**
 * Create a skill context for external use
 */
export function createSkillContext(prompt: string): SkillContext {
  const analysis = analyzePrompt(prompt);

  return {
    userPrompt: prompt,
    detectedIntents: analysis.detectedIntents.map(i => i.category),
    requiredIntegrations: analysis.requiredIntegrations,
    complexity: analysis.complexity,
    suggestedPatterns: analysis.suggestedPatterns,
  };
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): SkillPattern | undefined {
  return PATTERN_MAP.get(id);
}

/**
 * Get all available patterns
 */
export function getAllPatterns(): SkillPattern[] {
  return ALL_PATTERNS;
}

/**
 * Format patterns for display
 */
export function formatPatternsForDisplay(patterns: SkillPattern[]): string {
  return patterns.map(p => {
    const practices = p.bestPractices.slice(0, 3).map(bp => `  • ${bp}`).join('\n');
    return `### ${p.name} (${p.category})\n${p.description}\n\nBest practices:\n${practices}`;
  }).join('\n\n');
}
