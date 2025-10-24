import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { graphqlUploadExpress } from 'graphql-upload'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        snapshot: true,
    })

    // Apply the upload limits defined for the challenge.
    app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 5 }))

    // Register OpenAPI documentation so the Swagger decorators on controllers are applied.
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Pandektes LegalEagle API')
        .setDescription('REST endpoints for health checks and service discovery.')
        .setVersion('1.0.0')
        .build()
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, swaggerDocument, {
        swaggerOptions: { persistAuthorization: true },
    })

    const port = Number(process.env.PORT) || 3000
    await app.listen(port)

    Logger.log(`Pandektes backend listening on http://localhost:${port}`, 'Bootstrap')
    Logger.log(`Swagger UI available at http://localhost:${port}/docs`, 'Bootstrap')
}

void bootstrap()
