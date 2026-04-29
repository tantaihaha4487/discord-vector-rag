const DEFAULT_PROVIDER_IDS = ["openrouter", "nvidia"];

const BUILT_IN_PROVIDERS = {
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

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;
const RETRIEVAL_LIMIT = 8;
const DEFAULT_EMBEDDING_PROVIDER_ID = "openrouter";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_QDRANT_URL = "http://localhost:6333";
const DEFAULT_QDRANT_COLLECTION = "discord_vector_rag";
const DEFAULT_QDRANT_INDEX_ID = "discord-vector-rag";

function assertConfig() {
  const providers = getConfiguredProviders();
  const embeddingProvider = getEmbeddingProviderConfig();

  if (!providers.length) {
    throw new Error(
      "Missing provider configuration in .env. Set AI_PROVIDERS and AI_PROVIDER_<NAME>_API_KEY.",
    );
  }

  if (!embeddingProvider.apiKey) {
    throw new Error(
      "Missing embedding provider configuration in .env. Set EMBEDDING_PROVIDER and AI_PROVIDER_<NAME>_API_KEY.",
    );
  }
}

function getConfiguredProviders() {
  return getProviderIds()
    .filter((id) => getProviderEnv(id, "API_KEY"))
    .map(getProviderConfig);
}

function getProviderIds() {
  return (process.env.AI_PROVIDERS ?? DEFAULT_PROVIDER_IDS.join(","))
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

function getProviderConfig(id) {
  const builtIn = BUILT_IN_PROVIDERS[id] ?? {};

  return {
    id,
    name: getProviderEnv(id, "NAME") ?? builtIn.name ?? formatProviderName(id),
    apiKey: getProviderEnv(id, "API_KEY"),
    model: getProviderEnv(id, "MODEL") ?? builtIn.model,
    baseURL: getProviderEnv(id, "BASE_URL") ?? builtIn.baseURL,
    temperature: getNumberProviderEnv(id, "TEMPERATURE", builtIn.temperature),
    topP: getNumberProviderEnv(id, "TOP_P", builtIn.topP),
    maxTokens: getNumberProviderEnv(id, "MAX_TOKENS", builtIn.maxTokens),
    defaultHeaders: builtIn.defaultHeaders,
    reasoningEnabled: getBooleanProviderEnv(
      id,
      "REASONING_ENABLED",
      builtIn.reasoningEnabled,
    ),
    reasoningEffort:
      getProviderEnv(id, "REASONING_EFFORT") ?? builtIn.reasoningEffort,
  };
}

function getEmbeddingProviderConfig() {
  const id = (
    process.env.EMBEDDING_PROVIDER ?? DEFAULT_EMBEDDING_PROVIDER_ID
  ).trim().toLowerCase();
  const provider = getProviderConfig(id);

  return {
    ...provider,
    embeddingModel:
      getProviderEnv(id, "EMBEDDING_MODEL") ??
      provider.embeddingModel ??
      DEFAULT_EMBEDDING_MODEL,
  };
}

function getQdrantConfig() {
  return {
    url: process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION ?? DEFAULT_QDRANT_COLLECTION,
    indexId: process.env.QDRANT_INDEX_ID ?? DEFAULT_QDRANT_INDEX_ID,
  };
}

function getProviderEnv(id, key) {
  return process.env[`AI_PROVIDER_${formatEnvProviderId(id)}_${key}`];
}

function getNumberProviderEnv(id, key, fallback) {
  const value = getProviderEnv(id, key);
  if (value === undefined) return fallback;

  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(
      `Invalid number for AI_PROVIDER_${formatEnvProviderId(id)}_${key}.`,
    );
  }

  return number;
}

function getBooleanProviderEnv(id, key, fallback) {
  const value = getProviderEnv(id, key);
  if (value === undefined) return fallback;

  return value !== "false";
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

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  RETRIEVAL_LIMIT,
  assertConfig,
  getConfiguredProviders,
  getEmbeddingProviderConfig,
  getQdrantConfig,
};
