/**
 * POST /api/skills/analyze
 * Analyzes a prompt and returns skill-based recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  analyzePrompt,
  getBestPatterns,
  quickSkillCheck,
  getAllPatterns,
} from '@/lib/skills';

export interface AnalyzeRequest {
  prompt: string;
  maxPatterns?: number;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis?: {
    complexity: string;
    intents: Array<{
      category: string;
      confidence: number;
      keywords: string[];
    }>;
    suggestedPatterns: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      bestPractices: string[];
    }>;
    requiredIntegrations: string[];
    estimatedNodeCount: number;
  };
  quickCheck?: {
    complexity: string;
    intents: string[];
    patterns: string[];
    integrations: string[];
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { prompt, maxPatterns = 5 } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid prompt',
        },
        { status: 400 }
      );
    }

    // Run full analysis
    const analysis = analyzePrompt(prompt);

    // Get best patterns
    const patterns = getBestPatterns(prompt, maxPatterns);

    // Format response
    const response: AnalyzeResponse = {
      success: true,
      analysis: {
        complexity: analysis.complexity,
        intents: analysis.detectedIntents.map(intent => ({
          category: intent.category,
          confidence: Math.round(intent.confidence * 100) / 100,
          keywords: intent.matchedKeywords,
        })),
        suggestedPatterns: patterns.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          bestPractices: p.bestPractices.slice(0, 3),
        })),
        requiredIntegrations: analysis.requiredIntegrations,
        estimatedNodeCount: analysis.estimatedNodeCount,
      },
      quickCheck: quickSkillCheck(prompt),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Analysis error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/skills/analyze
 * Returns all available patterns
 */
export async function GET() {
  const patterns = getAllPatterns();

  return NextResponse.json({
    description: 'n8n Workflow Skills Analysis API',
    totalPatterns: patterns.length,
    categories: {
      trigger: patterns.filter(p => p.category === 'trigger').length,
      integration: patterns.filter(p => p.category === 'integration').length,
      transform: patterns.filter(p => p.category === 'transform').length,
      logic: patterns.filter(p => p.category === 'logic').length,
      output: patterns.filter(p => p.category === 'output').length,
      error: patterns.filter(p => p.category === 'error').length,
    },
    patterns: patterns.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      nodeTypes: p.nodeTypes,
    })),
    usage: {
      endpoint: 'POST /api/skills/analyze',
      body: {
        prompt: 'string (required) - The workflow description to analyze',
        maxPatterns: 'number (optional, default: 5) - Max patterns to return',
      },
    },
  });
}
