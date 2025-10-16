import { ObjectType, Field, Int, GraphQLISODateTime } from '@nestjs/graphql';

/**
 * GraphQL ObjectType representing a legal document in the Pandektes system.
 * This model defines the structure for document records that can be queried
 * and manipulated through the GraphQL API.
 *
 * @example
 * ```typescript
 * const document: DocumentType = {
 *   id: 1,
 *   fileName: "2025-appeal.pdf",
 *   title: "Sample Legal Document",
 *   date: new Date("2025-01-10"),
 *   court: "Court of Appeals",
 *   caseNumber: "CA-2025-00123",
 *   summary: "This appeal challenges the district court ruling.",
 *   metadata: '{"notes":"uploaded by QA"}',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
@ObjectType('Document')
export class DocumentType {
    /**
     * Unique identifier for the document record.
     * Auto-generated primary key used for database operations and GraphQL queries.
     */
    @Field(() => Int)
    id!: number;

    /**
     * Original name of the uploaded file.
     * Required field that stores the actual filename including extension.
     */
    @Field()
    fileName!: string;

    /**
     * Human-readable title for the document.
     * Optional field that provides a descriptive name for the document.
     * Defaults to null if not provided.
     */
    @Field({ nullable: true })
    title: string | null = null;

    /**
     * Date associated with the document (e.g., creation date, case date).
     * Optional field stored as ISO DateTime format.
     * Defaults to null if not provided.
     */
    @Field(() => GraphQLISODateTime, { nullable: true })
    date: Date | null = null;

    /**
     * Name of the court where the case was heard.
     * Optional field for legal documents that specify jurisdiction.
     * Defaults to null if not provided.
     */
    @Field({ nullable: true })
    court: string | null = null;

    /**
     * Official case number or reference identifier.
     * Optional field used to track legal case references.
     * Defaults to null if not provided.
     */
    @Field({ nullable: true })
    caseNumber: string | null = null;

    /**
     * Brief description or summary of the document content.
     * Optional field providing an overview of the document.
     * Defaults to null if not provided.
     */
    @Field({ nullable: true })
    summary: string | null = null;

    /**
     * Additional metadata stored as a JSON string.
     * Optional field for storing structured data like tags, notes, or custom properties.
     * Should be valid JSON when provided. Defaults to null if not provided.
     *
     * @example
     * ```json
     * {"tags":["appeal","civil"],"priority":"high","notes":"Review required"}
     * ```
     */
    @Field({ nullable: true })
    metadata: string | null = null; // We can represent JSON as a string in GraphQL for simplicity, or define a JSON scalar

    /**
     * Timestamp when the document record was first created.
     * Automatically set by the system and stored in ISO DateTime format.
     */
    @Field(() => GraphQLISODateTime)
    createdAt!: Date;

    /**
     * Timestamp when the document record was last modified.
     * Automatically updated by the system whenever the record changes.
     * Stored in ISO DateTime format.
     */
    @Field(() => GraphQLISODateTime)
    updatedAt!: Date;
}
