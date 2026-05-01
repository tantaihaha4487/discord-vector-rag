const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const { RETRIEVAL_LIMIT } = require("./config");
const { retrieveHybridDocs } = require("./hybrid-retriever");

const systemPrompt = [
  "You are a helpful assistant.",
  "Answer using only the provided context.",
  "If the answer is not in the context, say you don't know.",
  "Format answers with Discord markdown when it improves readability.",
  "Available formatting: **bold**, *italic*, __underline__, ~~strike~~, `code`, code blocks, > quotes, - lists, and [text](url) links.",
].join(" ");

async function answerQuestion(llm, knowledgeBase, question, provider) {
  const retrievedDocs = await retrieveHybridDocs(
    knowledgeBase,
    question,
    RETRIEVAL_LIMIT,
  );
  const context = retrievedDocs
    .map(
      (doc, index) =>
        `Source ${index + 1}: ${doc.metadata.source}\n${doc.pageContent}`,
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
