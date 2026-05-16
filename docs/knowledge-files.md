# Knowledge Files

[Back to docs index](README.md) | [Back to project README](../README.md)

Knowledge files are the local source material used for mention-based questions.

Related pages: [Setup Guide](setup.md), [Configuration Guide](configuration.md), [Operations Guide](operations.md), [Architecture](architecture.md).

## Supported Types

- `.txt` files are read as UTF-8 text.
- `.pdf` files are parsed with `pdf-parse` by default.
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, and `.heif` files are converted to text by `imageText.provider`.

## Folder Layout

Put files under `data/`. Subfolders are scanned recursively.

```text
data/
  admissions-2569.txt
  handbooks/
    student-handbook.pdf
  faq/
    general-faq.txt
  posters/
    event.jpg
```

Rules:

- Keep filenames descriptive because filenames are shown as `Sources` in Discord.
- Do not put API keys, passwords, or private credentials in knowledge files.
- Avoid adding private image data unless your configured image text provider is acceptable for that data.
- Large PDFs create more chunks and can dominate retrieval results.
- Image files must be under `imageText.maxBytes`.
- PDF OCR sends rendered page images to `imageText.provider`; avoid OCR for private scanned PDFs unless that provider is acceptable for the data.

## Indexing Behavior

The bot indexes `data/` on startup.

During indexing, it:

- Lists files recursively.
- Filters unsupported extensions.
- Extracts text from `.txt`, `.pdf`, and supported image files.
- Uses OCR instead of normal PDF text extraction for PDFs uploaded with `use_ocr:true`.
- Splits documents using `retrieval.chunkSize` and `retrieval.chunkOverlap`.
- Adds metadata including source path, chunk index, and `qdrant.indexId`.
- Deletes old Qdrant points for the current `qdrant.indexId`.
- Upserts the new chunks into Qdrant.

Use `/refresh` after adding, editing, or deleting files outside Discord while the bot is running.

## Uploads From Discord

`/upload` accepts `.txt`, `.pdf`, and supported image attachments.

Behavior:

- The command is restricted by `DISCORD_ADMIN_USER_IDS` and `DISCORD_MODERATOR_ROLE_IDS`.
- The optional folder field autocompletes existing folders.
- A typed folder path can create a new folder under `data/`.
- Folder paths are normalized and must stay inside `data/`.
- `use_ocr:true` is accepted only for PDF and image uploads.
- For PDFs, `use_ocr:true` skips normal `pdf-parse` text extraction and OCRs every page unless `imageText.pdfOcrMaxPages` is configured.
- For images, text extraction already uses OCR/image text; `use_ocr:true` only makes that explicit.
- PDF OCR choices are persisted in `data/.rag-metadata.json` so `/reload database`, `/refresh`, and restarts keep the same extraction mode.
- After saving the file, the bot refreshes the vector index automatically.

## Viewing Files From Discord

`/view` sends an existing knowledge file from `data/` back into Discord.

Mention-based answers can also include a source-file button when `commands.ask.topSourceButton` is `true`. Anyone can click that button, and the selected top source file is sent only to the clicking user as an ephemeral Discord reply. Files too large for Discord are uploaded to tmpfiles and returned as an ephemeral link.

Behavior:

- The file option autocompletes matching paths under `data/`.
- When `commands.view.allowEveryone` is `true`, every user can see suggestions and use `/view`.
- When `commands.view.allowEveryone` is `false`, `/view` requires `DISCORD_ADMIN_USER_IDS` or `DISCORD_MODERATOR_ROLE_IDS`.
- The command validates the selected path so it stays inside `data/`.
- Files within Discord's attachment limit are sent directly.
- Larger files are uploaded to tmpfiles and returned as a link.

## Image Text And OCR Cache

Images and OCR PDF pages are converted to text during indexing and cached under `.cache/image-text/` by default.

Cache identity includes:

- Image file hash for normal images.
- PDF file hash, page number, and render settings for PDF OCR pages.
- Provider ID.
- Model name.
- Prompt version.

PDF OCR cache records also store the rendered page hash for debugging. Unchanged images and PDF pages reuse cached extracted text. Change `imageText.promptVersion` to force re-extraction.

## Docker Data Behavior

Docker Compose mounts:

- `./data` to `/app/data`.
- `./.cache` to `/app/.cache`.
- `./config.yaml` to `/app/config.yaml`.
- `.env` values into the bot service, including `DISCORD_*` settings.

Because of those mounts, `/upload` writes to the host `data/` directory and image text cache survives container rebuilds.
