import { Injectable, Logger } from '@nestjs/common';
import { DocumentProcessorServiceClient, protos } from '@google-cloud/documentai';

/**
 * Configuration values required to call the Google Document AI API.
 */
interface DocumentAiConfig {
    projectId: string;
    location: string;
    processorId: string;
    apiEndpoint?: string;
}

/**
 * Structured response from Document AI text extraction.
 */
export interface DocumentAiExtraction {
    /**
     * Complete text returned by the Document AI processor.
     */
    text: string;
    /**
     * Paragraphs detected on each processed page (flattened).
     */
    paragraphs: string[];
    /**
     * Fully-qualified processor resource path used for the request.
     */
    processorName: string;
    /**
     * Number of pages processed.
     */
    pageCount: number;
}

type Document = protos.google.cloud.documentai.v1.IDocument;
type Paragraph = protos.google.cloud.documentai.v1.Document.Page.IParagraph;
type TextAnchor = protos.google.cloud.documentai.v1.Document.ITextAnchor;

/**
 * Thin wrapper around Google Document AI providing convenience helpers for the NestJS app.
 *
 * This service takes care of reading configuration from environment variables, initialising
 * the client only when needed, and translating Document AI responses into simple data
 * structures that can be merged into the application's metadata pipeline.
 */
@Injectable()
export class DocumentAiService {
    private readonly logger = new Logger(DocumentAiService.name);
    private readonly config: DocumentAiConfig | null;
    private client: DocumentProcessorServiceClient | null = null;

    constructor() {
        this.config = this.loadConfig();
        if (!this.config) {
            this.logger.debug(
                'Document AI configuration not detected (set DOCUMENT_AI_PROJECT_ID, DOCUMENT_AI_LOCATION, and DOCUMENT_AI_PROCESSOR_ID to enable).',
            );
        }
    }

    /**
     * Uses Document AI to extract full text and paragraph data from a PDF buffer.
     *
     * Returns `null` when configuration is missing or when the processor response
     * does not contain text that we can use, allowing the caller to fall back to
     * local parsing strategies.
     *
     * @param buffer - Raw PDF bytes
     * @param mimeType - Optional MIME type (defaults to application/pdf)
     * @returns Document AI extraction payload or null if unavailable
     */
    async extractTextFromPdf(
        buffer: Buffer,
        mimeType: string = 'application/pdf',
    ): Promise<DocumentAiExtraction | null> {
        if (!this.config) {
            return null;
        }

        const processorName = this.buildProcessorName(this.config);

        try {
            const client = this.getClient(this.config);
            const request: protos.google.cloud.documentai.v1.IProcessRequest = {
                name: processorName,
                rawDocument: {
                    content: buffer.toString('base64'),
                    mimeType,
                },
            };

            const [result] = await client.processDocument(request);
            const document = result?.document;

            if (!document) {
                this.logger.warn('Document AI response did not include a document payload.');
                return null;
            }

            const text = (document.text ?? '').trim();
            if (!text) {
                this.logger.warn('Document AI returned an empty text payload.');
                return null;
            }

            const paragraphs = this.extractParagraphs(document);
            const pageCount = document.pages?.length ?? 0;

            return {
                text,
                paragraphs,
                processorName,
                pageCount,
            };
        } catch (error) {
            this.logger.error(
                `Failed to process document via Google Document AI (${error instanceof Error ? error.message : String(error)}).`,
            );
            return null;
        }
    }

    /**
     * Lazily creates a DocumentProcessorServiceClient using the resolved configuration.
     */
    private getClient(config: DocumentAiConfig): DocumentProcessorServiceClient {
        if (!this.client) {
            const options: ConstructorParameters<typeof DocumentProcessorServiceClient>[0] = {};
            if (config.apiEndpoint) {
                options.apiEndpoint = config.apiEndpoint;
            }
            this.client = new DocumentProcessorServiceClient(options);
        }
        return this.client;
    }

    /**
     * Loads configuration from environment variables.
     */
    private loadConfig(): DocumentAiConfig | null {
        const projectId =
            process.env.DOCUMENT_AI_PROJECT_ID ?? process.env.GOOGLE_PROJECT_ID ?? process.env.GCP_PROJECT ?? '';
        const location =
            process.env.DOCUMENT_AI_LOCATION ?? process.env.GOOGLE_LOCATION ?? process.env.GCP_LOCATION ?? '';
        const processorId =
            process.env.DOCUMENT_AI_PROCESSOR_ID ??
            process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID ??
            process.env.GCP_DOCUMENT_AI_PROCESSOR_ID ??
            '';
        const apiEndpoint =
            process.env.DOCUMENT_AI_API_ENDPOINT ??
            process.env.GOOGLE_DOCUMENT_AI_API_ENDPOINT ??
            process.env.GCP_DOCUMENT_AI_API_ENDPOINT;

        if (!projectId || !location || !processorId) {
            return null;
        }

        return {
            projectId,
            location,
            processorId,
            apiEndpoint: apiEndpoint ?? undefined,
        };
    }

    /**
     * Builds the fully-qualified processor resource name.
     */
    private buildProcessorName(config: DocumentAiConfig): string {
        return `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
    }

    /**
     * Extracts paragraph text snippets from the Document AI response.
     *
     * @param document - Document AI response document
     * @returns Array of paragraph strings (whitespace-normalised)
     */
    private extractParagraphs(document: Document): string[] {
        if (!document.pages || !Array.isArray(document.pages)) {
            return [];
        }

        const fullText = document.text ?? '';
        const paragraphs: string[] = [];

        for (const page of document.pages) {
            const pageParagraphs = (page?.paragraphs ?? []) as Paragraph[];
            for (const paragraph of pageParagraphs) {
                const text = this.getTextFromAnchor(fullText, paragraph?.layout?.textAnchor ?? null);
                const normalised = text.replace(/\s+/g, ' ').trim();
                if (normalised) {
                    paragraphs.push(normalised);
                }
            }
        }

        return paragraphs;
    }

    /**
     * Converts a text anchor into string content using the document's full text.
     */
    private getTextFromAnchor(fullText: string, textAnchor: TextAnchor | null): string {
        if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
            return '';
        }

        return textAnchor.textSegments
            .map((segment) => {
                const startIndex = Number(segment.startIndex ?? 0);
                const endIndex = Number(segment.endIndex ?? 0);
                if (Number.isNaN(startIndex) || Number.isNaN(endIndex) || endIndex <= startIndex) {
                    return '';
                }
                return fullText.substring(startIndex, endIndex);
            })
            .join('');
    }
}

