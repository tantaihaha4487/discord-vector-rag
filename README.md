# Discord Vector RAG Bot

Discord.js v14 bot with a `/ask` slash command backed by local knowledge files, image text extraction, keyword routing, Ollama local embeddings, Qdrant vector search, and configurable OpenAI-compatible chat providers.

## Tech Stack

- Node.js
- Discord.js v14
- LangChain text splitters and OpenAI-compatible chat clients
- Ollama local embeddings by default
- Optional remote embeddings through OpenAI-compatible providers
- OpenRouter image text extraction with Gemini-compatible vision models
- Qdrant vector database
- Docker and Docker Compose
- `pdf-parse` for PDF knowledge files

## Features

- Slash command loader from the original Discord.js template
- `/ask` command for questions against local knowledge files
- `/upload` command for adding `.txt`, `.pdf`, or image files from Discord
- `/refresh` command for rebuilding the Qdrant index without restarting
- `/upload` and `/refresh` are restricted by `discord.adminUserIds` in `config.yaml`
- Supports `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, and `.heif` files in `data/` and nested folders
- Caches extracted image text so unchanged images do not call the vision model again
- Keyword-first retrieval for exact/factual questions
- Qdrant semantic retrieval for general questions
- Local Ollama embedding configuration in `config.yaml`
- Optional remote embedding configuration using `config.yaml` and provider API keys
- Configurable fallback order for OpenAI-compatible chat providers
- Docker Compose setup for the bot, Qdrant, and Ollama

## Quick Setup

The basic setup needs a Discord bot token in `.env`, Discord app IDs in `config.yaml`, and one chat provider API key. Fallback providers, Qdrant settings, and embedding settings are optional.

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Fill in the required credentials in `.env`:

```env
BOT_TOKEN=
AI_PROVIDER_OPENROUTER_API_KEY=
```

Paste your real Discord bot token and provider API key after `=`. You only need one chat provider API key to start. Fallback providers are optional and can be added later.

4. Fill in Discord app IDs in `config.yaml`:

```yaml
discord:
  clientId: "YOUR_CLIENT_ID"
  guildId: "YOUR_GUILD_ID"
  adminUserIds: []
```

Keep Discord IDs quoted. Leave `adminUserIds: []` to disable admin commands, or add your Discord user ID if you want to use `/upload` and `/refresh`.

5. Add knowledge files:

Place `.txt`, `.pdf`, or supported image files in `data/` or folders inside `data/`.

Example:

```text
data/
  admissions-ubu-2569.txt
  handbooks/
    handbook.pdf
  faq/
    faq.txt
  posters/
    event.jpg
```

6. Deploy Discord slash commands:

```bash
npm run deploy
```

You only need to redeploy slash commands when command definitions change. If `discord.clientId` or `discord.guildId` is empty, deploy logs a warning and skips command registration.

7. Start the bot and local services:

```bash
docker compose up -d --build
```

Docker Compose deploys slash commands, starts Qdrant, starts Ollama, pulls the default embedding model, and runs the bot. No Qdrant or Ollama values are required in `.env` for the Compose setup.

## Optional Config

Use `.env` for credentials only. Use `config.yaml` for normal app settings such as Discord IDs, admin users, provider order, models, Qdrant, embeddings, and retrieval tuning.

Copy `.env.advanced.example` if you want a full credential reference for all built-in providers.

### Discord And Admins

```yaml
discord:
  clientId: "YOUR_CLIENT_ID"
  guildId: "YOUR_GUILD_ID"
  adminUserIds:
    - "YOUR_DISCORD_USER_ID"
```

`/ask` and `/ping` are public. `/upload` and `/refresh` only work for users listed in `discord.adminUserIds`.

If `adminUserIds` is empty, `/upload` and `/refresh` are denied for everyone. Discord IDs must be quoted strings because they are larger than JavaScript's safe integer range.

### Fallback Chat Providers

Fallback providers are not required. By default, `config.yaml` uses OpenRouter only:

```yaml
chat:
  providers:
    - openrouter
```

Set the matching provider API key in `.env`:

```env
AI_PROVIDER_OPENROUTER_API_KEY=
```

To enable fallback, set `chat.providers` in the order you want and add keys for the providers you want to use:

```yaml
chat:
  providers:
    - openrouter
    - nvidia
    - openai
```

```env
AI_PROVIDER_OPENROUTER_API_KEY=
AI_PROVIDER_NVIDIA_API_KEY=
AI_PROVIDER_OPENAI_API_KEY=
```

Providers without API keys are skipped.

### Qdrant

The default local Qdrant config in `config.yaml` is:

```yaml
qdrant:
  url: http://localhost:6333
  collection: discord_vector_rag
  indexId: discord-vector-rag
