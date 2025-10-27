import { Args, GraphQLISODateTime, Int, Mutation, Query, Resolver } from '@nestjs/graphql'
import { GraphQLUpload, type FileUpload } from 'graphql-upload-ts'
import { DocumentType } from './document.model'
import { DocumentService } from './document.service'

/**
 * Developer notes:
 * - Set OPENAI_API_KEY to enable optional AI enrichment.
 * - Configure MODEL_PRIMARY to override default model if applicable.
 * - Test uploads with small PDFs/HTML files when validating parsing and OCR.
 * - Consider adding pagination to `documents` query for production use.
 * - See DocumentService for the implementation details of persistence and file handling.
 */

/**
 * GraphQL resolver for document management in the application.
 *
 * Exposes queries and mutations for listing, retrieving, creating, updating,
 * deleting and uploading documents. This layer translates GraphQL requests
 * into calls to DocumentService which implements the business logic.
 *
 * Notes:
 * - GraphQL types and nullability are declared in the resolver decorators.
 * - File uploads follow the GraphQL Upload specification via graphql-upload.
 */
@Resolver(() => DocumentType)
export class DocumentResolver {
	/**
	 * Construct a DocumentResolver.
	 *
	 * @param documentsService - Service handling document persistence and processing.
	 */
	constructor(private readonly documentsService: DocumentService) {}

	/**
	 * Return all documents.
	 *
	 * Retrieves every document record available to the service. Useful for
	 * listing pages and administrative views. Consider pagination for large
	 * datasets.
	 *
	 * @returns Promise<DocumentType[]> - Array of all document objects.
	 */
	@Query(() => [DocumentType], { name: 'documents' })
	async documents(): Promise<DocumentType[]> {
		return this.documentsService.getAllDocuments()
	}

	/**
	 * Return a single document by id.
	 *
	 * @param id - Document database identifier.
	 * @returns Promise<DocumentType | null> - Document or null when not found.
	 */
	@Query(() => DocumentType, { name: 'document', nullable: true })
	async document(@Args('id', { type: () => Int }) id: number): Promise<DocumentType | null> {
		return this.documentsService.getDocumentById(id)
	}

	/**
	 * Create a new document record (metadata-only).
	 *
	 * Use this mutation when you want to create a document record without an
	 * immediate file upload. The service will persist the provided metadata.
	 *
	 * @param fileName - Required filename (including extension).
	 * @param title - Optional human readable title.
	 * @param date - Optional ISO date associated with the document.
	 * @param court - Optional court name.
	 * @param caseNumber - Optional case or reference number.
	 * @param summary - Optional short description.
	 * @param metadata - Optional JSON string with additional metadata.
	 * @param caseType - Optional high-level case classification.
	 * @param area - Optional legal area taxonomy.
	 * @param areaData - Optional area specific JSON string.
	 * @returns Promise<DocumentType> - Newly created document.
	 */
	@Mutation(() => DocumentType, { name: 'createDocument' })
	async createDocument(
		@Args('fileName', { type: () => String }) fileName: string,
		@Args('title', { type: () => String, nullable: true }) title?: string,
		@Args('date', { type: () => GraphQLISODateTime, nullable: true }) date?: Date,
		@Args('court', { type: () => String, nullable: true }) court?: string,
		@Args('caseNumber', { type: () => String, nullable: true }) caseNumber?: string,
		@Args('summary', { type: () => String, nullable: true }) summary?: string,
		@Args('metadata', { type: () => String, nullable: true }) metadata?: string,
		@Args('caseType', { type: () => String, nullable: true }) caseType?: string,
		@Args('area', { type: () => String, nullable: true }) area?: string,
		@Args('areaData', { type: () => String, nullable: true }) areaData?: string,
	): Promise<DocumentType> {
		return this.documentsService.createDocument(
			{
				fileName,
				title,
				date,
				court,
				caseNumber,
				summary,
				metadata,
				caseType,
				area,
				areaData,
			},
			false,
		)
	}

	/**
	 * Update an existing document record.
	 *
	 * Performs a partial update: only provided fields are changed. To clear a
	 * field set it explicitly to null. The service will update the updatedAt
	 * timestamp as appropriate.
	 *
	 * @param id - Required document id to update.
	 * @param fileName - Optional new filename.
	 * @param title - Optional new title (nullable to clear).
	 * @param date - Optional new date (nullable to clear).
	 * @param court - Optional new court (nullable to clear).
	 * @param caseNumber - Optional new case number (nullable to clear).
	 * @param summary - Optional new summary (nullable to clear).
	 * @param metadata - Optional new metadata JSON string (nullable to clear).
	 * @param caseType - Optional case type (nullable to clear).
	 * @param area - Optional area taxonomy (nullable to clear).
	 * @param areaData - Optional area-specific JSON (nullable to clear).
	 * @returns Promise<DocumentType> - Updated document.
	 * @throws If the document does not exist or the service validation fails.
	 */
	@Mutation(() => DocumentType, { name: 'updateDocument' })
	async updateDocument(
		@Args('id', { type: () => Int }) id: number,
		@Args('fileName', { type: () => String, nullable: true }) fileName?: string,
		@Args('title', { type: () => String, nullable: true }) title?: string | null,
		@Args('date', { type: () => GraphQLISODateTime, nullable: true }) date?: Date | null,
		@Args('court', { type: () => String, nullable: true }) court?: string | null,
		@Args('caseNumber', { type: () => String, nullable: true }) caseNumber?: string | null,
		@Args('summary', { type: () => String, nullable: true }) summary?: string | null,
		@Args('metadata', { type: () => String, nullable: true }) metadata?: string | null,
		@Args('caseType', { type: () => String, nullable: true }) caseType?: string | null,
		@Args('area', { type: () => String, nullable: true }) area?: string | null,
		@Args('areaData', { type: () => String, nullable: true }) areaData?: string | null,
	): Promise<DocumentType> {
		const updates = {
			fileName,
			title,
			date,
			court,
			caseNumber,
			summary,
			metadata,
			caseType,
			area,
			areaData,
		}
		const payload: Parameters<DocumentService['updateDocument']>[0] = {
			id,
			...Object.fromEntries(Object.entries(updates).filter(([, value]) => typeof value !== 'undefined')),
		}

		return this.documentsService.updateDocument(payload)
	}

