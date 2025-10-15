import type { RequestHandler } from 'express';

declare module 'graphql-upload/graphqlUploadExpress.mjs' {
  interface GraphqlUploadExpressOptions {
    /** Maximum allowed non-file multipart form field size in bytes. */
    maxFieldSize?: number;
    /** Maximum allowed file size in bytes. */
    maxFileSize?: number;
    /** Maximum number of files to accept per request. */
    maxFiles?: number;
  }

  export default function graphqlUploadExpress(
    options?: GraphqlUploadExpressOptions,
  ): RequestHandler;
}

declare module 'graphql-upload/GraphQLUpload.mjs' {
  import type { GraphQLScalarType } from 'graphql';
  const Upload: GraphQLScalarType;
  export default Upload;
}
