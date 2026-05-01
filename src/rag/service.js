const { assertConfig, getConfiguredProviders } = require("./config");
const { createChatModel } = require("./llm");
const { answerQuestion } = require("./rag");
const { getKnowledgeVectorStore } = require("./vector-store");

async function askKnowledgeBase(question) {
  assertConfig();

  const knowledgeBase = await getKnowledgeVectorStore();

  return answerWithFallback(knowledgeBase, question);
}

async function answerWithFallback(knowledgeBase, question) {
  const providers = getConfiguredProviders();
  let lastError;

  for (const provider of providers) {
    try {
      return await answerQuestion(
        createChatModel(provider),
        knowledgeBase,
        question,
        provider,
      );
    } catch (error) {
      lastError = error;

      console.warn(`${provider.name} request failed:`, error);
    }
  }

  throw lastError ?? new Error("No configured AI providers are available.");
}

module.exports = { askKnowledgeBase };
