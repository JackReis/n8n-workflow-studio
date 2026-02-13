/**
 * POST /api/repair
 * Repairs n8n workflow JSON using LLM-powered repair loop
 */

import { NextRequest, NextResponse } from 'next/server';
import { createProvider, maskApiKey, type ProviderName } from '@/lib/providers';
import { repairLoop, quickRepair, validateAndRepair } from '@/lib/repair/loop';
import { validateWorkflow } from '@/lib/validation/rules';
import type { n8nWorkflow, ValidationError } from '@/lib/validation/schemas';

// Increase max duration for Vercel/serverless (up to 5 minutes)
export const maxDuration = 300;

export interface RepairRequest {
  workflow: n8nWorkflow;
  errors?: ValidationError[]; // If not provided, will validate first
  provider: ProviderName;
  model: string;
  apiKey: string;
  config?: {
    maxAttempts?: number;
    temperature?: number;
    preserveNodeIds?: boolean;
    preserveNodeNames?: boolean;
  };
  mode?: 'full' | 'quick' | 'auto'; // full = repairLoop, quick = single attempt, auto = validateAndRepair
}

export interface RepairResponse {
  success: boolean;
  workflow?: n8nWorkflow;
  attempts?: number;
  finalErrors?: ValidationError[];
  repairHistory?: Array<{
    attempt: number;
    fixedCount: number;
    newErrorCount: number;
  }>;
  originalWorkflow?: n8nWorkflow;
  error?: string;
  timestamp: string;
}

const DEFAULT_CONFIG = {
  maxAttempts: 5,
  temperature: 0.1,
  preserveNodeIds: true,
  preserveNodeNames: true,
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: RepairRequest = await request.json();
    const {
      workflow,
      errors,
      provider: providerName,
      model,
      apiKey,
      config = {},
      mode = 'full',
    } = body;

    // Validate required fields
    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing workflow in request body',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!providerName || !apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing provider or apiKey',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing model',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Create provider instance (API key is NOT logged)
    const provider = createProvider(providerName as ProviderName, apiKey);

    // Merge config with defaults
    const finalConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      model,
    };

    // Deep clone original for response
    const originalWorkflow = JSON.parse(JSON.stringify(workflow)) as n8nWorkflow;

    let result;

    try {
      if (mode === 'auto') {
        // Auto mode: validate first, then repair if needed
        result = await validateAndRepair(workflow, provider, finalConfig);
      } else if (mode === 'quick') {
        // Quick mode: single repair attempt
        const validation = validateWorkflow(workflow);
        if (validation.valid) {
          result = {
            success: true,
            workflow,
            attempts: 0,
          };
        } else {
          const repaired = await quickRepair(workflow, validation.errors, provider, model);
          result = {
            success: !!repaired,
            workflow: repaired || workflow,
            attempts: 1,
            finalErrors: repaired ? undefined : validation.errors,
          };
        }
      } else {
        // Full mode: run repair loop with provided errors or validate first
        let repairErrors = errors;
        if (!repairErrors) {
          const validation = validateWorkflow(workflow);
          repairErrors = validation.errors;
        }

        if (repairErrors.length === 0) {
          result = {
            success: true,
            workflow,
            attempts: 0,
          };
        } else {
          result = await repairLoop(workflow, repairErrors, provider, finalConfig);
        }
      }
    } catch (llmError) {
      const errorMessage = llmError instanceof Error ? llmError.message : 'Unknown LLM error';
      return NextResponse.json(
        {
          success: false,
          error: `LLM provider error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      );
    }

    const response: RepairResponse = {
      success: result.success,
      workflow: result.workflow,
      attempts: result.attempts,
      finalErrors: result.finalErrors,
      repairHistory: result.repairHistory?.map(h => ({
        attempt: h.attempt,
        fixedCount: h.fixedCount,
        newErrorCount: h.newErrorCount,
      })),
      originalWorkflow,
      timestamp: new Date().toISOString(),
    };

    // Add processing time in development
    if (process.env.NODE_ENV === 'development') {
      (response as RepairResponse & { processingTimeMs: number }).processingTimeMs = Date.now() - startTime;
      // Never include API key in logs or responses
      (response as RepairResponse & { providerUsed: string }).providerUsed = `${providerName}:${model}`;
    }

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Repair error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/repair
 * Returns repair capabilities
 */
export async function GET() {
  return NextResponse.json({
    description: 'n8n Workflow JSON Repair API',
    modes: {
      full: 'Full repair loop with multiple attempts (default)',
      quick: 'Single repair attempt',
      auto: 'Validate first, repair only if needed',
    },
    config: {
      maxAttempts: 'Maximum repair attempts (default: 5)',
      temperature: 'LLM temperature (default: 0.1)',
      preserveNodeIds: 'Keep original node IDs (default: true)',
      preserveNodeNames: 'Keep original node names (default: true)',
    },
    security: {
      apiKeyHandling: 'API keys are never logged or persisted',
      keyMasking: `Keys are masked as ${maskApiKey('sk-example-key-1234')}`,
    },
  });
}
