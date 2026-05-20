# Release 1.1.25

## Changes

- Replaces native browser `prompt()` usage with real VS Code Webview modals for manual model entry.
- Replaces preset import `prompt()` with a Webview modal containing a preset group selector.
- Manual model entry now supports multi-line and comma/semicolon separated model IDs in the modal textarea.

## Fixes

- Fixes `+模型` and `导入预设` appearing to do nothing in VS Code Remote/WSL webviews where native `prompt()` dialogs may not show.
- Keeps all model-management actions inside the extension sidebar UI.

## Notes

- This release keeps the 1.1.24 preset groups and model delete controls.
