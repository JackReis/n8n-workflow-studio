/**
 * Repair Loop Types
 * Conservative n8n workflow repair system
 */

// Re-export types from validation schemas for consistency
export type {
  n8nWorkflow,
  n8nNode,
  ConnectionTarget,
  NodeConnections,
  ValidationError,
  ValidationResult as ValidationResponse,
  ValidationSeverity
} from '@/lib/validation/schemas';

// Re-export for convenience and local use
import type {
  n8nWorkflow as WorkflowType,
  n8nNode as NodeType,
  ValidationError as ValidationErrorType,
  ValidationResult as ValidationResponse
} from '@/lib/validation/schemas';
import type { LLMProvider as BaseLLMProvider, GenerateParams, GenerateResult as BaseGenerateResult } from '@/lib/providers/base';

export type n8nWorkflowType = WorkflowType;
export type n8nNodeType = NodeType;

// Re-export the LLMProvider from base for use in repair functions
export type LLMProvider = BaseLLMProvider;

// Local aliases for backward compatibility
type n8nWorkflow = WorkflowType;
type ValidationError = ValidationErrorType;

// Additional repair-specific types

export interface NodeErrorHandler {
  onError?: string;
  retry?: RetryConfig;
}

export interface RetryConfig {
  maxTries: number;
  waitBetweenTries: number;
}

export interface WorkflowSettings {
  executionOrder?: 'v1';
  saveDataErrorExecution?: boolean;
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
  cancellationAllowed?: boolean;
}

// Use ValidationError from schemas (re-exported above)
// Use ValidationResponse from schemas (aliased as ValidationResult)

// Local ValidationResult for repair-specific results
export interface RepairValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// Repair Types
export interface RepairConfig {
  maxAttempts: number;
  model: string;
  preserveNodeIds: boolean;
  preserveNodeNames: boolean;
  allowNewNodes: boolean;
  temperature?: number;
  /** Use JSON Patch (RFC6902) mode instead of full JSON rewrite */
  patchMode?: boolean;
}

export interface RepairResult {
  success: boolean;
  workflow: n8nWorkflow;
  attempts: number;
  finalErrors?: ValidationError[];
  repairHistory?: RepairAttempt[];
}

export interface RepairAttempt {
  attempt: number;
  inputErrors: ValidationError[];
  outputErrors: ValidationError[];
  fixedCount: number;
  newErrorCount: number;
}

// Default configurations
export const DEFAULT_REPAIR_CONFIG: RepairConfig = {
  maxAttempts: 5,
  model: 'glm-5',
  preserveNodeIds: true,
  preserveNodeNames: true,
  allowNewNodes: false,
  temperature: 0.1,
  patchMode: true, // Use JSON Patch by default (more efficient)
};
