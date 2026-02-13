import { create } from 'zustand';

// Validation error type
export interface ValidationError {
  code?: string;
  message: string;
  path: string;
  severity?: 'error' | 'warning' | 'info';
  node?: string;
  suggestion?: string;
}

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: { message: string; path: string }[];
  stage?: number;
  stats?: {
    nodeCount: number;
    connectionCount: number;
    nodeTypes: Record<string, number>;
  };
}

// History item type
export interface HistoryItem {
  id?: string;
  type: string;
  timestamp: string;
  success: boolean;
  provider?: string;
  model?: string;
  input?: string;
  output?: string;
  errors?: ValidationError[];
}

// Provider info
export interface ProviderInfo {
  id: string;
  name: string;
  icon?: string;
  getKeyUrl?: string;
  // Default models (used when API not connected)
  defaultModels?: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter (All LLMs)',
    icon: 'R',
    getKeyUrl: 'https://openrouter.ai/keys',
    defaultModels: [
      // Free models
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free',
      // Claude
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-haiku',
      // GPT
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'openai/o1-preview',
      // Gemini
      'google/gemini-pro-1.5',
      'google/gemini-2.0-flash-exp',
      // Qwen
      'qwen/qwen-2.5-72b-instruct',
      'qwen/qwen-2.5-coder-32b-instruct',
      // DeepSeek
      'deepseek/deepseek-chat',
      'deepseek/deepseek-coder',
      // Llama
      'meta-llama/llama-3.3-70b-instruct',
      'meta-llama/llama-3.2-90b-vision-instruct',
      // Mistral
      'mistralai/mistral-large',
      'mistralai/codestral-latest',
      // Kimi (Moonshot)
      'moonshotai/kimi-chat',
      // MiniMax
      'minimax/minimax-text-01',
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'G',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    defaultModels: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    id: 'groq',
    name: 'Groq (Free)',
    icon: 'Q',
    getKeyUrl: 'https://console.groq.com/keys',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'O',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
  },
  {
    id: 'zai',
    name: 'z.ai (GLM)',
    icon: 'Z',
    getKeyUrl: 'https://z.ai/api-keys',
    defaultModels: ['glm-5', 'glm-4.7', 'glm-4-flash'],
  },
  {
    id: 'glm5',
    name: 'GLM-5 Local (Bridge)',
    icon: 'L',
    defaultModels: ['glm-5', 'glm-4-plus', 'glm-4-flash'],
  },
];

// Dynamic models fetched from API
export interface DynamicModel {
  id: string;
  name: string;
  owned_by?: string;
  context_length?: number;
}

// AppState interface - comprehensive
interface AppState {
  // Provider & Model
  provider: string;
  setProvider: (provider: string) => void;
  model: string;
  setModel: (model: string) => void;

  // API Keys
  apiKey: string; // Current active API key (for selected provider)
  apiKeys: Record<string, string>; // API keys per provider
  setApiKey: (providerOrKey: string, key?: string) => void; // setApiKey(key) for current provider, or setApiKey(provider, key)
  setApiKeyForProvider: (provider: string, key: string) => void;
  getApiKey: (provider: string) => string | undefined;
  clearApiKeys: () => void;

  // Dynamic models from API
  dynamicModels: Record<string, DynamicModel[]>; // provider -> models
  setDynamicModels: (provider: string, models: DynamicModel[]) => void;
  connectedProviders: string[]; // providers with valid API keys
  addConnectedProvider: (provider: string) => void;
  removeConnectedProvider: (provider: string) => void;
  isLoadingModels: boolean;
  setIsLoadingModels: (loading: boolean) => void;

  // Workflow JSON
  workflowJson: string;
  setWorkflowJson: (json: string) => void;
  currentJson: string;
  setCurrentJson: (json: string) => void;

  // Prompt for generation
  prompt: string;
  setPrompt: (prompt: string) => void;

