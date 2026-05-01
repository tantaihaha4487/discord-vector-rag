const { SlashCommandBuilder } = require("@discordjs/builders");
const { askKnowledgeBase } = require("../rag/service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask a question using the local RAG knowledge base")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("The question to answer")
        .setRequired(true),
    ),

  async execute(interaction) {
    const question = interaction.options.getString("question", true);

    await interaction.deferReply();

    try {
      const result = await askKnowledgeBase(question);
      const response = formatResponse(result);

      await interaction.editReply(response);
    } catch (error) {
      console.error("Error answering RAG question:", error);

      await interaction.editReply(getUserFacingError(error));
    }
  },
};

function formatResponse(result) {
  const sources = result.sources.length
    ? `\n\nSources:\n${result.sources.map((source) => `- ${source}`).join("\n")}`
    : "";
  const response = `${result.answer}${sources}`;

  if (response.length <= 2000) return response;

  const availableAnswerLength = Math.max(0, 1900 - sources.length);

  return `${result.answer.slice(0, availableAnswerLength)}...${sources}`;
}

function getUserFacingError(error) {
  if (error.message?.startsWith("No chat provider is configured.")) {
    return "RAG is not configured yet. Set one provider API key in .env, for example AI_PROVIDER_OPENROUTER_API_KEY. Fallback providers are optional.";
  }

  if (error.message?.startsWith("Missing embedding")) {
    return `Vector search is not configured yet. ${error.message}`;
  }

  if (error.message === "No .txt or .pdf files found in data/") {
    return "No knowledge files found. Add .txt or .pdf files to data/.";
  }

  if (error?.status === 429 || error?.lc_error_code === "MODEL_RATE_LIMIT") {
    return "AI provider rate limit hit. Retry later or change AI_PROVIDERS/model configuration.";
  }

  if (error?.message?.includes("Ollama")) {
    return "Ollama embeddings are not reachable. Run with Docker Compose or start Ollama and pull nomic-embed-text.";
  }

  if (error?.code === "ECONNREFUSED" || error?.message?.includes("Qdrant")) {
    return "Qdrant is not reachable. Start it with docker compose up -d qdrant and retry.";
  }

  return "There was an error while answering your question.";
}
