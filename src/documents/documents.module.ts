import { Module } from '@nestjs/common'
import { DocumentResolver } from './document.resolver'
import { DocumentService } from './document.service'
import { PrismaService } from '../prisma/prisma.service'

/**
 * DocumentsModule - Legal Document Management Module for Pandektes System
 *
 * This NestJS module encapsulates all document-related functionality for the Pandektes
 * legal document management system. It provides a cohesive unit that handles document
 * upload, processing, storage, and retrieval operations with AI-powered metadata extraction.
 *
 * Key Features:
 * - GraphQL API for document operations (via DocumentResolver)
 * - Document processing and AI metadata extraction (via DocumentService)
 * - Database persistence with Prisma ORM (via PrismaService)
 * - Support for PDF and HTML document formats
 * - OpenAI integration for intelligent content analysis
 *
 * Architecture:
 * - Follows NestJS modular architecture principles
 * - Implements dependency injection for loose coupling
 * - Provides clear separation of concerns between API, business logic, and data layers
 *
 * Dependencies:
 * - DocumentResolver: GraphQL API layer for client interactions
 * - DocumentService: Core business logic for document processing
 * - PrismaService: Database abstraction layer for PostgreSQL operations
 *
 * Usage:
 * Import this module into the main AppModule to enable document management
 * functionality throughout the Pandektes application.
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { DocumentsModule } from './documents/documents.module';
 *
 * @Module({
 *   imports: [DocumentsModule],
 *   // ...other configuration
 * })
 * export class AppModule {}
 * ```
 *
 * @version 1.0
 * @module DocumentsModule
 * @requires @nestjs/common
 * @requires DocumentResolver
 * @requires DocumentService
 * @requires PrismaService
 */
@Module({
	/**
	 * Providers array defines the services that can be injected within this module.
	 * These providers form the core of the document management functionality:
	 *
	 * - DocumentResolver: Handles GraphQL queries and mutations for document operations
	 * - DocumentService: Contains business logic for document processing and AI integration
	 * - PrismaService: Provides database access layer for PostgreSQL operations
	 */
	providers: [DocumentResolver, DocumentService, PrismaService],

	/**
	 * Exports array makes services available for injection in other modules.
	 * DocumentService is exported to allow other modules to access document
	 * functionality programmatically (e.g., for batch processing, integrations).
	 */
	exports: [DocumentService],
})
export class DocumentsModule {}
