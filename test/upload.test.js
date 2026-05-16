const test = require("node:test");
const assert = require("node:assert/strict");

const { _test } = require("../src/commands/upload");

test("normalizeFolder treats data prefixes as the data root", () => {
  assert.equal(_test.normalizeFolder("."), "");
  assert.equal(_test.normalizeFolder("data/"), "");
  assert.equal(_test.normalizeFolder("/data"), "");
  assert.equal(_test.normalizeFolder("/data/"), "");
});

test("normalizeFolder preserves normal relative folders", () => {
  assert.equal(_test.normalizeFolder("plain"), "plain");
  assert.equal(_test.normalizeFolder("sub"), "sub");
  assert.equal(_test.normalizeFolder("data/sub"), "sub");
  assert.equal(_test.normalizeFolder("/data/sub"), "sub");
});

test("getUploadTarget does not create nested data paths from data prefixes", () => {
  const cases = new Map([
    [".", "file.txt"],
    ["data/", "file.txt"],
    ["/data", "file.txt"],
    ["/data/", "file.txt"],
    ["data/sub", "sub/file.txt"],
    ["/data/sub", "sub/file.txt"],
    ["sub", "sub/file.txt"],
  ]);

  for (const [folder, relativePath] of cases) {
    assert.equal(_test.getUploadTarget("file.txt", folder).relativePath, relativePath);
  }
});

test("normalizeFolder rejects traversal after data prefix removal", () => {
  assert.throws(
    () => _test.normalizeFolder("data/../secret"),
    /relative path under `data\/`/,
  );
  assert.throws(
    () => _test.normalizeFolder("../secret"),
    /relative path under `data\/`/,
  );
});

test("validateOcrOption accepts PDF and image uploads", () => {
  assert.doesNotThrow(() => _test.validateOcrOption(".pdf", true));
  assert.doesNotThrow(() => _test.validateOcrOption(".png", true));
  assert.doesNotThrow(() => _test.validateOcrOption(".txt", false));
});

test("validateOcrOption rejects OCR for text uploads", () => {
  assert.throws(
    () => _test.validateOcrOption(".txt", true),
    /OCR extraction is only available for PDF and image uploads/,
  );
});
