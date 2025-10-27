# TypeScript Practices Review

## Scope

- [`documents.DocumentService`](src/documents/document.service.ts)
- [`documents.DocumentResolver`](src/documents/document.resolver.ts)
- [prisma/seed.ts](prisma/seed.ts)

## Summary of Findings

| Severity | Finding | Status | References |
| --- | --- | --- | --- |
| Medium | Global suppression of unsafe-operation lint rules masks real typing defects. | Open | [`documents.DocumentService`](src/documents/document.service.ts) |
| Medium | Seed workflow relies on `any` for heterogeneous payloads, defeating compile-time validation. | Open | [prisma/seed.ts](prisma/seed.ts) |
| Low | Resolver inputs modeled with scalar args instead of DTOs, limiting reusable typings and validation. | Open | [`documents.DocumentResolver`](src/documents/document.resolver.ts) |

## Detailed Findings

### 1. Blanket Lint Suppression Hides Unsafe Operations (Medium)

[`documents.DocumentService`](src/documents/document.service.ts) disables `@typescript-eslint/no-unsafe-*` rules at file scope, allowing unchecked calls, reads, and assignments. This bypass prevents the compiler from surfacing unsafe interactions with external libraries (e.g., `pdf-parse`, `OpenAI` responses).

<- markdown disable MD036 ->
**Recommendation**

- Remove global disables and reintroduce typed wrappers for parsed payloads (define interfaces for `pdf-parse` output, OpenAI usage records).
- Narrow unsafe casts to localized helper functions using `unknown` + type guards.

### 2. Seed Pipeline Uses `any` for Parsed Inputs (Medium)

The seed script initializes `seedData` as `any` in [prisma/seed.ts](prisma/seed.ts), then treats it interchangeably as an array or an object (`seedData.sql`). This pattern sidesteps TypeScript’s structural checks and can mask schema drift between JSON and SQL seed modes.

<- markdown disable MD036 ->
**Recommendation**

- Introduce a discriminated union (e.g., `type SeedPayload = { mode: 'json'; records: DocumentSeed[] } | { mode: 'sql'; script: string }`) to enable exhaustive switch handling.
- Replace loosely typed loops with strongly typed Prisma DTOs to leverage editor/tooling support.

### 3. Resolver Inputs Lack Structured DTOs (Low)

[`documents.DocumentResolver`](src/documents/document.resolver.ts) exposes mutations such as `createDocument` and `uploadDocument` via long argument lists of primitive scalars. This duplicates field definitions between resolver signatures and service contracts, raising drift risk and blocking class-validator decorators.

<- markdown disable MD036 ->
**Recommendation**

- Introduce `@InputType` DTO classes shared between resolver and service layers.
- Enable Nest’s `ValidationPipe` once DTOs exist to gain runtime validation without manual checks.

## Next Steps

1. Create typed adapters for external library responses, then drop the global lint disables.
2. Refactor the seed loader to parse into a discriminated union before invoking Prisma helpers.
3. Model resolver payloads as DTOs, enabling shared validation and future schema evolution.
