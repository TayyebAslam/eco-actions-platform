# Use the official Node.js Alpine image
FROM node:23-alpine

# Set the working directory inside the container
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ curl

# Copy package.json and config files
COPY package.json package-lock.json tsconfig.json knexfile.ts ./

# Install dependencies using ci for reproducible builds
RUN npm ci

# Copy the rest of the app files
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose the port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Command to start the app
CMD ["npm", "run", "dev"]