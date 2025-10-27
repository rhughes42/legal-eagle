# Security Review Report

## Scope

- [src](../src) application bootstrap, GraphQL exposure, and logging utilities.
- [prisma](../prisma) schema tooling, seed pipeline, and raw SQL execution path.
- [scripts](../scripts) operational helpers executed in CI/dev workflows.
- [data](../data) artifacts consumed by seeds and parsers.

## Methodology

1. Static inspection of NestJS bootstrap logic (`[`bootstrap`](../../src/main.ts)`), service endpoints (`[`AppService.getOverview`](../../src/app.service.ts)`), and supporting modules.
2. Review of Prisma tooling with focus on raw query execution (`[`prisma.$executeRawUnsafe`](../../prisma/seed.ts)`) and migration practices.
3. Evaluation of operational scripts and documentation for secret handling, process isolation, and least privilege expectations.

## Summary of Findings

| Severity | Finding | Status | References |
| --- | --- | --- | --- |
| High | Authentication and authorization absent for REST and GraphQL surfaces. | Open | [`bootstrap`](../../src/main.ts), [`AppService.getOverview`](../../src/app.service.ts) |
| High | Seed runner executes unchecked SQL through `prisma.$executeRawUnsafe`, exposing RCE if file tampered. | Open | [`prisma.$executeRawUnsafe`](../../prisma/seed.ts) |
| Medium | No security middleware (Helmet, CSP, CSRF) and default-open CORS policy. | Open | [`bootstrap`](../../src/main.ts) |
| Medium | No global input validation or sanitization for GraphQL mutations/uploads. | Open | [`bootstrap`](../../src/main.ts) |
| Low | Swagger UI publicly available with persisted auth and no guardrails. | Open | [`SwaggerModule.setup`](../../src/main.ts) |

## Detailed Findings

### 1. Missing Authentication & Authorization (High)

- GraphQL `/graphql` and REST `/` endpoints are constructed without guards or identity checks.
- Implication: unauthenticated users can upload documents, trigger OpenAI enrichment, and enumerate records.
- Recommendation: integrate JWT/OIDC guards, role-based resolvers, and protect uploads with scoped permissions.

### 2. Raw SQL Seed Execution (High)

- `[`prisma.$executeRawUnsafe`](../../prisma/seed.ts)` runs arbitrary SQL from `data/seed-documents.sql`.
- Risk: tampered file (supply chain, insider) executes unrestricted SQL/DDL.
- Mitigation: disable unsafe path by default, verify checksum/signature, or parse SQL statements and apply allow-list.

### 3. Transport & Middleware Hardening (Medium)

- `[`bootstrap`](../../src/main.ts)` lacks `helmet`, HSTS/CSP headers, CSRF tokens, and explicit HTTPS redirection.
- `app.enableCors` not invoked, so default permissive CORS stands.
- Recommendation: add security middleware stack, restrict origins, enforce TLS termination.

### 4. Input Validation Gaps (Medium)

- No global validation pipe; GraphQL DTOs accept unsanitized strings/files.
- Risk: injection in downstream services (OpenAI prompts, Prisma queries) and resource exhaustion.
- Action: configure `ValidationPipe` with whitelist/transform, add schema-level constraints, validate file MIME type before parsing.

### 5. Swagger Exposure (Low)

- Swagger UI at `/docs` persists credentials and is unauthenticated.
- Recommendation: gate with auth, disable in production, or move behind admin perimeter.

## Recommendations

1. Deploy authentication/authorization layer with per-resolver guards; deny unauthenticated uploads.
2. Replace unsafe SQL seeding or require `--allow-unsafe-sql` opt-in with checksum validation.
3. Enable Helmet, rate limiting, request logging with correlation IDs, and hardened CORS.
4. Register global validation pipe, implement DTO schemas, and sanitize user metadata before persistence.
5. Restrict Swagger to authenticated roles or disable in production builds.

## Next Steps

- Track each open item as security ticket; prioritize High severities for immediate remediation.
- After fixes, rerun focused penetration tests on upload flow and seed tooling.
- Incorporate security checks (lint rules, dependency audit, secret scanning) into CI/CD.
