import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Response } from 'supertest'
import request from 'supertest'

import { AppModule } from './app.module'
import { PrismaService } from './prisma/prisma.service'

interface GraphQLResponse<T = unknown> {
    data?: T
    errors?: Array<{ message: string }>
}

interface DocumentsQueryResponse {
    documents: Array<{
        id: number
        fileName: string
        title: string | null
    }>
}

interface DocumentQueryResponse {
    document: {
        id: number
        fileName: string
        title: string | null
    } | null
}

interface CreateDocumentResponse {
    createDocument: {
        id: number
        fileName: string
        title: string | null
    }
}

interface DeleteDocumentResponse {
    deleteDocument: {
        id: number
    }
}

describe('GraphQL Documents API (integration)', () => {
    let app: INestApplication
    let prisma: PrismaService

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()

        app = moduleRef.createNestApplication()
        await app.init()

        prisma = app.get(PrismaService)
    })

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
        const body = response.body as GraphQLResponse<DocumentsQueryResponse>
        expect(body.errors).toBeUndefined()

        const documents = body.data?.documents
        expect(Array.isArray(documents)).toBe(true)
        expect(documents).toBeDefined()
        if (documents) {
            expect(documents.length).toBeGreaterThan(0)
            expect(documents[0]).toHaveProperty('id')
            expect(documents[0]).toHaveProperty('fileName')
        }
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
        const body = response.body as GraphQLResponse<DocumentQueryResponse>
        expect(body.errors).toBeUndefined()

        const document = body.data?.document
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
        const createBody = createResponse.body as GraphQLResponse<CreateDocumentResponse>
        expect(createBody.errors).toBeUndefined()

        const created = createBody.data?.createDocument
        expect(created).toBeDefined()
        if (!created) {
            throw new Error('Document was not created')
        }
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
        const deleteBody = deleteResponse.body as GraphQLResponse<DeleteDocumentResponse>
        expect(deleteBody.errors).toBeUndefined()
        expect(deleteBody.data?.deleteDocument?.id).toBe(created.id)

        const record = await prisma.document.findUnique({
            where: {
                id: created.id,
            },
        })

        expect(record).toBeNull()
    })
})
