/**
 * AutoFix Module
 * Deterministic pre-repair patches for common n8n JSON issues
 */

import type { n8nNode, n8nWorkflow } from '../validation/schemas';

export interface PatchResult {
  workflow: n8nWorkflow;
  patches: AppliedPatch[];
  unchanged: boolean;
}

export interface AppliedPatch {
  type: string;
  node?: string;
  path: string;
  before: unknown;
  after: unknown;
  reason: string;
}

/**
 * Convert mustache template to n8n expression with proper encoding
 * =http://...?q={{ $json.keyword }} → ={{ 'http://...?q=' + encodeURIComponent($json.keyword) }}
 */
function convertMustacheToExpression(template: string, useEncode: boolean = false): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    // Add literal part before this match
    if (match.index > lastIndex) {
      parts.push(JSON.stringify(template.slice(lastIndex, match.index)));
    }
    // Add expression part with optional encoding
    const expr = match[1].trim();
    if (useEncode && !expr.includes('encodeURIComponent')) {
      parts.push(`encodeURIComponent(${expr})`);
    } else {
      parts.push(expr);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining literal part
  if (lastIndex < template.length) {
    parts.push(JSON.stringify(template.slice(lastIndex)));
  }

  if (parts.length === 0) return `={{ ${JSON.stringify(template)} }}`;
  if (parts.length === 1 && parts[0].startsWith('"')) return `={{ ${parts[0]} }}`;
  return `={{ ${parts.join(' + ')} }}`;
}

/**
 * Detect if URL contains query parameters that need encoding
 */
function needsUrlEncoding(url: string): boolean {
  return url.includes('?') && url.includes('=');
}

function patchInvalidUrl(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.httpRequest') return patches;

  const url = node.parameters.url as string | undefined;
  if (!url || typeof url !== 'string') return patches;

  // Pattern 1: =http://...{{ }} (invalid expression format)
  if (url.startsWith('=') && !url.startsWith('={{')) {
    const inner = url.slice(1);
    if (inner.includes('{{') && inner.includes('}}')) {
      const useEncode = needsUrlEncoding(inner);
      const converted = convertMustacheToExpression(inner, useEncode);
      node.parameters.url = converted;
      patches.push({ type: 'url_expression_fix', node: node.name, path: 'parameters.url', before: url, after: converted, reason: 'Fixed URL expression format' });
    } else {
      const converted = `={{ ${JSON.stringify(inner)} }}`;
      node.parameters.url = converted;
      patches.push({ type: 'url_expression_fix', node: node.name, path: 'parameters.url', before: url, after: converted, reason: 'Added expression wrapper' });
    }
  }
  // Pattern 2: Plain URL with mustache inside
  else if (!url.startsWith('=') && url.includes('{{') && url.includes('}}')) {
    const useEncode = needsUrlEncoding(url);
    const converted = convertMustacheToExpression(url, useEncode);
    node.parameters.url = converted;
    patches.push({ type: 'url_mustache_fix', node: node.name, path: 'parameters.url', before: url, after: converted, reason: 'Converted mustache URL to expression' });
  }
  return patches;
}

function patchMergeMode(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.merge') return patches;

  const mode = node.parameters.mode as string | undefined;
  const badModes = ['combine', 'multiplex', 'keepKeyMatches', 'mergeByPosition'];

  if (mode && badModes.includes(mode)) {
    node.parameters.mode = 'append';
    patches.push({ type: 'merge_mode_fix', node: node.name, path: 'parameters.mode', before: mode, after: 'append', reason: 'Changed to append mode for aggregation' });
  }
  return patches;
}

