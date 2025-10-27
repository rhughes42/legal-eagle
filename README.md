# LegalEagle API

LegalEagle is a NestJS service for ingesting, enriching, and querying legal documents. It provides a GraphQL API for uploads and metadata management, Prisma/PostgreSQL for persistence, optional OpenAI-powered extraction, and a small REST surface for health checks and (WIP) Swagger documentation.

## Core Capabilities

- GraphQL endpoints for uploading, listing, updating, and deleting legal documents.
- PDF and HTML parsing with optional OpenAI structured output enrichment.
- Prisma ORM with PostgreSQL migrations, seed data, and CLI helpers.
- Production-ready Docker/Docker Compose configuration with Postgres.
- Centralised logging utilities, health overview, and auto-generated Swagger docs.

## Architecture at a Glance

1. `main.ts` bootstraps NestJS, registers multipart upload limits (10 MB per file, 5 files per request), and serves Swagger at `/docs`.
2. `AppModule` wires configuration, Apollo GraphQL (code-first schema), logging, and the documents feature module.
3. GraphQL requests hit `DocumentResolver`, which delegates to `DocumentService` for validation, file handling, enrichment, and persistence.
4. `DocumentService` stores data via `PrismaService` and, when `OPENAI_API_KEY` is configured, calls the OpenAI Responses API for structured metadata.
5. Prisma migrations keep the Postgres schema in sync; optional seed scripts populate demo records.

## Repository Layout

``` markdown
app/
├─ src/
│  ├─ main.ts                # Application bootstrap, uploads, Swagger
│  ├─ app.module.ts          # Root NestJS module
│  ├─ app.controller.ts/.service.ts  # Health + service overview endpoints
│  ├─ documents/             # GraphQL types, resolver, and document pipeline
│  ├─ common/                # Logger helpers, performance utilities
│  └─ prisma/prisma.service.ts       # Prisma client wrapper
├─ prisma/
│  ├─ schema.prisma          # Postgres data model
│  └─ seed.ts                # Interactive/dry-run seeding script
├─ scripts/
│  ├─ wait-for-db.sh         # pg_isready loop used during container startup
│  └─ check-seed.ts          # CLI check to ensure the DB has documents
├─ data/                     # Sample PDFs/HTML plus JSON/SQL seed sources
├─ Dockerfile                # Multi-stage build (Node 20 + Prisma runtime deps)
└─ docker-compose.yml        # App + Postgres stack for local testing
```

## Prerequisites

- **Node.js 20** (see `.nvmrc`); npm 10+ recommended.
- **PostgreSQL 16** (local install or containers). Default port is 5432.
- **Docker & Docker Compose** *(optional but recommended for local DB/testing)*.
- **OpenAI API key** *(optional)* for automated metadata enrichment.
- macOS/Linux/WSL/Windows are supported; the repository ships PowerShell- and POSIX-friendly scripts.

## Configuration

Create your `.env` by copying `.env.example` and updating the values that matter for your environment:

```powershell
cp .env.example .env
```

Key variables:

| Name | Required | Purpose |
| ---- | -------- | ------- |
| `DATABASE_URL` | ✅ | Prisma connection string (e.g. `postgresql://postgres:postgres@localhost:5432/database?schema=public`). |
| `NODE_ENV` | ✅ | `development` or `production`; controls GraphQL Playground/introspection. |
| `PORT` | ➖ | HTTP port (defaults to `3000`). |
| `OPENAI_API_KEY` | ➖ | Enables OpenAI enrichment for uploaded content. Without it, uploads still succeed but enrichment is skipped. |
| `OPENAI_CHAT_MODEL` / `MODEL_PRIMARY` | ➖ | Overrides the OpenAI model (default: `gpt-5-mini`). |
| `OPENAI_EMBEDDING_MODEL` | ➖ | Reserved for embedding workflows; only read when set. |

> Never commit populated `.env` files. Keep secrets local or in your secrets manager.

## Getting Started

