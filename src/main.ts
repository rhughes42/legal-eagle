import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { graphqlUploadExpress } from 'graphql-upload'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        snapshot: true,
    })

    // Apply the upload limits defined for the challenge.
    app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 5 }))

    const port = Number(process.env.PORT) || 3000
    await app.listen(port)

    Logger.log(`Pandektes backend listening on http://localhost:${port}`, 'Bootstrap')
}

void bootstrap()
