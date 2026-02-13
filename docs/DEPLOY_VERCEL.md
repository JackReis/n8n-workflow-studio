# Vercel Deployment Guide

This guide walks you through deploying the n8n Workflow JSON Studio to Vercel.

---

## Prerequisites

- A [Vercel account](https://vercel.com) (free tier works)
- A [GitHub account](https://github.com) for repository hosting
- (Optional) A custom domain

---

## Quick Deploy

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/n8n-workflow-studio)

### Option 2: Manual Deploy

---

## Step-by-Step Guide

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/yourusername/n8n-workflow-studio.git

# Push to GitHub
git push -u origin main
```

### Step 2: Import in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." -> "Project"
3. Select "Import Git Repository"
4. Find and select your repository
5. Click "Import"

### Step 3: Configure Build Settings

Vercel auto-detects Next.js. Default settings should work:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |

Click "Deploy".

### Step 4: Wait for Deployment

- Build typically takes 1-2 minutes
- You'll see build logs in real-time
- Once complete, you'll get a deployment URL

---

## Environment Variables

**Good news: No environment variables required!**

This app uses the BYOK (Bring Your Own Key) model:

- Users provide their own API keys through the UI
- Keys are never stored server-side
- No `.env` configuration needed for deployment

---

## Custom Domain Setup

### Step 1: Add Domain

1. Go to your project in Vercel dashboard
2. Click "Settings" -> "Domains"
3. Enter your domain name
4. Click "Add"

### Step 2: Configure DNS

Vercel will show DNS configuration instructions. Typically:

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

Or use Vercel's nameservers for full DNS management.

### Step 3: Enable HTTPS

- HTTPS is automatically enabled via Let's Encrypt
- Certificates auto-renew
- No manual configuration needed

---

## Configuration Options

### vercel.json (Optional)

Create `vercel.json` in project root for advanced configuration:

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### API Route Limits (Free Tier)

| Metric | Limit |
|--------|-------|
| Function Duration | 10 seconds |
| Response Size | 4.5 MB |
| Memory | 1024 MB |

For production workloads, consider upgrading to Pro tier.

---

## Monitoring

### Vercel Analytics

Enable in project settings:

1. Go to "Analytics" tab
2. Click "Enable Analytics"
3. View usage metrics, performance data

### Logging

View real-time logs:

1. Go to "Deployments" tab
2. Click on a deployment
3. Click "Functions" -> "Logs"

---

## Troubleshooting

### Build Failures

**Error: `next` not found**
```bash
# Ensure next is in dependencies
npm install next react react-dom
```

**Error: Module not found**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Runtime Errors

**Error: API route timeout**
- Free tier has 10-second limit
- Consider optimizing LLM calls or upgrading

**Error: CORS blocked**
- Check that API routes return proper CORS headers
- Ensure frontend URL matches deployed domain

### Domain Issues

**DNS not propagating**
- Wait up to 48 hours for full propagation
- Use `dig yourdomain.com` to check

**Certificate pending**
- Usually resolves within minutes
- Ensure DNS is correctly configured

---

## Performance Optimization

### Edge Functions (Optional)

Move API routes to edge for faster response:

```typescript
// app/api/validate/route.ts
export const runtime = 'edge';

export async function POST(request: Request) {
  // ... validation logic
}
```

### Caching

Enable caching for static assets:

```javascript
// next.config.js
module.exports = {
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
};
```

---

## Production Checklist

Before going live:

- [ ] Custom domain configured
- [ ] HTTPS enabled (automatic)
- [ ] Security headers set
- [ ] Error pages customized
- [ ] Analytics enabled (optional)
- [ ] Rate limiting considered
- [ ] Monitoring set up

---

## CI/CD Integration

### GitHub Actions (Automatic)

Vercel automatically deploys on push to main:

1. Push changes to GitHub
2. Vercel detects changes
3. New deployment starts automatically
4. Preview URLs for PRs

### Preview Deployments

Every pull request gets a preview URL:

```
https://n8n-workflow-studio-abc123.vercel.app
```

Great for testing before merging.

---

## Cost Estimation

### Free Tier Limits

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Serverless Function Executions | 100 GB-Hrs |
| Edge Requests | Unlimited |

### Typical Usage

For a portfolio/demo site:
- Should stay well within free tier
- BYOK model means no API costs on Vercel side

---

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Status](https://www.vercel-status.com)

For project-specific issues: tncrtimur@gmail.com
