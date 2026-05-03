# Provider Guide

[Back to docs index](README.md) | [Back to project README](../README.md)

The bot uses OpenAI-compatible provider settings for chat, optional remote embeddings, and image text extraction.

Related pages: [Configuration Guide](configuration.md), [Setup Guide](setup.md), [Troubleshooting](troubleshooting.md).

## Built-In Providers

- `openrouter`
- `nvidia`
- `openai`
- `groq`
- `together`
- `deepinfra`
- `fireworks`

Each provider has defaults in `config.yaml` under `providers.<name>`.

## Credentials

Credentials stay in `.env`:

```env
AI_PROVIDER_OPENROUTER_API_KEY=
AI_PROVIDER_NVIDIA_API_KEY=
AI_PROVIDER_OPENAI_API_KEY=
AI_PROVIDER_GROQ_API_KEY=
AI_PROVIDER_TOGETHER_API_KEY=
AI_PROVIDER_DEEPINFRA_API_KEY=
AI_PROVIDER_FIREWORKS_API_KEY=
```

Only set keys for providers you plan to use. Providers without API keys are skipped.

## Chat Fallback Order

`chat.providers` controls answer provider order:

```yaml
chat:
  providers:
    - openrouter
    - nvidia
    - openai
```

The bot tries configured providers with available API keys. If a provider fails or is not configured, the answer flow can fall through to the next usable provider.

## Provider Settings

Example:

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

Fields are provider-dependent. Keep only fields your provider supports.

## Image Text Provider

Default image extraction uses OpenRouter:

```yaml
imageText:
  provider: openrouter
  model: google/gemini-2.5-flash
```

The selected provider must support image input through an OpenAI-compatible chat completions API.

Images are sent to this provider during indexing unless cached extracted text already exists.

## Embedding Provider

Default embeddings use local Ollama:

```yaml
embeddings:
  provider: ollama
```

Optional remote embeddings use the provider's `embeddingModel`:

```yaml
embeddings:
  provider: openrouter

providers:
  openrouter:
    embeddingModel: openai/text-embedding-3-small
```

Remote embeddings require the matching provider API key in `.env`.

## Custom Providers

Add a custom OpenAI-compatible provider by adding it to `chat.providers`, defining settings under `providers`, and setting a matching API key.

Example:

```yaml
chat:
  providers:
    - myprovider

providers:
  myprovider:
    name: My Provider
    baseUrl: https://example.com/v1
    model: example-chat-model
    temperature: 0.2
```

```env
AI_PROVIDER_MYPROVIDER_API_KEY=
```

Provider names are normalized for environment variable lookup. Use simple lowercase names when possible.

## Choosing Providers

- Use local Ollama embeddings for privacy and lower cost.
- Use remote embeddings if you need a specific embedding model or hosted reliability.
- Use one stable chat provider first, then add fallbacks only when needed.
- Use a vision-capable provider for `imageText.provider` if you index images.
