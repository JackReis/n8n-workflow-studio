#!/usr/bin/env node
/**
 * n8n Workflow Validator CLI
 * Usage: node scripts/validate-workflow.js <file.json>
 */

const fs = require('fs');
const path = require('path');

// Import validation functions (CommonJS compatible)
// Note: Run with ts-node or after build for ESM

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
n8n Workflow Validator CLI

Usage: node scripts/validate-workflow.js <workflow.json> [options]

Options:
  --fix         Apply auto-fix patches
  --json        Output as JSON
  --quiet       Only show errors
  --help, -h    Show this help

Examples:
  node scripts/validate-workflow.js workflow.json
  node scripts/validate-workflow.js workflow.json --fix
  npx ts-node scripts/validate-workflow.ts workflow.json --json
`);
    process.exit(0);
  }

  return {
    file: args.find(a => !a.startsWith('--')),
    fix: args.includes('--fix'),
    json: args.includes('--json'),
    quiet: args.includes('--quiet'),
  };
}

function extractJsonBlocks(text) {
  const blocks = [];
  
  // Markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{') || content.startsWith('[')) {
      blocks.push(content);
    }
  }
  
  if (blocks.length > 0) return blocks;
  
  // Brace matching for objects
  let depth = 0, start = -1, inString = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) { escape = false; continue; }
    if (char === '\\' && inString) { escape = true; continue; }
    if (char === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    
    if (char === '{') { if (depth === 0) start = i; depth++; }
    else if (char === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  
  return blocks;
}

function validateBasicShape(workflow) {
  const errors = [];
  
  if (!workflow || typeof workflow !== 'object') {
    errors.push({ code: 'E001', message: 'Invalid workflow: not an object' });
    return { valid: false, errors };
  }
  
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push({ code: 'E002', message: 'Missing or invalid "nodes" array' });
  }
  
  if (!workflow.connections || typeof workflow.connections !== 'object') {
    errors.push({ code: 'E003', message: 'Missing or invalid "connections" object' });
  }
  
  return { valid: errors.length === 0, errors };
}

function validateNodes(workflow) {
  const errors = [];
  const warnings = [];
  const nodeNames = new Set();
  
  if (!workflow.nodes) return { errors, warnings };
  
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];
    
    if (!node.id) {
      errors.push({ code: 'E101', message: `Node ${i}: missing id`, node: node.name || `index ${i}` });
    }
    if (!node.name) {
      errors.push({ code: 'E102', message: `Node ${i}: missing name`, node: `id ${node.id || 'unknown'}` });
    }
    if (!node.type) {
      errors.push({ code: 'E103', message: `Node ${i}: missing type`, node: node.name || `index ${i}` });
    }
    if (node.name && nodeNames.has(node.name)) {
      errors.push({ code: 'E104', message: `Duplicate node name: ${node.name}`, node: node.name });
    }
    if (node.name) nodeNames.add(node.name);
  }
  
  return { errors, warnings };
}

function validateConnections(workflow) {
  const errors = [];
  const warnings = [];
  const nodeNames = new Set((workflow.nodes || []).map(n => n.name));
  
  if (!workflow.connections) return { errors, warnings };
  
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    if (!nodeNames.has(source)) {
      warnings.push({ code: 'E201', message: `Connection from unknown node: ${source}` });
    }
    
    const main = outputs.main;
    if (!main) continue;
    
    for (const outputList of main) {
      if (!Array.isArray(outputList)) continue;
      for (const target of outputList) {
        if (!target.node) {
          errors.push({ code: 'E202', message: `Connection missing target node`, node: source });
        } else if (!nodeNames.has(target.node)) {
          errors.push({ code: 'E203', message: `Connection to unknown node: ${target.node}`, node: source });
        }
      }
    }
  }
  
  return { errors, warnings };
}

function checkReachability(workflow) {
  const warnings = [];
  const nodeNames = new Set((workflow.nodes || []).map(n => n.name));
  
  const triggerTypes = [
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.scheduleTrigger', 
    'n8n-nodes-base.webhook',
  ];
  
  const triggers = (workflow.nodes || []).filter(n => triggerTypes.includes(n.type));
  if (triggers.length === 0) {
    warnings.push({ code: 'E301', message: 'No trigger node found', severity: 'error' });
    return { reachable: 0, orphans: nodeNames.size, warnings };
  }
  
  // BFS from triggers
  const reachable = new Set(triggers.map(t => t.name));
  const queue = [...reachable];
  
  while (queue.length > 0) {
    const current = queue.shift();
    const outputs = workflow.connections?.[current]?.main;
    if (!outputs) continue;
    
    for (const outputList of outputs) {
      if (!Array.isArray(outputList)) continue;
      for (const target of outputList) {
        if (target?.node && !reachable.has(target.node)) {
          reachable.add(target.node);
          queue.push(target.node);
        }
      }
    }
  }
  
  const orphans = [...nodeNames].filter(n => !reachable.has(n));
  for (const orphan of orphans) {
    const node = workflow.nodes.find(n => n.name === orphan);
    if (node && !triggerTypes.includes(node.type)) {
      warnings.push({ code: 'E302', message: `Unreachable node: ${orphan}`, node: orphan, severity: 'warning' });
    }
  }
  
  return { reachable: reachable.size, orphans: orphans.length, warnings };
}

function checkSemanticRules(workflow) {
  const warnings = [];
  
  for (const node of workflow.nodes || []) {
    // Check HTTP URL expressions
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = node.parameters?.url;
      if (typeof url === 'string') {
        if (url.startsWith('=') && !url.startsWith('={{')) {
          warnings.push({ code: 'E303', message: `Invalid URL expression in ${node.name}`, node: node.name, severity: 'error' });
        }
        if (!url.startsWith('=') && url.includes('{{')) {
          warnings.push({ code: 'E304', message: `Mustache in plain URL in ${node.name}`, node: node.name, severity: 'error' });
        }
      }
    }
    
    // Check Merge mode
    if (node.type === 'n8n-nodes-base.merge') {
      const mode = node.parameters?.mode;
      if (['combine', 'multiplex'].includes(mode)) {
        warnings.push({ code: 'E305', message: `Merge ${node.name} uses ${mode} mode, consider 'append'`, node: node.name, severity: 'warning' });
      }
    }
  }
  
  return warnings;
}

function applyAutoFix(workflow) {
  const patches = [];
  const fixed = JSON.parse(JSON.stringify(workflow));
  
  for (const node of fixed.nodes || []) {
    // Fix URL expressions
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = node.parameters?.url;
      if (typeof url === 'string' && url.startsWith('=') && !url.startsWith('={{')) {
        node.parameters.url = `={{ ${JSON.stringify(url.slice(1))} }}`;
        patches.push({ type: 'url_fix', node: node.name });
      }
    }
    
    // Fix Merge mode
    if (node.type === 'n8n-nodes-base.merge') {
      const mode = node.parameters?.mode;
      if (['combine', 'multiplex'].includes(mode)) {
        node.parameters.mode = 'append';
        patches.push({ type: 'merge_mode_fix', node: node.name });
      }
    }
  }
  
  return { workflow: fixed, patches };
}

async function main() {
  const args = parseArgs();
  
  if (!args.file) {
    console.error('Error: No file specified');
    process.exit(1);
  }
  
  const filePath = path.resolve(args.file);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Try to parse JSON
  let workflow;
  try {
    // Try direct parse
    workflow = JSON.parse(content);
  } catch {
    // Try extracting blocks
    const blocks = extractJsonBlocks(content);
    if (blocks.length === 0) {
      console.error('Error: No valid JSON found in file');
      process.exit(1);
    }
    try {
      workflow = JSON.parse(blocks[0]);
    } catch (e) {
      console.error(`Error: Failed to parse JSON: ${e.message}`);
      process.exit(1);
    }
  }
  
  // Run validations
  const basicResult = validateBasicShape(workflow);
  const nodeResult = validateNodes(workflow);
  const connResult = validateConnections(workflow);
  const reachResult = checkReachability(workflow);
  const semanticResult = checkSemanticRules(workflow);
  
  const allErrors = [...basicResult.errors, ...nodeResult.errors, ...connResult.errors];
  const allWarnings = [...nodeResult.warnings, ...connResult.warnings, ...reachResult.warnings, ...semanticResult];
  
  if (args.json) {
    const output = {
      file: filePath,
      valid: allErrors.length === 0,
      stats: {
        nodeCount: (workflow.nodes || []).length,
        reachableCount: reachResult.reachable,
        orphanCount: reachResult.orphans,
      },
      errors: allErrors,
      warnings: allWarnings,
    };
    
    if (args.fix) {
      const fixResult = applyAutoFix(workflow);
      output.fixed = fixResult.workflow;
      output.patches = fixResult.patches;
    }
    
    console.log(JSON.stringify(output, null, 2));
    process.exit(allErrors.length > 0 ? 1 : 0);
  }
  
  // Human-readable output
  if (!args.quiet) {
    console.log(`\n📋 n8n Workflow Validation Report`);
    console.log(`   File: ${path.basename(filePath)}`);
    console.log(`   Nodes: ${(workflow.nodes || []).length}`);
    console.log(`   Reachable: ${reachResult.reachable}/${(workflow.nodes || []).length}`);
    console.log(`   Orphans: ${reachResult.orphans}`);
  }
  
  if (allErrors.length > 0) {
    console.log(`\n❌ Errors (${allErrors.length}):`);
    for (const err of allErrors) {
      console.log(`   [${err.code}] ${err.message}${err.node ? ` (node: ${err.node})` : ''}`);
    }
  }
  
  if (allWarnings.length > 0 && !args.quiet) {
    console.log(`\n⚠️  Warnings (${allWarnings.length}):`);
    for (const warn of allWarnings) {
      console.log(`   [${warn.code}] ${warn.message}${warn.node ? ` (node: ${warn.node})` : ''}`);
    }
  }
  
  if (args.fix) {
    const fixResult = applyAutoFix(workflow);
    if (fixResult.patches.length > 0) {
      console.log(`\n🔧 Auto-fix applied (${fixResult.patches.length} patches):`);
      for (const patch of fixResult.patches) {
        console.log(`   - ${patch.type}: ${patch.node}`);
      }
      
      // Write fixed file
      const fixedPath = filePath.replace('.json', '.fixed.json');
      fs.writeFileSync(fixedPath, JSON.stringify(fixResult.workflow, null, 2));
      console.log(`   Written to: ${path.basename(fixedPath)}`);
    }
  }
  
  console.log(allErrors.length === 0 ? '\n✅ Valid' : '\n❌ Invalid');
  process.exit(allErrors.length > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
