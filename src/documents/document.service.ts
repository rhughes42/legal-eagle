/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Core NestJS imports
import { BadRequestException, Injectable, Logger, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common'

// Database imports
import type { Document as PrismaDocument } from '@prisma/client'
import { Prisma } from '@prisma/client'

// External library imports
import { load as loadHtml } from 'cheerio'
import type { FileUpload } from 'graphql-upload-ts'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import pdfParse from 'pdf-parse'
import { z } from 'zod'

// Node.js imports
import { extname } from 'node:path'
import type { Readable } from 'node:stream'

// Local imports
import { PrismaService } from '../prisma/prisma.service'
import { DocumentType } from './document.model'

/**
 * File overview
 *
 * Purpose:
 * - Provides DocumentService: a NestJS injectable responsible for managing
 *   legal documents (CRUD) with AI-assisted metadata extraction.
 *
 * Key responsibilities:
 * - Create, read, update, delete documents via Prisma.
 * - Handle file uploads (PDF and HTML), extract text, and persist document records.
 * - Enrich document metadata using OpenAI structured outputs.
 * - Parse and stringify JSON metadata and areaData safely for DB storage.
 * - Provide robust stream utilities for reading uploaded files.
 *
 * Important notes:
 * - Uses PrismaService for database access and a temporary compatibility type
 *   for fields not yet present in the generated Prisma client.
 * - OpenAI integration requires OPENAI_API_KEY; model can be configured via
 *   OPENAI_CHAT_MODEL or MODEL_PRIMARY environment variables (fallback model used).
 * - Metadata and areaData are accepted as JSON strings and validated; invalid JSON
 *   results in BadRequestException.
 * - Supports only PDF and HTML upload types; other types produce
 *   UnsupportedMediaTypeException.
 * - Error handling uses NestJS exceptions (BadRequestException, NotFoundException, etc.).
 *
 * Design considerations:
 * - User-provided metadata takes precedence over AI-extracted values; AI adds
 *   inferred fields when available.
 * - Streams are converted to Buffer/string for reliable parsing of PDFs and HTML.
 * - AI prompt input is truncated to a safe excerpt to avoid token limits.
 */

// ===== INTERFACES AND TYPES =====

/**
 * Result structure from pdf-parse library
 */
interface PdfParseResult {
	text: string
	numpages: number
	numrender: number
	info: unknown
	metadata: unknown
	version: string
}

/**
 * Options for creating a new document
 */
interface CreateDocumentOptions {
	fileName: string
	title?: string | null
	date?: Date | null
	court?: string | null
	caseNumber?: string | null
	summary?: string | null
	metadata?: string | null
	caseType?: string | null
	area?: string | null
	areaData?: string | null
}

/**
 * Options for uploading a document (excludes fileName as it comes from the file)
 */
type UploadDocumentOptions = Omit<CreateDocumentOptions, 'fileName'>

/**
 * Options for updating an existing document.
 *
 * Fields marked as optional may be omitted when they are not being changed.
 * Nullable fields explicitly accept `null` to clear an existing value.
 *
 * @property id - The unique numeric identifier of the document to update.
 * @property fileName - Optional file name for the document (e.g., "document.pdf"). If omitted, the file name is left unchanged.
 * @property title - Optional title of the document. Pass `null` to remove an existing title.
 * @property date - Optional date associated with the document as a `Date` object. Pass `null` to clear the date.
 * @property court - Optional name of the court or issuing authority. Pass `null` to clear this value.
 * @property caseNumber - Optional case number related to the document. Pass `null` to clear it.
 * @property summary - Optional short summary or description of the document. Pass `null` to clear it.
 * @property metadata - Optional additional metadata (for example, a serialized JSON string). Pass `null` to clear metadata.
 * @property caseType - Optional classification or type of the case. Pass `null` to clear it.
 * @property area - Optional geographic or subject area associated with the document. Pass `null` to clear it.
 * @property areaData - Optional additional structured data related to the area (format depends on implementation). Pass `null` to clear it.
 */
interface UpdateDocumentOptions {
	id: number
	fileName?: string
	title?: string | null
	date?: Date | null
	court?: string | null
	caseNumber?: string | null
	summary?: string | null
	metadata?: string | null
	caseType?: string | null
	area?: string | null
	areaData?: string | null
}

/**
 * Represents the result of an AI-based extraction from a legal document.
 *
 * Contains both a normalized, typed collection of extracted fields under `fields`
 * and the raw extraction output under `json`.
 *
 * @interface AiExtractionResult
 *
 * @property fields - A collection of normalized extraction values. Each property may be `null` if the extractor could not determine a value.
 * @property fields.title - The extracted document title, or `null` when not present or uncertain.
 * @property fields.date - The extracted date as a `Date`, or `null` if unavailable or unparsable. Consumers should verify the `Date` is valid before use.
 * @property fields.court - The name of the court or tribunal associated with the document, or `null`.
 * @property fields.caseNumber - The extracted case identifier (e.g., docket number), or `null`.
 * @property fields.summary - A short, human-readable summary of the document's contents, or `null`.
 * @property fields.caseType - A classification of the case (for example, "civil" or "criminal"), or `null`.
 * @property fields.area - A higher-level area or jurisdiction tag (for example, "family", "tax"), or `null`.
 * @property fields.areaData - Additional structured data related to `area`. Stored as `Prisma.JsonValue` and may be any valid JSON value (object, array, primitive) or `null`.
 * @property fields.metadata - Supplemental extraction metadata. Stored as `Prisma.JsonValue` and may include diagnostics (confidence, language, etc.) or be `null`.
 *
 * @property json - The original, unnormalized extraction output as a plain object. Use this to inspect the raw model response, debug extraction issues, or recover fields not yet mapped into `fields`.
 *
 * @remarks
 * Values are nullable to reflect the uncertainty inherent in automated extraction. Callers should handle `null` values and perform any required validation or normalization (for example, parsing or timezone handling for `fields.date`) before persisting or using the data in business logic.
 *
 * @example
 * const result: AiExtractionResult = await aiExtract(documentBuffer);
 * if (result.fields.caseNumber) {
 *   // proceed with indexing or lookup
 * }
 */
interface AiExtractionResult {
	fields: {
		title: string | null
		date: Date | null
		court: string | null
		caseNumber: string | null
		summary: string | null
		caseType: string | null
		area: string | null
		areaData: Prisma.JsonValue | null
		metadata: Prisma.JsonValue | null
	}
	json: Record<string, unknown>
}

/**
 * Zod schema describing the structured extraction result for a document.
 *
 * @remarks
 * - Each string field is trimmed and may be either undefined (optional) or null (explicitly absent).
 * - areaData and metadata are flexible key/value maps (Record<string, unknown>) and may also be null or undefined.
 * - Intended to validate normalized outputs from OCR/NLP extraction or manual extraction pipelines.
 *
 * @property title - The document's title or caption (e.g., case title or judgment heading).
 * @property date - The document's date as a trimmed string. The exact format is implementation-specific (commonly ISO 8601).
 * @property court - Name of the issuing court or tribunal.
 * @property caseNumber - Official case identifier, docket number, or file reference.
 * @property summary - A short textual summary or abstract of the document's contents.
 * @property caseType - A label describing the type of case (for example: "civil", "criminal", "administrative").
 * @property area - Topical/jurisdictional area associated with the document (for example: "tax", "employment").
 * @property areaData - Optional structured details related to the area field; a free-form object for domain-specific attributes.
 * @property metadata - Optional arbitrary metadata for the extraction (e.g., source, confidence scores, processing timestamps).
 */
// Define a permissive JSON value type for record values that still produces
// a JSON Schema with explicit `type` in additionalProperties.
const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
    z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.object({}).passthrough()]),
)

