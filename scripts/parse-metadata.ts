#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Metadata Parser Script for Legal Documents
 *
 * This script processes documents to parse and clean up their metadata fields,
 * particularly the areaData field which contains structured key-value pairs
 * in a JSON string format. It converts the structured data into clean JSON.
 *
 * Note: This script can also be called via the DocumentService API methods:
 * - parseDocumentMetadata(id, dryRun) for single documents
 * - parseAllDocumentsMetadata(options) for batch processing
 *
 * Usage:
 *   npm run parse-metadata [-- --document-id=<id>] [-- --dry-run] [-- --help]
 *
 * Options:
 *   --document-id=<id>  Process only the document with specified ID
 *   --dry-run          Show what would be changed without making updates
 *   --help             Show this help message
 *
 * Examples:
 *   npm run parse-metadata -- --document-id=82
 *   npm run parse-metadata -- --dry-run
 *   npm run parse-metadata
 */

import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { DocumentService } from '../src/documents/document.service'

class MetadataParserScript {
	private documentService!: DocumentService
	private dryRun: boolean

	constructor(dryRun = false) {
		this.dryRun = dryRun
	}

	async initialize(): Promise<void> {
		// Create NestJS application context to access services
		const app = await NestFactory.createApplicationContext(AppModule, {
			logger: false, // Disable NestJS logs for cleaner script output
		})

		this.documentService = app.get(DocumentService)
	}

	/**
	 * Main processing function that delegates to DocumentService
	 */
	async process(documentId?: number): Promise<void> {
		try {
			await this.initialize()

			if (documentId) {
				console.log(`\nProcessing document ${documentId}...`)
				if (this.dryRun) {
					console.log('DRY RUN MODE: No changes will be made\n')
				}

				const result = await this.documentService.parseDocumentMetadata(documentId, this.dryRun)

				console.log(`\nProcessing complete for document ${documentId}:`)
				console.log(`- Has changes: ${result.hasChanges}`)

				if (result.hasChanges) {
					console.log('- Changes:')
					if (result.changes.areaData) {
						console.log('  * areaData: Converted from key-value pairs to object')
						if (this.dryRun) {
							console.log('    Before:', result.changes.areaData.before)
							console.log('    After:', JSON.stringify(result.changes.areaData.after, null, 2))
						}
					}
					if (result.changes.metadata) {
						console.log('  * metadata: Converted from key-value pairs to object')
						if (this.dryRun) {
							console.log('    Before:', result.changes.metadata.before)
							console.log('    After:', JSON.stringify(result.changes.metadata.after, null, 2))
						}
					}
				}

				if (this.dryRun && result.hasChanges) {
					console.log('\nRun without --dry-run to apply these changes')
				}
			} else {
				console.log('\nProcessing all documents...')
				if (this.dryRun) {
					console.log('DRY RUN MODE: No changes will be made\n')
				}

				// Use DocumentService batch processing with filters for better performance
				const result = await this.documentService.parseAllDocumentsMetadata({
					dryRun: this.dryRun,
					filter: {
						hasStringAreaData: true, // Only process docs that might need parsing
						hasStringMetadata: true,
					},
				})

				console.log(`\nBatch processing complete:`)
				console.log(`- Processed: ${result.processedCount} documents`)
				console.log(`- Modified: ${result.changedCount} documents`)
				console.log(`- Failed: ${result.failedCount} documents`)

				if (result.changedCount > 0) {
					console.log('\nDocuments with changes:')
					result.results
						.filter((r) => r.hasChanges)
						.forEach((r) => {
							console.log(`  - Document ${r.documentId}: ${r.fileName}`)
							if (this.dryRun && r.changes) {
								if (r.changes.areaData) {
									console.log('    * areaData: Would be converted from key-value pairs')
								}
								if (r.changes.metadata) {
									console.log('    * metadata: Would be converted from key-value pairs')
								}
							}
						})
				}

				if (result.failedCount > 0) {
					console.log('\nFailed documents:')
					result.results
						.filter((r) => r.error)
						.forEach((r) => {
							console.log(`  - Document ${r.documentId}: ${r.fileName} - ${r.error}`)
						})
				}

				if (this.dryRun && result.changedCount > 0) {
					console.log('\nRun without --dry-run to apply these changes')
				}
			}
		} catch (error) {
			console.error('Processing failed:', error)
			throw error
		}
	}
}

/**
 * Parse command line arguments
 */
function parseArgs(): { documentId?: number; dryRun: boolean; help: boolean } {
	const args = process.argv.slice(2)
	let documentId: number | undefined
	let dryRun = false
	let help = false

	for (const arg of args) {
		if (arg.startsWith('--document-id=')) {
			const id = parseInt(arg.split('=')[1], 10)
			if (!isNaN(id)) {
				documentId = id
			}
		} else if (arg === '--dry-run') {
			dryRun = true
		} else if (arg === '--help') {
			help = true
		}
	}

	return { documentId, dryRun, help }
}

/**
 * Show help message
 */
function showHelp(): void {
	const scriptName = 'parse-metadata'
	console.log(`
Metadata Parser Script for Legal Documents

This script processes documents to parse and clean up their metadata fields,
particularly the areaData field which contains structured key-value pairs
in a JSON string format.

Usage:
  npm run ${scriptName} [-- --document-id=<id>] [-- --dry-run] [-- --help]

Options:
  --document-id=<id>  Process only the document with specified ID
  --dry-run          Show what would be changed without making updates
  --help             Show this help message

Examples:
  npm run ${scriptName} -- --document-id=82
  npm run ${scriptName} -- --dry-run
  npm run ${scriptName}

What it does:
  - Converts areaData from key-value pairs array to clean object
  - Converts metadata from key-value pairs array to clean object
  - Attempts to parse numbers, booleans, and null values in metadata
  - Shows before/after comparison in dry-run mode

Note: This script uses the DocumentService API methods for processing.
`)
}

/**
 * Main execution
 */
async function main(): Promise<void> {
	const { documentId, dryRun, help } = parseArgs()

	if (help) {
		showHelp()
		return
	}

	const parser = new MetadataParserScript(dryRun)
	await parser.process(documentId)
}

// Run the script if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error('Script failed:', error)
		process.exit(1)
	})
}
