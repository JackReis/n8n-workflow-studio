# n8n Workflow JSON Studio

Multi-LLM powered n8n workflow generator, validator, and repair tool. Built with Next.js 16, Monaco Editor, and shadcn/ui.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Multi-LLM Support
- **z.ai Gateway** - GLM-5, GLM-4.7 models
- **OpenAI** - GPT-4o, GPT-4-turbo, GPT-3.5
- **Google Gemini** - Gemini 2.0 Flash, Gemini 1.5 Pro
- **OpenRouter** - 500+ models (Claude, Llama, Mixtral, etc.)
- **Groq** - Ultra-fast inference (Llama 3.3, Mixtral)
- **GLM-5 Local** - Local GLM-5 via FastAPI bridge

### Workflow Operations
- **Generate** - Create n8n workflows from natural language descriptions
- **Validate** - Multi-stage validation with structural and semantic checks
- **Repair** - AI-powered automatic fixing of broken workflows
- **Enhance** - Optimize workflows with error handling and best practices

### Skills System
The Skills System enhances prompts with n8n best practices:
- **Intent Detection** - Automatically detects workflow intent (trigger, integration, transform, output)
- **Pattern Matching** - Matches prompts to 10+ workflow patterns
- **Best Practices Injection** - Adds error handling, validation, and optimization tips
- **Complexity Estimation** - Estimates node count and workflow complexity
- **Integration Detection** - Identifies required external services

### Developer Experience
- Real-time Monaco Editor with JSON validation
- Side-by-side diff viewer for before/after comparison
- Operation history tracking
- Responsive design (mobile, tablet, desktop)
- BYOK (Bring Your Own Key) - API keys never leave browser

## Quick Start

```bash
# Clone the repository
git clone https://github.com/turtir-ai/n8n-workflow-studio.git
cd n8n-workflow-studio

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3011
```

## Configuration

### API Keys
Keys are stored locally in browser localStorage and never sent to external servers except the respective LLM providers.

| Provider | Get API Key |
|----------|-------------|
| z.ai | Configured via gateway |
| OpenAI | https://platform.openai.com/api-keys |
| Google Gemini | https://aistudio.google.com/apikey |
| OpenRouter | https://openrouter.ai/keys |
| Groq | https://console.groq.com/keys |

### GLM-5 Local Bridge
To use GLM-5 locally, create a FastAPI bridge:

```python
# bridge.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    model: str
    messages: list
    temperature: float = 0.7
    max_tokens: int = 8192

@app.post("/v1/chat/completions")
async def chat(request: ChatRequest):
    # Your GLM-5 inference code here
    response = glm5_generate(request.messages, request.temperature, request.max_tokens)
    return {"choices": [{"message": {"content": response}}]}

# Run: uvicorn bridge:app --host 0.0.0.0 --port 8765
```

## Usage

### Generate Mode
1. Go to **Generate** tab
2. Describe your workflow in natural language
   - Example: "Create an RSS feed reader that sends new items to Slack"
3. The Skills System will analyze your prompt and show:
   - Detected intents (trigger, integration, transform)
   - Suggested patterns (RSS Feed Trigger, HTTP Request, Slack Output)
   - Estimated complexity and node count
4. Click **Generate** to create the workflow
5. Validate and download the JSON

### Repair Mode
1. Go to **Repair** tab
2. Upload or paste your n8n workflow JSON
3. Click **Validate** to check for errors
4. Review validation results (errors, warnings, suggestions)
5. If errors found, click **Fix with AI**
6. Review the diff and download the fixed JSON

### Settings
- View configured API keys (masked)
- Adjust temperature (0-1)
- Set max tokens (256-32768)
- Clear all keys

## Project Structure

