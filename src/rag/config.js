const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config.yaml");

const DEFAULT_PROVIDER_IDS = ["openrouter"];
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 180;
const DEFAULT_RETRIEVAL_LIMIT = 8;
const DEFAULT_EMBEDDING_PROVIDER_ID = "ollama";
const DEFAULT_QDRANT_URL = "http://localhost:6333";
const DEFAULT_QDRANT_COLLECTION = "discord_vector_rag";
const DEFAULT_QDRANT_INDEX_ID = "discord-vector-rag";
const DEFAULT_IMAGE_TEXT_PROVIDER_ID = "openrouter";
const DEFAULT_IMAGE_TEXT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_IMAGE_TEXT_CACHE_DIR = ".cache/image-text";
const DEFAULT_IMAGE_TEXT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_IMAGE_TEXT_PROMPT_VERSION = "v1";

const BUILT_IN_PROVIDERS = {
  ollama: {
    name: "Ollama",
    baseURL: DEFAULT_OLLAMA_BASE_URL,
    embeddingModel: DEFAULT_OLLAMA_EMBEDDING_MODEL,
  },
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    model: "google/gemma-4-31b-it:free",
    embeddingModel: "openai/text-embedding-3-small",
    temperature: 0.2,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-OpenRouter-Title": "Discord RAG Bot",
    },
  },
  nvidia: {
    name: "NVIDIA",
    baseURL: "https://integrate.api.nvidia.com/v1",
    model: "deepseek-ai/deepseek-v4-flash",
    temperature: 1,
    topP: 0.95,
    maxTokens: 16384,
    reasoningEnabled: true,
    reasoningEffort: "high",
  },
  openai: {
    name: "OpenAI",
    model: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    temperature: 0.2,
  },
  groq: {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
  },
  together: {
    name: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    temperature: 0.2,
  },
  deepinfra: {
    name: "DeepInfra",
    baseURL: "https://api.deepinfra.com/v1/openai",
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    temperature: 0.2,
  },
  fireworks: {
    name: "Fireworks",
    baseURL: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    temperature: 0.2,
  },
};

let appConfig;

function assertConfig() {
  const providers = getConfiguredProviders();
  const embeddingProvider = getEmbeddingProviderConfig();

  if (!providers.length) {
    throw new Error(
      "No chat provider is configured. Set one provider API key in .env, for example AI_PROVIDER_OPENROUTER_API_KEY. Fallback providers are optional.",
    );
  }

  if (embeddingProvider.id !== "ollama" && !embeddingProvider.apiKey) {
    throw new Error(
      `Missing embedding provider API key. Set ${getProviderEnvName(embeddingProvider.id, "API_KEY")} in .env or use embeddings.provider: ollama in config.yaml.`,
    );
  }

  if (embeddingProvider.id !== "ollama" && !embeddingProvider.embeddingModel) {
    throw new Error(
      `Missing embedding model for ${embeddingProvider.name}. Set providers.${embeddingProvider.id}.embeddingModel in config.yaml or use embeddings.provider: ollama.`,
    );
  }
}

function getConfiguredProviders() {
  return getProviderIds()
    .filter((id) => getProviderEnv(id, "API_KEY"))
    .map(getProviderConfig);
}

function getProviderIds() {
  const chat = getObject(getAppConfig().chat, "chat");
  const providers = getStringList(chat.providers, "chat.providers", {
    lowercase: true,
  });

  return providers.length ? providers : DEFAULT_PROVIDER_IDS;
}

