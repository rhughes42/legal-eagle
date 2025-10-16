/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Request, Response } from 'express';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';

/**
 * GraphQL Configuration Factory
 *
 * Creates the GraphQL configuration object with appropriate settings
 * for different environments. This factory pattern allows for easy
 * testing and environment-specific configurations.
 *
 * @returns {ApolloDriverConfig} Complete GraphQL configuration
 *
 * @example
 * ```typescript
 * const config = createGraphQLConfig();
 * console.log(config.autoSchemaFile); // true
 * ```
 */
function createGraphQLConfig(): ApolloDriverConfig {
    return {
        driver: ApolloDriver,
        autoSchemaFile: true,
        playground: process.env.NODE_ENV !== 'production',
        introspection: process.env.NODE_ENV !== 'production',
        context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        formatError: (error) => ({
            message: error.message,
            code: error.extensions?.code,
            path: error.path,
        }),
    };
}

/**
 * AppModule - Root Application Module
 *
 * The root module of the Pandektes Legal Document Management API application.
 * This module orchestrates all feature modules and provides the core application
 * infrastructure including GraphQL API, configuration management, and document
 * processing capabilities.
 *
 * ## Architecture Overview
 *
 * The module follows NestJS modular architecture principles:
 * - **Configuration Management**: Environment-based configuration using ConfigModule
 * - **GraphQL API**: Apollo Server integration with schema-first approach
 * - **Document Processing**: Specialized document management features
 * - **Health & Monitoring**: Application status and API discovery endpoints
 *
 * ## Key Features
 *
 * - **Auto-generated GraphQL Schema**: Automatic schema generation from TypeScript decorators
 * - **Environment Configuration**: Flexible configuration management across environments
 * - **CORS Support**: Cross-origin resource sharing for web clients
 * - **Development Tools**: GraphQL Playground in development mode
 * - **Error Handling**: Standardized GraphQL error formatting
 *
 * ## Module Dependencies
 *
 * - `ConfigModule`: Global configuration management
 * - `GraphQLModule`: Apollo GraphQL server integration
 * - `DocumentsModule`: Document management and processing features
 *
 * ## Environment Variables
 *
 * The module respects the following environment variables:
 * - `NODE_ENV`: Controls playground and introspection availability
 * - `CORS_ORIGIN`: Comma-separated list of allowed CORS origins
 *
 * @class AppModule
 * @version 1.0
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * // Bootstrap the application
 * import { NestFactory } from '@nestjs/core';
 * import { AppModule } from './app.module';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   await app.listen(3000);
 * }
 * bootstrap();
 * ```
 *
 * @example
 * ```bash
 * # Environment configuration example
 * NODE_ENV=production
 * CORS_ORIGIN=https://app.example.com,https://admin.example.com
 * ```
 *
 * @see {@link AppController} - Main application controller
 * @see {@link AppService} - Core application service
 * @see {@link DocumentsModule} - Document management features
 * @see {@link https://docs.nestjs.com/modules} NestJS Modules Documentation
 * @see {@link https://www.apollographql.com/docs/apollo-server/} Apollo Server Documentation
 */
@Module({
    imports: [
        /**
         * ConfigModule - Global Configuration Management
         *
         * Provides environment-based configuration management throughout
         * the application. Configured as global to avoid repeated imports.
         *
         * Features:
         * - Environment variable loading
         * - Configuration validation
         * - Type-safe configuration access
         */
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],
            cache: true,
        }),

        /**
         * GraphQLModule - Apollo GraphQL Server
         *
         * Configures the GraphQL API endpoint with Apollo Server.
         * Uses code-first approach with automatic schema generation
         * from TypeScript decorators and metadata.
         *
         * Configuration includes:
         * - Automatic schema file generation
         * - Environment-specific playground access
         * - CORS configuration for web clients
         * - Custom error formatting
         * - Request context injection
         */
        GraphQLModule.forRoot<ApolloDriverConfig>(createGraphQLConfig()),

        /**
         * DocumentsModule - Document Management Features
         *
         * Provides comprehensive document management capabilities
         * including upload, processing, storage, and retrieval.
         */
        DocumentsModule,
    ],
    controllers: [
        /**
         * AppController - Application Root Controller
         *
         * Handles application-level endpoints including health checks,
         * API discovery, and service status information.
         */
        AppController,
    ],
    providers: [
        /**
         * AppService - Core Application Service
         *
         * Provides business logic for application-level operations
         * and service management functionality.
         */
        AppService,
    ],
})
export class AppModule {}
