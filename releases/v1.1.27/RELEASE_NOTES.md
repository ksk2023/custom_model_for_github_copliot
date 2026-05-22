# Release 1.1.27

## Changes

- Improves OpenAI-compatible relay streaming support for Copilot tool calls.
- Tool call deltas are now accumulated across SSE chunks and flushed at stream end, even when the relay does not send `finish_reason: "tool_calls"`.
- Handles tool-only responses where `delta.content` is empty but `delta.tool_calls` contains valid tool calls.
- Processes tool calls across all choices instead of only `choices[0]`.
- Preserves streamed tool-call argument fragments and parses them with the same tolerant parser used by non-stream responses.

## Fixes

- Fixes `API response completed without text content; unsupported stream format` when a relay returns pure tool-call chunks.
- Fixes Copilot tools not being invoked when Claude/GPT models behind an OpenAI-compatible relay stream tool calls without a final standard finish reason.
- Avoids treating known empty assistant chunks such as `{ "content": "", "role": "assistant" }` as unknown stream formats.
- Avoids switching Claude-named relay models to Anthropic native `/messages` protocol unless the provider endpoint is actually Anthropic or explicitly `/messages`.

## Notes

- This release targets relay providers that expose Claude/GPT/Gemini models through OpenAI-compatible Chat Completions.
- Official Anthropic endpoints continue to use Anthropic native protocol.
