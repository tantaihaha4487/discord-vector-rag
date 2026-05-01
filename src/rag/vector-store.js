const crypto = require("node:crypto");
const { Document } = require("@langchain/core/documents");
const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbeddingProviderConfig, getQdrantConfig } = require("./config");
const { loadKnowledgeBase } = require("./data-loader");
const { createEmbeddingModel } = require("./llm");

let vectorStorePromise;

async function getKnowledgeVectorStore() {
  if (!vectorStorePromise) {
    const currentPromise = buildKnowledgeVectorStore().catch((error) => {
      if (vectorStorePromise === currentPromise) {
        vectorStorePromise = undefined;
      }

      throw error;
    });

    vectorStorePromise = currentPromise;
  }

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
    chunks,
    similaritySearch: (query, limit) =>
      similaritySearch(
        client,
        embeddings,
        qdrant.collectionName,
        qdrant.indexId,
        query,
        limit,
      ),
    similaritySearchWithScores: (query, limit) =>
      similaritySearchWithScores(
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

  if (exists) {
    const info = await client.getCollection(collectionName);
    const existingSize = getCollectionVectorSize(info);

    if (existingSize === vectorSize) return;

    console.warn(
      `Recreating Qdrant collection ${collectionName}: vector size changed from ${existingSize ?? "unknown"} to ${vectorSize}.`,
    );
    await client.deleteCollection(collectionName);
  }

  await client.createCollection(collectionName, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });
}

function getCollectionVectorSize(info) {
  const collectionInfo = info.result ?? info;
  const vectors = collectionInfo.config?.params?.vectors;

  if (typeof vectors?.size === "number") return vectors.size;

  if (vectors && typeof vectors === "object") {
    const firstVector = Object.values(vectors).find(
      (vector) => typeof vector?.size === "number",
    );

    return firstVector?.size;
  }

  return undefined;
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
  const results = await similaritySearchWithScores(
    client,
    embeddings,
    collectionName,
    indexId,
    query,
    limit,
  );

  return results.map((result) => result.doc);
}

async function similaritySearchWithScores(
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

  const points = response.points ?? response;

  return points.map((point) => ({
    doc: new Document({
      id: String(point.id),
      pageContent: point.payload?.content ?? "",
      metadata: point.payload?.metadata ?? {},
    }),
    score: point.score,
    source: "qdrant",
  }));
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
