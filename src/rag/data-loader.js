const { readdir, readFile } = require("node:fs/promises");
const path = require("node:path");
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PDFParse } = require("pdf-parse");
const { CHUNK_OVERLAP, CHUNK_SIZE } = require("./config");

const dataDir = path.join(__dirname, "..", "..", "data");
const supportedExtensions = new Set([".txt", ".pdf"]);

async function loadKnowledgeBase() {
  const documents = await loadDocuments();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const chunks = await splitter.splitDocuments(documents);

  return chunks.map((chunk, index) => {
    chunk.metadata = {
      ...chunk.metadata,
      chunkIndex: index,
    };

    return chunk;
  });
}

async function loadDocuments() {
  const files = await listDataFiles(dataDir);
  const supportedFiles = files.filter(({ relativePath }) =>
    supportedExtensions.has(path.extname(relativePath).toLowerCase()),
  );

  if (supportedFiles.length === 0) {
    throw new Error("No .txt or .pdf files found in data/");
  }

  return Promise.all(
    supportedFiles.map(async ({ filePath, relativePath }) => {
      return new Document({
        pageContent: await loadFileText(filePath),
        metadata: { source: relativePath },
      });
    }),
  );
}

async function listDataFiles(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listDataFiles(filePath, baseDir);
      }

      if (!entry.isFile()) {
        return [];
      }

      return [
        {
          filePath,
          relativePath: path.relative(baseDir, filePath).split(path.sep).join("/"),
        },
      ];
    }),
  );

  return files.flat();
}

async function listDataFolders(dir = dataDir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const folders = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const folderPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, folderPath).split(path.sep).join("/");

        return [relativePath, ...(await listDataFolders(folderPath, baseDir))];
      }),
  );

  return folders.flat();
}

async function loadFileText(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    return readFile(filePath, "utf8");
  }

  const parser = new PDFParse({ data: await readFile(filePath) });

  try {
    const result = await parser.getText();

    return result.text;
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  dataDir,
  listDataFolders,
  loadKnowledgeBase,
  supportedExtensions,
};
