/**
 * Workflow Normalizer
 *
 * Handles various n8n export formats and normalizes them to a single workflow object.
 * n8n can export:
 * - Single workflow: { name: "...", nodes: [...], connections: {} }
 * - Multiple workflows: [ {workflow1}, {workflow2} ]
 * - With metadata: { workflow: {...}, meta: {...} }
 */

import type { n8nWorkflow, ValidationError } from '@/lib/validation/schemas';

export interface NormalizeResult {
  success: boolean;
  workflow?: n8nWorkflow;
  workflows?: n8nWorkflow[]; // If multiple found
  workflowCount: number;
  selectedIndex: number;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Detect the export format
 */
function detectFormat(data: unknown): 'single' | 'array' | 'wrapped' | 'invalid' {
  if (Array.isArray(data)) {
    return 'array';
  }

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for single workflow format
    if ('nodes' in obj && 'connections' in obj) {
      return 'single';
    }

    // Check for wrapped format { workflow: {...} }
    if ('workflow' in obj) {
      return 'wrapped';
    }

    // Check for { workflows: [...] } format
    if ('workflows' in obj && Array.isArray(obj.workflows)) {
      return 'wrapped';
    }
  }

  return 'invalid';
}

/**
 * Validate basic workflow structure
 */
function isValidWorkflow(obj: unknown): obj is n8nWorkflow {
  if (typeof obj !== 'object' || obj === null) return false;
  const w = obj as Record<string, unknown>;
  return (
    Array.isArray(w.nodes) &&
    typeof w.connections === 'object'
  );
}

/**
 * Normalize any export format to a single workflow or list of workflows
 */
export function normalizeWorkflowExport(
  data: unknown,
  options: {
    selectIndex?: number; // Which workflow to select if multiple
    autoSelect?: 'first' | 'largest' | 'named'; // Auto-selection strategy
  } = {}
): NormalizeResult {
  const { selectIndex = 0, autoSelect = 'first' } = options;
  const warnings: ValidationError[] = [];

  const format = detectFormat(data);

  // Invalid format
  if (format === 'invalid') {
    return {
      success: false,
      workflowCount: 0,
      selectedIndex: -1,
      errors: [{
        code: 'NORM001',
        path: '',
        message: 'Invalid workflow format. Expected object with nodes/connections or array of workflows.',
        severity: 'error',
      }],
      warnings: [],
    };
  }

  // Array format: [workflow1, workflow2, ...]
  if (format === 'array') {
    const arr = data as unknown[];

    // Filter valid workflows
    const validWorkflows: n8nWorkflow[] = [];
    arr.forEach((item, index) => {
      if (isValidWorkflow(item)) {
        validWorkflows.push(item as n8nWorkflow);
      } else {
        warnings.push({
          code: 'NORM002',
          path: `[${index}]`,
          message: `Item ${index} is not a valid workflow, skipping`,
          severity: 'warning',
        });
      }
    });

    if (validWorkflows.length === 0) {
      return {
        success: false,
        workflowCount: 0,
        selectedIndex: -1,
        errors: [{
          code: 'NORM003',
          path: '',
          message: 'No valid workflows found in array',
          severity: 'error',
        }],
        warnings,
      };
    }

    // Select workflow based on strategy
    let selectedIndex = 0;
    if (autoSelect === 'largest' && validWorkflows.length > 1) {
      selectedIndex = validWorkflows.reduce((maxIdx, w, idx, arr) =>
        (w.nodes?.length || 0) > (arr[maxIdx].nodes?.length || 0) ? idx : maxIdx
      , 0);
    }

    selectedIndex = Math.min(selectIndex, validWorkflows.length - 1);

    if (validWorkflows.length > 1) {
      warnings.push({
        code: 'NORM004',
        path: '',
        message: `Multiple workflows found (${validWorkflows.length}). Selected workflow #${selectedIndex + 1}.`,
        severity: 'warning',
      });
    }

    return {
      success: true,
      workflow: validWorkflows[selectedIndex],
      workflows: validWorkflows,
      workflowCount: validWorkflows.length,
      selectedIndex,
      errors: [],
      warnings,
    };
  }

  // Wrapped format: { workflow: {...} } or { workflows: [...] }
  if (format === 'wrapped') {
    const obj = data as Record<string, unknown>;

    if ('workflows' in obj && Array.isArray(obj.workflows)) {
      // Recursively handle as array
      return normalizeWorkflowExport(obj.workflows, options);
    }

    if ('workflow' in obj) {
      if (isValidWorkflow(obj.workflow)) {
        return {
          success: true,
          workflow: obj.workflow as n8nWorkflow,
          workflowCount: 1,
          selectedIndex: 0,
          errors: [],
          warnings: [],
        };
      } else {
        return {
          success: false,
          workflowCount: 0,
          selectedIndex: -1,
          errors: [{
            code: 'NORM005',
            path: 'workflow',
            message: 'Wrapped workflow is not valid',
            severity: 'error',
          }],
          warnings,
        };
      }
    }
  }

  // Single workflow format
  if (format === 'single') {
    return {
      success: true,
      workflow: data as n8nWorkflow,
      workflowCount: 1,
      selectedIndex: 0,
      errors: [],
      warnings: [],
    };
  }

  return {
    success: false,
    workflowCount: 0,
    selectedIndex: -1,
    errors: [{
      code: 'NORM000',
      path: '',
      message: 'Unknown format',
      severity: 'error',
    }],
    warnings,
  };
}

/**
 * Ensure a workflow has all required fields with defaults
 */
export function ensureWorkflowDefaults(workflow: n8nWorkflow): n8nWorkflow {
  return {
    name: workflow.name ?? 'Untitled Workflow',
    nodes: workflow.nodes ?? [],
    connections: workflow.connections ?? {},
    settings: workflow.settings ?? { executionOrder: 'v1' },
    staticData: workflow.staticData ?? {},
    tags: workflow.tags ?? [],
    pinData: workflow.pinData ?? {},
    versionId: workflow.versionId ?? '',
    id: workflow.id,
    active: workflow.active,
  };
}
