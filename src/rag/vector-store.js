const crypto = require("node:crypto");
const { Document } = require("@langchain/core/documents");
const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbeddingProviderConfig, getQdrantConfig } = require("./config");
const { loadKnowledgeBase } = require("./data-loader");
const { createEmbeddingModel } = require("./llm");

let vectorStorePromise;

async function getKnowledgeVectorStore() {
  vectorStorePromise ??= buildKnowledgeVectorStore();

  return vectorStorePromise;
}

async function buildKnowledgeVectorStore() {
  const qdrant = getQdrantConfig();
  const embeddingProvider = getEmbeddingProviderConfig();
  const embeddings = createEmbeddingModel(embeddingProvider);
  const chunks = addIndexMetadata(await loadKnowledgeBase(), qdrant.indexId);
  const vectors = await embeddings.embedDocuments(
    chunks.map((chunk) => chunk.pageContent),
  );
  const client = new QdrantClient({
    url: qdrant.url,
    apiKey: qdrant.apiKey,
  });

  if (vectors.length === 0) {
    throw new Error("No chunks were generated from data/.");
  }

  await ensureCollection(client, qdrant.collectionName, vectors[0].length);
  await deleteExistingIndex(client, qdrant.collectionName, qdrant.indexId);
  await upsertChunks(client, qdrant.collectionName, chunks, vectors);

  console.log(
    `Indexed ${chunks.length} chunks in Qdrant collection ${qdrant.collectionName}.`,
  );

  return {
    similaritySearch: (query, limit) =>
      similaritySearch(
        client,
        embeddings,
        qdrant.collectionName,
        qdrant.indexId,
        query,
        limit,
      ),
  };
}

async function ensureCollection(client, collectionName, vectorSize) {
  const response = await client.getCollections();
  const exists = response.collections.some(
    (collection) => collection.name === collectionName,
  );

  if (exists) return;

  await client.createCollection(collectionName, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });
}

async function deleteExistingIndex(client, collectionName, indexId) {
  await client.delete(collectionName, {
    wait: true,
    filter: {
      must: [
        {
          key: "metadata.indexId",
          match: { value: indexId },
        },
      ],
    },
  });
}

async function upsertChunks(client, collectionName, chunks, vectors) {
  const points = chunks.map((chunk, index) => ({
    id: createPointId(chunk),
    vector: vectors[index],
    payload: {
      content: chunk.pageContent,
      metadata: chunk.metadata,
    },
  }));

  for (let index = 0; index < points.length; index += 100) {
    await client.upsert(collectionName, {
      wait: true,
      points: points.slice(index, index + 100),
    });
  }
}

async function similaritySearch(
  client,
  embeddings,
  collectionName,
  indexId,
  query,
  limit,
) {
  const response = await client.query(collectionName, {
    query: await embeddings.embedQuery(query),
    limit,
    filter: {
      must: [
        {
          key: "metadata.indexId",
          match: { value: indexId },
        },
      ],
    },
    with_payload: ["metadata", "content"],
    with_vector: false,
  });

  return response.points.map((point) =>
    new Document({
      id: String(point.id),
      pageContent: point.payload?.content ?? "",
      metadata: point.payload?.metadata ?? {},
    }),
  );
}

function addIndexMetadata(chunks, indexId) {
  return chunks.map((chunk) => {
    chunk.metadata = {
      ...chunk.metadata,
      indexId,
    };

    return chunk;
  });
}

function createPointId(chunk) {
  return createDeterministicUuid(
    JSON.stringify({
      indexId: chunk.metadata.indexId,
      source: chunk.metadata.source,
      chunkIndex: chunk.metadata.chunkIndex,
      pageContent: chunk.pageContent,
    }),
  );
}

function createDeterministicUuid(input) {
  const hex = crypto.createHash("sha256").update(input).digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

module.exports = { getKnowledgeVectorStore };
