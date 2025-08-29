# Dockerfile for a NestJS and React Application

# --- Stage 1: Build the React Frontend ---
FROM node:18-alpine AS web-builder
WORKDIR /app/web

# Copy package files and install dependencies
COPY web/package.json web/package-lock.json ./
RUN npm install

# Copy the rest of the web source code and build
# Increase memory limit for potentially large frontend builds
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY web/ ./
RUN npm run build

# --- Stage 2: Build the NestJS Backend ---
FROM node:18-alpine AS api-builder
WORKDIR /app/api

# Copy package files and install dependencies
COPY api/package.json api/package-lock.json ./
RUN npm install

# Copy the rest of the api source code and build
COPY api/ ./
RUN npm run build

# --- Stage 3: Final Production Image ---
FROM node:18-alpine AS production
WORKDIR /app

# Copy production dependencies from the api-builder
COPY --from=api-builder /app/api/package.json /app/api/package-lock.json ./
RUN npm install --omit=dev

# Copy the built NestJS application
COPY --from=api-builder /app/api/dist ./dist

# Copy the built React application into a "client" folder
COPY --from=web-builder /app/web/dist ./client

# Expose the port the app will run on
EXPOSE 3000

# The command to run the application, with explicit .js extension
CMD ["node", "dist/main.js"]
