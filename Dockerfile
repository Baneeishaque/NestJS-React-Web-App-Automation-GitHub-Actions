# Dockerfile for a NestJS and React Application

# --- Stage 1: Build the NestJS Backend ---
FROM node:22-alpine AS api-builder
WORKDIR /app

COPY api/ ./
RUN npm install --omit=dev
RUN npm run build

# --- Stage 2: Build the React Frontend ---
FROM node:22-alpine AS web-builder
WORKDIR /app

# Copy package files and install dependencies
COPY web/ ./
RUN npm install --omit=dev
# Increase memory limit for potentially large frontend builds
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# --- Stage 3: Final Production Image ---
FROM node:22-alpine AS production
WORKDIR /app

# Copy production dependencies from the api-builder
COPY --from=api-builder /app/node_modules ./node_modules

# Copy the built NestJS application
COPY --from=api-builder /app/dist ./dist

# Copy the built React application into a "client" folder
COPY --from=web-builder /app/dist ./client

# Expose the port the app will run on
EXPOSE 3000

# The command to run the application, with explicit .js extension
CMD ["node", "dist/main.js"]
