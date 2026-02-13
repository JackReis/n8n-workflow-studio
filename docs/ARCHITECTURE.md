# Architecture Overview

## System Design

The n8n Workflow JSON Studio is a full-stack Next.js application designed to validate, repair, and generate n8n workflow JSON files using multiple LLM providers.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router + React 18 |
| UI Framework | Tailwind CSS + shadcn/ui |
| Code Editor | Monaco Editor (JSON + Diff) |
| State Management | Zustand |
| Validation | Zod (input) + Ajv (JSON Schema) |
| LLM Integration | Multi-provider adapter pattern |

### Design Principles

1. **BYOK (Bring Your Own Key)** - API keys are never stored server-side
2. **Stateless Backend** - No persistent storage, enabling easy horizontal scaling
3. **Provider Agnostic** - Unified interface for multiple LLM providers
4. **Conservative Repair** - Minimal changes to preserve workflow semantics

---

## Directory Structure

```
/app
  /repair          # JSON upload, validation, repair UI
  /generate        # Prompt-to-workflow generation UI
  /history         # Local session history
  /settings        # API keys, model preferences
  /api
    /llm/generate  # Unified LLM generation endpoint
    /validate      # Multi-stage JSON validation
    /repair        # Repair loop orchestration
/components
  /ui              # shadcn/ui primitives
  /editor          # Monaco editor wrappers
  /validation      # Error display, validation status
  /diff            # Before/after diff viewer
/lib
  /providers       # LLM adapter implementations
    zai.ts
    openai.ts
    gemini.ts
    openrouter.ts
    groq.ts
    index.ts       # Registry and factory
  /validation
    stages.ts      # Multi-stage validation pipeline
    rules.ts       # n8n structural rules
    errors.ts      # Error types and formatting
  /repair
    loop.ts        # Repair loop algorithm
    prompts.ts     # System prompts for LLM
  /n8n
    schema-lite.json   # Simplified n8n JSON schema
    samples/           # Sample workflows for testing
  /utils
    json.ts         # JSON parsing utilities
    storage.ts      # Local storage helpers
/docs
  ARCHITECTURE.md
  PROVIDERS.md
  SECURITY.md
  DEPLOY_VERCEL.md
```

---

## Data Flow

### Mode A: JSON Repair Flow

```
1. User uploads JSON (drag & drop / paste / file)
   |
2. Frontend: JSON parse attempt
   |
3. POST /api/validate
   |  Stage 1: JSON syntax + basic shape
   |  Stage 2: n8n structural rules
   |  Stage 3: Semantic validation (optional)
   |
4. Return validation result:
   - valid: true/false
   - errors: [{ path, message, severity }]
   |
5. User clicks "Fix with LLM"
   |
6. POST /api/repair
   |  Repair Loop (max 5 iterations):
   |    a. Build prompt with errors
   |    b. Call LLM provider
   |    c. Validate response
   |    d. If valid -> return; else -> next iteration
   |
7. Display diff (before/after)
   |
8. User downloads import-ready JSON
```

### Mode B: Prompt-to-Workflow Flow

```
1. User enters natural language prompt
   |  Example: "RSS feed to Slack webhook"
   |
2. POST /api/llm/generate
   |  mode: "generate_workflow"
   |  provider + model selected
   |
3. LLM generates workflow JSON
   |
4. Auto-validate generated JSON
   |
5. If errors -> auto-trigger repair loop
   |
6. Display result + validation status
   |
7. User downloads or refines
```

---

## Key Modules

### /lib/providers - LLM Adapters

Unified interface for all providers:

```typescript
interface LLMProvider {
  name: string;
  models: string[];
  generate(params: GenerateParams): Promise<GenerateResult>;
  supportsStructuredOutput: boolean;
}

interface GenerateParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: { type: 'json' };
  maxTokens?: number;
  temperature?: number;
}
```

Each adapter handles:
- Authentication (API key header)
- Request format transformation
- Response parsing
- Error handling

### /lib/validation - Multi-Stage Validator

Three-stage pipeline:

| Stage | Purpose | Checks |
|-------|---------|--------|
| Stage 1 | Basic Shape | JSON parse, root is object, `nodes` array exists, `connections` object exists |
| Stage 2 | Structural Rules | Node `id`/`name`/`type`/`typeVersion`/`position`, connection target validity |
| Stage 3 | Semantic (optional) | Known node types, parameter validity, expression warnings |

### /lib/repair - Repair Loop

Core algorithm:

```typescript
async function repairLoop(
  workflow: unknown,
  errors: ValidationError[],
  config: RepairConfig
): Promise<RepairResult> {
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const prompt = buildRepairPrompt(workflow, errors);
    const fixed = await llmGenerate(prompt);

    const validation = await validate(fixed);
    if (validation.valid) {
      return { success: true, workflow: fixed, attempts: attempt };
    }

    errors = validation.errors; // Only remaining errors for next attempt
  }

  return { success: false, errors };
}
```

### /lib/n8n - n8n Schema

Lightweight schema focusing on import-critical fields:

```json
{
  "type": "object",
  "required": ["nodes", "connections"],
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "required": ["id", "name", "type", "typeVersion", "position"]
      }
    },
    "connections": { "type": "object" }
  }
}
```

---

## API Endpoints

### POST /api/validate

Validates n8n workflow JSON.

**Request:**
```json
{
  "workflow": { ... }
}
```

**Response:**
```json
{
  "valid": false,
  "errors": [
    {
      "path": "nodes[0].type",
      "message": "Required field 'type' is missing",
      "severity": "error"
    }
  ]
}
```

### POST /api/repair

Attempts to repair a broken workflow.

**Request:**
```json
{
  "workflow": { ... },
  "provider": "openai",
  "model": "gpt-4o",
  "apiKey": "sk-...",
  "maxAttempts": 5
}
```

**Response:**
```json
{
  "success": true,
  "workflow": { ... },
  "attempts": 2,
  "diff": { ... }
}
```

### POST /api/llm/generate

Generates or repairs workflow via LLM.

**Request:**
```json
{
  "provider": "zai",
  "model": "glm-5",
  "mode": "generate_workflow",
  "prompt": "Create an RSS to Slack workflow",
  "apiKey": "...",
  "responseFormat": { "type": "json" }
}
```

**Response:**
```json
{
  "success": true,
  "workflow": { ... }
}
```

---

## UI Components

### Monaco Editor Integration

- JSON syntax highlighting
- Error markers linked to validation errors
- Auto-formatting
- Diff view for before/after comparison

### Error List

- Clickable errors jump to JSON location
- Severity indicators (error/warning/info)
- Grouped by node or connection

### Provider Selector

- Dropdown for provider
- Dynamic model list based on provider
- API key input (masked, not persisted)
- "Remember key" checkbox (localStorage only)
