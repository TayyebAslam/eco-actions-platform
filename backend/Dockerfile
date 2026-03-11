# Use the official Node.js Alpine image
FROM node:23-alpine

# Set the working directory inside the container
WORKDIR /app

# Install build dependencies for native modules (like bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package.json and config files
COPY package.json package-lock.json tsconfig.json knexfile.ts ./

# Install dependencies
RUN npm install

# Copy the rest of the app files
COPY . .

# Expose the port
EXPOSE 5000

# Command to start the app
CMD ["npm", "run", "dev"]