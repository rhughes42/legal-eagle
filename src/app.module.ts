import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
<<<<<<< HEAD
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Root application module wiring shared services and GraphQL transport.
 */
const graphqlConfig: ApolloDriverConfig = {
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,
};

/**
 * Root application module wiring shared services and GraphQL transport.
 */
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      ...graphqlConfig,
      ...({ uploads: false } as Record<string, unknown>),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
=======
import { DocumentResolver } from './documents/document.resolver';
import { PrismaService } from './prisma/prisma.service';

const graphQLConfig: ApolloDriverConfig = {
	driver: ApolloDriver,
	autoSchemaFile: true,
};

@Module({
	imports: [
		// Enable code-first GraphQL schema generation with uploads handled in main.ts.
		GraphQLModule.forRoot<ApolloDriverConfig>({
			...graphQLConfig,
			uploads: false,
		} as ApolloDriverConfig),
	],
	providers: [DocumentResolver, PrismaService],
>>>>>>> 36702e36 (Initialize project structure with essential configurations and files. Added .gitignore.)
})
export class AppModule {}
