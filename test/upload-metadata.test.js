const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  getFileMetadata,
  readUploadMetadata,
  setFileOcrPreference,
  _test,
} = require("../src/rag/upload-metadata");

test("metadata paths normalize to safe data-relative keys", () => {
  assert.equal(_test.normalizeMetadataPath("folder\\file.pdf"), "folder/file.pdf");
  assert.equal(_test.normalizeMetadataPath("/folder/file.pdf/"), "folder/file.pdf");
  assert.throws(
    () => _test.normalizeMetadataPath("../file.pdf"),
    /relative paths under data/,
  );
});

test("setFileOcrPreference writes and clears PDF OCR metadata", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "upload-metadata-"));
  const metadataPath = path.join(directory, ".rag-metadata.json");

  try {
    await setFileOcrPreference("handbooks/scanned.pdf", true, metadataPath);

    const metadata = await readUploadMetadata(metadataPath);

    assert.equal(getFileMetadata(metadata, "handbooks/scanned.pdf").useOcr, true);

    const raw = JSON.parse(await readFile(metadataPath, "utf8"));
    assert.equal(raw.files["handbooks/scanned.pdf"].useOcr, true);
    assert.equal(typeof raw.files["handbooks/scanned.pdf"].updatedAt, "string");

    await setFileOcrPreference("handbooks/scanned.pdf", false, metadataPath);

    assert.deepEqual(
      getFileMetadata(await readUploadMetadata(metadataPath), "handbooks/scanned.pdf"),
      {},
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
