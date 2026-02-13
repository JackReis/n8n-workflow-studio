/**
 * n8n Workflow Patterns
 * Pre-defined patterns for common workflow structures
 */

import { SkillPattern, SkillExample } from './types';

// ============================================
// TRIGGER PATTERNS
// ============================================

export const ScheduleTriggerPattern: SkillPattern = {
  id: 'trigger-schedule',
  name: 'Scheduled Execution',
  description: 'Run workflow on a schedule (cron)',
  category: 'trigger',
  nodeTypes: ['n8n-nodes-base.scheduleTrigger'],
  template: {
    nodes: [{
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [250, 300],
      parameters: {
        rule: { interval: [{ field: 'hours', hoursInterval: 1 }] }
      }
    }]
  },
  bestPractices: [
    'Use timezone setting for consistent execution times',
    'Consider rate limits of external APIs when setting frequency',
    'Add error handling for failed scheduled runs',
    'Use meaningful node names that describe the schedule'
  ],
  commonMistakes: [
    'Running too frequently without need',
    'Not handling timezone correctly',
    'Missing error notifications for silent failures'
  ],
  examples: []
};

export const WebhookTriggerPattern: SkillPattern = {
  id: 'trigger-webhook',
  name: 'Webhook Trigger',
  description: 'Start workflow when receiving HTTP request',
  category: 'trigger',
  nodeTypes: ['n8n-nodes-base.webhook'],
  template: {
    nodes: [{
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [250, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'webhook-path',
        responseMode: 'responseNode'
      },
      webhookId: 'auto-generate'
    }]
  },
  bestPractices: [
    'Always validate incoming data structure',
    'Use authentication for production webhooks',
    'Return meaningful response codes',
    'Log incoming requests for debugging'
  ],
  commonMistakes: [
    'Not validating input data',
    'Exposing webhook without authentication',
    'Not handling duplicate webhook calls'
  ],
  examples: []
};

export const RSSTriggerPattern: SkillPattern = {
  id: 'trigger-rss',
  name: 'RSS Feed Reader',
  description: 'Read and process RSS/Atom feeds',
  category: 'trigger',
  nodeTypes: ['n8n-nodes-base.rssFeedRead'],
  template: {
    nodes: [{
      name: 'RSS Feed',
      type: 'n8n-nodes-base.rssFeedRead',
      typeVersion: 1,
      position: [250, 300],
      parameters: {
        url: 'https://example.com/feed.xml',
        options: {}
      }
    }]
  },
  bestPractices: [
    'Cache processed items to avoid duplicates using a database or static data',
    'Handle feed parsing errors gracefully',
    'Set appropriate polling interval',
    'Extract and normalize content from different feed formats'
  ],
  commonMistakes: [
    'Not checking for duplicate items',
    'Processing all items every run instead of new ones only',
    'Not handling malformed RSS'
  ],
  examples: []
};

// ============================================
// DATA TRANSFORMATION PATTERNS
// ============================================

export const JSONExtractionPattern: SkillPattern = {
  id: 'transform-json-extract',
  name: 'JSON Field Extraction',
  description: 'Extract specific fields from JSON data',
  category: 'transform',
  nodeTypes: ['n8n-nodes-base.editFields', 'n8n-nodes-base.code'],
  template: {
    nodes: [{
      name: 'Extract Fields',
      type: 'n8n-nodes-base.editFields',
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        mode: 'manual',
        fields: []
      }
    }]
  },
  bestPractices: [
    'Use dot notation for nested fields (e.g., data.user.name)',
    'Handle missing fields with default values',
    'Validate field types before processing',
    'Document expected input/output structure'
  ],
  commonMistakes: [
    'Assuming fields always exist',
    'Not handling null/undefined values',
    'Hardcoding field names without flexibility'
  ],
  examples: []
};

export const DataDeduplicationPattern: SkillPattern = {
  id: 'transform-dedupe',
  name: 'Remove Duplicates',
  description: 'Filter out duplicate items based on a key',
  category: 'transform',
  nodeTypes: ['n8n-nodes-base.removeDuplicates', 'n8n-nodes-base.code'],
  template: {
    nodes: [{
      name: 'Remove Duplicates',
      type: 'n8n-nodes-base.removeDuplicates',
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        compare: 'selectedFields',
        fieldsToCompare: ['id']
      }
    }]
  },
  bestPractices: [
    'Choose a unique identifier field carefully',
    'Consider using hash of multiple fields if no single unique field',
    'Log removed duplicates for auditing',
    'Process in batches for large datasets'
  ],
  commonMistakes: [
    'Using non-unique field as deduplication key',
    'Not considering case sensitivity',
    'Memory issues with very large datasets'
  ],
  examples: []
};

