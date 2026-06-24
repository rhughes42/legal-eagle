# Getting Started

## Prerequisites

- Node.js 20
- PostgreSQL 16
- Docker and Docker Compose for local database setup
- `OPENAI_API_KEY` for full enrichment functionality

## Configuration

Copy the example environment file and set your local values:

```powershell
cp .env.example .env
```

Important values:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `OPENAI_API_KEY`
- `NODE_ENV`

## Local Development

1. Install dependencies with `npm install`.
2. Start Postgres with `docker compose up -d db`.
3. Wait for the database to be ready.
4. Generate Prisma artifacts with `npm run prisma:generate`.
5. Apply migrations with `npm run prisma:migrate`.
6. Start the app with `npm run start:dev`.

## Quality Checks

- `npm test` runs the repository test suite.
- `npm run check-ts-build` performs a type-only build check.
- `npm run lint` applies the repository ESLint rules.

## Local Endpoints

- GraphQL Playground: `http://localhost:3000/graphql`
- Swagger UI: `http://localhost:3000/docs`
- Health Check: `http://localhost:3000/`
