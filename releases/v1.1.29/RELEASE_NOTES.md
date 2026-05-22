# Release 1.1.29

## Changes

- Pushes the extension further toward a generic Copilot relay adapter for mixed external APIs.
- Tool argument deltas are detected before text extraction, so JSON argument fragments are not emitted as normal assistant text.
- Anthropic native `tool_use` streams are now accumulated across `content_block_start` and `content_block_delta` events, then flushed on stop/end.
- OpenAI Responses API function-call argument deltas and output items remain supported, with better separation from text output.
- Non-stream legacy OpenAI `function_call` responses are now translated into Copilot tool calls.

## Fixes

- Reduces protocol pollution in Copilot output, especially raw tool argument fragments such as partial JSON.
- Reduces false `unsupported stream format` failures when relays emit tool-related events without text.
- Improves compatibility for relay APIs that expose Claude/Gemini/GPT models through OpenAI-compatible endpoints.

## Boundaries

- The adapter can normalize protocol-level noise and multiple tool-call formats.
- It cannot reliably remove arbitrary upstream-injected prompt text if the relay/model emits it as normal assistant content.
- Tool calling still requires the upstream model or relay to return machine-readable tool/function call structures.