  // Validation
  validationResult: ValidationResult | null;
  setValidationResult: (result: ValidationResult | null) => void;
  validationErrors: ValidationError[];
  setValidationErrors: (errors: ValidationError[]) => void;

  // Repair state
  isRepairing: boolean;
  setIsRepairing: (repairing: boolean) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Repaired JSON
  repairedJson: string;
  setRepairedJson: (json: string) => void;

  // History
  history: HistoryItem[];
  addToHistory: (item: HistoryItem) => void;
  clearHistory: () => void;

  // Settings
  temperature: number;
  setTemperature: (temp: number) => void;
  maxTokens: number;
  setMaxTokens: (tokens: number) => void;

  // Active tab
  activeTab: 'repair' | 'generate' | 'history' | 'settings';
  setActiveTab: (tab: 'repair' | 'generate' | 'history' | 'settings') => void;
}

// Create store
export const useAppStore = create<AppState>((set, get) => ({
  // Provider & Model
  provider: 'openrouter',
  setProvider: (provider) => set({ provider }),
  model: 'google/gemini-2.0-flash-exp:free',
  setModel: (model) => set({ model }),

  // API Keys
  apiKey: '',
  apiKeys: {},
  setApiKey: (providerOrKey, key) => {
    if (key !== undefined) {
      // setApiKey(provider, key) - set key for specific provider
      set((state) => ({
        apiKeys: { ...state.apiKeys, [providerOrKey]: key },
        apiKey: state.provider === providerOrKey ? key : state.apiKey
      }));
    } else {
      // setApiKey(key) - set key for current provider
      const currentProvider = get().provider;
      set((state) => ({
        apiKey: providerOrKey,
        apiKeys: { ...state.apiKeys, [currentProvider]: providerOrKey }
      }));
    }
  },
  setApiKeyForProvider: (provider, key) => set((state) => ({
    apiKeys: { ...state.apiKeys, [provider]: key }
  })),
  getApiKey: (provider) => get().apiKeys[provider],
  clearApiKeys: () => set({ apiKeys: {}, apiKey: '', dynamicModels: {}, connectedProviders: [] }),

  // Dynamic Models
  dynamicModels: {},
  setDynamicModels: (provider, models) => set((state) => ({
    dynamicModels: { ...state.dynamicModels, [provider]: models }
  })),
  connectedProviders: [],
  addConnectedProvider: (provider) => set((state) => ({
    connectedProviders: state.connectedProviders.includes(provider)
      ? state.connectedProviders
      : [...state.connectedProviders, provider]
  })),
  removeConnectedProvider: (provider) => set((state) => ({
    connectedProviders: state.connectedProviders.filter(p => p !== provider)
  })),
  isLoadingModels: false,
  setIsLoadingModels: (isLoadingModels) => set({ isLoadingModels }),

  // Workflow JSON
  workflowJson: '{\n  "name": "My Workflow",\n  "nodes": [],\n  "connections": {}\n}',
  setWorkflowJson: (workflowJson) => set({ workflowJson }),
  currentJson: '',
  setCurrentJson: (currentJson) => set({ currentJson }),

  // Prompt
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),

  // Validation
  validationResult: null,
  setValidationResult: (validationResult) => set({ validationResult }),
  validationErrors: [],
  setValidationErrors: (validationErrors) => set({ validationErrors }),

  // Repair
  isRepairing: false,
  setIsRepairing: (isRepairing) => set({ isRepairing }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Repaired JSON
  repairedJson: '',
  setRepairedJson: (repairedJson) => set({ repairedJson }),

  // History
  history: [],
  addToHistory: (item) => set((state) => ({
    history: [{ ...item, id: `history-${Date.now()}` }, ...state.history].slice(0, 20)
  })),
  clearHistory: () => set({ history: [] }),

  // Settings
  temperature: 0.7,
  setTemperature: (temperature) => set({ temperature }),
  maxTokens: 4096,
  setMaxTokens: (maxTokens) => set({ maxTokens }),

  // Active tab
  activeTab: 'repair',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
