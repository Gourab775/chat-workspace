# Embeddable Chat Workspace

Embeddable chat workspace for any website — one script tag adds a floating widget that understands page context and connects to your backend services via structured tool calling.

**Live Demo:** https://chat-workspace.vercel.app

**Category:** Chat / Embedded Workspace
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Workflow Engine
**Language:** TypeScript

## Overview

Embeddable Chat Workspace is a full-stack chat platform designed for drop-in integration on any website. It combines page-context awareness with backend service connectivity, enabling visitors to get contextual answers and trigger business operations without leaving the page. A single script tag deploys the floating widget and iframe-based workspace with configurable theming and position.

## Features

- **One-Line Embed** — Add `<script src=".../embed.js">` to any site to render a floating chat bubble and workspace. No backend changes required for basic page-context mode.
- **Page Context Awareness** — The workspace automatically extracts current page content via `embed.js` and provides it as context for service responses.
- **Business Service Integration** — Connect your REST services via `api-schema.json` and `DATA_API_BASE_URL` for real-time queries through structured tool calling.
- **Customizable Widget** — Configure accent color and corner position via `data-color` and `data-position` attributes; reusable configuration in workspace config.
- **Persistent Configuration** — Centralized config for workspace name, welcome message, system prompt, and suggested questions.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript, Tailwind CSS, tailwind-merge, clsx |
| Workflow Engine | Workflow Engine (session-based workspace services) |
| Markdown & Rendering | marked, @tailwindcss/typography |
| Observability | OpenTelemetry API |

## Project Structure

```
.
├── services/
│   ├── chat/                     # Core workspace service — handles widget conversations
│   ├── widget/                   # Widget service — serves iframe workspace
│   └── _shared.ts                # Service initialization and helpers
├── app/
│   ├── widget/page.tsx           # Widget iframe UI
│   ├── page.tsx                  # Main site / demo page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── public/
│   └── embed.js                  # Embed script — injects floating bubble + iframe
├── lib/                          # Shared utilities
├── workspace.config.json         # Workspace name, welcome, system prompt, suggestions
├── api-schema.example.json       # Example tool definitions for business services
├── edgeone.json                  # Deployment configuration
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json
```

> Note: Source directory is `services/` in documentation. Runtime keeps `agents/` as an alias for backward compatibility where applicable. Config file shown as `workspace.config.json` for professional naming; original file retained for compatibility.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
cp .env.example .env
# Edit .env with your service credentials (see Environment Variables)
npm run dev
```

Open http://localhost:3000 for the main site and http://localhost:3000/widget for the workspace iframe.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVICE_API_KEY` | Yes* | Platform service API key (Open-Compatible provider key). |
| `SERVICE_BASE_URL` | Yes* | Gateway base URL, e.g. `https://gateway.edgeone.link/v1`. |
| `SERVICE_MODEL` | No | Model identifier. Defaults to `@makers/deepseek-v3`. |
| `DATA_API_BASE_URL` | No | Your backend API base URL for business service integration. |
| `DATA_API_KEY` | No | Auth token for your backend API. |

\* Automatically injected when deploying via EdgeOne Makers one-click deploy. For local development, set manually.

> Alias: `SERVICE_*` is the canonical naming in this workspace. `SERVICE_API_KEY`, `SERVICE_BASE_URL`, and `SERVICE_MODEL` are aliases for `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, and `AI_GATEWAY_MODEL` for backward compatibility. Either naming works; prefer `SERVICE_*` for new deployments.

### Embed on Your Website

```html
<script src="https://your-workspace.edgeone.app/embed.js" async></script>
```

A floating chat bubble appears in the bottom corner. Clicking it opens the iframe workspace.

**Customization:**

```html
<script
  src="https://your-workspace.edgeone.app/embed.js"
  data-color="#10b981"
  data-position="bottom-left"
  async>
</script>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-color` | `#6366f1` | Accent color (bubble, buttons, avatar) |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |

### Configuration

Edit workspace config:

```json
{
  "name": "Chat Workspace",
  "welcome": "Hi! How can I help you?",
  "systemPrompt": "You are a helpful workspace assistant.",
  "suggestedQuestions": ["What is this page about?"]
}
```

### Business Service Integration

Place an `api-schema.json` in the project root to enable workspace queries to your backend:

```json
{
  "tools": [
    {
      "name": "search_posts",
      "description": "Search blog posts by keyword",
      "endpoint": "GET /api/posts",
      "parameters": {
        "q": { "type": "string", "description": "Search keyword" }
      }
    }
  ]
}
```

Set `DATA_API_BASE_URL` to your backend address.

## Deployment

This project uses `edgeone.json` for EdgeOne Makers deployment:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

**Options:**

- **Vercel:** Import the repository, set `SERVICE_API_KEY` and `SERVICE_BASE_URL` in Environment Variables, framework Next.js, deploy.
- **Netlify:** Build command `npm run build`, publish `.next` (with Next.js plugin), add the same env vars.
- **GitHub Pages (static export):** Configure `next.config.mjs` with `output: 'export'` and publish `out/` via Actions for static site. For workspace services, use Vercel/EdgeOne/Netlify Functions.

## Customization

- **Workspace Branding:** Update workspace config for name, welcome text, and suggested questions; adjust widget colors via `data-color`.
- **System Prompt:** Edit `systemPrompt` in the config file to set tone and behavior for service responses.
- **UI / Theme:** Modify `app/widget/page.tsx`, `app/globals.css`, and `tailwind.config.ts`.
- **Embed Script:** Customize `public/embed.js` for bubble icon, position logic, or iframe handling.
- **Service Logic:** Update handlers under `services/` to extend routing, tool calling, or session handling.

## License

MIT
