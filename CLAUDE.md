# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Social Media Agent is a multi-platform social media automation system built on Cloudflare Workers. It supports dual execution paths: cloud-run automation (Apify/Playwright) and user-run automation (Chrome extension in authenticated browser sessions). Target platforms: LinkedIn, X, Facebook, Instagram, TikTok, Xiaohongshu.

## Build & Development Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages and apps
pnpm test             # Run all tests
pnpm dev              # Run all dev servers in parallel
pnpm build:workers    # Build only Cloudflare workers
pnpm build:extension  # Build only Chrome extension
```

### Local Development

```bash
./scripts/dev.sh              # Start all workers locally
./scripts/dev.sh api          # Start only api-worker
./scripts/dev.sh orchestrator # Start only orchestrator-worker
./scripts/dev.sh stop         # Stop all workers
```

Worker ports: api-worker `:8787`, orchestrator-worker `:8788`, scheduler-worker `:8789`

### Deployment

```bash
./scripts/deploy.sh           # Full deployment to Cloudflare
./scripts/deploy.sh --skip-db # Skip database creation (if already exists)
```

### Database Setup

```bash
# Local
npx wrangler d1 execute social_agent_db --local --file=apps/api-worker/src/db/migrations/0001_init.sql

# Remote
npx wrangler d1 execute social_agent_db --remote --file=apps/api-worker/src/db/migrations/0001_init.sql
```

## Architecture

### Control Plane (Cloudflare)
- **api-worker**: REST API gateway, handles auth, routes, request validation
- **orchestrator-worker**: Workflow execution via RunDO Durable Object, manages state machine
- **scheduler-worker**: Cron-triggered scheduled job execution

### Data Plane (Executors)
- **API Executor**: Official platform API calls
- **Cloud Browser Executor**: Apify Actors / Cloudflare Browser Rendering
- **Extension Executor**: Chrome extension in user's authenticated session

### Key Packages
- **@social-agent/schemas**: Zod schemas for Platform, Action, Workflow, Trace, Policy
- **@social-agent/workflow-core**: BubbleLab-inspired workflow runtime with typed nodes
- **@social-agent/executors**: Executor interface and routing logic
- **@social-agent/adapters**: Per-platform adapters with capabilities and step DSL templates
- **@social-agent/policy**: Policy engine, quotas, content linting
- **@social-agent/observability**: Trace emitter, structured logging

### Workflow Execution Flow
1. API worker receives workflow run request
2. Orchestrator's RunDO executes nodes in topological order
3. Nodes can throw `NeedsApprovalError` to pause for human approval
4. Action nodes dispatch to executors via `chooseMode()` routing
5. Extension polls `/extension/poll`, executes step DSL, returns results
6. RunDO resumes and completes workflow

### Step DSL
Platform adapters define automation steps in JSON:
- Located at `packages/adapters/src/{platform}/steps/*.json`
- Selectors versioned at `packages/adapters/src/{platform}/selectors/*.json`
- Same DSL runs in both extension content scripts and Apify Playwright actors

## Key Interfaces

**Node interface** (`packages/workflow-core/src/runtime/node.ts`):
```ts
interface Node<I, O> {
  type: string;
  run: (ctx: NodeContext, input: I) => Promise<O> | O;
}
```

**PlatformAdapter** (`packages/adapters/src/adapter.ts`):
```ts
interface PlatformAdapter {
  platform: string;
  capabilities(): Capability;
  buildAction(req: ActionRequest): Promise<{...}>;
}
```

**Execution mode routing** (`packages/executors/src/router.ts`): `chooseMode(req)` selects execution path based on adapter capabilities.

## Design Principles

- Prefer official APIs when available; UI automation is a consented fallback
- Actions should be idempotent where possible
- LinkedIn DMs require explicit user confirmation in extension UI
- Never store raw cookies or passwords; tokens are encrypted via Cloudflare secrets
- All actions emit trace events with correlation IDs

## Reference Documentation

Detailed design: `docs/social_media_agent_design.md`
Full blueprint: `docs/social_media_agent_full_blueprint.md`
Implementation scaffold: `docs/social_media_agent_implementation_scaffold.md`
