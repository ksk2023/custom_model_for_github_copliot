# Release 1.1.24

## Changes

- Adds a per-provider `+模型` button in the sidebar for manually adding model IDs.
- Adds a `导入预设` button with common OpenAI/GPT, Gemini, Claude, and DeepSeek presets.
- Adds per-model delete buttons so imported or manually added models can be cleaned up directly from the sidebar.

## Preset Groups

- OpenAI/GPT: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.3-codex`
- Gemini: `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- Claude: `claude-opus-4-1-20250805`, `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20241022`
- DeepSeek: `deepseek-chat`, `deepseek-reasoner`, `deepseek-v4-pro`, `deepseek-v4-flash`

## Fixes

- Provides a Chatbox-like fallback path for relays whose `/models` endpoint does not expose every callable model.
- Users can now add known working model IDs even when automatic model discovery is incomplete.
