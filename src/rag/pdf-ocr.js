const { readFile } = require("node:fs/promises");
const { PDFParse } = require("pdf-parse");
const { getImageTextConfig } = require("./config");
const {
  createSha256,
  extractImageBufferText,
  readImageTextCache,
} = require("./image-text");

const PDF_OCR_RENDER_SCALE = 1.5;
const PDF_OCR_RENDER_SETTINGS = {
  renderer: "pdf-parse.getScreenshot@v1",
  format: "png",
  scale: PDF_OCR_RENDER_SCALE,
};

async function extractPdfTextWithOcr(filePath, relativePath) {
  const config = getImageTextConfig();
  const pdf = await readFile(filePath);
  const sourcePdfSha256 = createSha256(pdf);
  const parser = new PDFParse({ data: pdf });

  try {
    const info = await parser.getInfo();
    const totalPages = getTotalPages(info);

    assertPdfWithinPageLimit(relativePath, totalPages, config.pdfOcrMaxPages);

    const pageResults =
      totalPages === undefined
        ? await extractUnknownPageCountPdf(parser, relativePath, sourcePdfSha256, config)
        : await extractKnownPageCountPdf(
            parser,
            totalPages,
            relativePath,
            sourcePdfSha256,
            config,
          );

    assertPdfWithinPageLimit(relativePath, pageResults.length, config.pdfOcrMaxPages);

    return {
      text: formatPageText(pageResults),
      metadata: {
        sourceType: "pdf-ocr",
        pdfOcrPageCount: pageResults.length,
        pdfOcrProvider: config.id,
        pdfOcrModel: config.model,
        pdfOcrPromptVersion: config.promptVersion,
        pdfOcrRenderScale: PDF_OCR_RENDER_SCALE,
        pdfOcrFirstCacheKey: pageResults[0]?.cacheKey,
      },
    };
  } finally {
    await parser.destroy();
  }
}

async function extractKnownPageCountPdf(
  parser,
  totalPages,
  relativePath,
  sourcePdfSha256,
  config,
) {
  const pageResults = [];

  for (const pageNumber of createPageNumbers(totalPages)) {
    const cacheIdentity = createPdfPageCacheIdentity(sourcePdfSha256, pageNumber);
    const cached = await readImageTextCache(cacheIdentity, config);

    if (cached !== undefined) {
      pageResults.push({
        pageNumber,
        text: cached.text,
        cacheKey: cached.cacheKey,
      });
      continue;
    }

    const page = await renderPdfPage(parser, pageNumber);
    pageResults.push(
      await extractPdfPageText(page, relativePath, cacheIdentity, config),
    );
  }

  return pageResults;
}

async function extractUnknownPageCountPdf(parser, relativePath, sourcePdfSha256, config) {
  const pages = await renderPdfPages(parser);
  const pageResults = [];

  for (const page of pages) {
    const cacheIdentity = createPdfPageCacheIdentity(
      sourcePdfSha256,
      page.pageNumber,
    );
    const cached = await readImageTextCache(cacheIdentity, config);

    if (cached !== undefined) {
      pageResults.push({
        pageNumber: page.pageNumber,
        text: cached.text,
        cacheKey: cached.cacheKey,
      });
      continue;
    }

    pageResults.push(
      await extractPdfPageText(page, relativePath, cacheIdentity, config),
    );
  }

  return pageResults;
}

async function extractPdfPageText(page, relativePath, cacheIdentity, config) {
  const result = await extractImageBufferText({
    image: page.image,
    mimeType: "image/png",
    source: `${relativePath}#page=${page.pageNumber}`,
    sourceType: "pdf-ocr-page",
    cacheIdentity,
    cacheRecord: {
      sourcePath: relativePath,
      renderedImageSha256: createSha256(page.image),
    },
    imageHashKey: null,
    config,
  });

  return {
    pageNumber: page.pageNumber,
    text: result.text,
    cacheKey: result.metadata.imageTextCacheKey,
  };
}

async function renderPdfPage(parser, pageNumber) {
  const pages = await renderPdfPages(parser, { partial: [pageNumber] });

  return pages[0];
}

async function renderPdfPages(parser, options = {}) {
  const screenshot = await parser.getScreenshot({
    scale: PDF_OCR_RENDER_SCALE,
    imageBuffer: true,
    imageDataUrl: false,
    ...options,
  });

  return normalizeScreenshotPages(screenshot.pages);
}

function createPdfPageCacheIdentity(sourcePdfSha256, pageNumber) {
  return {
    kind: "pdf-page",
    sourcePdfSha256,
    pageNumber,
    renderSettings: PDF_OCR_RENDER_SETTINGS,
  };
}

function createPageNumbers(totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

function getTotalPages(info) {
  if (Number.isInteger(info?.total)) return info.total;
  if (Array.isArray(info?.pages)) return info.pages.length;

  return undefined;
}

function assertPdfWithinPageLimit(relativePath, pageCount, maxPages) {
  if (maxPages === undefined || pageCount === undefined || pageCount <= maxPages) {
    return;
  }

  throw new Error(
    `PDF ${relativePath} has ${pageCount} pages, but imageText.pdfOcrMaxPages is ${maxPages}. Increase the limit or upload a smaller PDF.`,
  );
}

function normalizeScreenshotPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("PDF OCR did not render any pages.");
  }

  return pages.map((page, index) => {
    if (!page.data) {
      throw new Error(`PDF OCR did not render page ${index + 1} as an image.`);
    }

    return {
      image: Buffer.from(page.data),
      pageNumber: Number.isInteger(page.pageNumber) ? page.pageNumber : index + 1,
    };
  });
}

function formatPageText(pageResults) {
  return pageResults
    .map(({ pageNumber, text }) => `Page ${pageNumber}\n${text}`)
    .join("\n\n")
    .trim();
}

module.exports = {
  extractPdfTextWithOcr,
  _test: {
    assertPdfWithinPageLimit,
    createPdfPageCacheIdentity,
    createPageNumbers,
    formatPageText,
    getTotalPages,
    normalizeScreenshotPages,
  },
};
