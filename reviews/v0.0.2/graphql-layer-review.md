# GraphQL Layer Review

## Scope

- [`app.createGraphQLConfig`](src/app.module.ts)
- [`documents.DocumentType`](src/documents/document.model.ts)
- [`documents.DocumentResolver`](src/documents/document.resolver.ts)
- [`documents.DocumentService`](src/documents/document.service.ts)
- `src/documents/queries.graphql`

## Schema Characteristics

- Code-first NestJS GraphQL with auto schema file generation and always-on playground & introspection (see [`app.createGraphQLConfig`](src/app.module.ts)).
- Single primary object type [`documents.DocumentType`](src/documents/document.model.ts) exposing many nullable scalar fields; no enums or custom scalars to constrain values.
- Mutations such as [`documents.DocumentResolver.uploadDocument`](src/documents/document.resolver.ts) and [`documents.DocumentResolver.createDocument`](src/documents/document.resolver.ts) accept numerous optional scalars instead of structured input types.
- Metadata parsing mutations (see [`documents.DocumentResolver.parseDocumentMetadata`](src/documents/document.resolver.ts) and `parseAllDocumentsMetadata`) serialize service responses to strings, reducing type safety on the GraphQL contract.

## Resolver Patterns

- Resolvers are thin pass-throughs into [`documents.DocumentService`](src/documents/document.service.ts) with minimal orchestration or validation.
- Queries (`documents`, `document`) expose unpaginated collections and return full entity payloads, increasing payload size risk.
- File uploads rely on `GraphQLUpload` without explicit MIME/type whitelisting in the resolver; checks happen deeper in the service.
- Error handling depends on service-level exceptions; resolvers do not add correlation IDs or context metadata.

## Improvement Opportunities

1. Introduce dedicated `@InputType` DTOs with class-validator decorators for create/update/upload mutations; register NestJS `ValidationPipe` to enforce constraints.
2. Replace stringified JSON responses with strongly typed GraphQL object results (e.g., `MetadataParseResult`) to preserve structure and discoverability.
3. Add connection/pagination pattern (Relay-style or offset-based) for `documents` to prevent large list responses and enable cursor-based fetching.
4. Gate schema tooling via environment (`NODE_ENV`) in [`app.createGraphQLConfig`](src/app.module.ts) to disable playground and introspection in production.
5. Model constrained fields (caseType, area) as enums or reference types to improve client-side validation and auto-completion.
6. Surface upload limits, accepted MIME types, and service outcomes via custom scalars or union results to improve client ergonomics.

## Recommended Next Steps

- Draft a GraphQL evolution plan focusing on input normalization and pagination.
- Implement resolver-level guards once authentication is added to prevent unauthenticated schema access.
- Add schema documentation (descriptions, deprecations) and align `src/documents/queries.graphql` examples with future DTO shapes.
