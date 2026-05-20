const crypto = require("node:crypto");
const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { normalizeSourcePath } = require("./path-normalizer");

const dataDir = path.join(__dirname, "..", "..", "data");
const UPLOAD_METADATA_FILENAME = ".rag-metadata.json";
const UPLOAD_METADATA_PATH = path.join(dataDir, UPLOAD_METADATA_FILENAME);

let metadataWritePromise = Promise.resolve();

async function readUploadMetadata(metadataPath = UPLOAD_METADATA_PATH) {
  let raw;

  try {
    raw = await readFile(metadataPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return createEmptyMetadata();

    throw error;
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse ${formatMetadataPath(metadataPath)}: ${error.message}`);
  }

  return normalizeUploadMetadata(parsed, metadataPath);
}

function getFileMetadata(metadata, relativePath) {
  const key = normalizeMetadataPath(relativePath);

  return metadata.files[key] ?? {};
}

async function setFileOcrPreference(
  relativePath,
  useOcr,
  metadataPath = UPLOAD_METADATA_PATH,
) {
  const updatePromise = metadataWritePromise.then(() =>
    setFileOcrPreferenceNow(relativePath, useOcr, metadataPath),
  );

  metadataWritePromise = updatePromise.catch(() => undefined);

  return updatePromise;
}

async function setFileOcrPreferenceNow(relativePath, useOcr, metadataPath) {
  const metadata = await readUploadMetadata(metadataPath);
  const key = normalizeMetadataPath(relativePath);

  if (useOcr) {
    metadata.files[key] = {
      useOcr: true,
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete metadata.files[key];
  }

  await writeUploadMetadata(metadata, metadataPath);
}

async function writeUploadMetadata(metadata, metadataPath) {
  const directory = path.dirname(metadataPath);
  const tempPath = path.join(
    directory,
    `.${path.basename(metadataPath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  );

  await mkdir(directory, { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await rename(tempPath, metadataPath);
}

function normalizeUploadMetadata(metadata, metadataPath = UPLOAD_METADATA_PATH) {
  if (!isPlainObject(metadata)) {
    throw new Error(`${formatMetadataPath(metadataPath)} must contain a JSON object.`);
  }

  const files = metadata.files === undefined ? {} : metadata.files;

  if (!isPlainObject(files)) {
    throw new Error(`${formatMetadataPath(metadataPath)} files must be a JSON object.`);
  }

  return {
    version: 1,
    files: Object.fromEntries(
      Object.entries(files)
        .filter(([, value]) => isPlainObject(value) && value.useOcr === true)
        .map(([key, value]) => [normalizeMetadataPath(key), normalizeFileMetadata(value)]),
    ),
  };
}

function normalizeFileMetadata(value) {
  return {
    useOcr: true,
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
  };
}

function normalizeMetadataPath(relativePath) {
  const normalized = normalizeSourcePath(relativePath).replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0 || parts.some(isInvalidPathPart)) {
    throw new Error("Metadata file paths must be relative paths under data/.");
  }

  return parts.join("/");
}

function isInvalidPathPart(part) {
  return part === "." || part === ".." || part.includes("\0");
}

function createEmptyMetadata() {
  return { version: 1, files: {} };
}

function formatMetadataPath(metadataPath) {
  return path.basename(metadataPath) === UPLOAD_METADATA_FILENAME
    ? `data/${UPLOAD_METADATA_FILENAME}`
    : metadataPath;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

module.exports = {
  getFileMetadata,
  readUploadMetadata,
  setFileOcrPreference,
  _test: {
    normalizeMetadataPath,
    normalizeUploadMetadata,
  },
};