```

Only change these if you are not using the defaults. Docker Compose uses a runtime-only override for the Qdrant URL inside the bot container so `localhost` in `config.yaml` remains correct for local non-Docker runs.

For remote Qdrant, keep the API key in `.env`:

```env
QDRANT_API_KEY=
```

### Embeddings

The default embedding provider in `config.yaml` is local Ollama:

```yaml
embeddings:
  provider: ollama
  ollama:
    baseUrl: http://localhost:11434
    model: nomic-embed-text
```

Docker Compose uses local Ollama embeddings, uses a runtime-only override for the Ollama URL inside the bot container, and pulls `nomic-embed-text` automatically.

If you change `embeddings.ollama.model` when using Docker Compose, also make sure that model exists in the Ollama container. You can set `OLLAMA_EMBEDDING_MODEL` before starting Compose so the `ollama-model` service pulls it, or pull it manually.

If you run without Docker Compose, install Ollama and pull the default embedding model:

```bash
ollama pull nomic-embed-text
```

Remote embeddings are optional. They reuse the same provider env format as chat providers:

```yaml
embeddings:
  provider: openrouter

providers:
  openrouter:
    embeddingModel: openai/text-embedding-3-small
```

```env
AI_PROVIDER_OPENROUTER_API_KEY=
```

Do not change `embeddings.provider` unless you specifically want remote embeddings.

### Image Text Extraction

Image files are converted to searchable text during indexing. By default, this uses OpenRouter with a Gemini vision model:

```yaml
imageText:
  provider: openrouter
  model: google/gemini-2.5-flash
  cacheDir: .cache/image-text
  maxBytes: 15728640
  promptVersion: v1
```

Set the matching provider key in `.env`:

```env
AI_PROVIDER_OPENROUTER_API_KEY=
```

The extracted text is cached under `.cache/image-text/` using the image hash, provider, model, and prompt version. Change `imageText.promptVersion` when you want to force re-extraction after changing extraction behavior.

Images are sent to the configured image text provider during extraction. Do not add private images unless that is acceptable for your provider account and data policy.

### Retrieval Debug Logs

```yaml
retrieval:
  debug: false
```

Set `retrieval.debug: true` to log retrieval mode, scores, source filenames, and chunk indexes without logging full chunk text.

## Knowledge Files

Supported file types:

- `.txt` files are read as UTF-8 text.
- `.pdf` files are parsed with `pdf-parse`.
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, and `.heif` files are sent to `imageText.provider` for text extraction.

Data rules:

- Put source documents inside `data/` or folders inside `data/`.
- Subfolders inside `data/` are scanned recursively.
- Keep filenames descriptive because filenames are shown in Discord as `Sources`.
- Do not put secrets, API keys, or private credentials in knowledge files.
- Large PDFs work, but they create more chunks and may appear more often in retrieval results.
- Image files must fit under `imageText.maxBytes` for inline extraction.

Reindex behavior:

- The bot indexes `data/` on startup.
- Use `/refresh` to rebuild the vector database while the bot is running.
- Use `/upload` to save a `.txt`, `.pdf`, or image attachment under `data/`; uploads refresh the vector database automatically.
- `/upload` can autocomplete existing folders, and it can create a new typed folder path under `data/`.
- Before indexing, it deletes old Qdrant points for the current `qdrant.indexId`.
- If the embedding vector size changes, the bot recreates the Qdrant collection before indexing.
- Changing between embedding providers requires reindexing because vector dimensions and embedding spaces differ.
- If you add, edit, or remove files outside Discord while the bot is running, use `/refresh` so it rebuilds the Qdrant index.
- Unchanged image files reuse cached extracted text from `.cache/image-text/`.
- You do not need to redeploy slash commands after changing `data/`.

Retrieval behavior:

- Exact/factual questions with strong keyword matches can use keyword-only retrieval and skip Qdrant embedding.
- Medium-confidence keyword matches use keyword results first, then a small Qdrant fill.
- General semantic questions use Qdrant first with local Ollama embeddings, then keyword fill.

Docker data behavior:

- With Docker Compose, `./data` is mounted into the bot container as `/app/data` so `/upload` can write files.
- With Docker Compose, `./.cache` is mounted into the bot container as `/app/.cache` so image text extraction cache survives rebuilds.
- With Docker Compose, `./config.yaml` is mounted into the bot container as `/app/config.yaml`; restart the bot after changing config.
- If you use `docker compose up -d --build`, local files in `data/` are available to the container.
- If you run only the prebuilt Docker image without the Compose volume, rebuild the image after changing `data/`.

## Run With Docker Compose

Use this when Docker Compose is installed. This deploys slash commands, starts Qdrant, starts Ollama, pulls the embedding model, and starts the bot.

1. Start the stack:

```bash
docker compose up -d --build
```

Inside Compose, the bot uses runtime-only overrides for the Qdrant URL, Ollama URL, and embedding provider. Other non-secret settings still come from `config.yaml`. The bot container runs `npm run deploy` before `npm start`, so slash commands are registered before the bot starts when Discord app IDs are configured. If `discord.clientId` or `discord.guildId` is empty, deploy logs a warning and the bot still starts. The `ollama-model` service pulls `nomic-embed-text` automatically before the bot starts.

No host Ollama install is required for Docker Compose. The first run downloads the Qdrant image, Ollama image, Node dependencies, and the embedding model, so it can take several minutes and use extra disk space.

2. Watch bot logs:

```bash
docker compose logs -f bot
```

3. Watch model pull logs:

```bash
docker compose logs -f ollama-model
```

4. Stop the stack:

```bash
docker compose down
```

Qdrant data is stored in `qdrant_storage`. Ollama models are stored in `ollama_storage`.

The Compose file does not publish Qdrant or Ollama ports to the host by default, which avoids port conflicts on fresh machines. If you need host access for debugging, add a local override file:

```yaml
services:
  qdrant:
    ports:
      - "6333:6333"
      - "6334:6334"
  ollama:
    ports:
      - "11434:11434"