const KeyValuePairSchema = z
    .object({
        key: z.string().trim(),
        value: z.string().trim(),
    })
    .strict()

const DocumentExtractionSchema = z
    .object({
        title: z.string().trim().nullable().optional(),
        date: z.string().trim().nullable().optional(),
        court: z.string().trim().nullable().optional(),
        caseNumber: z.string().trim().nullable().optional(),
        summary: z.string().trim().nullable().optional(),
        caseType: z.string().trim().nullable().optional(),
        area: z.string().trim().nullable().optional(),
        // Use arrays of strict key/value pairs so that the generated JSON
        // schema has additionalProperties=false at every object level.
        areaData: z.array(KeyValuePairSchema).nullable().optional(),
        metadata: z.array(KeyValuePairSchema).nullable().optional(),
    })
    .strict()
type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>

/**
 * Supported file types for document processing
 */
type FileKind = 'pdf' | 'html' | 'unknown'

// ===== SERVICE IMPLEMENTATION =====

// Temporary compatibility type until Prisma client is regenerated with new fields
type PrismaDocumentCompat = PrismaDocument & {
	caseType?: string | null
	area?: string | null
	areaData?: object | null
}

/**
 * Service for managing legal documents with AI-powered metadata extraction.
 *
 * This service provides comprehensive document management capabilities including:
 * - CRUD operations for documents
 * - File upload handling (PDF and HTML)
 * - AI-powered metadata extraction using OpenAI
 * - Text extraction from various file formats
 *
 * @injectable
 */
@Injectable()
export class DocumentService {
	private readonly logger = new Logger(DocumentService.name) // Logger instance for logging
	private openaiClient: OpenAI | null = null // OpenAI client instance for AI-powered features

	constructor(private readonly prisma: PrismaService) {} // Inject PrismaService for database access

	// ===== PUBLIC CRUD METHODS =====

	/**
	 * Retrieves all documents from the database
	 *
	 * @returns Promise resolving to array of DocumentType objects
	 */
	async getAllDocuments(): Promise<DocumentType[]> {
		this.logger.log('🔍 getAllDocuments: Fetching all documents from the database...')
		const documents = await this.prisma.document.findMany()

		this.logger.log(`📄 getAllDocuments: Retrieved ${documents.length} documents from the database.`)

		return documents.map((document) => this.mapToDocumentType(document))
	}

	/**
	 * Retrieves a single document by its ID
	 *
	 * @param id - The document ID to search for
	 * @returns Promise resolving to DocumentType or null if not found
	 */
	async getDocumentById(id: number): Promise<DocumentType | null> {
		if (typeof id !== 'number' || isNaN(id) || id <= 0) {
			this.logger.warn(`⚠️ getDocumentById: Invalid document ID provided: ${id}`)
			throw new BadRequestException('Invalid document ID provided.')
		}

		this.logger.log(`🔍 getDocumentById: Searching for document with ID: ${id}`)
		const document = await this.prisma.document.findUnique({ where: { id } })

		if (!document) {
			this.logger.warn(`⚠️ Document with ID ${id} not found.`)
			return null
		} else {
			this.logger.log(`✅ Document with ID ${id} found.`)
			return this.mapToDocumentType(document)
		}
	}

