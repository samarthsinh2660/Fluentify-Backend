# Use Node.js LTS version
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for nodemon)
RUN npm install

# Copy application source code
COPY . .

# Expose application port
EXPOSE 5000

# Start the application with nodemon for hot-reload
CMD ["npm", "run", "dev"]
