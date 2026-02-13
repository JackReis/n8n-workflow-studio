# Security Policy

## Overview

The n8n Workflow JSON Studio follows a **BYOK (Bring Your Own Key)** model. This document outlines our security practices and privacy guarantees.

---

## API Key Handling

### Core Principles

1. **NEVER stored on the server** - API keys are not persisted in any database, file, or cache
2. **NEVER logged** - Keys are never written to application logs, error reports, or telemetry
3. **Transmitted via HTTPS only** - All API communications use TLS encryption
4. **Browser-only storage (optional)** - Users can choose to save keys in localStorage for convenience

### Key Lifecycle

```
User enters key in UI
       |
       v
Key held in React state (memory only)
       |
       v
Request sent to /api/* endpoint
       |
       v
Server uses key for single API call
       |
       v
Key discarded immediately after response
       |
       v
Response returned to client
```

### Storage Options (Client-Side Only)

| Option | Location | Persistence | Security |
|--------|----------|-------------|----------|
| Session Only | React state | Tab close = gone | Most secure |
| Remember Me | localStorage | Until cleared | Convenient but less secure |

### Clear Keys Feature

Users can clear all stored keys via:
- Settings page "Clear All Keys" button
- Browser dev tools (localStorage.clear())

---

## Data Privacy

### What We DON'T Store

| Data Type | Server Storage | Logging |
|-----------|----------------|---------|
| API Keys | Never | Never |
| Workflow JSON | Never | Never |
| User Prompts | Never | Never |
| LLM Responses | Never | Never |
| Validation Results | Never | Never |

### What We DO Store (Client-Side Only)

| Data Type | Location | Purpose |
|-----------|----------|---------|
| History (last 20) | localStorage | User convenience |
| Settings preferences | localStorage | User preferences |
| API Keys (optional) | localStorage | "Remember me" feature |

### No Telemetry

- No analytics on workflow content
- No tracking of user prompts
- No usage statistics sent to external services
- No third-party scripts that track user behavior

---

## Server-Side Security

### Request Handling

```typescript
// API route example
export async function POST(request: Request) {
  const { apiKey, workflow, provider } = await request.json();

  // API key is used immediately, never stored
  const result = await callLLM({ apiKey, workflow, provider });

  // No logging of sensitive data
  // No persistence of any kind

  return Response.json(result);
}
```

### Headers

All responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### CORS Policy

- Strict origin checking
- Credentials allowed only from same origin
- No wildcard (*) origins in production

---

## Client-Side Security

### Input Validation

- JSON syntax validation before sending to server
- Schema validation on client to reduce unnecessary API calls
- Input sanitization for prompt text

### XSS Prevention

- React's built-in escaping for all user content
- Monaco editor sandboxed from page context
- All user content is treated as text, never rendered as HTML

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://api.openai.com https://api.z.ai https://generativelanguage.googleapis.com https://openrouter.ai https://api.groq.com;
```

---

## Best Practices for Users

### API Key Security

1. **Use dedicated keys** - Create separate API keys for this tool
2. **Rotate regularly** - Change keys periodically
3. **Monitor usage** - Check provider dashboards for unusual activity
4. **Don't share** - Never share keys or use in shared environments

### Workflow Privacy

1. **Review before upload** - Ensure workflows don't contain sensitive data
2. **Sanitize credentials** - Remove API keys, passwords from workflows before upload
3. **Use local development** - For highly sensitive workflows, run locally

### Browser Security

1. **Use HTTPS** - Always access via HTTPS in production
2. **Clear on shared devices** - Use "Clear Keys" after use
3. **Private browsing** - Consider incognito mode for extra privacy

---

## Security Checklist

Before deploying to production:

- [ ] All API routes validate input with Zod
- [ ] No console.log of sensitive data
- [ ] No API keys in environment variables (BYOK only)
- [ ] CORS configured for production domain only
- [ ] CSP headers configured
- [ ] No third-party tracking scripts
- [ ] HTTPS enforced
- [ ] Error messages don't leak sensitive info

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email: tncrtimur@gmail.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security FAQ

**Q: Can you see my workflow JSON?**
A: No. Workflows are processed in real-time and never stored.

**Q: What happens to my API key?**
A: It's used for a single API call, then discarded immediately.

**Q: Is my data encrypted?**
A: Yes, all communications use HTTPS/TLS encryption.

**Q: Do you have access to my LLM conversations?**
A: No. The LLM provider handles that directly. We just route the request.

**Q: Can I use this in an air-gapped environment?**
A: No, internet access is required to reach LLM provider APIs.

**Q: What if I accidentally paste a key with sensitive data?**
A: Use "Clear All Keys" immediately. The key was never stored server-side.
