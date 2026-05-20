# Release 1.1.26

## Changes

- Aligns chat request endpoint normalization with Chatbox-style API host behavior.
- A provider Base URL such as `https://api.xi-ai.cn` now resolves chat requests to `https://api.xi-ai.cn/v1/chat/completions`.
- Base URLs ending in `/v1` now resolve to `/v1/chat/completions`.
- Base URLs ending in `/openai` now resolve to `/openai/v1/chat/completions`.

## Fixes

- Fixes Xi-Api website HTML being returned when a host-root Base URL was used with imported preset models.
- HTML pages are no longer treated as plain model output; the extension now reports a clear Base URL / endpoint error.

## Notes

- For Chatbox-like relay providers, `https://api.xi-ai.cn` should now work as the provider Base URL for both model fetching and chat requests.
