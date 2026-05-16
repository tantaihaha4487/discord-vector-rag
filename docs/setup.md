# Setup Guide

[Back to docs index](README.md) | [Back to project README](../README.md)

Use this guide to get the bot running from a clean clone.

## Requirements

- Node.js compatible with the dependencies in `package.json`.
- npm for dependency install and scripts.
- A Discord application and bot token.
- One chat provider API key, usually OpenRouter for the default config.
- Docker Compose if you want the recommended all-in-one local stack.

Related pages: [Configuration Guide](configuration.md), [Provider Guide](providers.md), [Operations Guide](operations.md).

## Install Dependencies

```bash
npm install
```

## Create `.env`

```bash
cp .env.example .env
```

Minimum useful values:

```env
BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_ADMIN_USER_IDS=
DISCORD_MODERATOR_ROLE_IDS=
AI_PROVIDER_OPENROUTER_API_KEY=
```

Keep secrets and Discord IDs in `.env`. Do not put API keys in `config.yaml` or knowledge files.

For all built-in provider credential names, see `.env.advanced.example` and [Provider Guide](providers.md).

## Configure Discord IDs

Edit `.env`:

```env
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_GUILD_ID=YOUR_GUILD_ID
DISCORD_ADMIN_USER_IDS=
DISCORD_MODERATOR_ROLE_IDS=
```

Use comma-separated IDs for admin users or moderator roles:

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

Mention-based questions and `/ping` are public. Mention answers include a public source-file button while `commands.ask.topSourceButton` is `true`; clicking it returns the top source file ephemerally to the clicking user. `/view` is also public while `commands.view.allowEveryone` is `true`. Set it to `false` if file viewing should require `DISCORD_ADMIN_USER_IDS` or `DISCORD_MODERATOR_ROLE_IDS`.

Mention ask queue/progress notices use a public status button. Pressing the button creates an interaction, so the bot can return an ephemeral status visible only to the requesting user.

`/upload`, `/refresh`, and `/reload` always require `DISCORD_ADMIN_USER_IDS` or `DISCORD_MODERATOR_ROLE_IDS`. If both lists are empty, those admin commands are denied for everyone.

Enable Message Content Intent for the bot in the Discord Developer Portal so mentions like `@bot what's DSSI` include the question text.

For restricted channels, make sure the bot role is high enough and has `View Channel`, `Send Messages`, and `Read Message History`. `Read Message History` is required for Discord reply messages.

## Add Knowledge Files

Create `data/` if needed and add supported files:

```text
data/
  admissions.txt
  handbooks/
    handbook.pdf
  posters/
    event.jpg
```

Supported types are `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, and `.heif`. Use `/upload ... use_ocr:true` for scanned PDFs.

More detail: [Knowledge Files](knowledge-files.md).

## Deploy Slash Commands

```bash
npm run deploy
```

Deploy after changing command definitions, after first setup, or after changing `DISCORD_CLIENT_ID` / `DISCORD_GUILD_ID`. You do not need to redeploy when changing `data/`, provider keys, command access, provider order, models, or retrieval settings.

If `DISCORD_CLIENT_ID` or `DISCORD_GUILD_ID` is empty, deploy skips command registration and prints a warning.

## Run With Docker Compose

Recommended local mode:

```bash
docker compose up -d --build
```

This starts the bot, Qdrant, Ollama, and an `ollama-model` helper that pulls the default embedding model.

Useful logs:

```bash
docker compose logs -f bot
docker compose logs -f ollama-model
```

Stop the stack:

```bash
docker compose down
```

Docker Compose reads `.env`, passes the `DISCORD_*` values to the bot service, and mounts `./data`, `./.cache`, and `./config.yaml` into the bot container.

## Run Without Docker Compose

Use this when Docker Compose is not available or when you want to run the bot directly.

1. Install Ollama and pull the default embedding model:

```bash
ollama pull nomic-embed-text
```

2. Start Qdrant:

```bash
docker run -d \
  --name discord-vector-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v discord_vector_qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

3. Start the bot:

```bash
npm start
```

## Next Steps

- Tune settings in [Configuration Guide](configuration.md).
- Learn command usage in [Operations Guide](operations.md).
- Fix common startup issues in [Troubleshooting](troubleshooting.md).
