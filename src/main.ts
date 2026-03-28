import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { graphqlUploadExpress } from 'graphql-upload-ts'
import helmet from 'helmet'
import { AppModule } from './app.module'

/**
 * Bootstraps the NestJS application.
 *
 * Initializes the application with snapshot-based instantiation for faster startup,
 * configures GraphQL multipart upload limits, registers OpenAPI/Swagger documentation,
 * starts the HTTP server, and logs key startup URLs.
 *
 * Upload limits:
 * - Maximum file size: 10 MB
 * - Maximum files per request: 5
 *
 * Swagger:
 * - Title: "LegalEagle API"
 * - Description: "REST endpoints for health checks and service discovery."
 * - Version: 1.0.0
 * - UI path: /docs (authorization is persisted in the UI)
 *
 * Port:
 * - Reads the port from the PORT environment variable; defaults to 3000.
 *
 * Logs:
 * - Logs the application URL and the Swagger UI URL with the context "Bootstrap".
 *
 * @remarks
 * Ensure the GraphQL upload middleware is registered before initializing GraphQL to
 * correctly enforce multipart upload limits. Snapshot mode can improve cold-start
 * performance by reusing module instantiation metadata.
 *
 * @returns A promise that resolves when the HTTP server has started listening.
 *
 * @throws Error if the application fails to initialize or the HTTP server fails to bind.
 *
 * @example
 * // Start the application and handle startup errors
 * bootstrap().catch((err) => {
 *   console.error('Failed to bootstrap application:', err);
 *   process.exit(1);
 * });
 */
async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		snapshot: true,
	})

	// Apply security headers via Helmet middleware.
	app.use(helmet())

	// Configure CORS: restrict origins in production using the CORS_ORIGIN env var.
	const corsOrigin = process.env.CORS_ORIGIN
	app.enableCors({
		origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : false,
		credentials: true,
		methods: ['GET', 'POST'],
	})

	// Register a global validation pipe to sanitize and validate all incoming data.
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	)

	// Apply the upload limits defined for the challenge.
	app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 5 }))

	// Register OpenAPI documentation only in non-production environments.
	if (process.env.NODE_ENV !== 'production') {
		const swaggerConfig = new DocumentBuilder()
			.setTitle('LegalEagle API')
			.setDescription('REST endpoints for health checks and service discovery.')
			.setVersion('1.0.0')
			.build()
		const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
		SwaggerModule.setup('docs', app, swaggerDocument, {
			swaggerOptions: { persistAuthorization: false },
		})
	}

	const port = Number(process.env.PORT) || 3000
	await app.listen(port)

	Logger.log(`LegalEagle backend listening on http://localhost:${port}`, 'Bootstrap')
	if (process.env.NODE_ENV !== 'production') {
		Logger.log(`Swagger UI available at http://localhost:${port}/docs`, 'Bootstrap')
	}
}

// Run the bootstrap function and handle any errors during startup.
void bootstrap().catch((err) => {
	console.error('Failed to bootstrap application:', err)
	process.exit(1)
})
