import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
<<<<<<< HEAD
  const app = await NestFactory.create(AppModule);

  app.use(graphqlUploadExpress({ maxFileSize: 20 * 1024 * 1024, maxFiles: 1 }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Pandektes backend listening on http://localhost:${port}`,
    'Bootstrap',
  );
=======
	const app = await NestFactory.create(AppModule);

	// Apply the upload limits defined for the challenge.
	app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 5 }));

	const port = Number(process.env.PORT) || 3000;
	await app.listen(port);

	Logger.log(
		`Pandektes backend listening on http://localhost:${port}`,
		'Bootstrap',
	);
>>>>>>> 36702e36 (Initialize project structure with essential configurations and files. Added .gitignore.)
}

void bootstrap();
