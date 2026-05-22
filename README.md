# 🚀 Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

![VS Code](https://img.shields.io/badge/VS%20Code-%23007ACC?style=flat&logo=visual-studio-code&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.30-blue?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC?style=flat&logo=typescript&logoColor=white)

Custom Copilot Chat lets GitHub Copilot Chat use custom models from OpenAI-compatible APIs, relay providers, local reverse proxies, Anthropic-compatible endpoints, and Ollama-style local services.

The extension focuses on Copilot integration, not just raw chat completion: it normalizes relay responses, bridges tool calls into VS Code Copilot tools, and provides a sidebar UI for managing providers, models, presets, and fingerprints.

---

## ✨ What's New in 1.1.30

- **Documentation sync**: English and Chinese README files now describe the same current behavior, settings, installation paths, and compatibility notes.
- **Current VSIX flow**: install examples now point to the latest `custom-copilot-chat-1.1.30.vsix` package.
- **Relay compatibility notes**: docs now explain how tool-call bridging, endpoint normalization, model fetching, and manual presets work together.

---

## ✨ Features

| Area | What It Does |
|---|---|
| 🧩 Multi-provider support | Use OpenAI-compatible APIs, relay stations, local reverse proxies, Anthropic endpoints, Ollama, and custom hosts. |
| 🧠 Copilot tool-call bridge | Converts OpenAI `tool_calls`, legacy `function_call`, Responses API function calls, and Anthropic `tool_use` into VS Code Copilot tool calls. |
| 🧼 Relay output cleanup | Filters empty stream chunks, `[DONE]`, protocol event lines, HTML pages, and tool-argument deltas that should not appear as assistant text. |
| 🔄 Model fetching | Tries relay-friendly `/models` endpoints and parses common nested response shapes while filtering non-model fields such as `success` and `object`. |
| ✍️ Manual models | Add model IDs manually when a relay hides or incompletely exposes its model list. |
| 📦 Preset import | Import GPT, Gemini, Claude, DeepSeek, and other common model presets from the sidebar. |
| 🧬 Fingerprint management | Add, edit, delete, and activate per-provider fingerprint headers for relays or local reverse proxies. |
| 🎛️ Sidebar settings | Open the Custom AI activity-bar view to add providers, fetch models, edit models, delete models, import presets, and manage fingerprints. |
| 🌉 WSL/local support | Works in local Windows, local Linux, WSL, and remote Linux extension hosts with the same VSIX package. |

---

## 📦 Supported Providers

| Provider Type | Base URL Example | Notes |
|---|---|---|
| OpenAI-compatible relay | `https://api.example.com` or `https://api.example.com/v1` | Host-root, `/v1`, and `/v1/chat/completions` inputs are normalized automatically. |
| Local reverse proxy | `http://127.0.0.1:58486/v1` | Suitable for Windows-hosted local APIs used from VS Code, WSL, or Remote. |
| OpenAI | `https://api.openai.com/v1` | Use OpenAI-compatible chat completion models exposed by your account or proxy. |
| Anthropic native | `https://api.anthropic.com/v1` | Uses Anthropic protocol only for official Anthropic-style `/messages` endpoints. |
| Ollama | `http://localhost:11434/v1` | No API key is usually required. |
| Custom | Any compatible endpoint | If `/models` is incomplete, use manual model entry or presets. |

Common preset families include GPT, Gemini, Claude, DeepSeek, Qwen, Kimi, GLM, Step, Baichuan, Yi, and other relay-exposed OpenAI-compatible model IDs.

---

## 📥 Installation

### Option 1: Download from GitHub Releases

1. Open [Latest Release](https://github.com/ksk2023/custom_model_for_github_copliot/releases/latest).
2. Download `custom-copilot-chat-1.1.30.vsix`.
3. In VS Code, open **Extensions** (`Ctrl+Shift+X`).
4. Select **⋯ → Install from VSIX...** and choose the downloaded file.

### Option 2: Command Line

Install into the current local VS Code extension host:

```bash
code --install-extension custom-copilot-chat-1.1.30.vsix
```

Install into a WSL extension host:

```bash
code --remote wsl+Ubuntu --install-extension custom-copilot-chat-1.1.30.vsix
```

For Remote SSH or remote Linux, run the install command from the connected VS Code window so the extension is installed into the remote extension host.

---

## ⚡ Quick Start

1. Open **Custom AI** from the VS Code Activity Bar, or run **Custom AI: Open Config** from the command palette.
2. Click **Add Provider** or edit an existing provider.
3. Enter a **Base URL**:
   - Relay host root: `https://api.example.com`
   - Relay `/v1`: `https://api.example.com/v1`
   - Full chat endpoint: `https://api.example.com/v1/chat/completions`
   - Local proxy: `http://127.0.0.1:58486/v1`
4. Enter the **API Key** if required.
5. Click **Fetch Models**. If the relay does not expose all models, use **+ Model** or **Import Presets**.
6. Enable the models you want to show in Copilot Chat.
7. Open Copilot Chat and choose the custom model from the model picker.

---

## 🧠 Relay and Tool-Call Compatibility

Many relay services expose Claude, Gemini, DeepSeek, or GPT-style models through an OpenAI-compatible API. Their response formats are often close to OpenAI, but not identical. This extension adapts the most common variants so Copilot can still call tools such as file reading, workspace search, and other VS Code-provided functions.

### Normalized request behavior

- Sends OpenAI-compatible `messages` and `tools` for relay providers.
- Keeps Claude-named relay models on the OpenAI-compatible path unless the endpoint is an official Anthropic `/messages` endpoint.
- Normalizes chat URLs from host root or `/v1` to `/v1/chat/completions`.
- Normalizes model-list URLs to `/v1/models` when possible.
- Supports stream, non-stream, and local compatibility modes.

### Normalized response behavior

- Streams assistant text into Copilot as `LanguageModelTextPart`.
- Accumulates fragmented `delta.tool_calls[*].function.arguments` and emits valid Copilot tool calls.
- Supports legacy OpenAI `function_call` chunks.
- Supports OpenAI Responses API-style function-call output items.
- Supports Anthropic native `tool_use` blocks and tool input deltas.
- Flushes pending tool calls when a relay omits `finish_reason: "tool_calls"`.
- Treats tool-only responses as valid even when no assistant text is emitted.

### Boundaries

- The upstream model or relay must return machine-readable tool/function calls. Plain text that merely says “I want to call a tool” cannot be converted into a real Copilot tool call.
- The extension filters protocol noise, but it cannot reliably remove arbitrary advertisements, hidden prompts, or policy text if the relay emits them as normal assistant content.
- If a relay returns an HTML app page instead of JSON, the Base URL is likely pointing at the website frontend rather than the API endpoint.

---

## 🧬 Fingerprint Management

Some local reverse proxies or relay services require a session, device, or account fingerprint. Each provider can store multiple fingerprints and activate one at a time.

The default fingerprint header is:

```text
X-Fingerprint: your-fingerprint-value
```

Advanced header JSON is also supported by entering a JSON object as the fingerprint value, for example:

```json
{
  "X-Fingerprint": "your-fingerprint",
  "X-Device-Id": "your-device-id"
}
```

Fingerprints are applied to chat requests and model-fetch requests for the active provider.

---

## ⚙️ Configuration Reference

| Setting | Default | Description |
|---|---:|---|
| `customai.providers` | `[]` | Provider endpoints with `baseUrl`, `apiKey`, and optional fingerprints. |
| `customai.models` | `[]` | Models shown in Copilot Chat. Each model belongs to one provider. |
| `customai.defaultTemperature` | `0.7` | Default temperature for model responses. |
| `customai.defaultMaxTokens` | `4096` | Default max token value used when a model does not override it. |
| `customai.streamMode` | `auto` | `auto`, `stream`, or `non-stream`. |
| `customai.localEndpointHosts` | `[]` | Extra hosts/IPs to try for local endpoint fallback in WSL or remote environments. |
| `customai.localCompatibilityMode` | `auto` | `auto`, `full`, or `minimal` request compatibility mode for local reverse proxies. |
| `customai.debug` | `false` | Enables verbose output in the **Custom AI** output channel. |

Example settings:

```json
{
  "customai.providers": [
    {
      "id": "provider-xi",
      "name": "Xi API",
      "baseUrl": "https://api.xi-ai.cn",
      "apiKey": "sk-...",
      "activeFingerprintId": "fp-main",
      "fingerprints": [
        {
          "id": "fp-main",
          "name": "Default",
          "headerName": "X-Fingerprint",
          "value": "your-fingerprint"
        }
      ]
    }
  ],
  "customai.models": [
    {
      "id": "model-gpt-55",
      "providerId": "provider-xi",
      "modelName": "gpt-5.5",
      "displayName": "Xi API - GPT-5.5",
      "maxInputTokens": 1050000,
      "visible": true,
      "reasoningProfile": "openai",
      "reasoningEffort": "default",
      "thinkingType": "default",
      "customRequestParams": ""
    }
  ],
  "customai.streamMode": "auto",
  "customai.localCompatibilityMode": "auto"
}
```

API keys are masked in the UI, but they are stored in VS Code extension settings. Do not share exported settings files that contain provider credentials.

---

## 🧪 Recommended Configurations

| Scenario | Recommended Setting |
|---|---|
| OpenAI-compatible relay | `streamMode: auto`, provider Base URL as host root or `/v1`. |
| Relay has unstable streaming | Try `streamMode: non-stream`; tool-only non-stream responses are supported. |
| Windows local proxy from WSL | Use `http://127.0.0.1:58486/v1` first; if needed add host fallback values in `customai.localEndpointHosts`. |
| `/models` returns incomplete data | Use **+ Model** or **Import Presets**; chat can still work even when model fetching fails. |
| Claude model through OpenAI relay | Keep provider type as OpenAI-compatible/custom; the extension will not force Anthropic protocol unless the endpoint is Anthropic-native. |

---

## ❓ FAQ

**Q: `/v1/models` returns 502, but chat works in curl. What should I do?**

Use **+ Model** or **Import Presets**. Some relays do not proxy model-list requests reliably even though chat completion works.

**Q: Why did I get `unsupported stream format` with `delta.tool_calls` chunks?**

Install version `1.1.29` or later. Tool-only streamed responses are treated as valid and converted to Copilot tool calls.

**Q: Why do I see `success` or `object` as model names?**

Use version `1.1.29` or later. Model fetching filters common metadata fields and extracts IDs from nested relay responses.

**Q: Why does the extension show HTML during preset import or model fetching?**

The Base URL points to a website frontend instead of an API endpoint, or the relay returned a login/app page. Use the API host root, `/v1`, or `/v1/chat/completions` endpoint.

**Q: Does the extension remove upstream prompt pollution?**

It removes protocol-level noise and tool-call argument leakage. It cannot safely remove arbitrary text that the upstream model emits as normal assistant content.

---

## 🛠️ Development

```bash
npm install
npm run compile
npm run build
```

`npm run build` compiles TypeScript and packages the extension as a VSIX.

---

## 📄 License

[MIT](LICENSE)