function patchHttpMustache(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.httpRequest') return patches;

  const params = node.parameters;

  // Fix headerParameters
  if (params.headerParameters && typeof params.headerParameters === 'object') {
    const headers = params.headerParameters as Record<string, unknown>;
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string' && value.includes('{{') && !value.startsWith('={{')) {
        const converted = convertMustacheToExpression(value, false);
        headers[key] = converted;
        patches.push({ type: 'header_mustache_fix', node: node.name, path: `headerParameters.${key}`, before: value, after: converted, reason: 'Fixed header expression' });
      }
    }
  }

  // Fix bodyParameters
  if (params.bodyParameters && typeof params.bodyParameters === 'object') {
    const bodyParams = params.bodyParameters as { parameters?: Array<{ name: string; value: unknown }> };
    if (bodyParams.parameters && Array.isArray(bodyParams.parameters)) {
      for (const param of bodyParams.parameters) {
        if (typeof param.value === 'string' && param.value.includes('{{') && !param.value.startsWith('={{')) {
          const converted = convertMustacheToExpression(param.value, false);
          const oldValue = param.value;
          param.value = converted;
          patches.push({ type: 'body_mustache_fix', node: node.name, path: `bodyParameters.${param.name}`, before: oldValue, after: converted, reason: 'Fixed body parameter expression' });
        }
      }
    }
  }

  return patches;
}

function patchAuthentication(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.httpRequest') return patches;

  const params = node.parameters;
  if (params.genericAuthType || params.credentials) {
    const oldAuth = params.genericAuthType || params.credentials;
    delete params.genericAuthType;
    delete params.credentials;
    params.authentication = 'none';
    if (!params.headerParameters) params.headerParameters = {};
    patches.push({ type: 'auth_fix', node: node.name, path: 'authentication', before: oldAuth, after: 'none', reason: 'Use header expressions instead of credentials' });
  }
  return patches;
}

/**
 * Fix static data access in Code nodes
 * $static.cache → $getWorkflowStaticData('global').cache
 */
function patchStaticDataAccess(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.code') return patches;

  const code = node.parameters.jsCode as string | undefined;
  if (!code || typeof code !== 'string') return patches;

  // Check for incorrect static data access
  if (code.includes('$static.') && !code.includes('$getWorkflowStaticData')) {
    const fixed = code.replace(/\$static\./g, '$getWorkflowStaticData(\'global\').');
    node.parameters.jsCode = fixed;
    patches.push({ type: 'static_data_fix', node: node.name, path: 'parameters.jsCode', before: '$static', after: '$getWorkflowStaticData(\'global\')', reason: 'Fixed static data access' });
  }

  return patches;
}

/**
 * Fix LLM endpoint URLs (Z.ai specific)
 */
function patchLlmEndpoint(node: n8nNode): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  if (node.type !== 'n8n-nodes-base.httpRequest') return patches;

  const url = node.parameters.url as string | undefined;
  if (!url || typeof url !== 'string') return patches;

  // Fix incorrect Z.ai endpoints
  const wrongEndpoints = [
    'api.zai.io',
    'api.z.ai/v1',
    'z.ai/v1',
  ];

  for (const wrong of wrongEndpoints) {
    if (url.includes(wrong)) {
      const corrected = url.replace(wrong, 'api.z.ai/api/paas/v4');
      node.parameters.url = corrected;
      patches.push({ type: 'llm_endpoint_fix', node: node.name, path: 'parameters.url', before: url, after: corrected, reason: 'Fixed Z.ai endpoint URL' });
      break;
    }
  }

  return patches;
}

function patchOrphanMergeConnections(workflow: n8nWorkflow): AppliedPatch[] {
  const patches: AppliedPatch[] = [];
  const connections = workflow.connections;

  const nodesWithIncoming = new Set<string>();
  for (const [, outputs] of Object.entries(connections)) {
    const main = (outputs as Record<string, unknown>).main as Array<Array<{ node: string }>> | undefined;
    if (!main) continue;
    for (const list of main) {
      if (!Array.isArray(list)) continue;
      for (const t of list) if (t?.node) nodesWithIncoming.add(t.node);
    }
  }

  const orphanMerges = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.merge' && !nodesWithIncoming.has(n.name));
  if (orphanMerges.length === 0) return patches;

  for (const mergeNode of orphanMerges) {
    const potential: string[] = [];
    for (const node of workflow.nodes) {
      if (node.name === mergeNode.name || nodesWithIncoming.has(node.name)) continue;
      const outs = connections[node.name]?.main;
      if (!outs || (Array.isArray(outs) && outs.length === 0)) potential.push(node.name);
    }

    if (potential.length >= 2) {
      for (const src of potential.slice(0, 2)) {
        if (!connections[src]) connections[src] = { main: [] };
        const main = connections[src].main as Array<Array<{ node: string }>>;
        if (!main[0]) main[0] = [];
        main[0].push({ node: mergeNode.name });
        patches.push({ type: 'merge_connection_fix', node: src, path: `connections.${src}`, before: null, after: mergeNode.name, reason: 'Connected orphan merge node' });
      }
    }
  }
  return patches;
}

export function applyAutoFix(workflow: n8nWorkflow): PatchResult {
  const allPatches: AppliedPatch[] = [];
  const fixed = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;

  for (const node of fixed.nodes) {
    allPatches.push(...patchInvalidUrl(node));
    allPatches.push(...patchMergeMode(node));
    allPatches.push(...patchHttpMustache(node));
    allPatches.push(...patchAuthentication(node));
    allPatches.push(...patchStaticDataAccess(node));
    allPatches.push(...patchLlmEndpoint(node));
  }
  allPatches.push(...patchOrphanMergeConnections(fixed));

  return { workflow: fixed, patches: allPatches, unchanged: allPatches.length === 0 };
}

export function needsAutoFix(workflow: n8nWorkflow): boolean {
  return !applyAutoFix(workflow).unchanged;
}

export function getAutoFixPreview(workflow: n8nWorkflow): AppliedPatch[] {
  return applyAutoFix(workflow).patches;
}
