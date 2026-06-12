# Stage 1: Build Frontend React application
FROM node:20 AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the application
FROM node:20-slim
WORKDIR /app

# Install runtime dependencies for SQLite (if needed)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy backend files and pre-seeded database
COPY server.js ./
COPY db/database.db ./db/database.db

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
