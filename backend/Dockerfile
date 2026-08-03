# Build stage
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
			npm ci --omit=dev; \
		else \
			npm install --omit=dev; \
		fi

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_PATH=/data

EXPOSE 3001

# Create data dir with correct permissions (non-root user)
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data
USER app

CMD ["node", "src/app.js"]
