# Operations Guide

[Back to docs index](README.md) | [Back to project README](../README.md)

This page covers day-to-day command usage and maintenance.

Related pages: [Setup Guide](setup.md), [Knowledge Files](knowledge-files.md), [Configuration Guide](configuration.md), [Troubleshooting](troubleshooting.md).

## Asking Questions

Mention the bot to ask the knowledge base:

```text
@bot What is this program about?
```

The bot replies with an answer and source filenames when available. When `commands.ask.topSourceButton` is enabled, the first answer message also includes a button that lets anyone request the top source file as an ephemeral attachment or tmpfiles link.

## Slash Commands

Public commands:

- `/ping` checks whether the bot responds.
- `/view file:<path>` sends a knowledge file from `data/` into Discord when `commands.view.allowEveryone` is `true`.

Admin commands:

- `/upload file:<attachment> folder:<optional> use_ocr:<optional>` saves a knowledge file and refreshes the index. Use `use_ocr:true` for scanned PDFs or image uploads.
- `/view file:<path>` when `commands.view.allowEveryone` is `false`.
- `/refresh` rebuilds the vector database from `data/`.
- `/reload` reloads `config.yaml` without restarting the bot.

Admin commands require `DISCORD_ADMIN_USER_IDS` or `DISCORD_MODERATOR_ROLE_IDS` in `.env`. `/view` autocomplete follows the same access rule when it is restricted, so non-authorized users do not see internal `data/` paths.

## Typical Workflow

1. Add or upload knowledge files.
2. Run `/refresh` if files changed outside `/upload`.
3. Ask by mentioning the bot.
4. Use the source-file button or `/view` when you need to send a source file back to Discord.
5. Edit `config.yaml` when tuning providers, command access, or retrieval.
6. Run `/reload`.
7. Run `/refresh` if the config change affects indexing.

## Ask Examples

```text
@bot What is this program about?
@bot 2569 admission requirement คืออะไร
@bot ค่าเทอม 2568 เท่าไหร่
@bot Data Science and Software Innovation เรียนเกี่ยวกับอะไร
```

## Refresh Rules

Run `/refresh` after changing:

- Files in `data/` outside `/upload`.
- `retrieval.chunkSize` or `retrieval.chunkOverlap`.
- `embeddings.provider` or embedding model.
- `qdrant.collection` or `qdrant.indexId`.
- `imageText.provider`, `imageText.model`, `imageText.promptVersion`, or `imageText.pdfOcrMaxPages`.

You do not need `/refresh` after changing chat model fallback order unless you also changed indexing settings.

You do not need `/refresh` after changing `commands.ask.topSourceButton` or `commands.view.allowEveryone`; run `/reload` instead.

## Reload Rules

Run `/reload` after editing `config.yaml`.

Restart the bot instead after changing:

- `.env` provider keys.
- `BOT_TOKEN`.
- `DISCORD_*` ID or access values.
- Node dependencies.
- Source code.

## Docker Compose Commands

Start or rebuild the stack:

```bash
docker compose up -d --build
```

Watch bot logs:

```bash
docker compose logs -f bot
```

Watch Ollama model pull logs:

```bash
docker compose logs -f ollama-model
```

Stop services:

```bash
docker compose down
```

Persistent Docker volumes:

- `qdrant_storage` stores Qdrant data.
- `ollama_storage` stores Ollama models.

## Local Commands

Deploy slash commands:

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

Syntax check all source files:

```bash
for file in src/**/*.js; do node --check "$file" || exit 1; done
```

## Maintenance Notes

- Keep `data/` organized by topic or department.
- Keep filenames short but descriptive.
- Periodically remove obsolete knowledge files and run `/refresh`.
- Keep `.cache/image-text/` if you want to avoid reprocessing unchanged images.
- Clear `.cache/image-text/` only when you intentionally want image or PDF OCR re-extraction.
