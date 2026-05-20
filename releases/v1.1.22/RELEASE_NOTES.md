# Release 1.1.22

## Changes

- Reworked relay model parsing to follow Chatbox-style OpenAI-compatible `/models` behavior.
- Prioritizes real model list containers such as `data`, `models`, `modelList`, `items`, and `results`.
- Keeps support for OpenRouter-style metadata including `context_length`, `architecture.input_modalities`, `pricing.internal_reasoning`, and `supported_parameters`.

## Fixes

- Prevents response envelope fields like `object`, `success`, `status`, `payload`, and `response` from being added as fake models.
- Avoids treating non-model arrays such as `supported_parameters` as model lists.

## Notes

- Base URLs ending with `/v1/chat/completions` are still normalized to `/v1/models` when fetching models.
- This release is intended to improve compatibility with relays such as `https://api.xi-ai.cn`.
