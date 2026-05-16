# Configuration Guide

[Back to docs index](README.md) | [Back to project README](../README.md)

Use `.env` for secrets and Discord IDs. Use `config.yaml` for normal runtime settings.

Related pages: [Setup Guide](setup.md), [Provider Guide](providers.md), [Operations Guide](operations.md), [Troubleshooting](troubleshooting.md).

## File Responsibilities

- `.env` stores `BOT_TOKEN`, Discord IDs, provider API keys, and `QDRANT_API_KEY`.
- `config.yaml` stores command access, provider order, model names, Qdrant URL/collection, embedding settings, image text settings, and retrieval tuning.
- `docker-compose.yml` passes Discord env vars through and supplies container-only runtime overrides for service URLs.

Do not commit `.env`. Do not hardcode secrets in docs, config, source code, or knowledge files.

## Discord

```env
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_GUILD_ID=YOUR_GUILD_ID
DISCORD_ADMIN_USER_IDS=YOUR_DISCORD_USER_ID
DISCORD_MODERATOR_ROLE_IDS=YOUR_MODERATOR_ROLE_ID
```

Access behavior:

- Mention-based questions and `/ping` are public.
- `/upload`, `/refresh`, and `/reload` require an admin user ID or moderator role ID.
- Empty admin and moderator lists deny all admin commands.
- Use comma-separated values for multiple admin user IDs or moderator role IDs.

## Command Access

Command-specific access settings live under `commands`:

```yaml
commands:
  ask:
    topSourceButton: true
  view:
    allowEveryone: true
```

`commands.ask.topSourceButton` controls mention-based ask replies:

- `true`: when an answer has a resolvable source file, add a button that lets anyone request the top source file as an ephemeral reply.
- `false`: show only the text answer and source list.

`commands.view.allowEveryone` controls `/view`:

- `true`: every user can autocomplete and send files from `data/`.
- `false`: only users in `DISCORD_ADMIN_USER_IDS` or members with `DISCORD_MODERATOR_ROLE_IDS` can use `/view`.

Use `false` if file and folder names inside `data/` should not be visible through autocomplete suggestions.

## Runtime Reload

Use `/reload` after editing `config.yaml` to reload normal runtime settings without restarting the bot.

Reload applies these settings:

- Command access settings.
- Ask source button settings.
- Chat provider order and provider model settings.
- Qdrant target settings.
- Embedding provider settings.
- Image text settings.
- Retrieval settings.

Reload does not reload `.env`, `BOT_TOKEN`, or Discord ID/access env vars. Restart the bot after changing them.

Run `/refresh` after `/reload` if you changed embeddings, Qdrant, chunking, or image text settings.

## Chat Provider Order

Default:

```yaml
chat:
  providers:
    - openrouter
```

Fallback example:

```yaml
chat:
  providers:
    - openrouter
    - nvidia
    - openai
```

Providers without API keys are skipped. See [Provider Guide](providers.md).

## Provider Settings

Provider settings live under `providers`:

```yaml
providers:
  openrouter:
    name: OpenRouter
    baseUrl: https://openrouter.ai/api/v1
    model: google/gemma-4-31b-it:free
    embeddingModel: openai/text-embedding-3-small
    temperature: 0.2
    defaultHeaders:
      HTTP-Referer: http://localhost:3000
      X-OpenRouter-Title: Discord RAG Bot
```

Common fields:

- `name`: human-readable provider name.
- `baseUrl`: OpenAI-compatible API base URL. OpenAI can omit this.
- `model`: chat model for answers.
- `embeddingModel`: embedding model for remote embedding mode.
- `temperature`: answer randomness.
- `topP`, `maxTokens`, `reasoningEnabled`, `reasoningEffort`: provider-specific tuning when supported.
- `defaultHeaders`: extra headers sent with requests.

## Qdrant

Default:

```yaml
qdrant:
  url: http://localhost:6333
  collection: discord_vector_rag
  indexId: discord-vector-rag
```

`collection` is the Qdrant collection name. `indexId` scopes this bot's points inside the collection so refreshes delete only this index's points.

For remote Qdrant, keep the API key in `.env`:

```env
QDRANT_API_KEY=
```

Docker Compose overrides the Qdrant URL inside the container so the host-friendly `localhost` value can stay in `config.yaml`.

## Embeddings

Default local embeddings:

```yaml
embeddings:
  provider: ollama
  ollama:
    baseUrl: http://localhost:11434
    model: nomic-embed-text
```

Docker Compose starts Ollama and pulls `nomic-embed-text` automatically.

Remote embeddings:

```yaml
embeddings:
  provider: openrouter

providers:
  openrouter:
    embeddingModel: openai/text-embedding-3-small
```

Changing embedding provider or model requires `/refresh`. If vector dimensions change, the bot recreates the Qdrant collection.

## Image Text Extraction

Default:

```yaml
imageText:
  provider: openrouter
  model: google/gemini-2.5-flash
  cacheDir: .cache/image-text
  maxBytes: 15728640
  promptVersion: v1
  # Optional. Omit to OCR every page in PDFs uploaded with use_ocr.
  # pdfOcrMaxPages: 25
```

Image files are sent to the configured provider during indexing. PDFs uploaded with `use_ocr:true` are rendered page by page and each page image is sent to the same provider. Extracted text is cached by image file hash for images, or PDF file hash/page/render identity for PDF OCR pages, plus provider, model, and prompt version.

`imageText.pdfOcrMaxPages` is optional. When omitted, PDF OCR processes every page. When set, PDFs above the limit fail with a clear error rather than indexing only the first pages.

Change `promptVersion` when you want to force image or PDF OCR text re-extraction after changing extraction behavior.

## Retrieval

```yaml
retrieval:
  debug: false
  chunkSize: 1200
  chunkOverlap: 180
  limit: 8
```

Settings:

- `debug`: logs retrieval mode, scores, sources, and chunk indexes without full chunk text.
- `chunkSize`: target size for split chunks.
- `chunkOverlap`: overlap between neighboring chunks.
- `limit`: maximum retrieval result count passed into answer generation.

Run `/refresh` after changing chunk settings.