```

## Run Without Docker Compose

Use this when your Docker install does not support `docker compose`.

1. Install Ollama and pull the default embedding model:

```bash
ollama pull nomic-embed-text
```

2. Start Qdrant with plain Docker:

```bash
docker run -d \
  --name discord-vector-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v discord_vector_qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

3. Start the bot locally:

```bash
npm start
```

4. Stop Qdrant when finished:

```bash
docker stop discord-vector-qdrant
```

5. Start the same Qdrant container again later:

```bash
docker start discord-vector-qdrant
```

## Local Run With Compose Qdrant Only

Use this when you want Qdrant in Docker but the bot and Ollama running directly on your machine.

1. Install Ollama and pull the default embedding model:

```bash
ollama pull nomic-embed-text
```

2. Start only Qdrant:

```bash
docker compose up -d qdrant
```

3. Start the bot locally:

```bash
npm start
```

## Use The Bot

Run this command in Discord:

```text
/ask question: What is this program about?
```

Examples:

```text
/ask question: 2569 admission requirement คืออะไร
/ask question: ค่าเทอม 2568 เท่าไหร่
/ask question: Data Science and Software Innovation เรียนเกี่ยวกับอะไร
```

On startup, the bot loads files from `data/` and its subfolders, chunks them, clears its own `qdrant.indexId` points from Qdrant, and indexes the current chunks before searching.

## Provider Reference

`chat.providers` in `config.yaml` controls fallback order. You do not need to change it for the basic setup. Providers without an API key in `.env` are skipped.

Built-in OpenAI-compatible providers:

- `openrouter`
- `nvidia`
- `openai`
- `groq`
- `together`
- `deepinfra`
- `fireworks`

Provider settings live in `config.yaml`:

```yaml
chat:
  providers:
    - openrouter
    - nvidia

providers:
  openrouter:
    model: google/gemma-4-31b-it:free
    baseUrl: https://openrouter.ai/api/v1
    temperature: 0.2
    embeddingModel: openai/text-embedding-3-small

  nvidia:
    model: deepseek-ai/deepseek-v4-flash
    baseUrl: https://integrate.api.nvidia.com/v1
    temperature: 1
    topP: 0.95
    maxTokens: 16384
```

Provider credentials stay in `.env`:

```env
AI_PROVIDER_<NAME>_API_KEY=your_key
```

Custom OpenAI-compatible endpoints also work by adding a provider name to `chat.providers`, adding its settings under `providers.<name>`, and setting `AI_PROVIDER_<NAME>_API_KEY` in `.env`.

## Structure

```text
data/                      Local RAG knowledge files, scanned recursively
.cache/image-text/         Cached text extracted from image knowledge files
config.yaml                Non-secret app, provider, retrieval, and admin config
src/commands/ask.js        Discord slash command for RAG
src/rag/                   RAG loading, Qdrant retrieval, LLM, and answer flow
src/events/                Discord event handlers
src/utils/                 Command/event loader and deploy script
docker-compose.yml         Bot, Qdrant, and Ollama services
Dockerfile                 Bot container image
```
