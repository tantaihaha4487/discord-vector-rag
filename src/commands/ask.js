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
  if (
    error.message ===
    "Missing provider configuration in .env. Set AI_PROVIDERS and AI_PROVIDER_<NAME>_API_KEY."
  ) {
    return "RAG is not configured yet. Set AI_PROVIDERS and AI_PROVIDER_<NAME>_API_KEY in .env.";
  }

  if (
    error.message ===
    "Missing embedding provider configuration in .env. Set EMBEDDING_PROVIDER and AI_PROVIDER_<NAME>_API_KEY."
  ) {
    return "Vector search is not configured yet. Set EMBEDDING_PROVIDER and AI_PROVIDER_<NAME>_API_KEY in .env.";
  }

  if (error.message === "No .txt or .pdf files found in data/") {
    return "No knowledge files found. Add .txt or .pdf files to data/.";
  }

  if (error?.status === 429 || error?.lc_error_code === "MODEL_RATE_LIMIT") {
    return "AI provider rate limit hit. Retry later or change AI_PROVIDERS/model configuration.";
  }

  if (
    error?.code === "ECONNREFUSED" ||
    error?.message?.includes("fetch failed") ||
    error?.message?.includes("Qdrant")
  ) {
    return "Qdrant is not reachable. Start it with docker compose up -d qdrant and retry.";
  }

  return "There was an error while answering your question.";
}
