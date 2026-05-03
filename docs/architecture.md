# Architecture

[Back to docs index](README.md) | [Back to project README](../README.md)

This page explains how the bot is organized and how a question becomes an answer.

Related pages: [Knowledge Files](knowledge-files.md), [Configuration Guide](configuration.md), [Operations Guide](operations.md), [Provider Guide](providers.md).

## High-Level Flow

```text
Discord slash command
  -> command handler
  -> RAG service
  -> retriever
  -> keyword and/or Qdrant search
  -> chat provider
  -> Discord response with sources
```

## Main Directories

```text
src/commands/       Slash command definitions and command-level replies
src/events/         Discord event handlers
src/rag/            Config, loading, retrieval, vector store, LLM, and service logic
src/utils/          Command/event registration and slash command deployment
data/               Source knowledge files
.cache/image-text/  Image text extraction cache
```

## Startup

On startup, the bot:

- Loads environment variables.
- Loads `config.yaml`.
- Registers command and event handlers.
- Logs into Discord.
- Builds the knowledge vector store when first needed.

With Docker Compose, the container also runs `npm run deploy` before `npm start`.

## Command Layer

Commands live in `src/commands/`.

- `ask.js` handles user questions.
- `upload.js` saves Discord attachments and triggers refresh.
- `refresh.js` rebuilds the vector index.
- `reload.js` reloads `config.yaml`.
- `ping.js` is a basic health check.

`src/events/interactionCreate/commandExecute.js` dispatches chat input commands and autocomplete requests.

## Knowledge Loading

`src/rag/data-loader.js` scans `data/`, loads supported files, and creates LangChain `Document` objects.

Text extraction paths:

- `.txt` uses UTF-8 file reads.
- `.pdf` uses `pdf-parse`.
- Images use `src/rag/image-text.js` and the configured image text provider.

Documents are split into chunks using `RecursiveCharacterTextSplitter` with `retrieval.chunkSize` and `retrieval.chunkOverlap`.

## Vector Store

`src/rag/vector-store.js` manages Qdrant.

It:

- Creates the collection if missing.
- Recreates the collection if embedding vector size changes.
- Deletes existing points for the configured `qdrant.indexId` before refresh.
- Upserts chunks with deterministic point IDs.
- Provides similarity search methods for retrieval.

The vector store build is promise-cached so concurrent requests share the same in-flight work. Refreshes are queued around existing build/refresh work.

## Retrieval Strategy

The retriever combines keyword and vector retrieval.

Behavior summary:

- Strong exact/factual keyword matches can use keyword-only retrieval.
- Medium-confidence keyword matches use keyword results first and Qdrant fill second.
- General semantic questions use Qdrant first and keyword fill second.

Enable `retrieval.debug: true` to inspect mode, scores, sources, and chunk indexes.

## LLM Flow

`src/rag/llm.js` builds chat and embedding clients from config.

`src/rag/service.js` ties retrieval and answer generation together. It sends retrieved context to the configured chat provider and returns the answer plus source list to `/ask`.

## Runtime Config

`src/rag/config.js` reads and validates `.env` and `config.yaml` values. `/reload` replaces the active config without restarting for normal runtime settings.

Secrets still come from process environment, so changing `.env` requires restart.
