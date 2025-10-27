# Prisma Schema Design Review

## Scope

- [`prisma.Document`](prisma/schema.prisma)
- Migration history under [prisma/migrations](prisma/migrations)

## Summary of Findings

| Severity | Finding | Status | References |
| --- | --- | --- | --- |
| High | No unique constraint on `fileName`, enabling duplicate uploads and complicating upsert logic. | Open | [`prisma.Document`](prisma/schema.prisma) |
| Medium | Heavy reliance on unconstrained `Json` columns (`areaData`, `metadata`) without validation or indexes. | Open | [`prisma.Document`](prisma/schema.prisma) |
| Medium | Legacy migration (`20251015224108_init_schema`) conflicts with current schema shape; increases drift risk. | Open | [prisma/migrations](prisma/migrations) |
| Low | Missing supporting indexes (`createdAt`, `caseNumber`, JSON GIN) for common query patterns. | Open | [`prisma.Document`](prisma/schema.prisma) |
| Low | Domain fields (e.g., `caseType`, `area`) typed as `String` instead of enums, reducing data integrity. | Open | [`prisma.Document`](prisma/schema.prisma) |

## Detailed Insights

### 1. Duplicate File Names (High)

- `fileName` serves as the natural key for seeds and uploads, yet lacks `@unique`.
- Duplicate rows can break resolver expectations and seed upsert logic.

**Recommendation:** Add `@unique` or `@@unique([fileName])` to enforce idempotent writes.

### 2. Unstructured JSON Usage (Medium)

- `areaData` and `metadata` store arbitrary JSON without schema validation, increasing the chance of downstream parse errors.
- Absence of JSON indexes hinders querying by keys/values.

**Recommendation:** Introduce Zod/class-validator schemas in the ingestion path and add `@@index([metadata], type: gin)` / `@@index([areaData], type: gin)` where supported.

### 3. Migration Drift (Medium)

- Initial migration builds a `Document` table with `TEXT` primary keys and fields (`content`, `sourceUrl`) no longer present.
- Later migration rewrites the table, but legacy artifacts complicate rollback/forward workflows.

**Recommendation:** Squash obsolete migrations or regenerate from the current schema to keep history consistent.

### 4. Query Performance (Low)

- Frequent lookups (`caseNumber`, chronological lists) lack supporting indexes.
- No composite index for filtering by (`caseType`, `area`), which is common in legal document search.

**Recommendation:** Add `@@index([createdAt])`, `@@index([caseNumber])`, and consider `@@index([caseType, area])`.

### 5. Weak Domain Typing (Low)

- `caseType`, `area`, and similar fields are free-form strings, inviting inconsistent values.

**Recommendation:** Promote controlled vocabularies via Prisma `enum`s and reference tables when the list evolves.

## Additional Considerations

- Add optional soft-delete (`deletedAt`) for reversible removals.
- Store derived search text in a separate column for full-text indexing rather than embedding long strings in JSON.
- Document nullability strategy (when `null` vs. empty string) to align Prisma, GraphQL, and client expectations.

## Next Steps

1. Design and apply a migration introducing the `fileName` uniqueness constraint and supporting indexes.
2. Define DTO/validation schemas for JSON payloads before persisting to `Json` columns.
3. Clean migration history (squash/rebaseline) to reflect the current `Document` structure and ease onboarding.
4. Evaluate enum adoption for categorical fields and update resolvers/services to coerce inputs accordingly.
