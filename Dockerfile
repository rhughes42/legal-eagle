# Build the NestJS application and ship the compiled dist folder.
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma prisma
# Use legacy-peer-deps to avoid ERESOLVE failures during image builds
RUN npm install --legacy-peer-deps --silent

COPY tsconfig.json tsconfig.json
COPY scripts/wait-for-db.sh ./wait-for-db.sh
COPY src src

RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies required by Prisma on Alpine
RUN apk add --no-cache openssl ca-certificates libc6-compat

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/wait-for-db.sh ./wait-for-db.sh

RUN chmod +x ./wait-for-db.sh

# Skip npm prune in production image to avoid peer-dependency resolution errors during prune.
# The build stage already installs dependencies with --legacy-peer-deps and the production image
# copies the resulting node_modules. Removing prune keeps the image stable and avoids ERESOLVE
# failures inside the production stage.

CMD ["node", "dist/main"]
