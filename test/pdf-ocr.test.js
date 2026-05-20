const test = require("node:test");
const assert = require("node:assert/strict");

const { _test } = require("../src/rag/pdf-ocr");

test("assertPdfWithinPageLimit allows unset or in-range limits", () => {
  assert.doesNotThrow(() =>
    _test.assertPdfWithinPageLimit("file.pdf", 50, undefined),
  );
  assert.doesNotThrow(() => _test.assertPdfWithinPageLimit("file.pdf", 5, 5));
});

test("assertPdfWithinPageLimit rejects oversized PDFs", () => {
  assert.throws(
    () => _test.assertPdfWithinPageLimit("file.pdf", 6, 5),
    /file\.pdf has 6 pages, but imageText\.pdfOcrMaxPages is 5/,
  );
});

test("formatPageText preserves page markers", () => {
  assert.equal(
    _test.formatPageText([
      { pageNumber: 1, text: "First page" },
      { pageNumber: 2, text: "Second page" },
    ]),
    "Page 1\nFirst page\n\nPage 2\nSecond page",
  );
});

test("createPdfPageCacheIdentity excludes source path and rendered image hash", () => {
  assert.deepEqual(_test.createPdfPageCacheIdentity("abc123", 2), {
    kind: "pdf-page",
    sourcePdfSha256: "abc123",
    pageNumber: 2,
    renderSettings: {
      renderer: "pdf-parse.getScreenshot@v1",
      format: "png",
      scale: 1.5,
    },
  });
});
