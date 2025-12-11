FROM node:23.3.0-slim

# Install git and runtime dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile || true

# Build only the packages we need for the Telegram bot
RUN pnpm --filter "@elizaos/core" build || true
RUN pnpm --filter "@elizaos/adapter-sqlite" build || true
RUN pnpm --filter "@elizaos/client-telegram" build || true
RUN pnpm --filter "@elizaos/client-direct" build || true
RUN pnpm --filter "@elizaos/plugin-bootstrap" build || true
RUN pnpm --filter "@elizaos/plugin-node" build || true

EXPOSE 3000

WORKDIR /app/agent

# Start the bot directly with the character file
CMD ["node", "--loader", "ts-node/esm", "src/index.ts", "--character=../characters/criollo.character.json"]
