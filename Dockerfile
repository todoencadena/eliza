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

# Copy only the dist folders we need for the simplified agent
RUN mkdir -p agent/node_modules/@elizaos/adapter-sqlite && \
    cp -r packages/adapter-sqlite/dist agent/node_modules/@elizaos/adapter-sqlite/ && \
    mkdir -p agent/node_modules/@elizaos/client-telegram && \
    cp -r packages/client-telegram/dist agent/node_modules/@elizaos/client-telegram/ && \
    mkdir -p agent/node_modules/@elizaos/client-direct && \
    cp -r packages/client-direct/dist agent/node_modules/@elizaos/client-direct/ && \
    mkdir -p agent/node_modules/@elizaos/core && \
    cp -r packages/core/dist agent/node_modules/@elizaos/core/ && \
    mkdir -p agent/node_modules/@elizaos/plugin-bootstrap && \
    cp -r packages/plugin-bootstrap/dist agent/node_modules/@elizaos/plugin-bootstrap/ && \
    mkdir -p agent/node_modules/@elizaos/plugin-node && \
    cp -r packages/plugin-node/dist agent/node_modules/@elizaos/plugin-node/

# Verify the essential packages are in place
RUN ls -la agent/node_modules/@elizaos/client-telegram/dist/ && \
    ls -la agent/node_modules/@elizaos/core/dist/

EXPOSE 3000

# Start the bot with the character file
CMD ["pnpm", "start", "--", "--character=characters/criollo.character.json"]
