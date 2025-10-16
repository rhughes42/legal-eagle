import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService provides a centralized database connection service for the application.
 *
 * This service extends PrismaClient and implements NestJS lifecycle hooks to ensure
 * proper database connection management throughout the application lifecycle.
 * It maintains a single PrismaClient instance for the entire NestJS container,
 * providing connection pooling and transaction support.
 *
 * @class PrismaService
 * @extends {PrismaClient}
 * @implements {OnModuleInit}
 * @implements {OnModuleDestroy}
 *
 * @example
 * ```typescript
 * // Inject PrismaService in your service
 * constructor(private prisma: PrismaService) {}
 *
 * // Use it for database operations
 * async findUser(id: string) {
 *   return this.prisma.user.findUnique({ where: { id } });
 * }
 * ```
 *
 * @see {@link https://docs.nestjs.com/recipes/prisma} NestJS Prisma Integration
 * @see {@link https://www.prisma.io/docs/} Prisma Documentation
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private isConnected = false;

    constructor() {
        super({
            // Enable connection pooling for better performance
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            // Enable query logging in development
            log:
                process.env.NODE_ENV === 'development'
                    ? ['query', 'info', 'warn', 'error']
                    : ['error'],
            // Configure error formatting
            errorFormat: 'pretty',
        });
    }

    /**
     * Initializes the PrismaClient connection when the NestJS module starts.
     *
     * This method is automatically called by NestJS during the application bootstrap
     * process. It establishes the database connection with retry logic and proper
     * error handling to ensure the application starts successfully.
     *
     * @async
     * @throws {Error} Throws an error if database connection fails after retries
     *
     * @example
     * ```typescript
     * // This method is called automatically by NestJS
     * // No manual invocation required
     * ```
     */
    async onModuleInit(): Promise<void> {
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.log(
                    `Attempting to connect to database (attempt ${attempt}/${maxRetries})...`,
                );

                await this.$connect();

                // Verify connection with a simple query
                await this.$queryRaw`SELECT 1`;

                this.isConnected = true;
                this.logger.log('Successfully connected to database');
                return;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;

                this.logger.error(
                    `Database connection attempt ${attempt} failed: ${errorMessage}`,
                    errorStack,
                );

                if (attempt === maxRetries) {
                    this.logger.error('All database connection attempts failed');
                    throw new Error(
                        `Failed to connect to database after ${maxRetries} attempts: ${errorMessage}`,
                    );
                }

                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }

    /**
     * Gracefully closes the PrismaClient connection when the NestJS module is destroyed.
     *
     * This method is automatically called by NestJS during application shutdown.
     * It ensures all pending database operations are completed and the connection
     * is properly closed to prevent connection leaks.
     *
     * @async
     *
     * @example
     * ```typescript
     * // This method is called automatically by NestJS during shutdown
     * // No manual invocation required
     * ```
     */
    async onModuleDestroy(): Promise<void> {
        try {
            if (this.isConnected) {
                this.logger.log('Disconnecting from database...');
                await this.$disconnect();
                this.isConnected = false;
                this.logger.log('Successfully disconnected from database');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Error during database disconnection:', errorMessage);
            // Don't throw here as it's during shutdown
        }
    }

    /**
     * Checks if the database connection is healthy and active.
     *
     * This method performs a lightweight database query to verify that the
     * connection is working properly. Useful for health checks and monitoring.
     *
     * @async
     * @returns {Promise<boolean>} True if the connection is healthy, false otherwise
     *
     * @example
     * ```typescript
     * const isHealthy = await prismaService.isHealthy();
     * if (!isHealthy) {
     *   // Handle unhealthy database connection
     * }
     * ```
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Database health check failed:', errorMessage);
            return false;
        }
    }

    /**
     * Enables safe transaction execution with proper error handling.
     *
     * This method wraps Prisma's $transaction method with additional error
     * handling and logging for better debugging and monitoring.
     *
     * @template T
     * @param {Parameters<PrismaClient['$transaction']>[0]} fn - Transaction function or array of operations
     * @param {Parameters<PrismaClient['$transaction']>[1]} options - Transaction options
     * @returns {Promise<T>} Result of the transaction
     *
     * @example
     * ```typescript
     * const result = await prismaService.executeTransaction([
     *   prismaService.user.create({ data: userData }),
     *   prismaService.profile.create({ data: profileData })
     * ]);
     * ```
     */
    async executeTransaction<T>(
        fn: Parameters<PrismaClient['$transaction']>[0],
        options?: Parameters<PrismaClient['$transaction']>[1],
    ): Promise<T> {
        try {
            this.logger.debug('Starting database transaction');
            const result = await this.$transaction(fn, options);
            this.logger.debug('Database transaction completed successfully');
            return result as T;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Database transaction failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Gets the current connection status of the PrismaClient.
     *
     * @returns {boolean} True if connected to the database, false otherwise
     *
     * @example
     * ```typescript
     * if (prismaService.getConnectionStatus()) {
     *   // Proceed with database operations
     * }
     * ```
     */
    getConnectionStatus(): boolean {
        return this.isConnected;
    }
}
