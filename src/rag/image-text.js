const crypto = require("node:crypto");
const { mkdir, readFile, rename, stat, writeFile } = require("node:fs/promises");
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

  assertImageWithinLimit(file.size, config, relativePath);

  const image = await readFile(filePath);
  const mimeType = getImageMimeType(filePath);
  return extractImageBufferText({
    image,
    mimeType,
    source: relativePath,
    sourceType: "image",
    config,
  });
}

async function extractImageBufferText({
  image,
  mimeType,
  source,
  sourceType = "image",
  cacheIdentity = {},
  cacheRecord = {},
  metadata = {},
  imageHashKey = "fileSha256",
  config = getImageTextConfig(),
}) {
  const imageSha256 = createSha256(image);
  const imageIdentity = imageHashKey ? { [imageHashKey]: imageSha256 } : {};
  const identity = {
    ...cacheIdentity,
    ...imageIdentity,
  };
  const cached = await readImageTextCache(identity, config);

  if (cached !== undefined) {
    return createResult(cached.text, config, mimeType, cached.cacheKey, {
      sourceType,
      ...metadata,
    });
  }

  assertImageWithinLimit(image.byteLength, config, source);

  const text = await requestImageText(config, image, mimeType);
  const cacheKey = createCacheKey(config, identity);
  const cachePath = path.join(config.cacheDir, `${cacheKey}.json`);

  await writeCache(cachePath, {
    source,
    ...cacheRecord,
    ...identity,
    mimeType,
    provider: config.id,
    model: config.model,
    promptVersion: config.promptVersion,
    text,
    createdAt: new Date().toISOString(),
  });

  return createResult(text, config, mimeType, cacheKey, {
    sourceType,
    ...metadata,
  });
}

async function readImageTextCache(identity, config = getImageTextConfig()) {
  const cacheKey = createCacheKey(config, identity);
  const cachePath = path.join(config.cacheDir, `${cacheKey}.json`);
  const text = await readCachedText(cachePath, config, identity);

  if (text === undefined) return undefined;

  return { cacheKey, text };
}

function assertImageWithinLimit(size, config, relativePath) {
  if (size <= config.maxBytes) return;

  throw new Error(
    `Image ${relativePath} is too large for inline extraction. Maximum size is ${config.maxBytes} bytes.`,
  );
}

function createResult(text, config, mimeType, cacheKey, metadata = {}) {
  return {
    text,
    metadata: {
      imageMimeType: mimeType,
      imageTextCacheKey: cacheKey,
      imageTextModel: config.model,
      imageTextProvider: config.id,
      ...metadata,
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

async function readCachedText(cachePath, config, identity) {
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
    !matchesIdentity(record, identity) ||
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
  const directory = path.dirname(cachePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(cachePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  );

  await mkdir(directory, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tempPath, cachePath);
}

function matchesIdentity(record, identity) {
  return Object.entries(identity).every(([key, value]) =>
    isSameCacheValue(record[key], value),
  );
}

function isSameCacheValue(left, right) {
  if (isPlainObject(left) || isPlainObject(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return left === right;
}

function createCacheKey(config, identity) {
  return createSha256(
    JSON.stringify({
      ...identity,
      provider: config.id,
      model: config.model,
      promptVersion: config.promptVersion,
    }),
  );
}

function createSha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
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
  createSha256,
  extractImageBufferText,
  extractImageText,
  getImageMimeType,
  isImageExtension,
  readImageTextCache,
  supportedImageExtensions,
};
