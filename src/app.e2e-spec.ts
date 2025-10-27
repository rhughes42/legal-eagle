/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { Response } from 'supertest'

import { AppModule } from './app.module'
import { PrismaService } from './prisma/prisma.service'

/**
 * Integration tests for the GraphQL Documents API.
 *
 * Intro:
 * This file contains end-to-end (E2E) integration tests that exercise the
 * GraphQL endpoint exposed by the NestJS application. The suite verifies
 * basic CRUD behavior for the "document" resource through the /graphql
 * HTTP endpoint and relies on a Prisma-backed database instance.
 *
 * @file
 *
 * @remarks
 * - The test suite boots a NestJS application from AppModule and uses the
 *   PrismaService from the application context to prepare and inspect test
 *   state.
 * - The environment is set to NODE_ENV='test' during setup to allow test
 *   specific configuration within the application.
 * - A short seed ensures there is at least one document record available for
 *   retrieval tests (seeded when the documents table is empty).
 * - Jest timeout is increased to 30s to account for slower CI environments.
 *
 * Test cases included:
 * 1. "returns the current document list"
 *    - Sends a GraphQL query to fetch all documents and asserts the response
 *      shape, HTTP status, and that at least one document is returned.
 *
 * 2. "fetches a single document by id"
 *    - Reads an existing document from the database via Prisma, then queries
 *      the GraphQL API for that document by id and asserts the returned data
 *      matches the DB record.
 *
 * 3. "creates and deletes a document via mutations"
 *    - Uses a GraphQL mutation to create a new document, verifies the created
 *      resource, then deletes it via another mutation and confirms removal by
 *      checking the database directly via Prisma.
 *
 * @notes
 * - The tests interact with the real database configured for the application.
 *   Run them against an isolated test database or ensure proper teardown to
 *   avoid contaminating development or production data.
 * - The tests expect the GraphQL route to be available at POST /graphql and
 *   that the GraphQL schema exposes `documents`, `document`, `createDocument`,
 *   and `deleteDocument` operations with the expected shapes.
 *
 * @example
 * // Typical invocation (depending on project scripts/config):
 * //   npm run test:e2e
 *
 * @see AppModule - application wiring used by the tests
 * @see PrismaService - used to seed and assert database state
 */

jest.setTimeout(30000) // Set timeout to 30 seconds for slower CI environments.

describe('GraphQL Documents API (integration)', () => {
	let app: INestApplication
	let prisma: PrismaService

	beforeAll(async () => {
		process.env.NODE_ENV = 'test'

		// Create the NestJS testing module from AppModule.
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile()

		app = moduleRef.createNestApplication()
		await app.init()

		// Get the PrismaService from the application context.
		prisma = app.get(PrismaService)

		// Seed at least one document if none exist.
		const existingCount = await prisma.document.count()
		if (existingCount === 0) {
			await prisma.document.create({
				data: {
					fileName: 'seed-document.pdf',
					title: 'Seed Document',
				},
			})
		}
	})

	// Cleanup after tests are done.
	afterAll(async () => {
		await app?.close()
		await prisma?.$disconnect()
	})

	it('returns the current document list', async () => {
		const response: Response = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: /* GraphQL */ `
					{
						documents {
							id
							fileName
							title
						}
					}
				`,
			})

		expect(response.status).toBe(200)
		expect(response.body.errors).toBeUndefined()

		const documents = response.body.data?.documents
		expect(Array.isArray(documents)).toBe(true)
		expect(documents.length).toBeGreaterThan(0)
		expect(documents[0]).toHaveProperty('id')
		expect(documents[0]).toHaveProperty('fileName')
	})

	it('fetches a single document by id', async () => {
		const existing = await prisma.document.findFirst()
		expect(existing).toBeTruthy()

		const response: Response = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: /* GraphQL */ `
					query ($id: Int!) {
						document(id: $id) {
							id
							fileName
							title
						}
					}
				`,
				variables: {
					id: existing!.id,
				},
			})

		expect(response.status).toBe(200)
		expect(response.body.errors).toBeUndefined()

		const document = response.body.data?.document
		expect(document).toBeDefined()
		expect(document).toMatchObject({
			id: existing!.id,
			fileName: existing!.fileName,
		})
	})

	it('creates and deletes a document via mutations', async () => {
		const createResponse: Response = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: /* GraphQL */ `
					mutation ($fileName: String!, $title: String) {
						createDocument(fileName: $fileName, title: $title) {
							id
							fileName
							title
						}
					}
				`,
				variables: {
					fileName: 'integration-test.pdf',
					title: 'GraphQL integration test',
				},
			})

		expect(createResponse.status).toBe(200)
		expect(createResponse.body.errors).toBeUndefined()

		const created = createResponse.body.data?.createDocument
		expect(created).toBeDefined()
		expect(created.fileName).toBe('integration-test.pdf')

		const deleteResponse: Response = await request(app.getHttpServer())
			.post('/graphql')
			.send({
				query: /* GraphQL */ `
					mutation ($id: Int!) {
						deleteDocument(id: $id) {
							id
						}
					}
				`,
				variables: {
					id: created.id,
				},
			})

		expect(deleteResponse.status).toBe(200)
		expect(deleteResponse.body.errors).toBeUndefined()
		expect(deleteResponse.body.data?.deleteDocument?.id).toBe(created.id)

		const record = await prisma.document.findUnique({
			where: {
				id: created.id,
			},
		})

		expect(record).toBeNull()
	})
})
