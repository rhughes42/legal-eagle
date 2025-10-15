import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
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
})
export class AppModule {}
