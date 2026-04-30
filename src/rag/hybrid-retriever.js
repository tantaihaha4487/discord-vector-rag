const { isRetrievalDebugEnabled } = require("./config");
const { retrieveRelevantDocsWithScores } = require("./retriever");

const EXACT_NUMBER_REGEX = /\b\d{4,}\b/;
const STRONG_KEYWORD_SCORE = 20;
const MEDIUM_KEYWORD_SCORE = 8;
const KEYWORD_ONLY_LIMIT = 8;
const KEYWORD_FIRST_LIMIT = 6;
const QDRANT_FILL_LIMIT = 2;
const QDRANT_FIRST_LIMIT = 6;
const KEYWORD_FILL_LIMIT = 2;

async function retrieveHybridDocs(knowledgeBase, question, limit) {
  const keywordResults = retrieveRelevantDocsWithScores(
    knowledgeBase.chunks,
    question,
    Math.max(KEYWORD_ONLY_LIMIT, KEYWORD_FIRST_LIMIT, KEYWORD_FILL_LIMIT),
  );
  const bestKeywordScore = keywordResults[0]?.score ?? 0;

  if (
    EXACT_NUMBER_REGEX.test(question) &&
    bestKeywordScore >= STRONG_KEYWORD_SCORE
  ) {
    const results = mergeResults(limit, keywordResults.slice(0, KEYWORD_ONLY_LIMIT));

    debugRetrieval("keyword-only", results);

    return results.map((result) => result.doc);
  }

  if (bestKeywordScore >= MEDIUM_KEYWORD_SCORE) {
    const qdrantResults = await knowledgeBase.similaritySearchWithScores(
      question,
      QDRANT_FILL_LIMIT,
    );
    const results = mergeResults(
      limit,
      keywordResults.slice(0, KEYWORD_FIRST_LIMIT),
      qdrantResults,
    );

    debugRetrieval("keyword-first", results);

    return results.map((result) => result.doc);
  }

  const qdrantResults = await knowledgeBase.similaritySearchWithScores(
    question,
    QDRANT_FIRST_LIMIT,
  );
  const results = mergeResults(
    limit,
    qdrantResults,
    keywordResults.slice(0, KEYWORD_FILL_LIMIT),
  );

  debugRetrieval("qdrant-first", results);

  return results.map((result) => result.doc);
}

function mergeResults(limit, ...groups) {
  const seen = new Set();
  const results = [];

  for (const group of groups) {
    for (const item of group) {
      const key = getDocKey(item.doc);

      if (seen.has(key)) continue;

      seen.add(key);
      results.push(item);

      if (results.length >= limit) return results;
    }
  }

  return results;
}

function getDocKey(doc) {
  return `${doc.metadata.source}:${doc.metadata.chunkIndex}`;
}

function debugRetrieval(mode, results) {
  if (!isRetrievalDebugEnabled()) return;

  console.log(`Retrieval mode: ${mode}`);

  results.forEach((result, index) => {
    const metadata = result.doc.metadata ?? {};

    console.log(
      `${index + 1} ${result.source} score=${formatScore(result.score)} source=${metadata.source} chunk=${metadata.chunkIndex}`,
    );
  });
}

function formatScore(score) {
  if (typeof score !== "number") return "n/a";

  return Number.isInteger(score) ? String(score) : score.toFixed(4);
}

module.exports = { retrieveHybridDocs };