	/**
	 * Creates a document record and returns it mapped to DocumentType.
	 *
	 * This method supports two modes controlled by the `generateRandom` flag:
	 * - When `generateRandom` is true:
	 *   - A GUID is generated and used to produce a default filename if none is provided.
	 *   - Provided options (if any) are used to influence generated values.
	 *   - `generateRandomData` is called to synthesize a full set of create data.
	 *   - The synthesized data is persisted to the database via Prisma.
	 * - When `generateRandom` is false:
	 *   - `options.fileName` is required and must be a non-empty string; otherwise a
	 *     BadRequestException is thrown.
	 *   - `parseMetadata` and `parseAreaData` are used to normalize metadata and areaData.
	 *   - A create payload is assembled (with explicit assignments for `caseType`, `area`
	 *     and `areaData` to accommodate Prisma client typing/regeneration concerns) and
	 *     persisted via Prisma.
	 *
	 * Side effects:
	 * - Persists a document record to the database (this.prisma.document.create).
	 * - Emits informational logs about creation progress and created document ID.
	 *
	 * Notes:
	 * - The method casts create payloads to `any` to work around Prisma typing issues.
	 * - Any runtime errors from Prisma or other internal helpers will propagate to the caller.
	 *
	 * @param options - Options controlling document fields and metadata. When `generateRandom`
	 *                  is false this must include a valid `fileName`. When `generateRandom`
	 *                  is true the method will tolerate `options` being undefined and will
	 *                  synthesize missing fields.
	 * @param generateRandom - If true, auto-generate most document fields (with optional
	 *                         influence from `options`); if false, create exactly from
	 *                         provided `options` (subject to parsing/normalization).
	 *
	 * @returns A Promise that resolves to the created DocumentType (after mapping via
	 *          `mapToDocumentType`).
	 *
	 * @throws BadRequestException - If `generateRandom` is false and `options.fileName` is
	 *                               missing or empty.
	 * @throws Error - Propagates any underlying errors from helpers or the Prisma client.
	 */
	async createDocument(options: CreateDocumentOptions, generateRandom: boolean): Promise<DocumentType> {
		if (generateRandom) {
			const guid = this.generateGuid()

			const opts = options ?? {}

			// Generate filename when not provided
			const fileName = typeof opts.fileName === 'string' && opts.fileName.trim().length > 0 ? opts.fileName.trim() : `${guid()}.pdf`

			this.logger.log(`🆕 createDocument (auto) - Creating document with fileName: ${fileName}`)

			// Parse provided JSON fields if present, otherwise provide sensible dummy values
			const createData: Record<string, unknown> = this.generateRandomData(opts, fileName, guid)

			// Create the document record in the database
			const document = await this.prisma.document.create({
				data: createData as any,
			})

			this.logger.log(`📄 Auto-created document with ID: ${document.id}`)

			return this.mapToDocumentType(document)
		}

		if (!options.fileName || options.fileName.trim() === '') {
			throw new BadRequestException('fileName is required to create a document.')
		}

		this.logger.log(`🆕 Creating new document with fileName: ${options.fileName}`)

		const metadata = this.parseMetadata(options.metadata)
		const areaData = this.parseAreaData(options.areaData)

		// Prepare the data for creation
		const createData: Record<string, unknown> = {
			fileName: options.fileName,
			title: options.title ?? null,
			date: options.date ?? null,
			court: options.court ?? null,
			caseNumber: options.caseNumber ?? null,
			summary: options.summary ?? null,
			metadata,
		}

		// Assign new fields in a way that works before Prisma client is regenerated
		;(createData as any).caseType = options.caseType ?? null
		;(createData as any).area = options.area ?? null
		;(createData as any).areaData = areaData ?? null

		// Create the document record in the database
		const document = await this.prisma.document.create({
			data: createData as any, // Cast to any to bypass Prisma typing issues
		})

		this.logger.log(`📄 Document created with ID: ${document.id}`)

		// Return the created document mapped to DocumentType
		return this.mapToDocumentType(document)
	}

	/**
	 * Generate a creation payload for a Document using provided options with sensible defaults.
	 *
	 * This helper prepares a Record<string, unknown> suitable for passing to the ORM create call.
	 * It preserves explicit nulls provided in opts (e.g. opts.title === null -> title: null),
	 * while treating omitted properties or properties with value `undefined` as "missing" and substituting defaults.
	 *
	 * Behavior notes:
	 * - If opts has a "metadata" property (i.e. Object.prototype.hasOwnProperty.call(opts, 'metadata') is true),
	 *   the value is passed to parseMetadata and the parsed result is used. parseMetadata will throw a
	 *   BadRequestException if the provided metadata is invalid JSON.
	 * - If "metadata" is not present on opts, a default autogenerated Prisma.InputJsonValue describing provenance is used.
	 * - The same presence-check + parse/auto-default logic applies to "areaData" via parseAreaData.
	 * - For scalar fields (title, date, court, caseNumber, summary, caseType, area):
	 *   - An explicit null value is preserved.
	 *   - If the property is omitted or undefined, a default is provided.
	 * - Default caseNumber is synthesized using the provided guid() (prefix "AUTO-" + first 8 chars of guid()).
	 *
	 * @param opts - Options used to populate the document. May include optional properties:
	 *               title, date, court, caseNumber, summary, metadata, area, caseType, areaData.
	 * @param fileName - Filename to assign to the generated document record.
	 * @param guid - Function returning a unique identifier string; used to synthesize a default caseNumber when absent.
	 *
	 * @throws BadRequestException - If opts.metadata or opts.areaData are present but contain invalid JSON
	 *                               (thrown by parseMetadata/parseAreaData).
	 *
	 * @returns A Record<string, unknown> containing at minimum:
	 *          {
	 *            fileName: string,
	 *            title: string | null,
	 *            date: Date | null,
	 *            court: string | null,
	 *            caseNumber: string | null,
	 *            summary: string | null,
	 *            metadata: Prisma.InputJsonValue,
	 *            caseType: string | null,
	 *            area: string | null,
	 *            areaData: Prisma.InputJsonValue | null
	 *          }
	 *
	 * Default values when properties are omitted:
	 * - title: "Auto-generated Document"
	 * - date: new Date()
	 * - court: "Unknown Court"
	 * - caseNumber: `AUTO-${guid().slice(0, 8)}`
	 * - summary: autogenerated placeholder summary
	 * - metadata / areaData: small autogenerated JSON objects describing provenance
	 */
	private generateRandomData(opts: CreateDocumentOptions, fileName: string, guid: () => string) {
		let metadata: Prisma.InputJsonValue | undefined
		if (Object.prototype.hasOwnProperty.call(opts, 'metadata')) {
			// will throw BadRequestException if invalid JSON as before
			metadata = this.parseMetadata(opts.metadata)
		} else {
			metadata = {
				autogenerated: true,
				source: 'createDocument-auto',
				generatedAt: new Date().toISOString(),
			} as Prisma.InputJsonValue
		}

		let areaData: Prisma.InputJsonValue | undefined
		if (Object.prototype.hasOwnProperty.call(opts, 'areaData')) {
			// will throw BadRequestException if invalid JSON as before
			areaData = this.parseAreaData(opts.areaData)
		} else {
			areaData = {
				autogenerated: true,
				hint: 'placeholder areaData',
			} as Prisma.InputJsonValue
		}

		// Prepare the data for creation with dummy/default values where not provided
		const createData: Record<string, unknown> = {
			fileName,
			title: typeof opts.title !== 'undefined' ? (opts.title ?? null) : 'Auto-generated Document',
			date: typeof opts.date !== 'undefined' ? (opts.date ?? null) : new Date(),
			court: typeof opts.court !== 'undefined' ? (opts.court ?? null) : 'Unknown Court',
			caseNumber: typeof opts.caseNumber !== 'undefined' ? (opts.caseNumber ?? null) : `AUTO-${guid().slice(0, 8)}`,
			summary:
				typeof opts.summary !== 'undefined'
					? (opts.summary ?? null)
					: 'This is an autogenerated placeholder summary for testing or bootstrap purposes.',
			metadata,
		}
		;(createData as any).caseType = typeof opts.caseType !== 'undefined' ? (opts.caseType ?? null) : 'autogenerated'
		;(createData as any).area = typeof opts.area !== 'undefined' ? (opts.area ?? null) : 'autogenerated'
		;(createData as any).areaData = typeof areaData !== 'undefined' ? areaData : null
		return createData
	}

