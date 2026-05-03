const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const {
  dataDir,
  listDataFolders,
  supportedExtensions,
  supportedFileTypes,
} = require("../rag/data-loader");
const { canUseAdminCommand, getImageTextConfig } = require("../rag/config");
const { isImageExtension } = require("../rag/image-text");
const { refreshKnowledgeVectorStore } = require("../rag/vector-store");

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_FOLDER_CHOICES = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload")
    .setDescription("Upload a knowledge file and refresh the RAG index")
    .addAttachmentOption((option) =>
      option
        .setName("file")
        .setDescription("A .txt, .pdf, or image knowledge file")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("folder")
        .setDescription("Existing or new folder under data/")
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    if (!canUseAdminCommand(interaction)) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().trim().toLowerCase();
    const folders = [".", ...(await listDataFolders())];
    const choices = folders
      .filter((folder) => folder.toLowerCase().includes(focused))
      .slice(0, MAX_FOLDER_CHOICES)
      .map((folder) => ({
        name: folder === "." ? "data/" : `data/${folder}/`,
        value: folder,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    if (!canUseAdminCommand(interaction)) {
      await replyNotAllowed(interaction);
      return;
    }

    const attachment = interaction.options.getAttachment("file", true);
    const folder = interaction.options.getString("folder") ?? "";

    await interaction.deferReply({ ephemeral: true });

    try {
      const target = getUploadTarget(attachment.name, folder);
      validateAttachment(attachment, target.extension);

      await interaction.editReply({
        embeds: [
          createEmbed(
            "Upload Received",
            `Saving \`${target.relativePath}\` and refreshing the vector database...`,
          ),
        ],
      });

      await saveAttachment(attachment.url, target.filePath, target.directoryPath);

      try {
        const stats = await refreshKnowledgeVectorStore();

        await interaction.editReply({
          embeds: [createSuccessEmbed(target.relativePath, stats)],
        });
      } catch (error) {
        console.error("Error refreshing RAG index after upload:", error);

        await interaction.editReply({
          embeds: [createRefreshFailedEmbed(target.relativePath, error)],
        });
      }
    } catch (error) {
      console.error("Error uploading knowledge file:", error);

      await interaction.editReply({ embeds: [createErrorEmbed(error)] });
    }
  },
};

function validateAttachment(attachment, extension) {
  if (!supportedExtensions.has(extension)) {
    throw new Error(`Only ${supportedFileTypes} files are supported.`);
  }

  const maxBytes = getMaxUploadBytes(extension);

  if (attachment.size > maxBytes) {
    throw new Error(
      `Upload is too large. Maximum file size is ${formatBytes(maxBytes)}.`,
    );
  }
}

function getMaxUploadBytes(extension) {
  if (!isImageExtension(extension)) return MAX_UPLOAD_BYTES;

  return Math.min(MAX_UPLOAD_BYTES, getImageTextConfig().maxBytes);
}

function formatBytes(bytes) {
  const megabytes = bytes / 1024 / 1024;

  if (Number.isInteger(megabytes)) return `${megabytes} MB`;

  return `${megabytes.toFixed(1)} MB`;
}

function getUploadTarget(filename, folder) {
  const safeFolder = normalizeFolder(folder);
  const safeFilename = sanitizeFilename(filename);
  const extension = path.extname(safeFilename).toLowerCase();
  const root = path.resolve(dataDir);
  const directoryPath = path.resolve(root, safeFolder);
  const filePath = path.resolve(directoryPath, safeFilename);

  assertInsideData(root, directoryPath);
  assertInsideData(root, filePath);

  return {
    directoryPath,
    extension,
    filePath,
    relativePath: path.relative(root, filePath).split(path.sep).join("/"),
  };
}

function normalizeFolder(folder) {
  const value = folder.trim();
  if (!value || value === ".") return "";

  const parts = value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    parts.length === 0 ||
    parts.some((part) =>
      part === "." || part === ".." || /[<>:"|?*\x00-\x1F]/.test(part),
    )
  ) {
    throw new Error("Folder must be a relative path under `data/`.");
  }

  return parts.join("/");
}

function sanitizeFilename(filename) {
  const name = path
    .basename(filename.replace(/\\/g, "/"))
    .replace(/[<>:"|?*\x00-\x1F]/g, "_");

  if (!name || name === "." || name === "..") {
    throw new Error("Attachment filename is invalid.");
  }

  return name;
}

function assertInsideData(root, targetPath) {
  if (targetPath !== root && !targetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Upload target must stay inside `data/`.");
  }
}

async function saveAttachment(url, filePath, directoryPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Could not download attachment from Discord (${response.status}).`,
    );
  }

  await mkdir(directoryPath, { recursive: true });
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}

function createSuccessEmbed(relativePath, stats) {
  return createEmbed(
    "Upload Complete",
    `Saved \`${relativePath}\` and refreshed the knowledge base.`,
  ).addFields(
    { name: "Files", value: String(stats.files), inline: true },
    { name: "Chunks", value: String(stats.chunks), inline: true },
    { name: "Collection", value: `\`${stats.collectionName}\``, inline: false },
  );
}

function createRefreshFailedEmbed(relativePath, error) {
  return createEmbed(
    "Upload Saved, Refresh Failed",
    `Saved \`${relativePath}\`, but the vector database refresh failed.`,
  ).addFields({ name: "Error", value: getUserFacingError(error) });
}

function createErrorEmbed(error) {
  return createEmbed("Upload Failed", getUserFacingError(error));
}

async function replyNotAllowed(interaction) {
  await interaction.reply({
    content: `Only users listed in \`discord.adminUserIds\` or members with \`discord.moderatorRoleIds\` can use this command. Your user ID is \`${interaction.user.id}\`.`,
    ephemeral: true,
  });
}

function createEmbed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description);
}

function getUserFacingError(error) {
  return error.message || "There was an error while uploading the file.";
}
