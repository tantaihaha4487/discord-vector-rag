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

  return new OpenAIEmbeddings({
    model: provider.embeddingModel,
    apiKey: provider.apiKey,
    configuration: getProviderConfiguration(provider),
  });
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
};
