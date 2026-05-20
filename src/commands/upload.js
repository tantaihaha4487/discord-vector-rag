const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags } = require("discord.js");
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
const { normalizePathSegment } = require("../rag/path-normalizer");
const { setFileOcrPreference } = require("../rag/upload-metadata");
const { refreshKnowledgeVectorStore } = require("../rag/vector-store");

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_FOLDER_CHOICES = 25;

const uploadCommand = {
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
    )
    .addBooleanOption((option) =>
      option
        .setName("use_ocr")
        .setDescription("Use OCR/image text extraction for PDF or image uploads"),
    ),

  async autocomplete(interaction) {
    if (!canUseAdminCommand(interaction)) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().trim().toLowerCase();
    const folders = [".", ...(await listDataFolders())];
    const choices = folders
      .map((folder) => ({
        name: folder,
        value: folder,
      }))
      .filter(
        (choice) =>
          choice.name.toLowerCase().includes(focused) ||
          choice.value.toLowerCase().includes(focused),
      )
      .slice(0, MAX_FOLDER_CHOICES);

    await interaction.respond(choices);
  },

  async execute(interaction) {
    if (!canUseAdminCommand(interaction)) {
      await replyNotAllowed(interaction);
      return;
    }

    const attachment = interaction.options.getAttachment("file", true);
    const folder = interaction.options.getString("folder") ?? "";
    const useOcr = interaction.options.getBoolean("use_ocr") ?? false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const target = getUploadTarget(attachment.name, folder);
      validateAttachment(attachment, target.extension, useOcr);

      await interaction.editReply({
        embeds: [createUploadReceivedEmbed(target, useOcr)],
      });

      await saveAttachment(attachment.url, target.filePath, target.directoryPath);
      await updateOcrPreference(target, useOcr);
      await refreshAfterUpload(interaction, target, useOcr);
    } catch (error) {
      console.error("Error uploading knowledge file:", error);

      await interaction.editReply({ embeds: [createErrorEmbed(error)] });
    }
  },
};

module.exports = uploadCommand;
module.exports._test = { getUploadTarget, normalizeFolder, validateOcrOption };

function validateAttachment(attachment, extension, useOcr) {
  if (!supportedExtensions.has(extension)) {
    throw new Error(`Only ${supportedFileTypes} files are supported.`);
  }

  validateOcrOption(extension, useOcr);

  const maxBytes = getMaxUploadBytes(extension);

  if (attachment.size > maxBytes) {
    throw new Error(
      `Upload is too large. Maximum file size is ${formatBytes(maxBytes)}.`,
    );
  }
}

function validateOcrOption(extension, useOcr) {
  if (!useOcr) return;
  if (extension === ".pdf" || isImageExtension(extension)) return;

  throw new Error("OCR extraction is only available for PDF and image uploads.");
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
  const parts = folder
    .trim()
    .normalize("NFC")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  if (parts.length === 1 && parts[0] === ".") return "";

  if (parts[0]?.toLowerCase() === "data") {
    parts.shift();
  }

  if (parts.length === 0) return "";

  if (parts.some(isInvalidFolderPart)) {
    throw new Error("Folder must be a relative path under `data/`.");
  }

  return parts.join("/");
}

function isInvalidFolderPart(part) {
  return part === "." || part === ".." || part.includes("\0");
}

function sanitizeFilename(filename) {
  const name = normalizePathSegment(path.basename(filename.replace(/\\/g, "/")), {
    replaceInvalid: true,
  });

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

async function updateOcrPreference(target, useOcr) {
  if (target.extension !== ".pdf") return;

  await setFileOcrPreference(target.relativePath, useOcr);
}

async function refreshAfterUpload(interaction, target, useOcr) {
  try {
    const stats = await refreshKnowledgeVectorStore();

    await interaction.editReply({
      embeds: [createSuccessEmbed(target, stats, useOcr)],
    });
  } catch (error) {
    console.error("Error refreshing RAG index after upload:", error);

    await interaction.editReply({
      embeds: [createRefreshFailedEmbed(target, error)],
    });
  }
}

function createUploadReceivedEmbed(target, useOcr) {
  const embed = createEmbed(
    "Upload Received",
    `Saving \`${target.relativePath}\` and refreshing the vector database...`,
  );
  const extraction = getExtractionLabel(target.extension, useOcr);

  if (extraction) {
    embed.addFields({ name: "Extraction", value: extraction, inline: false });
  }

  return embed;
}

function createSuccessEmbed(target, stats, useOcr) {
  const embed = createEmbed(
    "Upload Complete",
    `Saved \`${target.relativePath}\` and refreshed the knowledge base.`,
  );
  const extraction = getExtractionLabel(target.extension, useOcr);

  if (extraction) {
    embed.addFields({ name: "Extraction", value: extraction, inline: false });
  }

  return embed.addFields(
    { name: "Files", value: String(stats.files), inline: true },
    { name: "Chunks", value: String(stats.chunks), inline: true },
    { name: "Collection", value: `\`${stats.collectionName}\``, inline: false },
  );
}

function createRefreshFailedEmbed(target, error) {
  return createEmbed(
    "Upload Saved, Refresh Failed",
    `Saved \`${target.relativePath}\`, but the vector database refresh failed.`,
  ).addFields({ name: "Error", value: getUserFacingError(error) });
}

function getExtractionLabel(extension, useOcr) {
  if (extension === ".pdf" && useOcr) return "PDF OCR using image text extraction";
  if (isImageExtension(extension)) return "Image text extraction";

  return undefined;
}

function createErrorEmbed(error) {
  return createEmbed("Upload Failed", getUserFacingError(error));
}

async function replyNotAllowed(interaction) {
  await interaction.reply({
    content: `Only users listed in \`DISCORD_ADMIN_USER_IDS\` or members with \`DISCORD_MODERATOR_ROLE_IDS\` can use this command. Your user ID is \`${interaction.user.id}\`.`,
    flags: MessageFlags.Ephemeral,
  });
}

function createEmbed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description);
}

function getUserFacingError(error) {
  return error.message || "There was an error while uploading the file.";
}