### Option A — Local Node.js with Dockerised Postgres (fastest for development)

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set at least `DATABASE_URL`.

3. **Start the database and wait for it to stabilize:**

   ```powershell
   # Start only the database container
   docker compose up -d db
   ```

   **Important:** Wait for the database to fully initialize before proceeding. The included `scripts/wait-for-db.sh` script can help verify readiness:

   ```powershell
   # Wait for database to be ready (optional verification)
   bash scripts/wait-for-db.sh
   ```

4. Apply database schema and generate the Prisma client:

   ```powershell
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Seed sample data (includes automatic database provisioning):**

   When the database is first provisioned, it includes a seeding procedure that populates demo data:

   ```powershell
   npm run seed -- --force
   ```

6. **Start the API in watch mode (ensure database is running first):**

   ```powershell
   npm run start:dev
   ```

   **Note:** Always ensure the database is running (`docker compose up -d db`) and stable before starting the development server.

7. Visit the running services:
   - GraphQL Playground: `http://localhost:3000/graphql`
   - Swagger UI (REST overview): `http://localhost:3000/docs`
   - Health check: `http://localhost:3000/`

Stop Postgres when you're done:

```powershell
npm run db:down
```

### Option B — Docker Compose (runs app + Postgres)

```powershell
docker compose up --build
```

The Compose file waits for Postgres to become healthy, runs `prisma migrate deploy`, and then starts the compiled app (`dist/main.js`). Override `.env` or Compose environment values to change secrets or ports. Use `docker compose down` to stop the stack, and add `-d` to run detached.

### Option C — Existing Postgres Instance

If you already have a database:

1. Ensure `DATABASE_URL` points to it.
2. Run `npm run prisma:generate` and `npm run prisma:migrate`.
3. Start the server with `npm run start:dev` (development) or `npm run start:prod` (after `npm run build`).

## Database & Seeding Cheatsheet

**Database Provisioning & Seeding:**
When the database is first provisioned, a seeding procedure automatically populates it with demo data from `data/seed-documents.json` or `.sql` files. This ensures you have sample legal documents to work with immediately.

**Common Commands:**

- `npm run prisma:generate` — regenerate the Prisma client after schema updates.
- `npm run prisma:migrate` — run `prisma migrate dev` with a new migration when schema changes.
- `npx prisma migrate deploy` — apply migrations in CI/production environments.
- `npm run prisma:studio` — open Prisma Studio to inspect/edit data.
- `npm run seed [-- <flags>]` — import demo data from `data/seed-documents.json` or `.sql`. Use `--dry-run`, `--force`, or `--upsert` as needed.
- `npm run test:seed` — run the seed verification script (`scripts/check-seed.ts`); exits with code 0 when documents exist.
- `npm run parse-metadata [-- <flags>]` — parse and clean document metadata, converting structured key-value pairs to clean JSON objects. Use `--dry-run` to preview changes, `--document-id=<id>` to process a single document.

**Database Startup Order:**

1. Start database: `docker compose up -d db`
2. Wait for stability: `bash scripts/wait-for-db.sh` (ensures database is ready)
3. Run migrations: `npm run prisma:migrate`
4. Seed data: `npm run seed -- --force`
5. Start application: `npm run start:dev`

## Working with Documents

Use GraphQL Playground/Apollo Sandbox or any GraphQL client.

**List all documents:**

```graphql
query {
  documents {
    id
    fileName
    title
    summary
    updatedAt
  }
}
```

**Get a single document by ID:**

```graphql
query GetDocument($id: Int!) {
  document(id: $id) {
    id
    fileName
    title
    summary
    date
    court
    caseNumber
    caseType
    area
    areaData
    metadata
    createdAt
    updatedAt
  }
}
```

Variables for the single document query:

```json
{
  "id": 1
}
```

Upload a PDF or HTML document with optional metadata:

```graphql
mutation UploadDocument($file: Upload!, $title: String) {
  uploadDocument(file: $file, title: $title) {
    id
    title
    caseNumber
    summary
    metadata
  }
}
```

