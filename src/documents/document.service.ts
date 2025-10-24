// Core NestJS imports
import { BadRequestException, Injectable, Logger, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common'

// Database imports
import { Prisma } from '@prisma/client'
import type { Document as PrismaDocument } from '@prisma/client'

// External library imports
import { load as loadHtml } from 'cheerio'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import pdfParse from 'pdf-parse'
import type { FileUpload } from 'graphql-upload'
import { z } from 'zod'

// Node.js imports
import { extname } from 'node:path'
import type { Readable } from 'node:stream'

// Local imports
import { DocumentType } from './document.model'
import { PrismaService } from '../prisma/prisma.service'

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
    title?: string
    date?: Date
    court?: string
    caseNumber?: string
    summary?: string
    metadata?: string
    caseType?: string
    area?: string
    areaData?: string
}

/**
 * Options for uploading a document (excludes fileName as it comes from the file)
 */
type UploadDocumentOptions = Omit<CreateDocumentOptions, 'fileName'>

/**
 * Options for updating an existing document
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
 * Result from AI metadata extraction
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
    }
    json: Record<string, unknown>
}

const DocumentExtractionSchema = z.object({
    title: z.string().trim().nullable().optional(),
    date: z.string().trim().nullable().optional(),
    court: z.string().trim().nullable().optional(),
    caseNumber: z.string().trim().nullable().optional(),
    summary: z.string().trim().nullable().optional(),
    caseType: z.string().trim().nullable().optional(),
    area: z.string().trim().nullable().optional(),
    areaData: z.record(z.any()).nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
})
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
    private readonly logger = new Logger(DocumentService.name)
    private openaiClient: OpenAI | null = null

    constructor(private readonly prisma: PrismaService) {}

    // ===== PUBLIC CRUD METHODS =====

    /**
     * Retrieves all documents from the database
     *
     * @returns Promise resolving to array of DocumentType objects
     */
    async getAllDocuments(): Promise<DocumentType[]> {
        const documents = await this.prisma.document.findMany()
        return documents.map((document) => this.mapToDocumentType(document))
    }

    /**
     * Retrieves a single document by its ID
     *
     * @param id - The document ID to search for
     * @returns Promise resolving to DocumentType or null if not found
     */
    async getDocumentById(id: number): Promise<DocumentType | null> {
        const document = await this.prisma.document.findUnique({ where: { id } })
        return document ? this.mapToDocumentType(document) : null
    }

    /**
     * Creates a new document with the provided options
     *
     * @param options - Document creation options
     * @returns Promise resolving to the created DocumentType
     * @throws BadRequestException if metadata is invalid JSON
     */
    async createDocument(options: CreateDocumentOptions): Promise<DocumentType> {
        const metadata = this.parseMetadata(options.metadata)
        const areaData = this.parseAreaData(options.areaData)

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ;(createData as any).caseType = options.caseType ?? null
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ;(createData as any).area = options.area ?? null
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ;(createData as any).areaData = areaData ?? null

        const document = await this.prisma.document.create({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: createData as any,
        })

        return this.mapToDocumentType(document)
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

        // Extract text based on file type
        const rawText = fileKind === 'pdf' ? await this.extractPdfText(file.createReadStream()) : await this.extractHtmlText(file.createReadStream())

        // Attempt AI metadata enrichment if text was extracted
        const aiEnrichment = rawText.length > 0 ? await this.enrichMetadataFromText(rawText) : null

        // Prepare metadata by merging user input with extraction results
        const metadataInput = this.parseMetadata(options.metadata)
        const areaDataInput = this.parseAreaData(options.areaData)
        const combinedMetadata = this.mergeMetadata(metadataInput, {
            originalFileName: filename,
            mimeType: mimetype ?? null,
            rawText: rawText.length > 0 ? rawText : null,
            aiExtraction: aiEnrichment?.json ?? null,
        })

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
        // assign additional properties via a local any reference to avoid parser/ASI edge-cases
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const _u = uploadData as any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        _u.caseType = options.caseType ?? aiEnrichment?.fields.caseType ?? null
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        _u.area = options.area ?? aiEnrichment?.fields.area ?? null
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        _u.areaData = typeof areaDataInput !== 'undefined' ? areaDataInput : (aiEnrichment?.fields.areaData ?? null)

        const document = await this.prisma.document.create({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: uploadData as any,
        })

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            ;(data as any).caseType = options.caseType ?? null
        }
        if (Object.prototype.hasOwnProperty.call(options, 'area')) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                ;(data as any).areaData = Prisma.JsonNull
            } else if (typeof options.areaData !== 'undefined') {
                const parsed = this.parseAreaData(options.areaData)
                if (typeof parsed !== 'undefined') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    ;(data as any).areaData = parsed
                }
            }
        }

        // Ensure at least one field is being updated
        if (Object.keys(data).length === 0) {
            throw new BadRequestException('At least one field must be provided to update.')
        }

        try {
            const document = await this.prisma.document.update({
                where: { id: options.id },
                data,
            })
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
     * Maps a Prisma document to the GraphQL DocumentType
     *
     * @param document - Prisma document from database
     * @returns Mapped DocumentType for GraphQL response
     */
    private mapToDocumentType(document: PrismaDocument): DocumentType {
        const documentType = new DocumentType()
        documentType.id = document.id
        documentType.fileName = document.fileName
        documentType.title = document.title ?? null
        documentType.date = document.date ?? null
        documentType.court = document.court ?? null
        documentType.caseNumber = document.caseNumber ?? null
        documentType.summary = document.summary ?? null
        const compat = document as unknown as PrismaDocumentCompat
        documentType.caseType = compat.caseType ?? null
        documentType.area = compat.area ?? null
        documentType.areaData = this.stringifyMetadata(compat.areaData ?? null)
        documentType.metadata = this.stringifyMetadata(document.metadata)
        documentType.createdAt = document.createdAt
        documentType.updatedAt = document.updatedAt

        return documentType
    }

    // ===== PRIVATE METADATA HANDLING METHODS =====

    /**
     * Converts database JSON metadata to string for GraphQL response
     *
     * @param metadata - JSON value from database
     * @returns Stringified JSON or null
     */
    private stringifyMetadata(metadata: Prisma.JsonValue | null): string | null {
        if (metadata === null || typeof metadata === 'undefined') {
            return null
        }

        if (typeof metadata === 'string') {
            return metadata
        }

        try {
            return JSON.stringify(metadata)
        } catch {
            return null
        }
    }

    /**
     * Parses string metadata to JSON for database storage
     *
     * @param metadata - Optional JSON string
     * @returns Parsed JSON value or undefined
     * @throws BadRequestException if JSON is invalid
     */
    private parseMetadata(metadata?: string | null): Prisma.InputJsonValue | undefined {
        return this.parseJsonField('metadata', metadata)
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
     * Enriches document metadata using OpenAI text analysis
     *
     * Sends document text to OpenAI to extract structured metadata including
     * title, date, court, case number, and summary.
     *
     * @param rawText - Extracted document text
     * @returns Promise resolving to extraction result or null if unavailable
     */
    private async enrichMetadataFromText(rawText: string): Promise<AiExtractionResult | null> {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY is not configured; continuing without AI metadata enrichment.')
            return null
        }

        const client = this.getOpenAiClient(apiKey)
        const model = process.env.OPENAI_CHAT_MODEL ?? process.env.MODEL_PRIMARY ?? 'gpt-4.1-mini'
        const prompt = this.buildExtractionPrompt(rawText)

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
                this.logger.warn('OpenAI structured response returned no parsed payload.')
                return null
            }

            return this.mapAiExtraction(parsed)
        } catch (error) {
            this.logger.error('Failed to enrich metadata via OpenAI.', error as Error)
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
            'Extract metadata from the following legal document text. Return STRICT JSON with exactly these keys:',
            'title, date, court, caseNumber, summary.',
            'Values may be null when unknown. Date must be ISO 8601 if present.',
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
        const normalizedMime = mimetype?.toLowerCase() ?? ''
        const extension = extname(filename).toLowerCase()

        if (normalizedMime.includes('pdf') || extension === '.pdf') {
            return 'pdf'
        }

        if (normalizedMime.includes('html') || extension === '.html' || extension === '.htm') {
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
        const buffer = await this.streamToBuffer(stream)
        if (buffer.length === 0) {
            throw new BadRequestException('Uploaded PDF file is empty.')
        }

        try {
            const result: PdfParseResult = await pdfParse(buffer)
            return result.text.trim()
        } catch (error) {
            throw new BadRequestException(`Failed to parse PDF: ${String(error)}`)
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
        const html = await this.streamToString(stream)

        try {
            const $ = loadHtml(html)
            if (!$ || typeof $ !== 'function') {
                throw new Error('Failed to parse HTML content - invalid parser result')
            }

            const bodyElement = $('body')
            if (!bodyElement || bodyElement.length === 0) {
                // Fallback to entire document if no body tag found
                const textContent = $.text()
                return textContent.replace(/\s+/g, ' ').trim()
            }

            const textContent = bodyElement.text()
            return textContent.replace(/\s+/g, ' ').trim()
        } catch (error) {
            throw new BadRequestException(`Failed to parse HTML: ${String(error)}`)
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
        const chunks: Buffer[] = []

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
        }

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
        const buffer = await this.streamToBuffer(stream)
        return buffer.toString(encoding)
    }
}
