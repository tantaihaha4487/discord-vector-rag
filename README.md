# Discord Vector RAG Bot

Discord.js v14 bot with a `/ask` slash command backed by local knowledge files, Qdrant vector search, and configurable OpenAI-compatible chat providers.

## Features

- Slash command loader from the original Discord.js template
- `/ask` command for questions against local knowledge files
- Supports `.txt` and `.pdf` files in `data/`
- Qdrant vector database retrieval
- Provider-style embedding configuration using `AI_PROVIDER_<NAME>_*`
- Configurable fallback order for OpenAI-compatible chat providers
- Docker Compose setup for the bot and Qdrant

## Setup

Install dependencies for local development:

```bash
npm install
```

Create your local environment file if needed:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_test_guild_id_here

AI_PROVIDERS=openrouter,nvidia

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=discord_vector_rag
QDRANT_INDEX_ID=discord-vector-rag

EMBEDDING_PROVIDER=openai

AI_PROVIDER_OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER_OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

`EMBEDDING_PROVIDER` uses the same provider env format as the chat config. For example, `EMBEDDING_PROVIDER=openai` reads `AI_PROVIDER_OPENAI_API_KEY`, `AI_PROVIDER_OPENAI_BASE_URL`, and `AI_PROVIDER_OPENAI_EMBEDDING_MODEL`.

Add `.txt` or `.pdf` knowledge files to `data/`.

## Docker

Pull Qdrant manually if you want to test image availability first:

```bash
docker pull qdrant/qdrant:latest
```

Run Qdrant and the Discord bot together:

```bash
docker compose up -d --build
```

Inside Compose, the bot uses `QDRANT_URL=http://qdrant:6333`. Your local `.env` can keep `QDRANT_URL=http://localhost:6333` for non-container runs.

Stop the stack:

```bash
docker compose down
```

Qdrant data is stored in the named Docker volume `qdrant_storage`.

## Local Run

Start only Qdrant:

```bash
docker compose up -d qdrant
```

Deploy slash commands to your test guild:

```bash
npm run deploy
```

Start the bot locally:

```bash
npm start
```

Use the command in Discord:

```text
/ask question: What is this program about?
```

On the first `/ask`, the bot loads files from `data/`, chunks them, clears its own `QDRANT_INDEX_ID` points from Qdrant, and indexes the current chunks before searching.

## Chat Providers

`AI_PROVIDERS` controls fallback order. Providers without an API key are skipped.

Built-in OpenAI-compatible providers:

- `openrouter`
- `nvidia`
- `openai`
- `groq`
- `together`
- `deepinfra`
- `fireworks`

Each provider uses this env format:

```env
AI_PROVIDER_<NAME>_API_KEY=your_key
AI_PROVIDER_<NAME>_MODEL=model_name
AI_PROVIDER_<NAME>_BASE_URL=https://provider.example/v1
AI_PROVIDER_<NAME>_TEMPERATURE=0.2
AI_PROVIDER_<NAME>_TOP_P=0.95
AI_PROVIDER_<NAME>_MAX_TOKENS=4096
AI_PROVIDER_<NAME>_EMBEDDING_MODEL=text-embedding-3-small
```

Custom OpenAI-compatible endpoints also work by adding a provider name to `AI_PROVIDERS` and setting `API_KEY`, `MODEL`, and `BASE_URL` for that name.

## Structure

```text
data/                      Local RAG knowledge files
src/commands/ask.js        Discord slash command for RAG
src/rag/                   RAG loading, Qdrant retrieval, LLM, and answer flow
src/events/                Discord event handlers
src/utils/                 Command/event loader and deploy script
docker-compose.yml         Bot and Qdrant services
Dockerfile                 Bot container image
```
