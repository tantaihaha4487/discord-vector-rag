# Troubleshooting

[Back to docs index](README.md) | [Back to project README](../README.md)

Use this page when setup, deploy, indexing, or `/ask` fails.

Related pages: [Setup Guide](setup.md), [Configuration Guide](configuration.md), [Knowledge Files](knowledge-files.md), [Operations Guide](operations.md), [Provider Guide](providers.md).

## Slash Commands Do Not Appear

Check `config.yaml`:

```yaml
discord:
  clientId: "YOUR_CLIENT_ID"
  guildId: "YOUR_GUILD_ID"
```

Then run:

```bash
npm run deploy
```

If deploy says it skipped command registration, `clientId` or `guildId` is still empty.

## Bot Does Not Start

Check `.env`:

```env
BOT_TOKEN=
```

Restart after changing `.env`. `/reload` does not reload environment variables.

For Docker Compose, inspect logs:

```bash
docker compose logs -f bot
```

## Admin Commands Are Denied

`/upload`, `/refresh`, and `/reload` require admin config.

Add your user ID or a moderator role ID:

```yaml
discord:
  adminUserIds:
    - "YOUR_DISCORD_USER_ID"
  moderatorRoleIds:
    - "YOUR_MODERATOR_ROLE_ID"
```

Run `/reload` after editing `config.yaml`, or restart if reload is not currently available to you.

## No Chat Provider Is Configured

Set at least one API key matching `chat.providers`.

Default config needs:

```env
AI_PROVIDER_OPENROUTER_API_KEY=
```

Providers without API keys are skipped. See [Provider Guide](providers.md).

## Missing Embedding Provider Or Ollama Unreachable

Default embeddings use Ollama and `nomic-embed-text`.

With Docker Compose, check model pull logs:

```bash
docker compose logs -f ollama-model
```

Without Compose, pull the model locally:

```bash
ollama pull nomic-embed-text
```

Make sure `embeddings.ollama.baseUrl` matches how the bot is running.

## Qdrant Is Not Reachable

With Docker Compose:

```bash
docker compose up -d qdrant
docker compose logs -f qdrant
```

Without Compose:

```bash
docker start discord-vector-qdrant
```

If using remote Qdrant, set `qdrant.url` in `config.yaml` and `QDRANT_API_KEY` in `.env`.

## No Supported Knowledge Files Found

Add at least one supported file under `data/`:

- `.txt`
- `.pdf`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.heic`
- `.heif`

Then run `/refresh` or restart the bot.

## Image Text Extraction Fails

Check:

- `imageText.provider` points to a provider with an API key.
- `imageText.model` supports vision/image input.
- Image size is below `imageText.maxBytes`.
- The image provider accepts your file type.

If you changed image extraction settings, run `/reload`, then `/refresh`.

## Answers Use Old Data

Run `/refresh` after changing files in `data/` outside `/upload`.

If you changed chunking, embeddings, Qdrant target, or image text settings, run `/reload` and then `/refresh`.

## Retrieval Seems Wrong

Enable debug logs:

```yaml
retrieval:
  debug: true
```

Run `/reload`, then ask again. Logs show retrieval mode, scores, source filenames, and chunk indexes.

Improve results by:

- Using clearer source filenames.
- Splitting very large mixed-topic documents.
- Reducing stale or duplicate files.
- Tuning `retrieval.chunkSize`, `retrieval.chunkOverlap`, and `retrieval.limit`.

Run `/refresh` after changing chunk settings.
