function retrieveRelevantDocs(chunks, query, limit) {
  const queryTerms = tokenize(query);
  const exactNumbers = queryTerms.filter((term) => /^\d{4,}$/.test(term));
  const scoredChunks = chunks
    .map((chunk) => ({
      chunk,
      score: scoreDocument(chunk.pageContent, queryTerms),
    }))
    .filter((result) => result.score > 0);
  const exactMatches = scoredChunks.filter((result) =>
    exactNumbers.some((number) => normalizeText(result.chunk.pageContent).includes(number)),
  );

  return (exactMatches.length > 0 ? exactMatches : scoredChunks)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => result.chunk);
}

function scoreDocument(text, queryTerms) {
  const normalizedText = normalizeText(text);
  const docTerms = new Set(tokenize(normalizedText));

  return queryTerms.reduce((score, term) => {
    const weight = /^\d{4,}$/.test(term) ? 20 : 1;

    if (docTerms.has(term)) return score + weight * 2;
    if (normalizedText.includes(term)) return score + weight;

    return score;
  }, 0);
}

function tokenize(text) {
  const terms =
    normalizeText(text)
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu)
      ?.filter((term) => term.length > 1) ?? [];

  return terms.flatMap((term) => {
    if (!/[\u0E00-\u0E7F]/u.test(term) || term.length < 4) {
      return [term];
    }

    return [term, ...thaiNgrams(term)];
  });
}

function thaiNgrams(term) {
  const grams = [];

  for (let size = 3; size <= Math.min(6, term.length); size += 1) {
    for (let index = 0; index <= term.length - size; index += 1) {
      grams.push(term.slice(index, index + size));
    }
  }

  return grams;
}

function normalizeText(text) {
  return text
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = { retrieveRelevantDocs };
