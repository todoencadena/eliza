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

# Copy everything (including pre-compiled dist folders)
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile || true

# Force create directories and copy dist folders explicitly
RUN mkdir -p agent/node_modules/@elizaos/client-instagram && \
    cp -r packages/client-instagram/dist agent/node_modules/@elizaos/client-instagram/ && \
    mkdir -p agent/node_modules/@elizaos/client-telegram && \
    cp -r packages/client-telegram/dist agent/node_modules/@elizaos/client-telegram/ && \
    mkdir -p agent/node_modules/@elizaos/client-direct && \
    cp -r packages/client-direct/dist agent/node_modules/@elizaos/client-direct/ && \
    mkdir -p agent/node_modules/@elizaos/client-auto && \
    cp -r packages/client-auto/dist agent/node_modules/@elizaos/client-auto/ && \
    mkdir -p agent/node_modules/@elizaos/client-discord && \
    cp -r packages/client-discord/dist agent/node_modules/@elizaos/client-discord/ && \
    mkdir -p agent/node_modules/@elizaos/client-twitter && \
    cp -r packages/client-twitter/dist agent/node_modules/@elizaos/client-twitter/ && \
    mkdir -p agent/node_modules/@elizaos/client-farcaster && \
    cp -r packages/client-farcaster/dist agent/node_modules/@elizaos/client-farcaster/ && \
    mkdir -p agent/node_modules/@elizaos/client-lens && \
    cp -r packages/client-lens/dist agent/node_modules/@elizaos/client-lens/ && \
    mkdir -p agent/node_modules/@elizaos/client-slack && \
    cp -r packages/client-slack/dist agent/node_modules/@elizaos/client-slack/ && \
    mkdir -p agent/node_modules/@elizaos/client-alexa && \
    cp -r packages/client-alexa/dist agent/node_modules/@elizaos/client-alexa/ && \
    mkdir -p agent/node_modules/@elizaos/client-simsai && \
    cp -r packages/client-simsai/dist agent/node_modules/@elizaos/client-simsai/ && \
    mkdir -p agent/node_modules/@elizaos/client-telegram-account && \
    cp -r packages/client-telegram-account/dist agent/node_modules/@elizaos/client-telegram-account/ && \
    mkdir -p agent/node_modules/@elizaos/client-xmtp && \
    cp -r packages/client-xmtp/dist agent/node_modules/@elizaos/client-xmtp/ && \
    mkdir -p agent/node_modules/@elizaos/client-deva && \
    cp -r packages/client-deva/dist agent/node_modules/@elizaos/client-deva/ && \
    mkdir -p agent/node_modules/@elizaos/client-github && \
    cp -r packages/client-github/dist agent/node_modules/@elizaos/client-github/ && \
    mkdir -p agent/node_modules/@elizaos/client-eliza-home && \
    cp -r packages/client-eliza-home/dist agent/node_modules/@elizaos/client-eliza-home/

# Copy adapter dist folders
RUN mkdir -p agent/node_modules/@elizaos/adapter-sqlite && \
    cp -r packages/adapter-sqlite/dist agent/node_modules/@elizaos/adapter-sqlite/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-postgres && \
    cp -r packages/adapter-postgres/dist agent/node_modules/@elizaos/adapter-postgres/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-supabase && \
    cp -r packages/adapter-supabase/dist agent/node_modules/@elizaos/adapter-supabase/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-pglite && \
    cp -r packages/adapter-pglite/dist agent/node_modules/@elizaos/adapter-pglite/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-qdrant && \
    cp -r packages/adapter-qdrant/dist agent/node_modules/@elizaos/adapter-qdrant/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-redis && \
    cp -r packages/adapter-redis/dist agent/node_modules/@elizaos/adapter-redis/ && \
    mkdir -p agent/node_modules/@elizaos/adapter-mongodb && \
    cp -r packages/adapter-mongodb/dist agent/node_modules/@elizaos/adapter-mongodb/

# Copy core
RUN mkdir -p agent/node_modules/@elizaos/core && \
    cp -r packages/core/dist agent/node_modules/@elizaos/core/

# Verify the copy worked
RUN ls -la agent/node_modules/@elizaos/client-instagram/dist/ || echo "client-instagram dist not found!"

EXPOSE 3000

# Start the bot with the character file
CMD ["pnpm", "start", "--", "--character=characters/criollo.character.json"]
