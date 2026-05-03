const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { isAdminUser } = require("../rag/config");
const { refreshKnowledgeVectorStore } = require("../rag/vector-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refresh")
    .setDescription("Refresh the RAG vector database from data/"),

  async execute(interaction) {
    if (!isAdminUser(interaction.user.id)) {
      await replyNotAllowed(interaction);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.editReply({
        embeds: [
          createEmbed(
            "Refresh Started",
            "Reindexing the vector database from `data/`...",
          ),
        ],
      });

      const stats = await refreshKnowledgeVectorStore();

      await interaction.editReply({ embeds: [createSuccessEmbed(stats)] });
    } catch (error) {
      console.error("Error refreshing RAG index:", error);

      await interaction.editReply({ embeds: [createErrorEmbed(error)] });
    }
  },
};

function createSuccessEmbed(stats) {
  return createEmbed(
    "Refresh Complete",
    "Refreshed the knowledge base.",
  ).addFields(
    { name: "Files", value: String(stats.files), inline: true },
    { name: "Chunks", value: String(stats.chunks), inline: true },
    { name: "Collection", value: `\`${stats.collectionName}\``, inline: false },
  );
}

function createErrorEmbed(error) {
  return createEmbed(
    "Refresh Failed",
    error.message || "There was an error while refreshing the vector database.",
  );
}

async function replyNotAllowed(interaction) {
  await interaction.reply({
    content: `Only users listed in \`discord.adminUserIds\` can use this command. Your user ID is \`${interaction.user.id}\`.`,
    ephemeral: true,
  });
}

function createEmbed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description);
}
