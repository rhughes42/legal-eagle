# Document Processing Pipeline Review

## Scope

- [`documents.DocumentService`](src/documents/document.service.ts)
- [`documents.DocumentResolver`](src/documents/document.resolver.ts)
- [`scripts/parse-metadata.ts`](scripts/parse-metadata.ts)

## Summary of Findings

| Severity | Finding | Status | References |
| --- | --- | --- | --- |
| High | Upload pipeline reads full files into memory and persists entire raw text blobs in metadata, causing heavy memory/IO pressure. | Open | [`DocumentService.handleUpload`](src/documents/document.service.ts#L500-L567), [`DocumentService.mergeMetadata`](src/documents/document.service.ts#L848-L870) |
| Medium | Batch metadata parsing performs N+1 database queries and sequential updates, slowing large reprocessing runs. | Open | [`DocumentService.parseAllDocumentsMetadata`](src/documents/document.service.ts#L1420-L1470) |
| Medium | No pagination or streaming safeguards on `getAllDocuments`, risking large result sets and API timeouts. | Open | [`DocumentService.getAllDocuments`](src/documents/document.service.ts#L260-L272), [`DocumentResolver.documents`](src/documents/document.resolver.ts) |
| Low | Excessive verbose logging serializes full payloads (including raw text), impacting performance and leaking sensitive content to logs. | Open | [`DocumentService.handleUpload`](src/documents/document.service.ts#L521-L546), [`DocumentService.enrichMetadataFromText`](src/documents/document.service.ts#L903-L1017) |
| Low | Stream helpers duplicate buffers when transforming HTML, doubling memory footprint unnecessarily. | Open | [`DocumentService.streamToString`](src/documents/document.service.ts#L1287-L1306) |

## Detailed Observations

### 1. Full-file buffering and raw-text persistence (High)

- `handleUpload` converts every upload stream to a complete in-memory buffer via `streamToBuffer`, then stores the entire `rawText` in `metadata` under `combinedMetadata`.
- Resulting metadata objects can reach multiple megabytes per document, inflating database size, slowing Prisma serialization, and making GraphQL responses unwieldy.

Recommendations

- Enforce tighter size caps (e.g., truncate `rawText` to a few KB or drop it post-enrichment).
- Switch to streaming parsers where possible (e.g., pipe PDF pages to incremental extractors) or spill to temp files to avoid double buffering.
- Store derived summaries instead of raw corpus text; if retention is required, consider object storage with references.

### 2. Batch metadata parsing inefficiencies (Medium)

- `parseAllDocumentsMetadata` fetches a list of documents, then calls `parseDocumentMetadata` for each, which re-queries Prisma per ID (N+1).
- Updates run sequentially without transaction batching, so large batches are slow and susceptible to partial failure states.

Recommendations

- Reuse the `findMany` payload when iterating; pass the already-fetched data into a pure helper to avoid extra selects.
- Use `Promise.allSettled` with a concurrency limiter to parallelize parsing while controlling load.
- Wrap writes in Prisma transactions or chunked batches to reduce round trips.

### 3. Unbounded collection queries (Medium)

- `getAllDocuments` exposes every row without pagination or filtering, and the resolver returns it directly. With growing data sets this will saturate memory and slow GraphQL responses.

Recommendations

- Introduce pagination (cursor or offset) and expose filters for common fields.
- Update the resolver and example queries to encourage paginated access.

### 4. Verbose logging of large payloads (Low)

- `JSON.stringify(uploadData)` and enrichment logging print full metadata, including raw text and AI output. Similar logs appear in enrichment success paths.
- Large logs increase disk usage, slow log aggregation, and risk leaking sensitive case content.

Recommendations

- Replace payload dumps with hashes or length metrics; redact raw text and AI JSON before logging.
- Add log-level guards (e.g., only emit detailed diagnostics when `LOG_LEVEL=debug`).

### 5. Redundant stream conversions (Low)

- `streamToString` first buffers the entire stream via `streamToBuffer`, then converts the buffer to string, keeping two copies in memory.

Recommendations

- Convert chunks directly to strings while reading to avoid the intermediate buffer, or reuse the original buffer without duplication.

## Next Steps

1. Define a storage policy for raw document text and update `handleUpload`/`mergeMetadata` accordingly.
2. Refactor batch metadata parsing to reuse fetched records and add controlled parallelism.
3. Introduce pagination and filtering on document queries (resolver + service + GraphQL schema).
4. Tame logging volume by redacting or summarizing large payloads.
5. Optimize stream helpers to minimize buffer duplication and enforce upload size guardrails.
