/**
 * TypeScript module declaration for the 'graphql-upload' package.
 *
 * This module provides GraphQL file upload functionality with support for
 * Express and Koa middleware, along with type definitions for file uploads
 * and GraphQL operations.
 *
 * @module graphql-upload
 * @see {@link https://github.com/jaydenseric/graphql-upload} GraphQL Upload package
 */
declare module 'graphql-upload' {
    /**
     * Value exports from the graphql-upload package.
     * These are the main runtime components for handling file uploads.
     */
    export { default as GraphQLUpload } from 'graphql-upload/GraphQLUpload.mjs';
    export { default as Upload } from 'graphql-upload/Upload.mjs';
    export { default as graphqlUploadExpress } from 'graphql-upload/graphqlUploadExpress.mjs';
    export { default as graphqlUploadKoa } from 'graphql-upload/graphqlUploadKoa.mjs';
    export { default as processRequest } from 'graphql-upload/processRequest.mjs';

    /**
     * Type exports from the graphql-upload package.
     * These provide TypeScript type definitions for file uploads,
     * GraphQL operations, and middleware configuration.
     */
    export type {
        // File
        FileUpload,
        FileUploadCreateReadStream,
        FileUploadCreateReadStreamOptions,
        UploadOptions,

        // GraphQL
        GraphQLOperation,
        GraphQLUpload as GraphQLUploadScalar,

        // Middleware
        ProcessRequestFunction,
        ProcessRequestOptions,
    } from 'graphql-upload/processRequest.mjs';
}
