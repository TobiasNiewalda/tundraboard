# TundraBoard

Task management and team collaboration API — the starter project for the **AI-Native Software Development** training programme.

## What is this?

TundraBoard is a realistic backend project that you will progressively build, refactor, and extend using AI-assisted development throughout the programme. It covers authentication, authorisation, CRUD operations, search, notifications, webhooks, and more.

**Built by:** TundraBoard Technologies Limited (fictional)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Framework | Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Testing | Vitest + Supertest |
| Linting | ESLint + Prettier |

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **PostgreSQL** (local install, Docker, or a free cloud tier like Supabase/Neon)
- **Git**

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd tundraboard

# 2. Install dependencies (respects the lockfile exactly)
npm ci

# 3. Check for known vulnerabilities and verify package signatures
npm audit
npm audit signatures

# 4. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# 5. Run database migrations
npm run db:migrate

# 6. Start the development server
npm run dev

# 7. Verify it works
curl http://localhost:3000/health
```

You should see:

```json
{ "status": "ok", "version": "1.0.0", "timestamp": "2026-..." }
```

### Using Docker for PostgreSQL

If you prefer Docker:

```bash
docker run -d \
  --name tundraboard-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tundraboard_dev \
  -p 5432:5432 \
  postgres:16
```

### Adding dependencies with native install scripts

This repo sets `ignore-scripts=true` in `.npmrc` to block postinstall execution during `npm ci`. Most packages work fine, but some native dependencies (e.g. `sharp`, `better-sqlite3`, `bcrypt`) require a build step that runs via install scripts. If you add such a package and get confusing runtime errors, run `npm rebuild` after install to trigger the build manually.

One known consequence: Prisma's postinstall (which generates the typed client into `node_modules/@prisma/client`) does not run automatically. Use `npm run db:generate` to generate it. `npm run db:migrate` and `npm run verify` both invoke it for you, so the typical workflow is unaffected.

## Project Structure

```
src/
  index.ts              # Server entry point
  app.ts                # Express app configuration
  middleware/
    authenticate.ts     # JWT authentication (TODO)
    errorHandler.ts     # Global error handler
  routes/
    health.ts           # Health check endpoint (implemented)
    auth.ts             # Authentication (TODO)
    workspaces.ts       # Workspace management (TODO)
    projects.ts         # Project management (TODO)
    tasks.ts            # Task CRUD (TODO)
    comments.ts         # Task comments (TODO)
    labels.ts           # Label management (TODO)
    notifications.ts    # User notifications (TODO)
    webhooks.ts         # Webhook management (TODO)
  services/             # Business logic (you will create these)
  types/
    express.d.ts        # Express type extensions
  utils/
    prisma.ts           # Prisma client instance
prisma/
  schema.prisma         # Database schema
tests/
  health.test.ts        # Example test
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run verify` | Run all checks (typecheck + lint + format + test) |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Generate Prisma client and run database migrations |

## Core Entities

| Entity | Description |
|--------|-------------|
| **users** | Team members with authentication credentials |
| **workspaces** | Team containers with role-based access (admin, member, viewer) |
| **projects** | Containers for tasks within a workspace |
| **tasks** | Work items with title, description, status, priority, assignee, due date |
| **comments** | Discussion threads on tasks |
| **labels** | Customisable tags for categorising tasks |
| **notifications** | In-app notifications for task changes, mentions, deadlines |
| **webhooks** | Outbound event delivery to external systems |
| **audit_log** | Immutable record of all user and system actions |
| **attachments** | Files attached to tasks |

## Branches

| Branch | Description | Used in |
|--------|-------------|---------|
| `main` | Clean TypeScript skeleton (this branch) | Module 1, 4, 5 |
| `module-2-legacy` | Deliberately messy JavaScript with anti-patterns | Module 2 |
| `module-3-planted-bugs` | Clean TypeScript with 9 planted security/logic bugs | Module 3 |
