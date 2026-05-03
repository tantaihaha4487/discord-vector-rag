# Knowledge Files

[Back to docs index](README.md) | [Back to project README](../README.md)

Knowledge files are the local source material used by `/ask`.

Related pages: [Setup Guide](setup.md), [Configuration Guide](configuration.md), [Operations Guide](operations.md), [Architecture](architecture.md).

## Supported Types

- `.txt` files are read as UTF-8 text.
- `.pdf` files are parsed with `pdf-parse`.
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

## Indexing Behavior

The bot indexes `data/` on startup.

During indexing, it:

- Lists files recursively.
- Filters unsupported extensions.
- Extracts text from `.txt`, `.pdf`, and supported image files.
- Splits documents using `retrieval.chunkSize` and `retrieval.chunkOverlap`.
- Adds metadata including source path, chunk index, and `qdrant.indexId`.
- Deletes old Qdrant points for the current `qdrant.indexId`.
- Upserts the new chunks into Qdrant.

Use `/refresh` after adding, editing, or deleting files outside Discord while the bot is running.

## Uploads From Discord

`/upload` accepts `.txt`, `.pdf`, and supported image attachments.

Behavior:

- The command is restricted by `discord.adminUserIds` and `discord.moderatorRoleIds`.
- The optional folder field autocompletes existing folders.
- A typed folder path can create a new folder under `data/`.
- Folder paths are normalized and must stay inside `data/`.
- After saving the file, the bot refreshes the vector index automatically.

## Image Text Cache

Images are converted to text during indexing and cached under `.cache/image-text/` by default.

Cache identity includes:

- Image file hash.
- Provider ID.
- Model name.
- Prompt version.

Unchanged images reuse cached extracted text. Change `imageText.promptVersion` to force re-extraction.

## Docker Data Behavior

Docker Compose mounts:

- `./data` to `/app/data`.
- `./.cache` to `/app/.cache`.
- `./config.yaml` to `/app/config.yaml`.

Because of those mounts, `/upload` writes to the host `data/` directory and image text cache survives container rebuilds.
