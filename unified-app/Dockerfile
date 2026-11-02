# English Writing Recovery — unified app (Recovery Studio + Unaided Studio)
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build the frontend
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# GEMINI_API_KEY is read from the environment at runtime.
# Without it, AI review endpoints fall back to guided self-check mode.
CMD ["npx", "tsx", "server.ts"]
