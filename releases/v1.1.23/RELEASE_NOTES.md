# Release 1.1.23

## Changes

- Aligns model fetching more closely with Chatbox-style API host behavior.
- When the Base URL is a host root such as `https://api.xi-ai.cn`, model fetching now also tries `https://api.xi-ai.cn/v1/models`.
- Base URLs ending in `/v1/chat/completions` continue to normalize to `/v1/models`.
- Adds support for relay response containers such as `data.list`, `data.rows`, and `data.records`.

## Fixes

- Fixes GPT models missing when a relay wraps the actual model list under `data.list`.
- Reduces mismatch between Chatbox "API Host" configuration and this extension's "Base URL" handling.

## Notes

- For Chatbox-like providers, both `https://api.xi-ai.cn` and `https://api.xi-ai.cn/v1/chat/completions` should now be usable.
