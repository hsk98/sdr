# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Create database directory for SQLite (if used)
RUN mkdir -p data && chown -R nodejs:nodejs data

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
                 const options = { hostname: 'localhost', port: 3001, path: '/api/health', timeout: 2000 }; \
                 const req = http.request(options, (res) => { \
                   if (res.statusCode === 200) process.exit(0); \
                   else process.exit(1); \
                 }); \
                 req.on('error', () => process.exit(1)); \
                 req.end();"

# Start the application
CMD ["npm", "start"]