import { z } from 'zod';

// ============================================
// n8n Workflow Types
// ============================================

export interface n8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  notes?: string;
  notesInFlow?: boolean;
  credentials?: Record<string, string>;
  disabled?: boolean;
  continueOnFail?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: string;
  main?: number[];
}

export interface ConnectionTarget {
  node: string;
  type: string;
  index: number;
}

export interface Connection {
  node: string;
  type: string;
  index: number;
}

export interface NodeConnections {
  main?: ConnectionTarget[][];
}

export interface n8nWorkflow {
  name?: string;
  nodes: n8nNode[];
  connections: Record<string, NodeConnections>;
  settings?: {
    executionOrder?: string;
    saveManualExecutions?: boolean;
    callerPolicy?: string;
    errorWorkflow?: string;
    timezone?: string;
    saveExecutionProgress?: boolean;
  };
  staticData?: Record<string, unknown>;
  tags?: string[];
  pinData?: Record<string, unknown>;
  versionId?: string;
  id?: string;
  active?: boolean;
}

// ============================================
// Validation Result Types
// ============================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: ValidationSeverity;
  node?: string;
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  node?: string;
  suggestion?: string;
  severity?: ValidationSeverity; // Optional: 'error' makes it a blocking issue
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stage: number;
  stats?: {
    nodeCount: number;
    connectionCount: number;
    nodeTypes: Record<string, number>;
  };
}

// ============================================
// Zod Schemas
// ============================================

export const ConnectionTargetSchema = z.object({
  node: z.string().min(1, 'Target node name is required'),
  type: z.string().default('main'),
  index: z.number().int().nonnegative().default(0),
});

export const ConnectionSchema = z.record(
  z.string(),
  z.object({
    main: z.array(z.array(ConnectionTargetSchema)).optional(),
  })
);

export const PositionSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
]);

export const n8nNodeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Node name is required'),
  type: z.string().min(1, 'Node type is required'),
  typeVersion: z.number().int().positive().default(1),
  position: PositionSchema,
  parameters: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional(),
  notesInFlow: z.boolean().optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  disabled: z.boolean().optional(),
  continueOnFail: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
  maxTries: z.number().int().positive().optional(),
  waitBetweenTries: z.number().int().nonnegative().optional(),
  onError: z.string().optional(),
  main: z.array(z.number()).optional(),
});

export const n8nWorkflowSchema = z.object({
  name: z.string().optional(),
  nodes: z.array(n8nNodeSchema).min(0),
  connections: z.record(z.string(), z.unknown()).default({}),
  settings: z.record(z.string(), z.unknown()).optional(),
  staticData: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  pinData: z.record(z.string(), z.unknown()).optional(),
  versionId: z.string().optional(),
  id: z.string().optional(),
  active: z.boolean().optional(),
});

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Stage 1 errors
  INVALID_JSON: 'E001',
  NOT_AN_OBJECT: 'E002',
  MISSING_NODES: 'E003',
  MISSING_CONNECTIONS: 'E004',
  NODES_NOT_ARRAY: 'E005',
  CONNECTIONS_NOT_OBJECT: 'E006',

  // Stage 2 errors - Node
  NODE_MISSING_NAME: 'E101',
  NODE_MISSING_TYPE: 'E102',
  NODE_MISSING_ID: 'E103',
  NODE_INVALID_TYPE_VERSION: 'E104',
  NODE_INVALID_POSITION: 'E105',
  NODE_PARAMETERS_NOT_OBJECT: 'E106',
  NODE_DUPLICATE_NAME: 'E107',
  NODE_DUPLICATE_ID: 'E108',

  // Stage 2 errors - Connections
  CONN_SOURCE_NOT_FOUND: 'E201',
  CONN_TARGET_NOT_FOUND: 'E202',
  CONN_INVALID_FORMAT: 'E203',
  CONN_INVALID_INDEX: 'E204',

  // Stage 3 warnings
  UNKNOWN_NODE_TYPE: 'W301',
  EMPTY_PARAMETERS: 'W302',
  EXPRESSION_WARNING: 'W303',
  MISSING_CREDENTIALS: 'W304',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
