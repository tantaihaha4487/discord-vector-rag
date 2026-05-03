const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const {
  canUseAdminCommand,
  getConfiguredProviders,
  getDiscordConfig,
  getDiscordConfigFrom,
  getEmbeddingProviderConfig,
  getImageTextConfig,
  getQdrantConfig,
  getRetrievalConfig,
  readConfigFile,
  reloadConfig,
} = require("../rag/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reload config.yaml without restarting the bot"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const allowedByCurrentConfig = canUseAdminCommand(interaction);
    const access = await getReloadAccess(interaction, allowedByCurrentConfig);

    if (!access.allowed) {
      await interaction.editReply({ embeds: [createNotAllowedEmbed(interaction)] });
      return;
    }

    let before;
    let after;

    try {
      before = getConfigSnapshot();
      reloadConfig(access.nextConfig);
      after = getConfigSnapshot();
    } catch (error) {
      await interaction.editReply({ embeds: [createErrorEmbed(error)] });
      return;
    }

    const warnings = getReloadWarnings(before, after);

    await interaction.editReply({ embeds: [createSuccessEmbed(after, warnings)] });
  },
};

async function getReloadAccess(interaction, allowedByCurrentConfig) {
  try {
    const nextConfig = readConfigFile();
    const allowedByNextConfig = canUseAdminCommand(
      interaction,
      getDiscordConfigFrom(nextConfig),
    );

    return {
      allowed: allowedByCurrentConfig || allowedByNextConfig,
      nextConfig,
    };
  } catch (error) {
    if (!allowedByCurrentConfig) {
      return { allowed: false };
    }

    throw error;
  }
}

function getConfigSnapshot() {
  const discord = getDiscordConfig();
  const embedding = getEmbeddingProviderConfig();
  const imageText = getImageTextConfig();
  const qdrant = getQdrantConfig();
  const retrieval = getRetrievalConfig();

  return {
    adminUserCount: discord.adminUserIds.length,
    moderatorRoleCount: discord.moderatorRoleIds.length,
    chatProviders: getConfiguredProviders().map((provider) => provider.id),
    embeddingProvider: embedding.id,
    embeddingModel: embedding.embeddingModel,
    imageTextProvider: imageText.id,
    imageTextModel: imageText.model,
    imageTextPromptVersion: imageText.promptVersion,
    qdrantUrl: qdrant.url,
    qdrantCollection: qdrant.collectionName,
    qdrantIndexId: qdrant.indexId,
    retrievalChunkSize: retrieval.chunkSize,
    retrievalChunkOverlap: retrieval.chunkOverlap,
    retrievalLimit: retrieval.limit,
  };
}

function getReloadWarnings(before, after) {
  const warnings = [];

  if (
    before.embeddingProvider !== after.embeddingProvider ||
    before.embeddingModel !== after.embeddingModel
  ) {
    warnings.push("Embedding settings changed. Run `/refresh` to rebuild vectors.");
  }

  if (
    before.qdrantUrl !== after.qdrantUrl ||
    before.qdrantCollection !== after.qdrantCollection ||
    before.qdrantIndexId !== after.qdrantIndexId
  ) {
    warnings.push("Qdrant index settings changed. Run `/refresh` to index into the new target.");
  }

  if (
    before.retrievalChunkSize !== after.retrievalChunkSize ||
    before.retrievalChunkOverlap !== after.retrievalChunkOverlap
  ) {
    warnings.push("Chunking settings changed. Run `/refresh` so existing documents use the new chunking.");
  }

  if (
    before.imageTextProvider !== after.imageTextProvider ||
    before.imageTextModel !== after.imageTextModel ||
    before.imageTextPromptVersion !== after.imageTextPromptVersion
  ) {
    warnings.push("Image text settings changed. Run `/refresh` to reprocess image knowledge files.");
  }

  return warnings;
}

function createSuccessEmbed(snapshot, warnings) {
  const embed = new EmbedBuilder()
    .setTitle("Reload Complete")
    .setDescription("Reloaded `config.yaml`.")
    .addFields(
      {
        name: "Access",
        value: `${snapshot.adminUserCount} admin user(s), ${snapshot.moderatorRoleCount} moderator role(s)`,
      },
      {
        name: "Chat Providers",
        value: snapshot.chatProviders.length
          ? snapshot.chatProviders.join(", ")
          : "None with API keys",
      },
      {
        name: "Embeddings",
        value: `${snapshot.embeddingProvider} / ${snapshot.embeddingModel}`,
      },
      {
        name: "Image Text",
        value: `${snapshot.imageTextProvider} / ${snapshot.imageTextModel}`,
      },
      {
        name: "Retrieval",
        value: `limit ${snapshot.retrievalLimit}, chunk ${snapshot.retrievalChunkSize}, overlap ${snapshot.retrievalChunkOverlap}`,
      },
    );

  if (warnings.length) {
    embed.addFields({ name: "Warnings", value: warnings.join("\n") });
  }

  return embed;
}

function createNotAllowedEmbed(interaction) {
  return new EmbedBuilder()
    .setTitle("Reload Denied")
    .setDescription(
      `Only users listed in \`discord.adminUserIds\` or members with \`discord.moderatorRoleIds\` can use this command. Your user ID is \`${interaction.user.id}\`.`,
    );
}

function createErrorEmbed(error) {
  return new EmbedBuilder()
    .setTitle("Reload Failed")
    .setDescription(error.message || "Could not reload config.yaml.");
}
