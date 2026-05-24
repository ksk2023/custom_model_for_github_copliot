# Custom Copilot Chat v1.1.31

## Summary

This release fixes model management pain points in the sidebar: models can be deleted reliably, manual model input correctly splits Chinese and English comma-separated IDs, and large provider model lists can be collapsed.

## Changes

- Added a dedicated extension-host `deleteModel` message path so a single model deletion is persisted directly.
- Added a bulk `deleteModels` message path used by the sidebar's new **删除未勾选 / Delete Unchecked** button.
- Updated manual model parsing to split model IDs by newlines, English commas, Chinese commas, semicolons, Chinese semicolons, and Chinese list separators.
- Updated Quick Add manual fallback with the same multi-model parsing logic.
- Added per-provider model-list collapse/expand state in the sidebar Webview.
- Kept collapse state inside the Webview state so it survives re-rendering while the view is retained.

## Notes

- Use **全不选** plus **删除未勾选** to quickly clear an over-large relay model list.
- Use inputs like `gpt-5.5，gemini-2.5-pro, claude-sonnet-4` when manually adding multiple models.