// ============================================
// AI/LLM PATTERNS
// ============================================

export const StructuredOutputPattern: SkillPattern = {
  id: 'ai-structured-output',
  name: 'Structured AI Output',
  description: 'Get structured JSON output from LLM with validation',
  category: 'transform',
  nodeTypes: ['n8n-nodes-base.code', '@n8n/n8n-nodes-langchain.openAi'],
  template: {
    nodes: [
      {
        name: 'Prepare Prompt',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [450, 300],
        parameters: {
          assignments: {
            assignments: []
          }
        }
      },
      {
        name: 'AI Generation',
        type: '@n8n/n8n-nodes-langchain.openAi',
        typeVersion: 1,
        position: [650, 300],
        parameters: {
          model: 'gpt-4o',
          options: {
            responseFormat: 'json_object'
          }
        }
      },
      {
        name: 'Validate JSON',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [850, 300],
        parameters: {
          language: 'javaScript',
          code: `
// Validate and parse JSON response
const response = $input.first().json;
try {
  const parsed = JSON.parse(response.message?.content || response.content || '{}');

  // Required field validation
  const required = ['title', 'content']; // Adjust as needed
  const missing = required.filter(f => !parsed[f]);

  if (missing.length > 0) {
    throw new Error('Missing required fields: ' + missing.join(', '));
  }

  return { json: parsed };
} catch (e) {
  throw new Error('JSON validation failed: ' + e.message);
}
          `
        }
      }
    ]
  },
  bestPractices: [
    'Always use json_object response format when available',
    'Validate required fields immediately after generation',
    'Implement retry loop for invalid JSON',
    'Use clear schema descriptions in prompts',
    'Set temperature low (0-0.3) for structured output'
  ],
  commonMistakes: [
    'Not validating LLM output before using it',
    'Using high temperature for structured output',
    'Not handling partial or malformed JSON',
    'Skipping retry mechanism for failures'
  ],
  examples: [{
    name: 'Article Extraction',
    description: 'Extract structured article data from raw text',
    workflow: {},
    explanation: 'Use JSON schema in prompt to ensure consistent output format'
  }]
};

export const AIRepairLoopPattern: SkillPattern = {
  id: 'ai-repair-loop',
  name: 'AI Self-Repair Loop',
  description: 'Automatically fix invalid LLM output by retrying with error context',
  category: 'error',
  nodeTypes: ['n8n-nodes-base.code', 'n8n-nodes-base.if', '@n8n/n8n-nodes-langchain.openAi'],
  template: {
    nodes: [
      {
        name: 'Validate',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [450, 300],
        parameters: {}
      },
      {
        name: 'Is Valid?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [650, 300],
        parameters: {}
      },
      {
        name: 'Repair Prompt',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [850, 400],
        parameters: {}
      },
      {
        name: 'Retry AI',
        type: '@n8n/n8n-nodes-langchain.openAi',
        typeVersion: 1,
        position: [1050, 400],
        parameters: {}
      }
    ]
  },
  bestPractices: [
    'Limit retry attempts (3-5 max)',
    'Include previous output and error message in retry prompt',
    'Use different model or lower temperature for repair attempts',
    'Log all attempts for debugging',
    'Fall back to default/empty values after max retries'
  ],
  commonMistakes: [
    'Infinite retry loops',
    'Not including error context in retry',
    'Using same prompt for retry',
    'Not having fallback behavior'
  ],
  examples: []
};

// ============================================
// INTEGRATION PATTERNS
// ============================================

