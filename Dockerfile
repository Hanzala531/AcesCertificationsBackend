# Stage 1: Install & Test
FROM node:20-alpine AS tester

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Run tests — build will fail here if any test fails
RUN npm test -- --forceExit --ci

# Stage 2: Build
FROM tester AS builder

RUN npm run build

# Stage 3: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

# Copy built output and migrations from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "run", "start:prod"]