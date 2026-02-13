/**
 * POST /api/validate
 * Validates n8n workflow JSON through multi-stage validation
 * Stage 1: Basic JSON structure
 * Stage 2: n8n structural rules
 * Stage 3: Production quality gates (expression syntax, merge mode, cardinality, XML, credentials)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateStage1, validateStage1FromString } from '@/lib/validation/stages';
import { validateStage2, validateWorkflow, validateWorkflowFromString } from '@/lib/validation/rules';
import { runProductionGates, type ProductionGateResult } from '@/lib/validation/production-gates';
import type { ValidationResult, n8nWorkflow } from '@/lib/validation/schemas';

export interface ValidateRequest {
  workflow: unknown;
  jsonString?: string;
  fullValidation?: boolean; // If true, run all stages
  productionGates?: boolean; // If true, also run Stage 3 production gates
}

export interface ValidateResponse extends ValidationResult {
  timestamp: string;
  productionGates?: ProductionGateResult;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ValidateRequest = await request.json();
    const { workflow, jsonString, fullValidation = true, productionGates = true } = body;

    let result: ValidationResult;
    let workflowObj: n8nWorkflow | null = null;

    // If jsonString provided, parse and validate
    if (jsonString) {
      // Parse JSON to get workflow object for subsequent stages
      try {
        workflowObj = JSON.parse(jsonString) as n8nWorkflow;
      } catch {
        // Will be caught by validateWorkflowFromString
      }
      if (fullValidation) {
        result = validateWorkflowFromString(jsonString);
      } else {
        result = validateStage1FromString(jsonString);
      }
    } else if (workflow) {
      // Validate the workflow object directly
      workflowObj = workflow as n8nWorkflow;
      if (fullValidation) {
        result = validateWorkflow(workflow);
      } else {
        result = validateStage1(workflow);
      }
    } else {
      return NextResponse.json(
        {
          valid: false,
          stage: 0,
          errors: [{
            code: 'E000',
            message: 'No workflow or jsonString provided',
            severity: 'error' as const,
            suggestion: 'Provide either a workflow object or jsonString in the request body',
          }],
          warnings: [],
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // If Stage 1 passed and we're doing full validation, run Stage 2
    if (fullValidation && result.valid && result.stage === 1 && workflowObj) {
      const stage2Result = validateStage2(workflowObj);
      result = stage2Result;
    }

    // Run Stage 3: Production Gates if requested and workflow is structurally valid
    let gateResult: ProductionGateResult | undefined;
    if (productionGates && result.valid && workflowObj) {
      gateResult = runProductionGates(workflowObj);
    }

    const response: ValidateResponse = {
      ...result,
      timestamp: new Date().toISOString(),
      productionGates: gateResult,
    };

    // Add processing time in development
    if (process.env.NODE_ENV === 'development') {
      (response as ValidateResponse & { processingTimeMs: number }).processingTimeMs = Date.now() - startTime;
    }

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        valid: false,
        stage: 0,
        errors: [{
          code: 'E500',
          message: `Validation error: ${errorMessage}`,
          severity: 'error' as const,
          suggestion: 'Check that the request body contains valid JSON',
        }],
        warnings: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/validate
 * Returns validation capabilities and supported error codes
 */
export async function GET() {
  return NextResponse.json({
    description: 'n8n Workflow JSON Validation API',
    stages: {
      1: 'Basic structure validation (JSON parse, nodes array, connections object)',
      2: 'n8n structural rules (node fields, connection integrity)',
      3: 'Production quality gates (expression syntax, merge mode, cardinality, XML, credentials)',
    },
    productionGates: {
      GATE001: 'Expression Syntax - Must use ={{ expr }} not {{ }} or inline URLs',
      GATE002: 'Merge Mode - Must use "append" not "combine/multiplex" for different sources',
      GATE003: 'Cardinality - Final output must be single item',
      GATE004: 'XML Parsing - arXiv/RSS endpoints need string response + Code parse',
      GATE005: 'Credentials - Should use $env variables with fallbacks',
    },
    scoring: {
      A: '90-100: Production ready',
      B: '80-89: Minor issues',
      C: '70-79: Needs attention',
      D: '60-69: Significant issues',
      F: '0-59: Critical failures',
    },
    errorCodes: {
      E001: 'Invalid JSON',
      E002: 'Root is not an object',
      E003: 'Missing nodes array',
      E004: 'Missing connections object',
      E005: 'Nodes is not an array',
      E006: 'Connections is not an object',
      E101: 'Node missing name',
      E102: 'Node missing type',
      E103: 'Node invalid/missing id',
      E104: 'Node invalid typeVersion',
      E105: 'Node invalid position',
      E106: 'Node parameters not object',
      E107: 'Duplicate node name',
      E108: 'Duplicate node id',
      E201: 'Connection source not found',
      E202: 'Connection target not found',
      E203: 'Connection invalid format',
      E204: 'Connection invalid index',
    },
    requestFormat: {
      workflow: 'n8n workflow object (optional if jsonString provided)',
      jsonString: 'JSON string to parse and validate (optional if workflow provided)',
      fullValidation: 'boolean - run Stage 1 + Stage 2 (default: true)',
      productionGates: 'boolean - run Stage 3 production quality gates (default: true)',
    },
  });
}
