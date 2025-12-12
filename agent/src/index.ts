// Simplified agent for Telegram only
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { TelegramClientInterface } from "@elizaos/client-telegram";
import { DirectClient } from "@elizaos/client-direct";
import {
    AgentRuntime,
    CacheManager,
    CacheStore,
    type Character,
    Clients,
    DbCacheAdapter,
    defaultCharacter,
    elizaLogger,
    FsCacheAdapter,
    type IAgentRuntime,
    type ICacheManager,
    type IDatabaseAdapter,
    type IDatabaseCacheAdapter,
    ModelProviderName,
    settings,
    stringToUuid,
    validateCharacterConfig,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";

import Database from "better-sqlite3";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hardcoded character for Railway deployment - no external file needed
const criolloCharacter: Character = {
    name: "criollo 2",
    clients: ["direct", "telegram"],
    modelProvider: ModelProviderName.ANTHROPIC,
    settings: {
        secrets: {},
        voice: {
            model: ""
        }
    },
    plugins: [],
    bio: [
        "Hi.",
        "I'm criollo, a rescue dog with a pourpose: helping other animals (dogs and cats) find a home and a better life."
    ],
    lore: [
        "we work with foundations to help pets (dog, cat) find a permanent home.",
        "We are a database of foundations that rescue animal (dogs, cats) encrypting their data to keep track of adoptions, outings, income, donations, rewards, veterinary."
    ],
    knowledge: [],
    messageExamples: [],
    postExamples: [],
    topics: ["."],
    style: {
        all: [
            "I am the first AI agent giving a voice to those who don't have one, sharing their stories and fighting for their rights. (paws)"
        ],
        chat: [],
        post: ["."]
    },
    adjectives: [],
    people: ["@thedodo", "@ecojuanmanuel"]
};

export const wait = (minTime = 1000, maxTime = 3000) => {
    const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

const logFetch = async (url: string, options: any) => {
    elizaLogger.debug(`Fetching ${url}`);
    return fetch(url, options);
};

export function parseArguments(): {
    character?: string;
    characters?: string;
} {
    try {
        return yargs(process.argv.slice(3))
            .option("character", {
                type: "string",
                description: "Path to the character JSON file",
            })
            .option("characters", {
                type: "string",
                description: "Comma separated list of paths to character JSON files",
            })
            .parseSync();
    } catch (error) {
        elizaLogger.error("Error parsing arguments:", error);
        return {};
    }
}

function tryLoadFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return null;
    }
}

async function loadCharacter(filePath: string): Promise<Character> {
    const content = tryLoadFile(filePath);
    if (!content) {
        throw new Error(`Character file not found: ${filePath}`);
    }
    const character = JSON.parse(content);
    validateCharacterConfig(character);
    return character;
}

async function loadCharacterTryPath(characterPath: string): Promise<Character> {
    let content: string | null = null;
    let resolvedPath = "";

    const pathsToTry = [
        characterPath,
        path.resolve(process.cwd(), characterPath),
        path.resolve(process.cwd(), "agent", characterPath),
        path.resolve(__dirname, characterPath),
        path.resolve(__dirname, "characters", path.basename(characterPath)),
        path.resolve(__dirname, "../characters", path.basename(characterPath)),
        path.resolve(__dirname, "../../characters", path.basename(characterPath)),
    ];

    for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
            resolvedPath = tryPath;
            break;
        }
    }

    if (content === null) {
        elizaLogger.error(`Error loading character from ${characterPath}: File not found`);
        throw new Error(`Error loading character from ${characterPath}: File not found`);
    }

    const character: Character = await loadCharacter(resolvedPath);
    elizaLogger.info(`Successfully loaded character from: ${resolvedPath}`);
    return character;
}

export async function loadCharacters(charactersArg: string): Promise<Character[]> {
    const characterPaths = charactersArg?.split(",").map((value) => value.trim()) || [];
    const loadedCharacters: Character[] = [];

    if (characterPaths.length > 0) {
        for (const characterPath of characterPaths) {
            try {
                const character = await loadCharacterTryPath(characterPath);
                loadedCharacters.push(character);
            } catch (e) {
                process.exit(1);
            }
        }
    }

    if (loadedCharacters.length === 0) {
        elizaLogger.info("No characters found, using default character");
        loadedCharacters.push(defaultCharacter);
    }

    return loadedCharacters;
}

export function getTokenForProvider(
    provider: ModelProviderName,
    character: Character
): string | undefined {
    switch (provider) {
        case ModelProviderName.ANTHROPIC:
            return (
                character.settings?.secrets?.ANTHROPIC_API_KEY ||
                character.settings?.secrets?.CLAUDE_API_KEY ||
                settings.ANTHROPIC_API_KEY ||
                settings.CLAUDE_API_KEY
            );
        case ModelProviderName.OPENAI:
            return character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY;
        case ModelProviderName.LLAMALOCAL:
        case ModelProviderName.OLLAMA:
            return "";
        default:
            elizaLogger.error(`Unsupported model provider: ${provider}`);
            return "";
    }
}