Example `curl` (PowerShell on Windows) using the provided sample PDF:

```powershell
curl.exe -X POST http://localhost:3000/graphql `
  -H "Apollo-Require-Preflight: true" `
  -F 'operations={"query":"mutation($file: Upload!){ uploadDocument(file:$file){ id fileName title summary } }","variables":{"file":null}}' `
  -F 'map={"0":["variables.file"]}' `
  -F '0=@D:\Repos\Active\Client\legal-eagle\app\data\curia-1.pdf;type=application/pdf'
```

**Parse document metadata:**

```graphql
# Parse metadata for a single document
mutation ParseDocumentMetadata($id: Int!, $dryRun: Boolean) {
  parseDocumentMetadata(id: $id, dryRun: $dryRun)
}

# Parse metadata for all documents (with optional filters)
mutation ParseAllDocumentsMetadata($dryRun: Boolean, $limit: Int) {
  parseAllDocumentsMetadata(dryRun: $dryRun, limit: $limit)
}
```

Variables for metadata parsing:

```json
{
  "id": 82,
  "dryRun": true
}
```

The metadata parsing operations convert structured key-value pairs in `areaData` and `metadata` fields from their JSON string array format to clean, flat JSON objects. For example:

**Before parsing:**

```json
"areaData": "[{\"key\":\"parties\",\"value\":\"Agencia Estatal v VT\"},{\"key\":\"referringCourt\",\"value\":\"Juzgado de lo Mercantil No 3\"}]"
```

**After parsing:**

```json
"areaData": "{\"parties\":\"Agencia Estatal v VT\",\"referringCourt\":\"Juzgado de lo Mercantil No 3\"}"
```

`DocumentService` accepts PDFs or HTML uploads. It normalises the file stream into text, merges any user-supplied metadata, optionally invokes OpenAI for structured extraction, and persists the record via Prisma.

## Testing & Quality Checks

- `npm test` — Jest unit/integration tests (requires a reachable database; use `npm run db:up`).
- `npm run test:e2e` — end-to-end pipeline tests.
- `npm run test:cov` — code coverage.
- `npm run lint` — ESLint with auto-fix.
- `npm run check-ts-build` — type-check without emitting output.

## Deployment Notes

- The Dockerfile builds the TypeScript sources (`npm run build`) and produces a minimal Node 20 Alpine runtime image with Prisma binary dependencies.
- `scripts/wait-for-db.sh` is available if you need to guard migrations while orchestrating services manually.
- `OPENAI_API_KEY` should be supplied via environment variables or secrets in production. Without it, OpenAI-dependent behaviour is skipped gracefully.

## Caveats & Known Limitations

- **Database readiness**: **Critical for development workflow** — when using Docker Compose, always run `docker compose up -d db` and wait for the database to stabilize before starting the development server with `npm run start:dev`. The `scripts/wait-for-db.sh` script helps verify database readiness and prevents race conditions.
- **Supported upload types**: only `.pdf` and `.html` are parsed. Other MIME types trigger an `UnsupportedMediaTypeException`.
- **Upload limits**: GraphQL uploads are capped at 10 MB per file and 5 files per request (configured in `main.ts`).
- **OpenAI enrichment**: requires `OPENAI_API_KEY`. Responses add latency and incur costs; logs show detailed usage when available.
- **Seed script prompts**: `npm run seed` is interactive. For non-interactive environments (CI, Docker), pass `--force`.
- **ESM/CJS compatibility**: the project targets CommonJS; dependencies like `graphql-upload-ts` are pinned to CJS-compatible releases.

## Troubleshooting Tips

- Prisma errors mentioning `getaddrinfo ENOTFOUND` usually mean `DATABASE_URL` points to an unavailable host or container.
- If GraphQL Playground is disabled, verify `NODE_ENV !== 'production'` or enable Apollo Sandbox via custom tooling.
- For OpenAI failures, check logs for detailed error output and confirm `OPENAI_CHAT_MODEL` names align with your account access.

Happy building!
