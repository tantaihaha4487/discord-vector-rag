# Discord Vector RAG Bot

Discord.js v14 bot with a `/ask` slash command backed by local knowledge files, Qdrant vector search, and configurable OpenAI-compatible chat providers.

## Tech Stack

- Node.js
- Discord.js v14
- LangChain text splitters and OpenAI-compatible chat/embedding clients
- OpenRouter embeddings by default
- Qdrant vector database
- Docker and Docker Compose
- `pdf-parse` for PDF knowledge files

## Features

- Slash command loader from the original Discord.js template
- `/ask` command for questions against local knowledge files
- Supports `.txt` and `.pdf` files in `data/`
- Qdrant vector database retrieval
- Provider-style embedding configuration using `AI_PROVIDER_<NAME>_*`
- Configurable fallback order for OpenAI-compatible chat providers
- Docker Compose setup for the bot and Qdrant

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example file:

```bash
cp .env.example .env
```

3. Fill in Discord credentials in `.env`:

```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_test_guild_id_here
```

4. Configure chat providers in `.env`:

```env
AI_PROVIDERS=openrouter,nvidia

AI_PROVIDER_OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_PROVIDER_OPENROUTER_MODEL=google/gemma-4-31b-it:free

AI_PROVIDER_NVIDIA_API_KEY=your_nvidia_api_key_here
AI_PROVIDER_NVIDIA_MODEL=deepseek-ai/deepseek-v4-flash
AI_PROVIDER_NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

5. Configure Qdrant and embeddings in `.env`:

```env
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=discord_vector_rag
QDRANT_INDEX_ID=discord-vector-rag

EMBEDDING_PROVIDER=openrouter

AI_PROVIDER_OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_PROVIDER_OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
```

`EMBEDDING_PROVIDER` uses the same provider env format as the chat config. For example, `EMBEDDING_PROVIDER=openrouter` reads `AI_PROVIDER_OPENROUTER_API_KEY`, `AI_PROVIDER_OPENROUTER_BASE_URL`, and `AI_PROVIDER_OPENROUTER_EMBEDDING_MODEL`.

6. Add knowledge files:

Place `.txt` or `.pdf` files in `data/`.

Example:

```text
data/
  admissions-ubu-2569.txt
  handbook.pdf
  faq.txt
```

Supported file types:

- `.txt` files are read as UTF-8 text.
- `.pdf` files are parsed with `pdf-parse`.

Data rules:

- Put each source document directly inside `data/`.
- Subfolders inside `data/` are not scanned.
- Keep filenames descriptive because filenames are shown in Discord as `Sources`.
- Do not put secrets, API keys, or private credentials in knowledge files.
- Large PDFs work, but they create more chunks and may appear more often in retrieval results.

Reindex behavior:

- The bot indexes `data/` on the first `/ask` after startup.
- Before indexing, it deletes old Qdrant points for the current `QDRANT_INDEX_ID`.
- If you add, edit, or remove files while the bot is running, restart the bot so it rebuilds the Qdrant index.
- You do not need to redeploy slash commands after changing `data/`.

Docker data behavior:

- With Docker Compose, `./data` is mounted into the bot container as `/app/data:ro`.
- If you use `docker compose up -d --build`, local files in `data/` are available to the container.
- If you run only the prebuilt Docker image without the Compose volume, rebuild the image after changing `data/`.

7. Deploy Discord slash commands:

```bash
npm run deploy
```

You only need to redeploy slash commands when command definitions change.

## Run With Docker Compose

Use this when Docker Compose is installed.

1. Pull Qdrant first if you want to test image availability:

```bash
docker pull qdrant/qdrant:latest
```

2. Start Qdrant and the Discord bot:

```bash
docker compose up -d --build
```

Inside Compose, the bot uses `QDRANT_URL=http://qdrant:6333`. Your local `.env` can keep `QDRANT_URL=http://localhost:6333` for non-container runs.

3. Watch bot logs:

```bash
docker compose logs -f bot
```

4. Stop the stack:

```bash
docker compose down
```

Qdrant data is stored in the named Docker volume `qdrant_storage`.

## Run Without Docker Compose

Use this when your Docker install does not support `docker compose`.

1. Start Qdrant with plain Docker:

```bash
docker run -d \
  --name discord-vector-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v discord_vector_qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

2. Start the bot locally:

```bash
npm start
```

3. Stop Qdrant when finished:

```bash
docker stop discord-vector-qdrant
```

4. Start the same Qdrant container again later:

```bash
docker start discord-vector-qdrant
```

## Local Run With Compose Qdrant Only

Use this when you want Qdrant in Docker but the bot running directly on your machine.

1. Start only Qdrant:

```bash
docker compose up -d qdrant
```

2. Start the bot locally:

```bash
npm start
```

## Use The Bot

Run this command in Discord:

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
