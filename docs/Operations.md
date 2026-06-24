# Data & Operations

## Database And Seeding

- Start Postgres with `docker compose up -d db`.
- Apply migrations with `npm run prisma:migrate`.
- Seed demo data with `npm run seed -- --force`.
- Verify sample data with `npm run test:seed`.

## Document Workflows

- Use GraphQL to list, fetch, upload, and mutate documents.
- Parse stored metadata with `npx ts-node scripts/parse-metadata.ts`.
- Use `--document-id=<id>` to target one record.
- Use `--dry-run` to preview changes.

## Deployment Notes

- `npm run build` produces the production bundle.
- `npm run start:prod` runs the compiled app from `dist/`.
- The Dockerfile and Compose stack are intended for local and containerized execution.

## Troubleshooting

- Check `DATABASE_URL` when Prisma cannot connect.
- Confirm `OPENAI_API_KEY` when enrichment falls back to reduced capability.
- Ensure the database is healthy before starting the app.
