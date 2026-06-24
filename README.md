# LegalEagle API

LegalEagle is an AI-native NestJS service for ingesting, enriching, and querying legal documents.

## Onboarding Path

1. Start with [Getting Started](./docs/Getting-Started.md) for setup, configuration, and local development.
2. Read [Architecture Overview](./docs/Architecture.md) to understand the module layout and request flow.
3. Use [Data & Operations](./docs/Operations.md) for seeding, document workflows, deployment notes, and troubleshooting.
4. Review [Roadmap & Deep Dives](./docs/Roadmap.md) for current feature direction and implementation context.

## Core Capabilities

- GraphQL endpoints for uploading, listing, updating, and deleting legal documents.
- PDF and HTML parsing with OpenAI enrichment support.
- Prisma ORM with PostgreSQL migrations, seed data, and CLI helpers.
- Docker and Docker Compose support for local development.
- Centralised logging utilities, health checks, and Swagger documentation.

## Documentation Index

- [Getting Started](./docs/Getting-Started.md)
- [Architecture Overview](./docs/Architecture.md)
- [Data & Operations](./docs/Operations.md)
- [Roadmap & Deep Dives](./docs/Roadmap.md)
- [Implementation Reviews](./reviews/v0.0.1/review-summary.md)

## Quick Notes

- `OPENAI_API_KEY` enables the best metadata extraction and similarity results.
- `npm test` runs the Jest suite configured for the repository.
- `npm run check-ts-build` validates the TypeScript build without emitting files.
