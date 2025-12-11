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

# Install dependencies - this creates the proper symlinks
RUN pnpm install --no-frozen-lockfile

EXPOSE 3000

# Start the bot with the character file
CMD ["pnpm", "start", "--", "--character=characters/criollo.character.json"]