export const WordPressRESTPattern: SkillPattern = {
  id: 'integration-wordpress',
  name: 'WordPress REST API',
  description: 'Create/update WordPress posts via REST API',
  category: 'integration',
  nodeTypes: ['n8n-nodes-base.httpRequest'],
  template: {
    nodes: [{
      name: 'Create WordPress Post',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [850, 300],
      parameters: {
        method: 'POST',
        url: 'https://example.com/wp-json/wp/v2/posts',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBasicAuth',
        sendBody: true,
        bodyParameters: {
          parameters: [
            { name: 'title', value: '={{ $json.title }}' },
            { name: 'content', value: '={{ $json.content }}' },
            { name: 'status', value: 'draft' },
            { name: 'meta', value: '={{ $json.meta }}' }
          ]
        }
      },
      credentials: {
        httpBasicAuth: { id: 'wordpress-creds', name: 'WordPress' }
      }
    }]
  },
  bestPractices: [
    'Use Application Passwords for authentication',
    'Create posts as draft first, validate, then publish',
    'Handle taxonomy term creation/lookup before post creation',
    'Include proper error handling for API failures',
    'Set featured media separately if needed'
  ],
  commonMistakes: [
    'Publishing directly without validation',
    'Not handling taxonomy resolution',
    'Missing meta field registration in WordPress',
    'Not using proper content encoding'
  ],
  examples: [{
    name: 'Create Draft Post with Meta',
    description: 'Create WordPress post with custom meta fields',
    workflow: {},
    explanation: 'First resolve taxonomies, then create post with all fields'
  }]
};

export const SlackNotificationPattern: SkillPattern = {
  id: 'integration-slack',
  name: 'Slack Notification',
  description: 'Send formatted notifications to Slack',
  category: 'output',
  nodeTypes: ['n8n-nodes-base.slack'],
  template: {
    nodes: [{
      name: 'Send to Slack',
      type: 'n8n-nodes-base.slack',
      typeVersion: 1,
      position: [850, 300],
      parameters: {
        channel: '#notifications',
        text: '={{ $json.message }}',
        otherOptions: {}
      }
    }]
  },
  bestPractices: [
    'Use Block Kit for rich formatting',
    'Include relevant links and context',
    'Rate limit notifications to prevent spam',
    'Use different channels for different severity levels'
  ],
  commonMistakes: [
    'Sending too many notifications',
    'Not formatting messages for readability',
    'Missing context in notifications'
  ],
  examples: []
};

// ============================================
// ERROR HANDLING PATTERNS
// ============================================

export const ErrorHandlingPattern: SkillPattern = {
  id: 'error-handling',
  name: 'Error Handler',
  description: 'Graceful error handling with notifications',
  category: 'error',
  nodeTypes: ['n8n-nodes-base.errorTrigger', 'n8n-nodes-base.slack'],
  template: {
    nodes: [
      {
        name: 'Error Trigger',
        type: 'n8n-nodes-base.errorTrigger',
        typeVersion: 1,
        position: [250, 500],
        parameters: {}
      },
      {
        name: 'Format Error',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [450, 500],
        parameters: {
          assignments: {
            assignments: [
              { name: 'error', value: '={{ $json.message }}' },
              { name: 'node', value: '={{ $json.execution.mode }}' },
              { name: 'timestamp', value: '={{ $now.toISO() }}' }
            ]
          }
        }
      }
    ]
  },
  bestPractices: [
    'Log all errors with context',
    'Send notifications for critical failures',
    'Implement retry with exponential backoff',
    'Have fallback behavior for each critical node'
  ],
  commonMistakes: [
    'Silent failures without logging',
    'Notifying on every minor error',
    'No retry mechanism'
  ],
  examples: []
};

// ============================================
// ALL PATTERNS EXPORT
// ============================================

export const ALL_PATTERNS: SkillPattern[] = [
  ScheduleTriggerPattern,
  WebhookTriggerPattern,
  RSSTriggerPattern,
  JSONExtractionPattern,
  DataDeduplicationPattern,
  StructuredOutputPattern,
  AIRepairLoopPattern,
  WordPressRESTPattern,
  SlackNotificationPattern,
  ErrorHandlingPattern,
];

// Pattern lookup by ID
export const PATTERN_MAP = new Map(
  ALL_PATTERNS.map(p => [p.id, p])
);

// Get patterns by category
export function getPatternsByCategory(category: SkillPattern['category']): SkillPattern[] {
  return ALL_PATTERNS.filter(p => p.category === category);
}

// Get patterns by node type
export function getPatternsByNodeType(nodeType: string): SkillPattern[] {
  return ALL_PATTERNS.filter(p => p.nodeTypes.includes(nodeType));
}
