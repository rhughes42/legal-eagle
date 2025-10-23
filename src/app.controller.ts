import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiOverview, AppService } from './app.service';

/**
 * AppController - Main Application Controller
 *
 * Provides essential endpoints for application health checking, API discovery,
 * and service overview. This controller serves as the entry point for clients
 * to understand the available services and verify the application status.
 *
 * Key Features:
 * - Health check endpoint for monitoring systems
 * - API discovery with GraphQL endpoint information
 * - Service status and version information
 * - OpenAPI/Swagger documentation integration
 *
 * Endpoints:
 * - GET / - Returns application overview and API discovery information
 *
 * @class AppController
 * @version 1.0
 * @since 1.0.0
 *
 * @example
 * ```bash
 * # Check application status
 * curl http://localhost:3000/
 *
 * # Response:
 * {
 *   "name": "Pandektes Legal Document Management API",
 *   "version": "1.0.0",
 *   "status": "online",
 *   "graphql": {
 *     "endpoint": "/graphql",
 *     "playground": "/graphql"
 *   },
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 *
 * @see {@link AppService} - Core application service
 * @see {@link https://docs.nestjs.com/controllers} NestJS Controllers Documentation
 */
@ApiTags('Application' as const)
@Controller()
export class AppController {
    /**
     * Creates an instance of AppController.
     *
     * @param {AppService} appService - Injected application service for business logic
     */
    constructor(private readonly appService: AppService) {}

    /**
     * GET /
     *
     * Returns a comprehensive application overview including health status,
     * API endpoints, and service information. This endpoint serves multiple purposes:
     *
     * - **Health Check**: Monitoring systems can verify the service is running
     * - **API Discovery**: Clients can discover available endpoints (GraphQL)
     * - **Service Information**: Version, status, and basic metadata
     *
     * This is particularly useful for:
     * - Load balancers performing health checks
     * - API consumers discovering GraphQL endpoint
     * - DevOps monitoring and alerting systems
     * - Development and debugging workflows
     *
     * @returns {ApiOverview} Lightweight JSON overview with service metadata
     *
     * @throws {InternalServerErrorException} When the service cannot provide overview
     *
     * @example
     * ```typescript
     * // Using in a client application
     * const response = await fetch('http://localhost:3000/');
     * const overview = await response.json();
     * console.log(`GraphQL available at: ${overview.graphql.endpoint}`);
     * ```
     *
     * @since 1.0.0
     */
    @Get()
    @ApiOperation({
        summary: 'Get application overview and health status',
        description: `
        Returns comprehensive application information including:
        - Service name and version
        - Current operational status
        - GraphQL endpoint discovery
        - API availability confirmation
        - Response timestamp for monitoring

        This endpoint is designed for health checks, API discovery, and monitoring purposes.
        `,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Application overview successfully retrieved',
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Application name',
                    example: 'Pandektes Legal Document Management API',
                },
                version: {
                    type: 'string',
                    description: 'Application version',
                    example: '1.0.0',
                },
                status: {
                    type: 'string',
                    description: 'Current operational status',
                    example: 'online',
                },
                graphql: {
                    type: 'object',
                    properties: {
                        endpoint: {
                            type: 'string',
                            description: 'GraphQL API endpoint',
                            example: '/graphql',
                        },
                        playground: {
                            type: 'string',
                            description: 'GraphQL Playground endpoint (development)',
                            example: '/graphql',
                        },
                    },
                },
                timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Response generation timestamp',
                    example: '2024-01-15T10:30:00.000Z',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: 'Internal server error - service unavailable',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    getOverview(): ApiOverview {
        return this.appService.getOverview();
    }
}
