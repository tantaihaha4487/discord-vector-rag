const DEFAULT_PROVIDER_IDS = ["openrouter"];
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

const BUILT_IN_PROVIDERS = {
  ollama: {
    name: "Ollama",
    baseURL: getEnvValue("OLLAMA_BASE_URL") ?? DEFAULT_OLLAMA_BASE_URL,
    embeddingModel:
      getEnvValue("OLLAMA_EMBEDDING_MODEL") ?? DEFAULT_OLLAMA_EMBEDDING_MODEL,
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

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;
const RETRIEVAL_LIMIT = 8;
const DEFAULT_EMBEDDING_PROVIDER_ID = "ollama";
const DEFAULT_QDRANT_URL = "http://localhost:6333";
const DEFAULT_QDRANT_COLLECTION = "discord_vector_rag";
const DEFAULT_QDRANT_INDEX_ID = "discord-vector-rag";

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
      `Missing embedding provider API key. Set ${getProviderEnvName(embeddingProvider.id, "API_KEY")} or use EMBEDDING_PROVIDER=ollama.`,
    );
  }

  if (embeddingProvider.id !== "ollama" && !embeddingProvider.embeddingModel) {
    throw new Error(
      `Missing embedding model for ${embeddingProvider.name}. Set ${getProviderEnvName(embeddingProvider.id, "EMBEDDING_MODEL")} or use EMBEDDING_PROVIDER=ollama.`,
    );
  }
}

function getConfiguredProviders() {
  return getProviderIds()
    .filter((id) => getProviderEnv(id, "API_KEY"))
    .map(getProviderConfig);
}

function getProviderIds() {
  return (getEnvValue("AI_PROVIDERS") ?? DEFAULT_PROVIDER_IDS.join(","))
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
    embeddingModel:
      getProviderEnv(id, "EMBEDDING_MODEL") ?? builtIn.embeddingModel,
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
    getEnvValue("EMBEDDING_PROVIDER") ?? DEFAULT_EMBEDDING_PROVIDER_ID
  ).trim().toLowerCase();
  const provider = getProviderConfig(id);
  const embeddingModel =
    getProviderEnv(id, "EMBEDDING_MODEL") ?? provider.embeddingModel;

  return {
    ...provider,
    embeddingModel:
      id === "ollama"
        ? embeddingModel ?? DEFAULT_OLLAMA_EMBEDDING_MODEL
        : embeddingModel,
  };
}

function getQdrantConfig() {
  return {
    url: getEnvValue("QDRANT_URL") ?? DEFAULT_QDRANT_URL,
    apiKey: getEnvValue("QDRANT_API_KEY"),
    collectionName: getEnvValue("QDRANT_COLLECTION") ?? DEFAULT_QDRANT_COLLECTION,
    indexId: getEnvValue("QDRANT_INDEX_ID") ?? DEFAULT_QDRANT_INDEX_ID,
  };
}

function isRetrievalDebugEnabled() {
  return getEnvValue("RAG_DEBUG_RETRIEVAL") === "true";
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
  isRetrievalDebugEnabled,
};
