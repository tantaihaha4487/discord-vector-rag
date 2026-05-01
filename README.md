# Discord Vector RAG Bot

Discord.js v14 bot with a `/ask` slash command backed by local knowledge files, keyword routing, Ollama local embeddings, Qdrant vector search, and configurable OpenAI-compatible chat providers.

## Tech Stack

- Node.js
- Discord.js v14
- LangChain text splitters and OpenAI-compatible chat clients
- Ollama local embeddings by default
- Optional remote embeddings through OpenAI-compatible providers
- Qdrant vector database
- Docker and Docker Compose
- `pdf-parse` for PDF knowledge files

## Features

- Slash command loader from the original Discord.js template
- `/ask` command for questions against local knowledge files
- Supports `.txt` and `.pdf` files in `data/`
- Keyword-first retrieval for exact/factual questions
- Qdrant semantic retrieval for general questions
- Local Ollama embedding configuration
- Optional remote embedding configuration using `AI_PROVIDER_<NAME>_*`
- Configurable fallback order for OpenAI-compatible chat providers
- Docker Compose setup for the bot, Qdrant, and Ollama

## Quick Setup

The basic setup needs Discord credentials and one chat provider API key. Fallback providers, Qdrant settings, and embedding settings are optional.

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Fill in the required values:

```env
BOT_TOKEN=
CLIENT_ID=
GUILD_ID=
AI_PROVIDER_OPENROUTER_API_KEY=
```

Paste your real Discord credentials and provider API key after `=`. You only need one chat provider API key to start. Fallback providers are optional and can be added later.

4. Add knowledge files:

Place `.txt` or `.pdf` files in `data/` or folders inside `data/`.

Example:

```text
data/
  admissions-ubu-2569.txt
  handbooks/
    handbook.pdf
  faq/
    faq.txt
```

5. Deploy Discord slash commands:

```bash
npm run deploy
```

You only need to redeploy slash commands when command definitions change.

6. Start the bot and local services:

```bash
docker compose up -d --build
```

Docker Compose starts Qdrant, starts Ollama, pulls the default embedding model, and runs the bot. No Qdrant or Ollama values are required in `.env` for the Compose setup.

## Optional Config

Copy `.env.advanced.example` if you want a full reference for provider fallback, model tuning, Qdrant overrides, or remote embeddings.

### Fallback Chat Providers

Fallback providers are not required. By default, the bot looks for OpenRouter only:

```env
AI_PROVIDER_OPENROUTER_API_KEY=
```

To enable fallback, set `AI_PROVIDERS` in the order you want and add keys for the providers you want to use:

```env
AI_PROVIDERS=openrouter,nvidia,openai

AI_PROVIDER_OPENROUTER_API_KEY=
AI_PROVIDER_NVIDIA_API_KEY=
AI_PROVIDER_OPENAI_API_KEY=
```

Providers without API keys are skipped.

### Qdrant

The default local Qdrant config is:

```env
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=discord_vector_rag
QDRANT_INDEX_ID=discord-vector-rag
```

Only set these if you are not using the defaults. Docker Compose overrides `QDRANT_URL` to `http://qdrant:6333` inside the bot container.

### Embeddings

The default embedding provider is local Ollama:

```env
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

Docker Compose always uses local Ollama embeddings and pulls `nomic-embed-text` automatically.

If you run without Docker Compose, install Ollama and pull the default embedding model:

```bash
ollama pull nomic-embed-text
```

Remote embeddings are optional. They reuse the same provider env format as chat providers:

```env
EMBEDDING_PROVIDER=openrouter
AI_PROVIDER_OPENROUTER_API_KEY=
AI_PROVIDER_OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
```

Do not change `EMBEDDING_PROVIDER` unless you specifically want remote embeddings.

### Retrieval Debug Logs

```env
RAG_DEBUG_RETRIEVAL=false
```

Set `RAG_DEBUG_RETRIEVAL=true` to log retrieval mode, scores, source filenames, and chunk indexes without logging full chunk text.

## Knowledge Files

Supported file types:

- `.txt` files are read as UTF-8 text.
- `.pdf` files are parsed with `pdf-parse`.

Data rules:

- Put source documents inside `data/` or folders inside `data/`.
- Subfolders inside `data/` are scanned recursively.
- Keep filenames descriptive because filenames are shown in Discord as `Sources`.
- Do not put secrets, API keys, or private credentials in knowledge files.
- Large PDFs work, but they create more chunks and may appear more often in retrieval results.

Reindex behavior:

- The bot indexes `data/` on startup.
- Before indexing, it deletes old Qdrant points for the current `QDRANT_INDEX_ID`.
- If the embedding vector size changes, the bot recreates the Qdrant collection before indexing.
- Changing between embedding providers requires reindexing because vector dimensions and embedding spaces differ.
- If you add, edit, or remove files while the bot is running, restart the bot so it rebuilds the Qdrant index.
- You do not need to redeploy slash commands after changing `data/`.

Retrieval behavior:

- Exact/factual questions with strong keyword matches can use keyword-only retrieval and skip Qdrant embedding.
- Medium-confidence keyword matches use keyword results first, then a small Qdrant fill.
- General semantic questions use Qdrant first with local Ollama embeddings, then keyword fill.

Docker data behavior:

- With Docker Compose, `./data` is mounted into the bot container as `/app/data:ro`.
- If you use `docker compose up -d --build`, local files in `data/` are available to the container.
- If you run only the prebuilt Docker image without the Compose volume, rebuild the image after changing `data/`.

## Run With Docker Compose

Use this when Docker Compose is installed. This starts Qdrant, Ollama, pulls the embedding model, and starts the bot.

1. Start the stack:

```bash
docker compose up -d --build
```

Inside Compose, the bot uses `QDRANT_URL=http://qdrant:6333` and `OLLAMA_BASE_URL=http://ollama:11434`. Compose uses local Ollama embeddings regardless of `EMBEDDING_PROVIDER` in `.env`. The `ollama-model` service pulls `nomic-embed-text` automatically before the bot starts.

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

On startup, the bot loads files from `data/`, chunks them, clears its own `QDRANT_INDEX_ID` points from Qdrant, and indexes the current chunks before searching.

## Provider Reference

`AI_PROVIDERS` controls fallback order. You do not need to set it for the basic setup. Providers without an API key are skipped.

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
docker-compose.yml         Bot, Qdrant, and Ollama services
Dockerfile                 Bot container image
```
