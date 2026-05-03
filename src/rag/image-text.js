const crypto = require("node:crypto");
const { mkdir, readFile, stat, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { getImageTextConfig } = require("./config");

const imageMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
]);

const supportedImageExtensions = new Set(imageMimeTypes.keys());
const IMAGE_TEXT_PROMPT = [
  "Extract all useful text from this image for a search knowledge base.",
  "Preserve original language, names, numbers, dates, URLs, labels, and table structure when possible.",
  "If the image has little or no readable text, describe the important visual content briefly.",
  "Return plain text only.",
].join("\n");

async function extractImageText(filePath, relativePath) {
  const config = getImageTextConfig();
  const file = await stat(filePath);

  if (file.size > config.maxBytes) {
    throw new Error(
      `Image ${relativePath} is too large for inline extraction. Maximum size is ${config.maxBytes} bytes.`,
    );
  }

  const image = await readFile(filePath);
  const fileSha256 = createSha256(image);
  const mimeType = getImageMimeType(filePath);
  const cacheKey = createCacheKey(config, fileSha256);
  const cachePath = path.join(config.cacheDir, `${cacheKey}.json`);
  const cached = await readCachedText(cachePath, config, fileSha256);

  if (cached !== undefined) {
    return createResult(cached, config, mimeType, cacheKey);
  }

  if (image.byteLength > config.maxBytes) {
    throw new Error(
      `Image ${relativePath} is too large for inline extraction. Maximum size is ${config.maxBytes} bytes.`,
    );
  }

  const text = await requestImageText(config, image, mimeType);
  await writeCache(cachePath, {
    source: relativePath,
    fileSha256,
    mimeType,
    provider: config.id,
    model: config.model,
    promptVersion: config.promptVersion,
    text,
    createdAt: new Date().toISOString(),
  });

  return createResult(text, config, mimeType, cacheKey);
}

function createResult(text, config, mimeType, cacheKey) {
  return {
    text,
    metadata: {
      imageMimeType: mimeType,
      imageTextCacheKey: cacheKey,
      imageTextModel: config.model,
      imageTextProvider: config.id,
      sourceType: "image",
    },
  };
}

async function requestImageText(config, image, mimeType) {
  if (!config.apiKey) {
    throw new Error(
      `Missing image text provider API key. Set ${config.apiKeyEnvName} in .env or change imageText.provider in config.yaml.`,
    );
  }

  if (!config.baseURL) {
    throw new Error(
      `Missing base URL for image text provider ${config.name}. Set providers.${config.id}.baseUrl in config.yaml.`,
    );
  }

  const response = await fetch(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...config.defaultHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      top_p: config.topP,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: IMAGE_TEXT_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${image.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = new Error(
      `${config.name} image text request failed with ${response.status}: ${truncate(await response.text())}`,
    );

    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = getResponseText(data);

  if (!text) {
    throw new Error(`${config.name} image text response did not include text.`);
  }

  return text;
}

function getResponseText(data) {
  const content = data.choices?.[0]?.message?.content;

  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

function truncate(text, length = 1000) {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

async function readCachedText(cachePath, config, fileSha256) {
  let record;

  try {
    record = JSON.parse(await readFile(cachePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT" && error.name !== "SyntaxError") {
      throw error;
    }

    return undefined;
  }

  if (
    record.fileSha256 !== fileSha256 ||
    record.provider !== config.id ||
    record.model !== config.model ||
    record.promptVersion !== config.promptVersion ||
    typeof record.text !== "string"
  ) {
    return undefined;
  }

  return record.text;
}

async function writeCache(cachePath, record) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function createCacheKey(config, fileSha256) {
  return createSha256(
    JSON.stringify({
      fileSha256,
      provider: config.id,
      model: config.model,
      promptVersion: config.promptVersion,
    }),
  );
}

function createSha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isImageExtension(extension) {
  return supportedImageExtensions.has(extension.toLowerCase());
}

function getImageMimeType(filePath) {
  const mimeType = imageMimeTypes.get(path.extname(filePath).toLowerCase());

  if (!mimeType) {
    throw new Error(`Unsupported image file type: ${path.extname(filePath)}`);
  }

  return mimeType;
}

module.exports = {
  extractImageText,
  getImageMimeType,
  isImageExtension,
  supportedImageExtensions,
};