	/**
	 * Handles file upload with automatic text extraction and AI metadata enrichment
	 *
	 * This method processes uploaded files by:
	 * 1. Detecting file type (PDF or HTML)
	 * 2. Extracting raw text content
	 * 3. Using AI to extract metadata from the text
	 * 4. Merging AI-extracted data with provided options
	 * 5. Creating the document record
	 *
	 * @param file - The uploaded file stream
	 * @param options - Additional document options
	 * @returns Promise resolving to the created DocumentType
	 * @throws UnsupportedMediaTypeException if file type is not supported
	 * @throws BadRequestException if file processing fails
	 */
	async handleUpload(file: FileUpload, options: UploadDocumentOptions): Promise<DocumentType> {
		const { filename, mimetype } = file

		// Detect file type before processing the stream
		const fileKind = this.detectFileKind(filename, mimetype)
		if (fileKind === 'unknown') {
			throw new UnsupportedMediaTypeException('uploadDocument only supports PDF or HTML files.')
		}

		this.logger.debug(`Processing uploaded file: ${filename} as type: ${fileKind}`)

		// Extract text based on file type
		// eslint-disable-next-line prettier/prettier
		const rawText =
			fileKind === 'pdf' ? await this.extractPdfText(file.createReadStream()) : await this.extractHtmlText(file.createReadStream())

		this.logger.debug(`Extracted raw text length: ${rawText.length} characters`)

		// Attempt AI metadata enrichment if text was extracted
		const aiEnrichment = rawText.length > 0 ? await this.enrichMetadataFromText(rawText) : null

		this.logger.debug(`AI enrichment result: ${JSON.stringify(aiEnrichment)}`)

		// Prepare metadata by merging user input with extraction results
		const metadataInput = this.parseMetadata(options.metadata)
		const areaDataInput = this.parseAreaData(options.areaData)
		const combinedMetadata = this.mergeMetadata(metadataInput, {
			originalFileName: filename,
			mimeType: mimetype ?? null,
			rawText: rawText.length > 0 ? rawText : null,
			aiExtraction: aiEnrichment?.json ?? null,
		})

		this.logger.debug(`Combined metadata: ${JSON.stringify(combinedMetadata)}`)

		// Create document with merged data (user input takes precedence over AI)
		const uploadData: Record<string, unknown> = {
			fileName: filename,
			title: options.title ?? aiEnrichment?.fields.title ?? null,
			date: options.date ?? aiEnrichment?.fields.date ?? null,
			court: options.court ?? aiEnrichment?.fields.court ?? null,
			caseNumber: options.caseNumber ?? aiEnrichment?.fields.caseNumber ?? null,
			summary: options.summary ?? aiEnrichment?.fields.summary ?? null,
			metadata: combinedMetadata,
		}

		this.logger.debug(`Upload data prepared: ${JSON.stringify(uploadData)}`)

		// Assign additional properties via a local any reference to avoid parser/ASI edge-cases
		const _u = uploadData as any

		_u.caseType = options.caseType ?? aiEnrichment?.fields.caseType ?? null
		_u.area = options.area ?? aiEnrichment?.fields.area ?? null
		_u.areaData = typeof areaDataInput !== 'undefined' ? areaDataInput : (aiEnrichment?.fields.areaData ?? null)

		this.logger.debug(`🆕 Creating new document from upload: ${filename}`)

		// Create the document record in the database.
		const document = await this.prisma.document.create({
			data: uploadData as any,
		})

		this.logger.log(`📄 Document created with ID: ${document.id}`)

		return this.mapToDocumentType(document)
	}

