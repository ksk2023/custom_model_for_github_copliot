# Custom Copilot Chat v1.1.30

## Summary

This release synchronizes the English and Chinese documentation with the current extension behavior and keeps the packaged VSIX version moving forward.

## Changes

- Updated `README.md` and `README_zh.md` in parallel so both documents describe the same features, install flow, settings, and compatibility notes.
- Updated install examples to use `custom-copilot-chat-1.1.30.vsix`.
- Documented the relay/tool-call adapter, including OpenAI `tool_calls`, legacy `function_call`, Responses API function calls, and Anthropic `tool_use` handling.
- Documented sidebar model management, manual model entry, preset import, fingerprint management, endpoint normalization, and WSL/local reverse proxy usage.
- Corrected the API key storage wording: keys are masked in the UI but stored in VS Code extension settings.

## Compatibility Notes

- Use this VSIX for Windows, WSL, local Linux, and remote Linux extension hosts.
- If `/v1/models` fails or returns incomplete relay data, use manual model entry or preset import.
- For tool-call compatibility with relay models, keep using v1.1.29 or later.