	/**
	 * Delete a document permanently.
	 *
	 * Removes the document record and any associated stored file(s) as handled
	 * by the service. This operation is irreversible.
	 *
	 * @param id - Document id to delete.
	 * @returns Promise<DocumentType> - The deleted document data for confirmation.
	 * @throws If the document does not exist or deletion fails.
	 */
	@Mutation(() => DocumentType, { name: 'deleteDocument' })
	async deleteDocument(@Args('id', { type: () => Int }) id: number): Promise<DocumentType> {
		return this.documentsService.deleteDocument(id)
	}

	/**
	 * Upload a file and create a document record.
	 *
	 * Accepts a multipart file upload and optional metadata. The service will
	 * handle file storage, parsing (e.g., OCR or text extraction) and any AI
	 * enrichment if configured. The provided metadata fields are stored with
	 * the created document.
	 *
	 * @param file - Uploaded file following the GraphQL Upload spec.
	 * @param title - Optional title for the document.
	 * @param date - Optional date associated with the document.
	 * @param court - Optional court name.
	 * @param caseNumber - Optional case/reference number.
	 * @param summary - Optional human summary/description.
	 * @param metadata - Optional JSON string with additional metadata.
	 * @param caseType - Optional case type classification.
	 * @param area - Optional legal area taxonomy.
	 * @param areaData - Optional area-specific JSON string.
	 * @returns Promise<DocumentType> - Document created from the uploaded file and metadata.
	 * @throws If file processing or storage fails.
	 */
	@Mutation(() => DocumentType, { name: 'uploadDocument' })
	async uploadDocument(
		@Args('file', { type: () => GraphQLUpload }) file: FileUpload,
		@Args('title', { nullable: true }) title?: string,
		@Args('date', { type: () => GraphQLISODateTime, nullable: true }) date?: Date,
		@Args('court', { nullable: true }) court?: string,
		@Args('caseNumber', { nullable: true }) caseNumber?: string,
		@Args('summary', { nullable: true }) summary?: string,
		@Args('metadata', { nullable: true }) metadata?: string,
		@Args('caseType', { nullable: true }) caseType?: string,
		@Args('area', { nullable: true }) area?: string,
		@Args('areaData', { nullable: true }) areaData?: string,
	): Promise<DocumentType> {
		return this.documentsService.handleUpload(file, {
			title,
			date,
			court,
			caseNumber,
			summary,
			metadata,
			caseType,
			area,
			areaData,
		})
	}

	/**
	 * Parse and clean metadata for a single document by ID.
	 *
	 * Converts structured key-value pairs in areaData and metadata fields
	 * from their string representations to clean JSON objects.
	 *
	 * @param id - The ID of the document to process.
	 * @param dryRun - If true, returns what would be changed without making updates.
	 * @returns Promise<string> - JSON string with parsing result details.
	 * @throws If the document does not exist or processing fails.
	 */
	@Mutation(() => String, { name: 'parseDocumentMetadata' })
	async parseDocumentMetadata(
		@Args('id', { type: () => Int }) id: number,
		@Args('dryRun', { type: () => Boolean, defaultValue: false }) dryRun: boolean,
	): Promise<string> {
		const result = await this.documentsService.parseDocumentMetadata(id, dryRun)
		return JSON.stringify(result, null, 2)
	}

	/**
	 * Parse and clean metadata for all documents or a filtered set.
	 *
	 * @param dryRun - If true, shows what would be changed without making updates.
	 * @param limit - Maximum number of documents to process.
	 * @param hasStringAreaData - Filter for documents with string areaData.
	 * @param hasStringMetadata - Filter for documents with string metadata.
	 * @returns Promise<string> - JSON string with processing summary.
	 */
	@Mutation(() => String, { name: 'parseAllDocumentsMetadata' })
	async parseAllDocumentsMetadata(
		@Args('dryRun', { type: () => Boolean, defaultValue: false }) dryRun: boolean,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('hasStringAreaData', { type: () => Boolean, nullable: true }) hasStringAreaData?: boolean,
		@Args('hasStringMetadata', { type: () => Boolean, nullable: true }) hasStringMetadata?: boolean,
	): Promise<string> {
		const options = {
			dryRun,
			limit: limit ?? undefined,
			filter: {
				hasStringAreaData: hasStringAreaData ?? undefined,
				hasStringMetadata: hasStringMetadata ?? undefined,
			},
		}

		const result = await this.documentsService.parseAllDocumentsMetadata(options)
		return JSON.stringify(result, null, 2)
	}
}
