# Pandektes — LegalEagle (NestJS)

Lightweight NestJS starter customized for the Pandektes LegalEagle challenge. This project shows a typical backend setup: NestJS + TypeScript, Prisma for database access, PostgreSQL as the primary datastore, Docker for local containers, and integrations with external services (for example OpenAI keys kept out of source control).

Table of Contents

- [Pandektes — LegalEagle (NestJS)](#pandektes--legaleagle-nestjs)
 	- [Features](#features)
 	- [Tech stack](#tech-stack)
 	- [Quick start](#quick-start)
 	- [Environment variables](#environment-variables)
 	- [Development](#development)
 	- [Uploading documents](#uploading-documents)
 	- [Database (Prisma)](#database-prisma)
 	- [Docker](#docker)
 	- [Notes Regarding Startup Order](#notes-regarding-startup-order)
 	- [Tests](#tests)
 	- [Contributing](#contributing)
 	- [License](#license)

## Features

- NestJS application scaffolded with TypeScript
- Prisma ORM + migrations configured for PostgreSQL
- Docker Compose for local DB and app orchestration
- Example endpoints and basic tests
- Optional Google Document AI integration for high fidelity PDF parsing

## Tech stack

- Node.js + NestJS
- TypeScript
- Prisma (ORM)
- PostgreSQL
- Docker + Docker Compose
- OpenAI (optional integration — keep keys in environment variables)

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Copy and populate your environment file**

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your database connection string and any AI model options (see [Environment variables](#environment-variables)).

3. **Run the application**

   - Local stack (uses your host Node/Postgres):

     ```bash
     npm run start:dev
     ```

   - Containers (builds the Nest app and Postgres together):

     ```bash
     docker compose up --build
     ```

4. **Visit GraphQL Playground / Apollo Sandbox** at `http://localhost:3000/graphql` to explore queries and mutations.

## Environment variables

Keep secrets out of version control. Typical variables (see `.env.example`):

- `DATABASE_URL` – Prisma-compatible Postgres connection string
- `OPENAI_API_KEY` - optional; enables AI metadata extraction during uploads
- `OPENAI_CHAT_MODEL` - optional; overrides the default `gpt-5` model name sent to OpenAI
- `NODE_ENV` - `development` or `production`

If you enable Document AI you must also provide credentials via the usual Google Cloud mechanism,
for example setting `GOOGLE_APPLICATION_CREDENTIALS` to the path of a service account JSON file
with `documentai.processors.process` permission.

Only commit the **keys** (not values) in `.env.example` so teammates know what to configure.

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

## Uploading documents

1. Ensure the API is running and `OPENAI_API_KEY` is set if you want AI enrichment.
2. (Optional) Set the Document AI variables above plus `GOOGLE_APPLICATION_CREDENTIALS` if you want
   Google Cloud to handle PDF text extraction. When present the server will first try Document AI
   and fall back to local parsing if anything fails.
3. Open Apollo Sandbox (`http://localhost:3000/graphql`) and use the following mutation:

   ```graphql
   mutation UploadDocument($file: Upload!, $title: String) {
     uploadDocument(file: $file, title: $title) {
       id
       fileName
       title
       summary
       metadata
     }
   }
   ```

   Attach a small PDF or HTML file as the `file` variable. The server streams the file, extracts text, optionally enriches metadata with OpenAI, and returns the stored record.

4. To list all documents:

   ```graphql
   {
     documents {
       id
       title
       summary
     }
   }
   ```

If `OPENAI_API_KEY` is missing, the upload still succeeds—logs will note that enrichment was skipped.

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

The Compose file provisions a Postgres instance and wires the Nest server to it. Update `.env` with the connection string shown in `docker-compose.yml` (typically `postgresql://postgres:postgres@localhost:5432/pandektes` when using the forwarded port).

## Notes Regarding Startup Order

------------------------

The container image includes a small helper script (`scripts/wait-for-db.sh`) that polls the Postgres host before running Prisma migrations. This avoids race conditions where the Nest app tries to run `prisma migrate deploy` before the database is ready. If you run migrations or the app from your host machine instead of within Docker, make sure the DB is reachable (for example `pg_isready -h localhost -p 5432`) before running `npx prisma migrate dev`.

## Compatibility note: `graphql-upload`

This project pins `graphql-upload` to the last CommonJS-compatible release (16.x) to maintain compatibility with the project's CommonJS build target. Newer `graphql-upload` 17.x releases are ESM-only and will throw at runtime when required from CommonJS code. If you see runtime errors like `Must use import to load ES Module`, pinning to `^16` or migrating the project to ESM are the two options:

- Quick/unblocking: keep `graphql-upload@^16` (current approach). This is low-risk and keeps builds and Docker images stable.
- Long-term: migrate the project to ESM (`"type": "module"` in `package.json`, update `tsconfig.json`, test tooling, CI, and Docker). This is recommended for modernization but requires a dedicated migration effort.

If you need help with the ESM migration, open an issue or a draft PR and we can plan it out.

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
