/**
 * POST /api/llm/generate
 * Unified LLM generation endpoint for workflow generation and repair
 * Now with skill-based prompt enhancement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createProvider, maskApiKey, parseJsonStrict, type ProviderName, type GenerateResult } from '@/lib/providers';
import { buildEnhancedPrompt, quickSkillCheck } from '@/lib/skills';
import { postProcessWorkflow, stripCodeFences, completeTruncatedJson } from '@/lib/workflow-postprocessor';

// Increase max duration for Vercel/serverless (up to 5 minutes)
export const maxDuration = 300;

export interface GenerateRequest {
  provider: ProviderName;
  model: string;
  mode: 'generate_workflow' | 'repair_workflow' | 'enhance_workflow' | 'custom';
  input: {
    prompt?: string;
    workflow?: unknown;
    errors?: Array<{ message: string; path?: string }>;
    description?: string; // For workflow generation
  };
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  useSkills?: boolean; // Enable skill-based prompt enhancement (default: true)
}

export interface GenerateResponse {
  success: boolean;
  content?: string;
  parsed?: unknown;
  error?: string;
  usage?: {
    input: number;
    output: number;
  };
  skillAnalysis?: {
    complexity: string;
    intents: string[];
    patterns: string[];
    integrations: string[];
  };
  patternsUsed?: string[];
  timestamp: string;
}

// System prompts for different modes (used as fallback when skills system is disabled)
const SYSTEM_PROMPTS = {
  generate_workflow: `You are an n8n workflow JSON generator. Generate valid n8n workflow JSON based on the user's description.

Rules:
- Output ONLY valid JSON, no explanations or markdown
- Include all required fields: name, nodes array, connections object
- Each node must have: id (UUID), name, type, typeVersion, position [x,y], parameters
- Use valid n8n node types (e.g., n8n-nodes-base.httpRequest, n8n-nodes-base.code)
- Create appropriate connections between nodes
- Position nodes with reasonable spacing (200-300px apart)`,

  repair_workflow: `You are an n8n workflow JSON repair specialist. Fix the provided workflow based on the error messages.

Rules:
- Output ONLY the corrected JSON, no explanations
- Keep existing node IDs and names unchanged when possible
- Only fix what is explicitly broken
- Do not add new nodes unless absolutely necessary
- Preserve the original workflow structure and logic`,

  enhance_workflow: `You are an n8n workflow optimizer. Enhance the provided workflow to follow best practices.

Rules:
- Output ONLY the enhanced JSON, no explanations
- Add error handling where missing
- Optimize node structure and connections
- Maintain the original workflow logic`,

  custom: `You are a helpful assistant for n8n workflow development.`,
};

// Prompt builders for different modes (used when skills system is disabled)
function buildPrompt(mode: string, input: GenerateRequest['input']): string {
  switch (mode) {
    case 'generate_workflow':
      return `Generate an n8n workflow JSON for the following description:

${input.description || input.prompt || 'No description provided'}

Output only the JSON workflow object.`;

    case 'repair_workflow':
      return `Fix the following n8n workflow JSON:

${JSON.stringify(input.workflow, null, 2)}

Errors to fix:
${input.errors?.map(e => `- ${e.path ? `[${e.path}] ` : ''}${e.message}`).join('\n') || 'No specific errors provided'}

Output only the corrected JSON workflow object.`;

    case 'enhance_workflow':
      return `Enhance and optimize the following n8n workflow JSON:

${JSON.stringify(input.workflow, null, 2)}

Goals:
- Add error handling where missing
- Optimize node structure
- Follow n8n best practices
- Maintain original workflow logic

Output only the enhanced JSON workflow object.`;

    case 'custom':
      return input.prompt || 'No prompt provided';

    default:
      return input.prompt || JSON.stringify(input);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: GenerateRequest = await request.json();
    const {
      provider: providerName,
      model,
      mode,
      input,
      apiKey,
      temperature = 0.7,
      // Increase token limit for complex workflows
      maxTokens = mode === 'generate_workflow' ? 16384 : 8192,
      systemPrompt: customSystemPrompt,
    } = body;

    // Validate required fields
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

    if (!mode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing mode',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Create provider instance (API key is NOT logged)
    const provider = createProvider(providerName as ProviderName, apiKey);

    // Determine if we should use skills system
    const useSkills = body.useSkills !== false; // Default to true

    let prompt: string;
    let systemPrompt: string;
    let skillAnalysis: GenerateResponse['skillAnalysis'];
    let patternsUsed: string[] = [];

    if (useSkills && (mode === 'generate_workflow' || mode === 'enhance_workflow')) {
      // Use skill-enhanced prompt generation
      const userPrompt = input.description || input.prompt || '';
      const enhanced = buildEnhancedPrompt(userPrompt, mode as 'generate_workflow' | 'repair_workflow' | 'enhance_workflow', {
        includeExamples: true,
        maxPatterns: 5,
      });

      prompt = enhanced.userPrompt;
      systemPrompt = customSystemPrompt || enhanced.systemPrompt;
      patternsUsed = enhanced.patterns.map(p => p.id);

      // Include skill analysis in response for debugging
      skillAnalysis = quickSkillCheck(userPrompt);
    } else {
      // Legacy prompt building
      prompt = buildPrompt(mode, input);
      systemPrompt = customSystemPrompt || SYSTEM_PROMPTS[mode as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.custom;
    }

    // Call LLM
    let result: GenerateResult;
    try {
      // Only use responseFormat for providers that support it well
      // z.ai, openai support json_object mode
      const supportsJsonMode = ['openai', 'zai', 'openrouter'].includes(providerName);
      const responseFormat = supportsJsonMode ? { type: 'json' as const } : undefined;

      result = await provider.generate({
        prompt,
        model,
        temperature,
        maxTokens,
        responseFormat,
        systemPrompt,
      });
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

    // Check for generation error
    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Strip code fences first
    let cleanContent = stripCodeFences(result.content);

    // Try to complete truncated JSON if needed
    const { json: completedJson, wasCompleted } = completeTruncatedJson(cleanContent);
    if (wasCompleted) {
      cleanContent = completedJson;
    }

    // Try to parse the JSON response
    const { data: parsed, error: parseError } = parseJsonStrict(cleanContent);

    // Post-process workflow if parsing succeeded and mode is workflow generation
    let finalContent = cleanContent;
    let postProcessFixes: string[] = [];

    // Add completion info
    if (wasCompleted) {
      postProcessFixes.push('JSON was truncated and auto-completed');
    }

    if (parsed && mode === 'generate_workflow') {
      const { workflow, fixes, wasFixed } = postProcessWorkflow(parsed as Parameters<typeof postProcessWorkflow>[0]);
      if (wasFixed) {
        finalContent = JSON.stringify(workflow, null, 2);
        postProcessFixes = fixes;
      }
    }

    // Return content even if parsing fails - user can manually fix
    // Set success: true if we have content, just include the warning
    const hasContent: boolean = Boolean(finalContent && finalContent.trim().length > 0);

    // Build error message with completion info
    let errorMsg: string | undefined;
    if (parseError) {
      errorMsg = `JSON parse warning: ${parseError}. Raw content shown.`;
    } else if (postProcessFixes.length > 0) {
      // Show post-processing fixes as info
      errorMsg = `Auto-fixed: ${postProcessFixes.join(', ')}`;
    }

    const response: GenerateResponse = {
      success: hasContent, // Success if we got any content back
      content: finalContent, // Return post-processed content
      parsed: parsed,
      error: errorMsg,
      usage: result.usage,
      skillAnalysis,
      patternsUsed: patternsUsed.length > 0 ? patternsUsed : undefined,
      timestamp: new Date().toISOString(),
    };

    // Add post-processing info in development
    if (postProcessFixes.length > 0 && process.env.NODE_ENV === 'development') {
      (response as GenerateResponse & { postProcessFixes: string[] }).postProcessFixes = postProcessFixes;
    }

    // Add processing time in development
    if (process.env.NODE_ENV === 'development') {
      (response as GenerateResponse & { processingTimeMs: number }).processingTimeMs = Date.now() - startTime;
      // Never include API key in logs or responses
      (response as GenerateResponse & { providerUsed: string }).providerUsed = `${providerName}:${model}`;
    }

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Generation error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/llm/generate
 * Returns generation capabilities
 */
export async function GET() {
  return NextResponse.json({
    description: 'Unified LLM Generation API for n8n workflows',
    modes: {
      generate_workflow: 'Generate new workflow from description (skill-enhanced by default)',
      repair_workflow: 'Repair broken workflow JSON',
      enhance_workflow: 'Optimize and add best practices to existing workflow',
      custom: 'Custom prompt with JSON response',
    },
    skills: {
      enabled: true,
      description: 'Skill-based prompt enhancement analyzes prompts and injects best practices',
      features: [
        'Intent detection (trigger, integration, transform, error handling)',
        'Pattern matching with templates',
        'Best practices injection',
        'Complexity estimation',
      ],
    },
    providers: ['zai', 'openai', 'gemini', 'openrouter', 'groq', 'glm5'],
    security: {
      apiKeyHandling: 'API keys are never logged or persisted',
      keyMasking: `Keys are masked as ${maskApiKey('sk-example-key-1234')}`,
    },
    defaults: {
      temperature: 0.7,
      maxTokens: 8192,
      useSkills: true,
    },
  });
}
