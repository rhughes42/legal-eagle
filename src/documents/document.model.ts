import { ObjectType, Field, Int, GraphQLISODateTime } from '@nestjs/graphql'

/** GraphQL type representing a document and its metadata. */
@ObjectType('Document')
export class DocumentType {
    /** Unique id. */
    @Field(() => Int)
    id!: number

    /** Original uploaded filename. */
    @Field(() => String)
    fileName!: string

    /** Optional title. */
    @Field(() => String, { nullable: true })
    title: string | null = null

    /** Optional date (ISO). */
    @Field(() => GraphQLISODateTime, { nullable: true })
    date: Date | null = null

    /** Optional court name. */
    @Field(() => String, { nullable: true })
    court: string | null = null

    /** Optional case/reference number. */
    @Field(() => String, { nullable: true })
    caseNumber: string | null = null

    /** Optional short description. */
    @Field(() => String, { nullable: true })
    summary: string | null = null

    /** Optional high-level case classification. */
    @Field(() => String, { nullable: true })
    caseType: string | null = null

    /** Optional legal area taxonomy. */
    @Field(() => String, { nullable: true })
    area: string | null = null

    /** Optional area-specific JSON string. */
    @Field(() => String, { nullable: true })
    areaData: string | null = null

    /** Optional metadata as JSON string. */
    @Field(() => String, { nullable: true })
    metadata: string | null = null

    /** Creation timestamp (ISO). */
    @Field(() => GraphQLISODateTime)
    createdAt!: Date

    /** Last update timestamp (ISO). */
    @Field(() => GraphQLISODateTime)
    updatedAt!: Date
}

/* Example
 * {
 *   "id": 1042,
 *   "fileName": "ACME_v_Omega_2023-07-15.pdf",
 *   "title": "ACME Corporation v. Omega Logistics Ltd.",
 *   "date": "2023-07-14T10:30:00.000Z",
 *   "court": "United States District Court for the Southern District of New York",
 *   "caseNumber": "1:23-cv-04567",
 *   "summary": "Order granting in part and denying in part defendant’s motion to dismiss a breach of contract claim arising from a long‑term supply agreement. The court finds portions of the force majeure clause ambiguous and allows discovery to proceed on damages.",
 *   "caseType": "Civil",
 *   "area": "Contract Law",
 *   "areaData": "{\"parties\":{\"plaintiff\":\"ACME Corporation\",\"defendant\":\"Omega Logistics Ltd.\"},\"judges\":[\"Hon. Maria Papadopoulos\"],\"claims\":[\"Breach of Contract\",\"Implied Covenant of Good Faith\"],\"disposition\":\"Motion to dismiss granted in part\",\"citations\":[\"2023 U.S. Dist. LEXIS 123456\"],\"hearingDate\":\"2023-06-20\",\"governingLaw\":\"New York\",\"relatedCases\":[\"1:22-cv-01234\"],\"docketUrl\":\"https://ecf.nysd.uscourts.gov/cgi-bin/DktRpt.pl?caseid=123456\",\"language\":\"en\"}",
 *   "metadata": "{\"uploader\":\"r.kelly@example.com\",\"sha256\":\"a3f5f7d2d8c1f0b902c6fe1e3d1a6b7b0b5c9adf8e76bc1c6d3f5a2e9f1a2345\",\"fileSize\":834215,\"pageCount\":37,\"mimeType\":\"application/pdf\",\"source\":\"manual-upload\",\"tags\":[\"decision\",\"motion\",\"contract\"],\"ocr\":true,\"extractedAt\":\"2023-07-15T12:06:10.000Z\"}",
 *   "createdAt": "2023-07-15T12:05:42.000Z",
 *   "updatedAt": "2023-07-16T09:14:03.000Z"
 * }
 */