```
portfolyo2/
├── app/
│   ├── api/
│   │   ├── llm/generate/route.ts     # Unified LLM generation
│   │   ├── providers/models/route.ts # Dynamic model fetching
│   │   ├── repair/route.ts           # Workflow repair
│   │   ├── skills/analyze/route.ts   # Skills analysis API
│   │   └── validate/route.ts         # JSON validation
│   ├── layout.tsx
│   ├── page.tsx                       # Main application
│   └── globals.css
├── components/
│   ├── editor/
│   │   ├── MonacoEditor.tsx          # Code editor
│   │   └── DiffViewer.tsx            # Diff comparison
│   ├── sidebar/
│   │   ├── Sidebar.tsx               # Main sidebar
│   │   └── ProviderSelector.tsx      # LLM provider UI
│   ├── tabs/
│   │   ├── GenerateTab.tsx           # Generation UI
│   │   └── RepairTab.tsx             # Repair UI
│   └── ui/                            # shadcn/ui components
├── lib/
│   ├── providers/
│   │   ├── index.ts                  # Provider factory
│   │   ├── base.ts                   # Base types & utilities
│   │   ├── openrouter.ts
│   │   ├── gemini.ts
│   │   ├── groq.ts
│   │   ├── openai.ts
│   │   ├── zai.ts
│   │   └── glm5.ts                   # Local GLM-5 bridge
│   ├── skills/
│   │   ├── index.ts                  # Skills exports
│   │   ├── intent.ts                 # Intent detection
│   │   ├── patterns.ts               # Workflow patterns
│   │   ├── types.ts                  # Type definitions
│   │   └── executor.ts               # Prompt enhancement
│   ├── store.ts                      # Zustand state
│   └── utils.ts
└── package.json
```

## API Reference

### POST /api/llm/generate
Unified LLM generation endpoint with skills enhancement.

```typescript
interface GenerateRequest {
  provider: 'openrouter' | 'gemini' | 'groq' | 'openai' | 'zai' | 'glm5';
  model: string;
  mode: 'generate_workflow' | 'repair_workflow' | 'enhance_workflow' | 'custom';
  input: {
    prompt?: string;
    workflow?: object;
    description?: string;
    errors?: Array<{ message: string; path?: string }>;
  };
  apiKey: string;
  temperature?: number;    // default: 0.7
  maxTokens?: number;      // default: 8192
  useSkills?: boolean;     // default: true
}
```

### POST /api/validate
Validate n8n workflow JSON.

```typescript
interface ValidateRequest {
  jsonString: string;
  fullValidation?: boolean;
}
```

### POST /api/repair
Repair broken workflow using LLM.

```typescript
interface RepairRequest {
  workflow: object;
  errors: ValidationError[];
  provider: string;
  model: string;
  apiKey: string;
}
```

### POST /api/skills/analyze
Analyze prompt for skills and patterns.

```typescript
interface SkillsRequest {
  prompt: string;
  maxPatterns?: number;  // default: 5
}
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| State | Zustand |
| Editor | Monaco Editor |
| Icons | Lucide React |

## Development

```bash
# Development server (port 3011)
npm run dev

# Production build
npm run build

# Start production
npm start

# Lint
npm run lint
```

## Adding a New LLM Provider

1. Create `/lib/providers/newprovider.ts`:
```typescript
import { LLMProvider, GenerateParams, GenerateResult } from './base';

export class NewProvider implements LLMProvider {
  name = 'newprovider';
  models = ['model-1', 'model-2'];

  async generate(params: GenerateParams): Promise<GenerateResult> {
    // Implementation
  }
}
```

2. Register in `/lib/providers/index.ts`
3. Add to `PROVIDERS` array in `/lib/store.ts`
4. Add icon in `/components/sidebar/ProviderSelector.tsx`

## Security

- API keys stored in browser localStorage only
- Keys never logged or sent to external servers
- All LLM calls made directly from browser
- No server-side key storage
- HTTPS only in production

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## License

MIT

## Author

[TT](https://github.com/turtir-ai) - Security Researcher & Workflow Automation Specialist

## Acknowledgments

- [n8n](https://n8n.io) - The workflow automation platform
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
