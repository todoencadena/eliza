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

# Manually copy dist folders to fix symlink issues
RUN for pkg in packages/client-*/; do \
    name=$(basename $pkg); \
    target="agent/node_modules/@elizaos/$name/dist"; \
    if [ -d "$pkg/dist" ]; then \
        mkdir -p "agent/node_modules/@elizaos/$name"; \
        cp -r "$pkg/dist" "$target" 2>/dev/null || true; \
    fi; \
done

# Also copy adapter dist folders
RUN for pkg in packages/adapter-*/; do \
    name=$(basename $pkg); \
    target="agent/node_modules/@elizaos/$name/dist"; \
    if [ -d "$pkg/dist" ]; then \
        mkdir -p "agent/node_modules/@elizaos/$name"; \
        cp -r "$pkg/dist" "$target" 2>/dev/null || true; \
    fi; \
done

# Copy core and plugin dist folders
RUN for pkg in packages/core packages/plugin-*/; do \
    name=$(basename $pkg); \
    target="agent/node_modules/@elizaos/$name/dist"; \
    if [ -d "$pkg/dist" ]; then \
        mkdir -p "agent/node_modules/@elizaos/$name"; \
        cp -r "$pkg/dist" "$target" 2>/dev/null || true; \
    fi; \
done

EXPOSE 3000

# Start the bot with the character file
CMD ["pnpm", "start", "--", "--character=characters/criollo.character.json"]
