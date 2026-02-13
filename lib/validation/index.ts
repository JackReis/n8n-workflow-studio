// ============================================
// n8n Workflow Validation Module
// ============================================

// Types and schemas
export type {
  n8nNode,
  n8nWorkflow,
  Connection,
  ConnectionTarget,
  NodeConnections,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSeverity,
  ErrorCode,
} from './schemas';

export {
  // Zod schemas
  n8nNodeSchema,
  n8nWorkflowSchema,
  ConnectionSchema,
  ConnectionTargetSchema,
  PositionSchema,
  // Error codes
  ErrorCodes,
} from './schemas';

// Stage 0: Multi-workflow & extraction
export {
  validateStage0,
  extractJsonBlocks,
  parseJsonSafe,
  runSemanticChecks,
  checkInvalidUrlExpressions,
  checkMustacheInStrings,
  checkMergeNodeMode,
  checkSplitInBatchesWiring,
  checkGraphReachability,
  SemanticErrorCodes,
  type Stage0Result,
} from './stage0';

// Stage 1: Basic validation
export {
  validateStage1,
  validateStage1FromString,
  isValidBasicShape,
  isValidBasicShapeFromString,
} from './stages';

// Stage 2: Structural rules
export {
  validateStage2,
  validateWorkflow,
  validateWorkflowFromString,
} from './rules';

// Stage 3: Semantic validation
export {
  validateStage3,
  validateWorkflowFull,
  validateWorkflowFullFromString,
} from './semantic';

// Node Registry (Arity validation)
export {
  NODE_REGISTRY,
  getNodeArity,
  validateGraphArity,
  validateMergeNodeConnections,
  arityViolationsToWarnings,
  type NodeArity,
  type ArityViolation,
} from './node-registry';
