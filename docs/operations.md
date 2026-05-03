# Operations Guide

[Back to docs index](README.md) | [Back to project README](../README.md)

This page covers day-to-day command usage and maintenance.

Related pages: [Setup Guide](setup.md), [Knowledge Files](knowledge-files.md), [Configuration Guide](configuration.md), [Troubleshooting](troubleshooting.md).

## Slash Commands

Public commands:

- `/ask question:<text>` asks the knowledge base.
- `/ping` checks whether the bot responds.

Admin commands:

- `/upload file:<attachment> folder:<optional>` saves a knowledge file and refreshes the index.
- `/refresh` rebuilds the vector database from `data/`.
- `/reload` reloads `config.yaml` without restarting the bot.

Admin commands require `discord.adminUserIds` or `discord.moderatorRoleIds` in `config.yaml`.

## Typical Workflow

1. Add or upload knowledge files.
2. Run `/refresh` if files changed outside `/upload`.
3. Ask with `/ask`.
4. Edit `config.yaml` when tuning providers or retrieval.
5. Run `/reload`.
6. Run `/refresh` if the config change affects indexing.

## Ask Examples

```text
/ask question: What is this program about?
/ask question: 2569 admission requirement คืออะไร
/ask question: ค่าเทอม 2568 เท่าไหร่
/ask question: Data Science and Software Innovation เรียนเกี่ยวกับอะไร
```

The bot replies with an answer and source filenames when available.

## Refresh Rules

Run `/refresh` after changing:

- Files in `data/` outside `/upload`.
- `retrieval.chunkSize` or `retrieval.chunkOverlap`.
- `embeddings.provider` or embedding model.
- `qdrant.collection` or `qdrant.indexId`.
- `imageText.provider`, `imageText.model`, or `imageText.promptVersion`.

You do not need `/refresh` after changing chat model fallback order unless you also changed indexing settings.

## Reload Rules

Run `/reload` after editing `config.yaml`.

Restart the bot instead after changing:

- `.env` provider keys.
- `BOT_TOKEN`.
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
- Clear `.cache/image-text/` only when you intentionally want image re-extraction.
