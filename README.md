# Discord Vector RAG Bot

Discord.js v14 bot that answers questions from local knowledge files when mentioned. It supports text, PDF, and image knowledge files, stores embeddings in Qdrant, uses Ollama for local embeddings by default, and can answer with any configured OpenAI-compatible chat provider.

## Documentation

Detailed guides live in [`docs/`](docs/README.md):

- [Setup](docs/setup.md): first install, Discord credentials, slash commands, and run modes.
- [Configuration](docs/configuration.md): `config.yaml`, `.env`, command access, providers, embeddings, Qdrant, and retrieval tuning.
- [Knowledge Files](docs/knowledge-files.md): supported files, folder layout, uploads, viewing files, indexing, and image text cache.
- [Operations](docs/operations.md): daily command usage, refresh/reload rules, Docker commands, and maintenance.
- [Providers](docs/providers.md): built-in providers, fallback order, credentials, and custom endpoints.
- [Architecture](docs/architecture.md): Discord command layer, RAG pipeline, retrieval strategy, and vector store flow.
- [Troubleshooting](docs/troubleshooting.md): common setup and runtime failures.

## Features

- Mention-based RAG answers, for example `@bot what is this program about?`.
- Mention asks are queued per user, with an ephemeral status button so only the requester can view queue/progress details.
- Slash commands: `/ping`, `/upload`, `/view`, `/refresh`, and `/reload`.
- Recursive `data/` knowledge loading for `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, and `.heif`.
- `/upload` can save supported Discord attachments into `data/`, optionally OCR PDFs with `use_ocr`, and refresh the index automatically.
- `/view` can send knowledge files back to Discord; public access is configurable.
- Image text extraction with cache reuse for unchanged images and OCR PDF pages.
- Hybrid retrieval: keyword-first for exact matches and Qdrant semantic search for general questions.
- Local Ollama embeddings by default, with optional remote embeddings.
- Configurable OpenAI-compatible chat provider fallback order.
- Docker Compose stack for the bot, Qdrant, Ollama, and default embedding model pull.

## Quick Start

### 1. Install

```bash
npm install
cp .env.example .env
```

Fill the required secrets in `.env`:

```env
BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_ADMIN_USER_IDS=
DISCORD_MODERATOR_ROLE_IDS=
AI_PROVIDER_OPENROUTER_API_KEY=
```

You only need one chat provider API key to start. Keep API keys and Discord IDs in `.env`, not in `config.yaml`.

### 2. Configure Discord

Edit `.env`:

```env
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_GUILD_ID=YOUR_GUILD_ID
DISCORD_ADMIN_USER_IDS=
DISCORD_MODERATOR_ROLE_IDS=
```

Use comma-separated IDs for admin users or moderator roles if you want to use admin commands such as `/upload`, `/refresh`, and `/reload`:

```env
DISCORD_ADMIN_USER_IDS=111111111111111111,222222222222222222
DISCORD_MODERATOR_ROLE_IDS=333333333333333333
```

Edit `config.yaml` for command-specific access:

```yaml
commands:
  ask:
    topSourceButton: true
  view:
    allowEveryone: true
```

Mention answers can include a source-file button by default. Set `commands.ask.topSourceButton: false` to disable it.

`/view` is public by default. Set `commands.view.allowEveryone: false` to restrict it to the same admin users and moderator roles.

Enable Message Content Intent in the Discord Developer Portal so the bot can read the question text after a mention.

### 3. Add Knowledge Files

Put supported files under `data/`:

```text
data/
  admissions-2569.txt
  handbooks/
    student-handbook.pdf
  posters/
    event.jpg
```

Subfolders are scanned recursively. Do not put secrets or private credentials in knowledge files.

### 4. Deploy Commands

```bash
npm run deploy
```

Redeploy only when slash command definitions change. Data and most config changes do not require redeploying commands.

### 5. Run

Recommended local stack:

```bash
docker compose up -d --build
```

This starts the bot, Qdrant, Ollama, and a helper service that pulls the default embedding model.

Useful logs:

```bash
docker compose logs -f bot
docker compose logs -f ollama-model
```

Without Docker Compose, run Qdrant and Ollama yourself, then start the bot:

```bash
ollama pull nomic-embed-text
npm start
```

See [Setup](docs/setup.md) for the full non-Compose path.

## Command Access

Public by default:

- Mention questions, for example `@bot what is DSSI?`.
  Mention request queue/progress updates are shown through a public status button; pressing it returns an ephemeral status visible only to the requesting user.
  When `commands.ask.topSourceButton` is enabled, answers can also include a public source-file button; pressing it returns the top source file ephemerally to the clicking user.
- `/ping`.
- `/view`, unless `commands.view.allowEveryone` is set to `false`.

Restricted to `DISCORD_ADMIN_USER_IDS` or `DISCORD_MODERATOR_ROLE_IDS`:

- `/upload`: save a knowledge file and refresh the index. Use `use_ocr:true` for scanned PDFs.
- `/refresh`: rebuild the vector database from `data/`.
- `/reload`: reload `config.yaml` without restarting.
- `/view` when `commands.view.allowEveryone: false`.

## Project Map

```text
data/                      Knowledge files scanned recursively
.cache/image-text/         Cached text extracted from images and PDF OCR pages
config.yaml                Non-secret app, command, provider, and retrieval config
.env                       Local secrets and Discord IDs, not committed
src/commands/              Slash commands
src/events/messageCreate/  Mention-based RAG question handler
src/rag/                   Loading, retrieval, vector store, and answer flow
src/utils/                 Command/event loader and deploy script
docker-compose.yml         Bot, Qdrant, and Ollama services
Dockerfile                 Bot container image
```
