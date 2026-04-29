const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { RETRIEVAL_LIMIT } = require("./config");

const systemPrompt =
  "You are a helpful assistant. Answer using only the provided context. If the answer is not in the context, say you don't know.";

async function answerQuestion(llm, vectorStore, question, provider) {
  const retrievedDocs = await vectorStore.similaritySearch(
    question,
    RETRIEVAL_LIMIT,
  );
  const context = retrievedDocs
    .map(
      (doc, index) => `Source ${index + 1}: ${doc.metadata.source}\n${doc.pageContent}`,
    )
    .join("\n\n");

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Context:\n${context}\n\nQuestion:\n${question}`),
  ]);

  return {
    answer: response.content,
    provider: provider.id,
    providerName: provider.name,
    sources: [...new Set(retrievedDocs.map((doc) => doc.metadata.source))],
  };
}

module.exports = { answerQuestion };
