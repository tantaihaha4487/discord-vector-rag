const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");

function createChatModel(provider) {
  if (!provider.model) {
    throw new Error(`Missing model for provider ${provider.name}.`);
  }

  return new ChatOpenAI({
    model: provider.model,
    apiKey: provider.apiKey,
    temperature: provider.temperature,
    topP: provider.topP,
    maxTokens: provider.maxTokens,
    configuration: getProviderConfiguration(provider),
    modelKwargs: getProviderModelKwargs(provider),
  });
}

function createEmbeddingModel(provider) {
  if (!provider.embeddingModel) {
    throw new Error(`Missing embedding model for provider ${provider.name}.`);
  }

  if (provider.id === "ollama") {
    return new OllamaEmbeddings({
      baseUrl: provider.baseURL,
      model: provider.embeddingModel,
    });
  }

  return new OpenAIEmbeddings({
    model: provider.embeddingModel,
    apiKey: provider.apiKey,
    configuration: getProviderConfiguration(provider),
  });
}

class OllamaEmbeddings {
  constructor({ baseUrl, model }) {
    this.baseUrl = (baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = model;
  }

  async embedDocuments(texts) {
    return this.embed(texts);
  }

  async embedQuery(text) {
    const [embedding] = await this.embed([text]);

    return embedding;
  }

  async embed(input) {
    let response;

    try {
      response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input }),
      });
    } catch (error) {
      throw new Error(
        `Ollama is not reachable at ${this.baseUrl}. Start Ollama or use Docker Compose.`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        `Ollama embedding request failed with ${response.status}: ${await response.text()}`,
      );
    }

    const data = await response.json();
    const embeddings = data.embeddings ?? data.embedding;

    if (!Array.isArray(embeddings)) {
      throw new Error("Ollama embedding response did not include embeddings.");
    }

    if (embeddings.length > 0 && typeof embeddings[0] === "number") {
      return [embeddings];
    }

    return embeddings;
  }
}

function getProviderConfiguration(provider) {
  if (!provider.baseURL && !provider.defaultHeaders) return undefined;

  return {
    baseURL: provider.baseURL,
    defaultHeaders: provider.defaultHeaders,
  };
}

function getProviderModelKwargs(provider) {
  if (provider.reasoningEnabled === undefined && !provider.reasoningEffort) {
    return undefined;
  }

  return {
    extra_body: {
      chat_template_kwargs: {
        thinking: provider.reasoningEnabled,
        reasoning_effort: provider.reasoningEffort,
      },
    },
  };
}

module.exports = {
  createEmbeddingModel,
  createChatModel,
  OllamaEmbeddings,
};