function getProviderConfig(id) {
  const normalizedId = id.trim().toLowerCase();
  const builtIn = BUILT_IN_PROVIDERS[normalizedId] ?? {};
  const provider = getYamlProvider(normalizedId);
  const pathPrefix = `providers.${normalizedId}`;
  const defaultHeaders = getStringMap(
    provider.defaultHeaders,
    `${pathPrefix}.defaultHeaders`,
  );

  return {
    id: normalizedId,
    name:
      getString(provider.name, `${pathPrefix}.name`) ??
      builtIn.name ??
      formatProviderName(normalizedId),
    apiKey: getProviderEnv(normalizedId, "API_KEY"),
    model: getString(provider.model, `${pathPrefix}.model`) ?? builtIn.model,
    embeddingModel:
      getString(provider.embeddingModel, `${pathPrefix}.embeddingModel`) ??
      builtIn.embeddingModel,
    baseURL:
      getString(provider.baseUrl, `${pathPrefix}.baseUrl`) ??
      getString(provider.baseURL, `${pathPrefix}.baseURL`) ??
      builtIn.baseURL,
    temperature: getNumber(
      provider.temperature,
      builtIn.temperature,
      `${pathPrefix}.temperature`,
    ),
    topP: getNumber(provider.topP, builtIn.topP, `${pathPrefix}.topP`),
    maxTokens: getNumber(
      provider.maxTokens,
      builtIn.maxTokens,
      `${pathPrefix}.maxTokens`,
    ),
    defaultHeaders: defaultHeaders ?? builtIn.defaultHeaders,
    reasoningEnabled: getBoolean(
      provider.reasoningEnabled,
      builtIn.reasoningEnabled,
      `${pathPrefix}.reasoningEnabled`,
    ),
    reasoningEffort:
      getString(provider.reasoningEffort, `${pathPrefix}.reasoningEffort`) ??
      builtIn.reasoningEffort,
  };
}

function getEmbeddingProviderConfig() {
  const embeddings = getObject(getAppConfig().embeddings, "embeddings");
  const id = (
    getEnvValue("RUNTIME_EMBEDDING_PROVIDER") ??
    getString(embeddings.provider, "embeddings.provider") ??
    DEFAULT_EMBEDDING_PROVIDER_ID
  )
    .trim()
    .toLowerCase();
  const provider = getProviderConfig(id);

  if (id !== "ollama") return provider;

  const ollama = getObject(embeddings.ollama, "embeddings.ollama");

  return {
    ...provider,
    baseURL:
      getEnvValue("RUNTIME_OLLAMA_BASE_URL") ??
      getString(ollama.baseUrl, "embeddings.ollama.baseUrl") ??
      provider.baseURL ??
      DEFAULT_OLLAMA_BASE_URL,
    embeddingModel:
      getString(ollama.model, "embeddings.ollama.model") ??
      getString(ollama.embeddingModel, "embeddings.ollama.embeddingModel") ??
      provider.embeddingModel ??
      DEFAULT_OLLAMA_EMBEDDING_MODEL,
  };
}

function getQdrantConfig() {
  const qdrant = getObject(getAppConfig().qdrant, "qdrant");

  return {
    url:
      getEnvValue("RUNTIME_QDRANT_URL") ??
      getString(qdrant.url, "qdrant.url") ??
      DEFAULT_QDRANT_URL,
    apiKey: getEnvValue("QDRANT_API_KEY"),
    collectionName:
      getString(qdrant.collection, "qdrant.collection") ??
      DEFAULT_QDRANT_COLLECTION,
    indexId:
      getString(qdrant.indexId, "qdrant.indexId") ??
      DEFAULT_QDRANT_INDEX_ID,
  };
}

function getImageTextConfig() {
  const imageText = getObject(getAppConfig().imageText, "imageText");
  const providerId = (
    getString(imageText.provider, "imageText.provider") ??
    DEFAULT_IMAGE_TEXT_PROVIDER_ID
  )
    .trim()
    .toLowerCase();
  const provider = getProviderConfig(providerId);
  const cacheDir =
    getString(imageText.cacheDir, "imageText.cacheDir") ??
    DEFAULT_IMAGE_TEXT_CACHE_DIR;

  return {
    ...provider,
    apiKeyEnvName: getProviderEnvName(providerId, "API_KEY"),
    cacheDir: resolveProjectPath(cacheDir),
    maxBytes: getInteger(
      imageText.maxBytes,
      DEFAULT_IMAGE_TEXT_MAX_BYTES,
      "imageText.maxBytes",
      { min: 1 },
    ),
    model:
      getString(imageText.model, "imageText.model") ?? DEFAULT_IMAGE_TEXT_MODEL,
    promptVersion:
      getString(imageText.promptVersion, "imageText.promptVersion") ??
      DEFAULT_IMAGE_TEXT_PROMPT_VERSION,
  };
}

function getDiscordConfig() {
  const discord = getObject(getAppConfig().discord, "discord");

  return {
    clientId: getDiscordId(discord.clientId, "discord.clientId"),
    guildId: getDiscordId(discord.guildId, "discord.guildId"),
    adminUserIds: getDiscordIdList(
      discord.adminUserIds,
      "discord.adminUserIds",
    ),
  };
}

