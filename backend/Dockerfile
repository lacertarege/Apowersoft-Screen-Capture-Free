FROM node:20-bullseye-slim

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src ./src

# Create data and logs directories
RUN mkdir -p /app/data /app/logs

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]