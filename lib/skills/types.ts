/**
 * n8n Workflow Skills System
 * Skills guide LLMs to generate better workflows with patterns and best practices
 */

// Skill types
export type SkillCategory =
  | 'trigger'      // How to start workflows
  | 'integration'  // External service integrations
  | 'transform'    // Data transformation patterns
  | 'logic'        // Conditional logic patterns
  | 'output'       // Output and notification patterns
  | 'error'        // Error handling patterns
  | 'optimization' // Performance optimizations
  | 'security';    // Security best practices

export interface SkillPattern {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  nodeTypes: string[];           // n8n node types involved
  template: object;              // Partial workflow template
  bestPractices: string[];       // Best practice tips
  commonMistakes: string[];      // What to avoid
  examples: SkillExample[];
}

export interface SkillExample {
  name: string;
  description: string;
  workflow: object;
  explanation: string;
}

export interface SkillContext {
  userPrompt: string;
  detectedIntents: string[];
  requiredIntegrations: string[];
  complexity: 'simple' | 'medium' | 'complex';
  suggestedPatterns: SkillPattern[];
}

export interface SkillEnhancedPrompt {
  systemPrompt: string;
  userPrompt: string;
  patterns: SkillPattern[];
  constraints: string[];
  examples: string;
}

// n8n Node Type Registry
export const N8N_NODE_TYPES = {
  // Triggers
  triggers: {
    manual: 'n8n-nodes-base.manualTrigger',
    schedule: 'n8n-nodes-base.scheduleTrigger',
    webhook: 'n8n-nodes-base.webhook',
    rss: 'n8n-nodes-base.rssFeedRead',
    email: 'n8n-nodes-base.emailReadImap',
    cron: 'n8n-nodes-base.cron',
  },

  // HTTP & API
  http: {
    request: 'n8n-nodes-base.httpRequest',
    webhook: 'n8n-nodes-base.webhook',
    graphql: 'n8n-nodes-base.graphql',
  },

  // Data Transform
  transform: {
    code: 'n8n-nodes-base.code',
    set: 'n8n-nodes-base.set',
    merge: 'n8n-nodes-base.merge',
    split: 'n8n-nodes-base.splitOut',
    aggregate: 'n8n-nodes-base.aggregate',
    filter: 'n8n-nodes-base.filter',
    switch: 'n8n-nodes-base.switch',
    if: 'n8n-nodes-base.if',
  },

  // AI & LLM
  ai: {
    openai: '@n8n/n8n-nodes-langchain.openAi',
    chat: '@n8n/n8n-nodes-langchain.chatOpenAi',
    chain: 'n8n-nodes-base.chain',
    agent: 'n8n-nodes-base.agent',
  },

  // Integrations
  integrations: {
    slack: 'n8n-nodes-base.slack',
    discord: 'n8n-nodes-base.discord',
    telegram: 'n8n-nodes-base.telegram',
    gmail: 'n8n-nodes-base.gmail',
    sheets: 'n8n-nodes-base.googleSheets',
    notion: 'n8n-nodes-base.notion',
    airtable: 'n8n-nodes-base.airtable',
    postgres: 'n8n-nodes-base.postgres',
    mysql: 'n8n-nodes-base.mySql',
    mongodb: 'n8n-nodes-base.mongoDb',
    redis: 'n8n-nodes-base.redis',
    s3: 'n8n-nodes-base.s3',
    ftp: 'n8n-nodes-base.ftp',
    ssh: 'n8n-nodes-base.ssh',
  },

  // Utility
  utility: {
    function: 'n8n-nodes-base.code',
    date: 'n8n-nodes-base.date',
    editFields: 'n8n-nodes-base.editFields',
    renameKeys: 'n8n-nodes-base.renameKeys',
    removeDuplicates: 'n8n-nodes-base.removeDuplicates',
    limit: 'n8n-nodes-base.limit',
    wait: 'n8n-nodes-base.wait',
    error: 'n8n-nodes-base.errorTrigger',
    stop: 'n8n-nodes-base.stop',
  },
} as const;

// Common field mappings
export const COMMON_FIELD_MAPPINGS = {
  // WordPress REST API
  wordpress: {
    title: 'title',
    content: 'content',
    excerpt: 'excerpt',
    status: 'status',
    author: 'author',
    categories: 'categories',
    tags: 'tags',
    meta: 'meta',
    featured_media: 'featured_media',
  },

  // Generic article
  article: {
    headline: 'title',
    body: 'content',
    summary: 'excerpt',
    author: 'author',
    date: 'date',
    source: 'source_url',
    tags: 'keywords',
  },

  // RSS feed item
  rss: {
    title: 'title',
    link: 'link',
    description: 'content',
    pubDate: 'date',
    creator: 'author',
    category: 'category',
    guid: 'id',
  },
} as const;