function getRetrievalConfig() {
  const retrieval = getObject(getAppConfig().retrieval, "retrieval");

  return {
    chunkSize: getInteger(
      retrieval.chunkSize,
      DEFAULT_CHUNK_SIZE,
      "retrieval.chunkSize",
      { min: 1 },
    ),
    chunkOverlap: getInteger(
      retrieval.chunkOverlap,
      DEFAULT_CHUNK_OVERLAP,
      "retrieval.chunkOverlap",
      { min: 0 },
    ),
    limit: getInteger(
      retrieval.limit,
      DEFAULT_RETRIEVAL_LIMIT,
      "retrieval.limit",
      { min: 1 },
    ),
    debug: getBoolean(retrieval.debug, false, "retrieval.debug"),
  };
}

function isAdminUser(userId) {
  return getDiscordConfig().adminUserIds.includes(userId);
}

function isRetrievalDebugEnabled() {
  return getRetrievalConfig().debug;
}

function getYamlProvider(id) {
  const providers = getObject(getAppConfig().providers, "providers");
  const provider = providers[id];

  return getObject(provider, `providers.${id}`);
}

function getAppConfig() {
  if (appConfig) return appConfig;

  if (!fs.existsSync(CONFIG_PATH)) {
    appConfig = {};
    return appConfig;
  }

  try {
    appConfig = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8")) ?? {};
  } catch (error) {
    throw new Error(`Could not parse config.yaml: ${error.message}`, {
      cause: error,
    });
  }

  if (!isPlainObject(appConfig)) {
    throw new Error("config.yaml must contain a YAML object.");
  }

  return appConfig;
}

function getProviderEnv(id, key) {
  return getEnvValue(getProviderEnvName(id, key));
}

function getProviderEnvName(id, key) {
  return `AI_PROVIDER_${formatEnvProviderId(id)}_${key}`;
}

function getEnvValue(name) {
  const value = process.env[name]?.trim();

  return value || undefined;
}

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value);
}

function getObject(value, configPath) {
  if (value === undefined || value === null) return {};

  if (!isPlainObject(value)) {
    throw new Error(`${configPath} in config.yaml must be an object.`);
  }

  return value;
}

function getString(value, configPath) {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new Error(`${configPath} in config.yaml must be a string.`);
  }

  return value.trim() || undefined;
}

function getStringList(value, configPath, { lowercase = false } = {}) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new Error(`${configPath} in config.yaml must be a list.`);
  }

  return value
    .map((item) => {
      const string = getString(item, configPath);

      return lowercase ? string?.toLowerCase() : string;
    })
    .filter(Boolean);
}

function getDiscordId(value, configPath) {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new Error(`${configPath} in config.yaml must be a quoted string.`);
  }

  return value.trim() || undefined;
}

function getDiscordIdList(value, configPath) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new Error(`${configPath} in config.yaml must be a list.`);
  }

  return value
    .map((item) => getDiscordId(item, configPath))
    .filter(Boolean);
}

function getStringMap(value, configPath) {
  if (value === undefined || value === null) return undefined;

  const object = getObject(value, configPath);
  const entries = Object.entries(object)
    .map(([key, item]) => [key, getString(item, `${configPath}.${key}`)])
    .filter(([, item]) => item !== undefined);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function getNumber(value, fallback, configPath) {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${configPath} in config.yaml must be a number.`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${configPath} in config.yaml must be a finite number.`);
  }

  return number;
}

function getInteger(value, fallback, configPath, { min }) {
  const number = getNumber(value, fallback, configPath);

  if (!Number.isInteger(number) || number < min) {
    throw new Error(
      `${configPath} in config.yaml must be an integer greater than or equal to ${min}.`,
    );
  }

  return number;
}

function getBoolean(value, fallback, configPath) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  throw new Error(`${configPath} in config.yaml must be true or false.`);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function formatEnvProviderId(id) {
  return id.replace(/[^a-z0-9]/gi, "_").toUpperCase();
}

function formatProviderName(id) {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

const {
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  limit: RETRIEVAL_LIMIT,
} = getRetrievalConfig();

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  RETRIEVAL_LIMIT,
  assertConfig,
  getConfiguredProviders,
  getDiscordConfig,
  getEmbeddingProviderConfig,
  getImageTextConfig,
  getProviderConfig,
  getQdrantConfig,
  getRetrievalConfig,
  isAdminUser,
  isRetrievalDebugEnabled,
};
