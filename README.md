# Pandektes — LegalEagle (NestJS)

Lightweight NestJS starter customized for the Pandektes LegalEagle challenge. This project shows a typical backend setup: NestJS + TypeScript, Prisma for database access, PostgreSQL as the primary datastore, Docker for local containers, and integrations with external services (for example OpenAI keys kept out of source control).

Table of Contents

- [Pandektes — LegalEagle (NestJS)](#pandektes--legaleagle-nestjs)
  - [Features](#features)
  - [Tech stack](#tech-stack)
  - [Quick start](#quick-start)
  - [Environment variables](#environment-variables)
  - [Development](#development)
  - [Database (Prisma)](#database-prisma)
  - [Docker](#docker)
  - [Tests](#tests)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- NestJS application scaffolded with TypeScript
- Prisma ORM + migrations configured for PostgreSQL
- Docker Compose for local DB and app orchestration
- Example endpoints and basic tests

## Tech stack

- Node.js + NestJS
- TypeScript
- Prisma (ORM)
- PostgreSQL
- Docker + Docker Compose
- OpenAI (optional integration — keep keys in environment variables)

## Quick start

Prerequisites:

- Node 18+ and npm
- Docker & Docker Compose (recommended for running PostgreSQL locally)

Install dependencies:

```bash
npm install
```

Create a copy of the example environment file and update values:

```bash
cp .env.example .env
# then edit .env to set DATABASE_URL and OPENAI_API_KEY
```

Start the database and app (development):

```bash
# using npm
npm run start:dev

# or using Docker Compose (if you prefer containers)
docker compose up --build
```

## Environment variables

Keep secrets out of version control. Typical variables (see `.env.example`):

- DATABASE_URL — Prisma-compatible Postgres connection string
- OPENAI_API_KEY — (optional) API key for OpenAI
- NODE_ENV — development|production

Create a `.env.example` file if one is not present and include only keys (no secret values).

## Development

Run in watch mode (fast iterate):

```bash
npm run start:dev
```

Build for production:

```bash
npm run build
npm run start:prod
```

## Database (Prisma)

Common Prisma commands:

```bash
# generate client
npm run prisma:generate

# create new migration (after schema changes)
npm run prisma:migrate dev --name "describe-change"

# apply migrations in CI or production
npx prisma migrate deploy

# open Studio
npm run prisma:studio
```

If you use Docker for Postgres, ensure `DATABASE_URL` points to the container host (see `docker-compose.yml`).

## Docker

Start the project and the database with Docker Compose:

```bash
docker compose up --build
```

To run in the background:

```bash
docker compose up -d --build
```

## Tests

Run unit tests:

```bash
npm run test
```

Run e2e tests:

```bash
npm run test:e2e
```

Test coverage:

```bash
npm run test:cov
```

## Contributing

If you contribute changes, please:

- Open an issue describing the change or bug
- Create a feature branch from `main`
- Add tests for new behavior
- Open a pull request

Be mindful not to commit secrets (API keys, DB passwords). Use `.env` and include a `.env.example` with only keys.

## License

This repository follows the license in the project root. See the upstream NestJS license for reference: [MIT license](https://github.com/nestjs/nest/blob/master/LICENSE).