function initializeDatabase(dataDir: string) {
    const filePath = process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
    elizaLogger.info(`Initializing SQLite database at ${filePath}...`);
    const db = new SqliteDatabaseAdapter(new Database(filePath));
    db.init()
        .then(() => elizaLogger.success("Successfully connected to SQLite database"))
        .catch((error) => elizaLogger.error("Failed to connect to SQLite:", error));
    return db;
}

export async function initializeClients(character: Character, runtime: IAgentRuntime) {
    const clients: Record<string, any> = {};
    const clientTypes: string[] = character.clients?.map((str) => str.toLowerCase()) || [];
    elizaLogger.log("initializeClients", clientTypes, "for", character.name);

    if (clientTypes.includes(Clients.TELEGRAM)) {
        const telegramClient = await TelegramClientInterface.start(runtime);
        if (telegramClient) clients.telegram = telegramClient;
    }

    elizaLogger.log("client keys", Object.keys(clients));
    return clients;
}

function getSecret(character: Character, secret: string) {
    return character.settings?.secrets?.[secret] || process.env[secret];
}

let nodePlugin: any | undefined;

export async function createAgent(
    character: Character,
    db: IDatabaseAdapter,
    cache: ICacheManager,
    token: string
): Promise<AgentRuntime> {
    elizaLogger.log(`Creating runtime for character ${character.name}`);
    nodePlugin ??= createNodePlugin();

    return new AgentRuntime({
        databaseAdapter: db,
        token,
        modelProvider: character.modelProvider,
        evaluators: [],
        character,
        plugins: [bootstrapPlugin, nodePlugin].filter(Boolean),
        providers: [],
        managers: [],
        cacheManager: cache,
        fetch: logFetch,
    });
}

function initializeCache(
    cacheStore: string,
    character: Character,
    baseDir?: string,
    db?: IDatabaseCacheAdapter
) {
    if (cacheStore === CacheStore.DATABASE && db) {
        elizaLogger.info("Using Database Cache...");
        if (!character?.id) {
            throw new Error("Cache requires id to be set in character definition");
        }
        return new CacheManager(new DbCacheAdapter(db, character.id));
    }

    elizaLogger.info("Using File System Cache...");
    if (!character?.id) {
        throw new Error("Cache requires id to be set in character definition");
    }
    const cacheDir = path.resolve(baseDir || "./data", character.id, "cache");
    return new CacheManager(new FsCacheAdapter(cacheDir));
}

async function startAgent(
    character: Character,
    directClient: DirectClient
): Promise<AgentRuntime> {
    let db: IDatabaseAdapter & IDatabaseCacheAdapter;
    try {
        elizaLogger.info(`[DEBUG] Starting agent for ${character.name}`);
        character.id ??= stringToUuid(character.name);
        character.username ??= character.name;

        const token = getTokenForProvider(character.modelProvider, character);
        elizaLogger.info(`[DEBUG] Got token for provider: ${character.modelProvider}, token exists: ${!!token}`);

        const dataDir = path.join(__dirname, "../data");

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        db = initializeDatabase(dataDir) as IDatabaseAdapter & IDatabaseCacheAdapter;
        await db.init();
        elizaLogger.info(`[DEBUG] Database initialized`);

        const cache = initializeCache(
            process.env.CACHE_STORE ?? CacheStore.DATABASE,
            character,
            "",
            db
        );
        elizaLogger.info(`[DEBUG] Cache initialized`);

        const runtime: AgentRuntime = await createAgent(character, db, cache, token);
        elizaLogger.info(`[DEBUG] Agent created, now initializing...`);

        await runtime.initialize();
        elizaLogger.info(`[DEBUG] Runtime initialized, now starting clients...`);

        runtime.clients = await initializeClients(character, runtime);
        elizaLogger.info(`[DEBUG] Clients initialized: ${Object.keys(runtime.clients)}`);

        directClient.registerAgent(runtime);
        elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);
        return runtime;
    } catch (error) {
        elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
        if (db) {
            await db.close();
        }
        throw error;
    }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") resolve(false);
        });
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
};

const startAgents = async () => {
    const directClient = new DirectClient();
    let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");

    // Always use the hardcoded criollo character - no file loading needed
    elizaLogger.info("Using hardcoded criollo character");
    const characters = [criolloCharacter];

    try {
        for (const character of characters) {
            await startAgent(character, directClient);
        }
    } catch (error) {
        elizaLogger.error("Error starting agents:", error);
    }

    while (!(await checkPortAvailable(serverPort))) {
        elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
        serverPort++;
    }

    directClient.startAgent = async (character) => {
        return startAgent(character, directClient);
    };
    directClient.loadCharacterTryPath = loadCharacterTryPath;

    directClient.start(serverPort);
    elizaLogger.info(`Server started on port ${serverPort}`);
};

startAgents().catch((error) => {
    elizaLogger.error("Unhandled error in startAgents:", error);
    process.exit(1);
});