	/**
	 * Updates an existing document with partial data
	 *
	 * Only provided fields will be updated. Uses hasOwnProperty to distinguish
	 * between undefined (don't update) and null (set to null).
	 *
	 * @param options - Update options with document ID and fields to update
	 * @returns Promise resolving to the updated DocumentType
	 * @throws BadRequestException if no fields provided or fileName is empty
	 * @throws NotFoundException if document doesn't exist
	 */
	async updateDocument(options: UpdateDocumentOptions): Promise<DocumentType> {
		const data: Prisma.DocumentUpdateInput & Record<string, unknown> = {}

		// Handle fileName with validation
		if (Object.prototype.hasOwnProperty.call(options, 'fileName')) {
			const fileName = options.fileName?.trim()
			if (!fileName) {
				throw new BadRequestException('fileName must be provided when updating.')
			}
			data.fileName = fileName
		}

		// Handle optional string fields (can be set to null)
		if (Object.prototype.hasOwnProperty.call(options, 'title')) {
			data.title = options.title ?? null
		}
		if (Object.prototype.hasOwnProperty.call(options, 'court')) {
			data.court = options.court ?? null
		}
		if (Object.prototype.hasOwnProperty.call(options, 'caseNumber')) {
			data.caseNumber = options.caseNumber ?? null
		}
		if (Object.prototype.hasOwnProperty.call(options, 'summary')) {
			data.summary = options.summary ?? null
		}

		// Handle classification fields
		if (Object.prototype.hasOwnProperty.call(options, 'caseType')) {
			;(data as any).caseType = options.caseType ?? null
		}
		if (Object.prototype.hasOwnProperty.call(options, 'area')) {
			;(data as any).area = options.area ?? null
		}

		// Handle date field
		if (Object.prototype.hasOwnProperty.call(options, 'date')) {
			data.date = options.date ?? null
		}

		// Handle metadata with special JSON handling
		if (Object.prototype.hasOwnProperty.call(options, 'metadata')) {
			if (options.metadata === null) {
				data.metadata = Prisma.JsonNull
			} else if (typeof options.metadata !== 'undefined') {
				const parsed = this.parseMetadata(options.metadata)
				if (typeof parsed !== 'undefined') {
					data.metadata = parsed
				}
			}
		}

		// Handle areaData JSON
		if (Object.prototype.hasOwnProperty.call(options, 'areaData')) {
			if (options.areaData === null) {
				;(data as any).areaData = Prisma.JsonNull
			} else if (typeof options.areaData !== 'undefined') {
				const parsed = this.parseAreaData(options.areaData)
				if (typeof parsed !== 'undefined') {
					;(data as any).areaData = parsed
				}
			}
		}

		// Ensure at least one field is being updated
		if (Object.keys(data).length === 0) {
			throw new BadRequestException('At least one field must be provided to update.')
		}

		// Attempt the update operation
		try {
			const document = await this.prisma.document.update({
				where: { id: options.id },
				data,
			})

			this.logger.debug(`✅ Document updated successfully: ${options.id}`)

			return this.mapToDocumentType(document)
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
				throw new NotFoundException(`Document with id ${options.id} was not found.`)
			}
			throw error
		}
	}

	/**
	 * Deletes a document by ID
	 *
	 * @param id - The document ID to delete
	 * @returns Promise resolving to the deleted DocumentType
	 * @throws NotFoundException if document doesn't exist
	 */
	async deleteDocument(id: number): Promise<DocumentType> {
		try {
			const document = await this.prisma.document.delete({ where: { id } })
			return this.mapToDocumentType(document)
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
				throw new NotFoundException(`Document with id ${id} was not found.`)
			}
			throw error
		}
	}

	// ===== PRIVATE MAPPING METHODS =====

	/**
	 * Generates a GUID using crypto.randomUUID if available, otherwise falls back to manual generation
	 *
	 * @returns Function that generates a GUID string
	 */
	private generateGuid() {
		return (): string => {
			try {
				// Node and modern runtimes.
				const rnd = (globalThis as any).crypto?.randomUUID
				if (typeof rnd === 'function') return rnd()
			} catch {
				this.logger.warn('crypto.randomUUID is not available; falling back to manual GUID generation.')
			}
			// Fallback
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
				const r = (Math.random() * 16) | 0
				const v = c === 'x' ? r : (r & 0x3) | 0x8

				this.logger.debug(`🔢 Generated GUID: ${v}`)
				return v.toString(16)
			})
		}
	}

	/**
	 * Map a Prisma document record to the GraphQL DocumentType DTO.
	 *
	 * Notes:
	 * - Preserves explicit nulls from the DB.
	 * - Provides safe defaults for missing/undefined fields.
	 * - Handles Prisma client compatibility fields (caseType, area, areaData)
	 *   that may not yet be present on the generated PrismaDocument type.
	 *
	 * @param document - Document record returned by Prisma
	 * @returns DocumentType ready for GraphQL response
	 */
	private mapToDocumentType(document: PrismaDocument): DocumentType {
		const compat = document as unknown as PrismaDocumentCompat

		const dto = new DocumentType()

		// Core identifying fields
		dto.id = document.id
		dto.fileName = (typeof document.fileName === 'string' ? document.fileName.trim() : '') || ''
		dto.title = typeof document.title === 'string' ? document.title : null

		// Date fields: preserve Date values, coerce strings if necessary, otherwise null
		const coerceDateField = (value: unknown): Date | null => {
			if (value instanceof Date) return value
			if (typeof value === 'string' && value.trim().length > 0) {
				const d = new Date(value)
				return Number.isNaN(d.getTime()) ? null : d
			}
			return null
		}
		dto.date = coerceDateField(document.date)

		// Simple string fields (may be null)
		dto.court = typeof document.court === 'string' ? document.court : null
		dto.caseNumber = typeof document.caseNumber === 'string' ? document.caseNumber : null
		dto.summary = typeof document.summary === 'string' ? document.summary : null

		// Compatibility fields that may not be present on the generated Prisma type
		dto.caseType = typeof compat.caseType === 'string' ? compat.caseType : null
		dto.area = typeof compat.area === 'string' ? compat.area : null

		// areaData and metadata stored as JSON-like values in DB. Convert to string for GraphQL.
		dto.areaData = this.stringifyMetadata((compat.areaData ?? null) as Prisma.JsonValue | null)
		dto.metadata = this.stringifyMetadata(document.metadata ?? null)

		// Timestamps: ensure Date objects (fall back to current time if coercion fails)
		// Todo: Handle this more securely / gracefully.
		// eslint-disable-next-line prettier/prettier
		dto.createdAt =
			coerceDateField(document.createdAt) ??
			(this.logger.warn('Failed to coerce createdAt; falling back to current time.'), new Date())
		// eslint-disable-next-line prettier/prettier
		dto.updatedAt =
			coerceDateField(document.updatedAt) ??
			(this.logger.warn('Failed to coerce updatedAt; falling back to current time.'), new Date())

		return dto
	}

	// ===== PRIVATE METADATA HANDLING METHODS =====

	/**
	 * Converts database JSON metadata to string for GraphQL response
	 *
	 * @param metadata - JSON value from database
	 * @returns Stringified JSON or null
	 */
	private stringifyMetadata(metadata: Prisma.JsonValue | null): string | null {
		// Handle null/undefined
		if (metadata === null || typeof metadata === 'undefined') {
			this.logger.debug('stringifyMetadata: Received null or undefined metadata; returning null.')
			return null
		}

		// Return strings as-is
		if (typeof metadata === 'string') {
			this.logger.debug('stringifyMetadata: Metadata is already a string; returning as-is.')
			return metadata
		}

		// Attempt to stringify other JSON types
		try {
			this.logger.debug('stringifyMetadata: Stringifying metadata JSON value.')
			return JSON.stringify(metadata)
		} catch {
			this.logger.warn('stringifyMetadata: Failed to stringify metadata; returning null.')
			return null
		}
	}
	/**
	 * Parses string metadata to JSON for database storage
	 *
	 * Control flow:
	 * - If metadata is missing or empty -> log and return undefined (do not set)
	 * - Else attempt to parse -> log before/after; on failure log and rethrow BadRequestException
	 *
	 * @param metadata - Optional JSON string
	 * @returns Parsed JSON value or undefined
	 * @throws BadRequestException if JSON is invalid
	 */
	private parseMetadata(metadata?: string | null): Prisma.InputJsonValue | undefined {
		// Guard: no metadata provided (undefined or null or empty/whitespace string)
		if (typeof metadata !== 'string' || metadata.trim().length === 0) {
			this.logger.debug('ℹ️ parseMetadata: No metadata provided; returning undefined.')
			return undefined
		}

		// Attempt to parse JSON with logging around the operation
		this.logger.debug('🔍 parseMetadata: Parsing metadata string to JSON...')
		try {
			const parsed = this.parseJsonField('metadata', metadata)
			this.logger.debug('✅ parseMetadata: Metadata parsed successfully.')
			return parsed
		} catch (error) {
			// parseJsonField throws BadRequestException on invalid JSON
			this.logger.warn(`⚠️ parseMetadata: Invalid metadata JSON provided. ${String(error)}`)
			throw error
		}
	}

	/**
	 * Parses string areaData to JSON for database storage
	 */
	private parseAreaData(areaData?: string | null): Prisma.InputJsonValue | undefined {
		return this.parseJsonField('areaData', areaData)
	}

	/**
	 * Generic JSON parser for string fields with custom label
	 */
	private parseJsonField(label: string, value?: string | null): Prisma.InputJsonValue | undefined {
		if (!value) {
			return undefined
		}
		try {
			return JSON.parse(value) as Prisma.InputJsonValue
		} catch {
			throw new BadRequestException(`${label} must be valid JSON when provided.`)
		}
	}

	/**
	 * Merges user-provided metadata with runtime-extracted metadata
	 *
	 * User metadata takes precedence, with additional fields layered in.
	 *
	 * @param metadata - User-provided metadata
	 * @param additional - Runtime-extracted metadata
	 * @returns Merged metadata object
	 */
	private mergeMetadata(metadata: Prisma.InputJsonValue | undefined, additional: Record<string, unknown>): Prisma.InputJsonValue {
		const baseMetadata: Prisma.InputJsonValue = additional as Prisma.InputJsonValue

		if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
			return {
				...(metadata as Record<string, Prisma.InputJsonValue>),
				...additional,
			} as Prisma.InputJsonValue
		}

		if (typeof metadata !== 'undefined') {
			return {
				value: metadata,
				...additional,
			} as Prisma.InputJsonValue
		}

		return baseMetadata
	}

	// ===== PRIVATE AI ENRICHMENT METHODS =====

	/**
	 * Attempts to enrich document metadata by extracting structured fields from the provided raw text
	 * via the OpenAI Responses API, validating the result against a Zod schema, and mapping it to the
	 * internal AI extraction model.
	 *
	 * Behavior:
	 * - Requires the OPENAI_API_KEY environment variable; returns null (and logs a warning) if missing.
	 * - Chooses the model from OPENAI_CHAT_MODEL, then MODEL_PRIMARY, defaulting to "gpt-5.1-mini".
	 * - Builds a domain-specific prompt and requests a structured parse using `DocumentExtractionSchema`
	 *   through `zodTextFormat`.
	 * - Logs start/end, elapsed time, and (when provided) token usage statistics.
	 * - On success, maps the parsed `DocumentExtraction` to `AiExtractionResult`.
	 *
	 * Failure modes:
	 * - Returns null if the API key is missing, if the structured response is empty/unparseable,
	 *   or if any API/parse error occurs (errors are caught and logged).
	 *
	 * Side effects:
	 * - Produces info/warn/error logs detailing progress, timing, and usage.
	 *
	 * @param rawText - The unstructured document text from which to extract metadata.
	 * @returns A promise resolving to the mapped AI extraction result, or null if enrichment is unavailable or unsuccessful.
	 * @internal
	 */
	private async enrichMetadataFromText(rawText: string): Promise<AiExtractionResult | null> {
		const apiKey = process.env.OPENAI_API_KEY
		if (!apiKey) {
			this.logger.warn('🔑 OPENAI_API_KEY is not configured; continuing without AI metadata enrichment.')
			return null
		}

		const client = this.getOpenAiClient(apiKey)
		const model = process.env.OPENAI_CHAT_MODEL ?? process.env.MODEL_PRIMARY ?? 'gpt-5-mini'
		const prompt = this.buildExtractionPrompt(rawText)
		const stopwatchStart = Date.now()

		// Local logging helper to handle different logger interfaces
		const logInfo = (message: string): void => {
			const infoMethod = (this.logger as unknown as { info?: (msg: string) => void }).info
			if (typeof infoMethod === 'function') {
				infoMethod.call(this.logger, message)
			} else {
				this.logger.log(message)
			}
		}

		logInfo(`Starting OpenAI metadata enrichment (model=${model}, rawChars=${rawText.length}, promptChars=${prompt.length}).`)

		/**
		 * Attempt to call OpenAI Responses API with structured Zod response format
		 * and parse the result according to DocumentExtractionSchema.
		 *
		 * On success, map the parsed result to AiExtractionResult.
		 * On failure, log the error and return null.
		 */
		try {
			const response = await client.responses.parse({
				model,
				input: [
					{
						role: 'system',
						content:
							'You are an expert at structured data extraction for legal documents. Fill in each field when confident and use null when a field cannot be determined.',
					},
					{
						role: 'user',
						content: prompt,
					},
				],
				text: {
					format: zodTextFormat(DocumentExtractionSchema, 'document_extraction'),
				},
			})

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			const parsed = response.output_parsed as DocumentExtraction | null
			if (!parsed) {
				const elapsedMs = Date.now() - stopwatchStart
				this.logger.warn(`❌ OpenAI structured response failed to return a parsed payload after ${elapsedMs}ms.`)
				return null
			}

			// Log usage statistics if available
			const elapsedMs = Date.now() - stopwatchStart
			const usageRecord = (response as { usage?: Record<string, unknown> }).usage

			// Helper to resolve usage values with fallback keys
			const resolveUsageValue = (keys: string[]): number | null => {
				if (!usageRecord) {
					this.logger.debug('ℹ️ OpenAI usage data is unavailable in the response.')
					return null
				}

				// Iterate through keys to find the first valid numeric value
				for (const key of keys) {
					const value = usageRecord[key]
					if (typeof value === 'number' && Number.isFinite(value)) {
						this.logger.debug(`ℹ️ OpenAI usage: ${key} = ${value}`)
						return value
					}
				}
				return null
			}

			// Extract usage statistics with fallbacks
			// Developer Note: some API's use different keys here, that's why we check multiple options.
			const promptTokens = resolveUsageValue(['prompt_tokens', 'input_tokens'])
			const completionTokens = resolveUsageValue(['completion_tokens', 'output_tokens'])
			const totalTokens = resolveUsageValue(['total_tokens', 'total'])

			// Log detailed success message with usage stats if available
			if (usageRecord) {
				logInfo(
					`💸 OpenAI metadata enrichment succeeded in ${elapsedMs}ms (model=${model}, promptTokens=${promptTokens ?? 'n/a'}, completionTokens=${completionTokens ?? 'n/a'}, totalTokens=${totalTokens ?? 'n/a'}).`,
				)
			} else {
				logInfo(`💸 OpenAI metadata enrichment succeeded in ${elapsedMs}ms (model=${model}, usage=unavailable).`)
			}

			return this.mapAiExtraction(parsed)
		} catch (error) {
			const elapsedMs = Date.now() - stopwatchStart
			this.logger.error(`Failed to enrich metadata via OpenAI after ${elapsedMs}ms.`, error as Error)
			return null
		}
	}

	/**
	 * Gets or creates OpenAI client instance (singleton pattern)
	 *
	 * @param apiKey - OpenAI API key
	 * @returns OpenAI client instance
	 * @throws Error if client initialization fails
	 */
	private getOpenAiClient(apiKey: string): OpenAI {
		if (!this.openaiClient) {
			try {
				this.openaiClient = new OpenAI({ apiKey })
			} catch (error) {
				throw new Error(`Failed to initialize OpenAI client: ${String(error)}`)
			}
		}
		return this.openaiClient
	}

	/**
	 * Builds extraction prompt for OpenAI with document text
	 *
	 * Limits text to 6000 characters to stay within token limits while
	 * providing sufficient context for metadata extraction.
	 *
	 * @param rawText - Full document text
	 * @returns Formatted prompt string
	 */
	private buildExtractionPrompt(rawText: string): string {
		const excerpt = rawText.length > 6000 ? `${rawText.slice(0, 6000)}...` : rawText

		return [
			'Extract structured metadata for a legal document. Respond ONLY with valid JSON that matches this object shape:',
            '{"title": null, "date": null, "court": null, "caseNumber": null, "summary": null, "caseType": null, "area": null, "areaData": null, "metadata": null}',
			'Rules:',
			'1. Output must be a single JSON object with exactly the keys above (no extra or missing keys).',
			'2. Use null when a value cannot be determined confidently.',
			'3. Dates must be ISO 8601 strings (YYYY-MM-DD or full timestamp).',
			'4. Strings should be concise and omit leading labels (e.g., no "Case Number:" prefixes).',
            '5. areaData must be either null or an array of objects: [{"key": string, "value": string}]. No extra fields allowed on each object.',
            '6. metadata must be either null or an array of objects: [{"key": string, "value": string}]. No extra fields allowed on each object.',
			'',
			'Field guidance:',
			'- title: Official case caption or document heading.',
			'- date: Filing, judgment, or most relevant event date.',
			'- court: Court, tribunal, or issuing authority.',
			'- caseNumber: Docket, file, or reference number.',
			'- summary: 1-3 sentence plain-language synopsis of the document.',
			'- caseType: High-level classification (e.g., civil, criminal, administrative).',
			'- area: Practice area or topic (e.g., contract law, employment, tax).',
			'- areaData: Structured JSON object with optional domain details (parties, claims, statutes, damages, outcomes, etc.).',
			'- metadata: Supplemental JSON object for extraction context (confidence, language, processing notes).',
			'',
			'Document excerpt:',
			'"""',
			excerpt,
			'"""',
		].join('\n')
	}

	/**
	 * Safely extracts JSON from OpenAI response text
	 *
	 * Handles cases where AI response includes extra text around JSON.
	 * Uses bracket matching to find complete JSON objects.
	 *
	 * @param content - Raw AI response content
	 * @returns Parsed JSON object or null if no valid JSON found
	 */
	/**
	 * Maps the structured OpenAI response to the internal extraction format.
	 *
	 * @param extraction - Parsed payload returned by OpenAI structured outputs
	 * @returns Structured extraction result
	 */
	private mapAiExtraction(extraction: DocumentExtraction): AiExtractionResult {
		const title = this.coerceString(extraction.title)
		const court = this.coerceString(extraction.court)
		const caseNumber = this.coerceString(extraction.caseNumber)
		const summary = this.coerceString(extraction.summary)
		const caseType = this.coerceString(extraction.caseType)
		const area = this.coerceString(extraction.area)
		const date = this.coerceDate(extraction.date)
		const rawDate = typeof extraction.date === 'string' && extraction.date.trim().length > 0 ? extraction.date.trim() : null
		const areaData = (extraction.areaData ?? null) as Prisma.JsonValue | null
		const metadata = (extraction.metadata ?? null) as Prisma.JsonValue | null

		const jsonPayload: Record<string, unknown> = {
			title,
			date: rawDate,
			court,
			caseNumber,
			summary,
			caseType,
			area,
			areaData,
			metadata,
		}

		return {
			fields: {
				title,
				date,
				court,
				caseNumber,
				summary,
				caseType,
				area,
				areaData,
				metadata,
			},
			json: jsonPayload,
		}
	}

	// ===== PRIVATE TYPE COERCION METHODS =====

	/**
	 * Safely coerces unknown value to string or null
	 *
	 * @param value - Value to coerce
	 * @returns Trimmed string if valid, null otherwise
	 */
	private coerceString(value: unknown): string | null {
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim()
		}
		return null
	}

	/**
	 * Safely coerces unknown value to Date or null
	 *
	 * @param value - Value to coerce (expected to be ISO date string)
	 * @returns Valid Date object or null
	 */
	private coerceDate(value: unknown): Date | null {
		if (typeof value !== 'string') {
			return null
		}
		const trimmed = value.trim()
		if (!trimmed) {
			return null
		}
		const parsed = new Date(trimmed)

		return Number.isNaN(parsed.getTime()) ? null : parsed
	}

	// ===== PRIVATE FILE PROCESSING METHODS =====

	/**
	 * Detects file type based on filename and MIME type
	 *
	 * @param filename - Original filename with extension
	 * @param mimetype - Optional MIME type from upload
	 * @returns File type classification
	 */
	private detectFileKind(filename: string, mimetype?: string | null): FileKind {
		if (!filename || filename.trim().length === 0) {
			throw new BadRequestException('Filename must be provided to detect file type.')
		}

		// Normalize inputs for comparison
		const normalizedMime = mimetype?.toLowerCase() ?? ''
		const extension = extname(filename).toLowerCase()

		// Determine file kind based on MIME type or extension
		if (normalizedMime.includes('pdf') || extension === '.pdf') {
			return 'pdf'
		} else if (normalizedMime.includes('html') || extension === '.html' || extension === '.htm') {
			return 'html'
		}

		return 'unknown'
	}

	/**
	 * Extracts text content from PDF file stream
	 *
	 * @param stream - Readable stream of PDF data
	 * @returns Promise resolving to extracted text
	 * @throws BadRequestException if PDF is empty or parsing fails
	 */
	private async extractPdfText(stream: Readable): Promise<string> {
		if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
			throw new BadRequestException('❌ Invalid stream provided for PDF text extraction.')
		}

		this.logger.debug('🔄 extractPdfText: Converting PDF stream to buffer...')

		// Convert stream to buffer for pdf-parse
		const buffer = await this.streamToBuffer(stream)
		if (buffer.length === 0) {
			throw new BadRequestException('❌ Uploaded PDF file is empty.')
		}

		// Attempt to parse PDF buffer to extract text
		this.logger.debug('🔄 extractPdfText: Attempting to parse PDF buffer for text extraction...')
		try {
			const result: PdfParseResult = await pdfParse(buffer)
			this.logger.debug(`✅ extractPdfText: Extracted ${result.text.length} characters of text from PDF.`)
			return result.text.trim()
		} catch (error) {
			throw new BadRequestException(`❌ Failed to parse PDF: ${String(error)}`)
		}
	}

	/**
	 * Extracts text content from HTML file stream
	 *
	 * Uses Cheerio to parse HTML and extract text from body element,
	 * falling back to entire document if no body tag found.
	 *
	 * @param stream - Readable stream of HTML data
	 * @returns Promise resolving to extracted text
	 * @throws BadRequestException if HTML parsing fails
	 */
	private async extractHtmlText(stream: Readable): Promise<string> {
		if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
			throw new BadRequestException('❌ Invalid stream provided for HTML text extraction.')
		}

		this.logger.debug('🔄 extractHtmlText: Converting HTML stream to string...')

		const html = await this.streamToString(stream)

		try {
			const $ = loadHtml(html)
			if (!$ || typeof $ !== 'function') {
				throw new Error('❌ Failed to parse HTML content - invalid parser result')
			}

			// Attempt to extract text from body element
			const bodyElement = $('body')

			// Fallback to entire document if no body tag found
			if (!bodyElement || bodyElement.length === 0) {
				const textContent = $.text()
				return textContent.replace(/\s+/g, ' ').trim()
			}

			// Extract and normalize text from body
			const textContent = bodyElement.text()

			// Normalize whitespace and trim
			return textContent.replace(/\s+/g, ' ').trim()
		} catch (error) {
			throw new BadRequestException(`❌ Failed to parse HTML: ${String(error)}`)
		}
	}

	// ===== PRIVATE STREAM UTILITY METHODS =====

	/**
	 * Converts readable stream to Buffer
	 *
	 * @param stream - Readable stream to convert
	 * @returns Promise resolving to Buffer
	 */
	private async streamToBuffer(stream: Readable): Promise<Buffer> {
		if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
			throw new BadRequestException('Invalid stream provided for conversion to buffer.')
		}

		this.logger.debug('🔄 streamToBuffer: Converting stream to buffer...')
		const chunks: Buffer[] = []

		let chunkCount = 0

		// Accumulate data chunks from the stream
		for await (const chunk of stream) {
			this.logger.debug(`🔄 streamToBuffer: Received chunk ${chunkCount}`)
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
			chunkCount++
		}

		this.logger.debug(`✅ streamToBuffer: Completed reading stream with ${chunkCount} chunks.`)

		return Buffer.concat(chunks)
	}

	/**
	 * Converts readable stream to string
	 *
	 * @param stream - Readable stream to convert
	 * @param encoding - Text encoding to use (default: utf8)
	 * @returns Promise resolving to string
	 */
	private async streamToString(stream: Readable, encoding: BufferEncoding = 'utf8'): Promise<string> {
		if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
			throw new BadRequestException('❌ Invalid stream provided for conversion to string.')
		}

		this.logger.debug('🔄 streamToString: Converting stream to string...')

		const buffer = await this.streamToBuffer(stream)

		return buffer.toString(encoding)
	}
}
