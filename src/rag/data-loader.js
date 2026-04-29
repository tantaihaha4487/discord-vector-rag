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
  const files = await readdir(dataDir).catch(() => []);
  const supportedFiles = files.filter((file) =>
    supportedExtensions.has(path.extname(file).toLowerCase()),
  );

  if (supportedFiles.length === 0) {
    throw new Error("No .txt or .pdf files found in data/");
  }

  return Promise.all(
    supportedFiles.map(async (file) => {
      const filePath = path.join(dataDir, file);

      return new Document({
        pageContent: await loadFileText(filePath),
        metadata: { source: file },
      });
    }),
  );
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

module.exports = { loadKnowledgeBase };
