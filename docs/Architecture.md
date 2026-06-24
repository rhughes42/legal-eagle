# Architecture Overview

## Request Flow

1. `main.ts` bootstraps NestJS, configures uploads, and exposes Swagger.
2. `AppModule` wires configuration, GraphQL, logging, and feature modules.
3. `DocumentResolver` handles GraphQL operations.
4. `DocumentService` performs validation, parsing, enrichment, and persistence.
5. `PrismaService` manages database access.

## Repository Layout

- `src/` — application code
- `prisma/` — schema, migrations, and seed scripts
- `scripts/` — operational helpers and CLI entry points
- `data/` — sample documents and seed fixtures
- `reviews/` — architecture and review notes

## Feature Areas

- Documents: upload, metadata parsing, search, and similarity
- Analytics: portfolio metrics and trends
- Common: logging, performance, and middleware utilities
