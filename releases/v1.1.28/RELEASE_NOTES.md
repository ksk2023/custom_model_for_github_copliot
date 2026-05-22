# Release 1.1.28

## Changes

- Adds a broader relay tool-call adapter for Copilot integration.
- Treats tool-call deltas as handled stream events immediately, so tool-only streams no longer depend on a final text chunk.
- Adds support for legacy OpenAI `function_call` streaming deltas.
- Adds support for OpenAI Responses API-style `response.function_call_arguments.delta` and `function_call` output items.
- Adds a basic Anthropic `content_block_start` / `tool_use` bridge for providers that expose native Anthropic tool-use events.

## Fixes

- Further reduces `API response completed without text content; unsupported stream format` for relay providers.
- Improves compatibility with relay APIs that mix Claude/GPT/Gemini models behind OpenAI-compatible endpoints.
- Makes Copilot tool invocation more resilient when relays omit standard finish reasons or return empty assistant content chunks before tool calls.

## Notes

- This version builds on 1.1.27 and aims to make the extension act more like a Copilot tool-call reverse-proxy adapter.
- OpenAI-compatible relays remain the recommended integration path for mixed model providers.
