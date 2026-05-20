# 🚀 Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

![VS Code](https://img.shields.io/badge/VS%20Code-%23007ACC?style=flat&logo=visual-studio-code&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.25-blue?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC?style=flat&logo=typescript&logoColor=white)

---

## ✨ Features

<table>
  <tr>
    <td width="50%">

### 🧩 Multi-Provider Support

Add **any OpenAI-compatible API** to GitHub Copilot Chat — OpenAI, Anthropic, Ollama, and more.

### 🇨🇳 Chinese Providers Built-in

Pre-configured for **Step, Zhipu, Moonshot, DeepSeek, Baichuan, Yi** and other domestic LLMs.

### 🔄 Dynamic Model Fetching

Enter your Base URL & API Key → click **"Fetch Models"** → try relay-friendly model endpoints and parse nested responses.

### 🎨 Visual Config UI

No JSON editing required. Configure everything through a clean, interactive VS Code webview panel.

### 🧬 Fingerprint Management

Add, edit, delete, and activate per-provider fingerprint headers for relays or local reverse proxies that require session/device fingerprints.

### ✍️ Manual Models & Presets

When `/models` is incomplete, manually add model IDs or import GPT, Gemini, Claude, and DeepSeek presets from the sidebar.

### ⚡ Quick Add Templates

One-click preset templates for every supported provider. Get started in seconds.

    </td>
    <td>

### 🛡️ Two-Layer Architecture

`Provider → Model` two-tier config. One provider can manage multiple models with independent settings.

### 🌡️ Per-Model Temperature

Each model gets its own `temperature` and `maxTokens` — override defaults individually.

### 🔑 Secure Key Storage

API keys are stored in VS Code's native `secretStorage`, not in plain text.

### 🔄 Auto-Reload on Config Change

Save and go — the extension detects changes and reloads the model list automatically.

    </td>
  </tr>
</table>

---

## 📦 Supported Providers

| Provider | Base URL | Example Models |
|---|---|---|
| 🟦 **阶跃星辰** Step | `https://api.stepfun.com/v1` | step-3.5-flash-2603, step-3.5-flash |
| 🟩 **智谱 AI** GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-5.1, glm-5, glm-5-turbo |
| 🟧 **月之暗面** Moonshot | `https://api.moonshot.cn/v1` | kimi-k2.6, kimi-k2.5, moonshot-v1-128k |
| 🔴 **DeepSeek** | `https://api.deepseek.com/v1` | deepseek-v4-pro, deepseek-v4-flash |
| 🟫 **百川** Baichuan | `https://api.baichuan-ai.com/v1` | Baichuan4, Baichuan4-Air |
| 🟨 **零一万物** Yi | `https://api.lingyiwanwu.com/v1` | yi-lightning, yi-large, yi-medium |
| ⬛ **OpenAI** | `https://api.openai.com/v1` | gpt-4.1, gpt-4o, o3 |
| 🟪 **Anthropic** | `https://api.anthropic.com/v1` | claude-sonnet-4, claude-3.5-sonnet |
| 🐪 **Ollama** | `http://localhost:11434/v1` | llama3.2, qwen2.5, deepseek-r1 |
| 🔗 **Custom** | Any OpenAI-compatible API | Varies |

---

## 📥 Installation

### Option 1: VSIX (Recommended)

1. Download the latest `.vsix` from [Releases](https://github.com/ksk2023/custom_model_for_github_copliot/releases)
2. Open VS Code → **Extensions** view (`Ctrl+Shift+X`)
3. Click the **⋯** menu → **Install from VSIX...**
4. Select the downloaded file

The same VSIX supports local Windows, local Linux, WSL, and remote Linux extension hosts.

### Option 2: Command Line

```bash
code --install-extension custom-copilot-chat-1.1.18.vsix
```

For WSL or a remote Linux host, run the command from that connected VS Code window, or use:

```bash
code --remote wsl+Ubuntu --install-extension custom-copilot-chat-1.1.18.vsix
```

---

## ⚡ Quick Start

### 1. Add a Model

Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → **"Custom AI: Quick Add Model"**

Then:
- Pick a **Provider** (e.g., 阶跃星辰)
- Enter **Base URL** and **API Key**
- Click **"Fetch Available Models"**
- Select models → **Save**

### 2. Select Your Model in Copilot Chat

Open Copilot Chat (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) → pick your model from the **model dropdown** → start chatting.

---

## ⚙️ Configuration

### Method 1: Config Panel (Recommended)

1. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → **"Custom AI: Open Config"**
2. Click **+ Add Model**
3. Choose a provider, fill in URL & key
4. Click **Fetch Models** → select models
5. **Save**

### Method 2: Settings JSON

```json
{
  "customai.models": [
    {
      "id": "model-001",
      "name": "My GPT-4o",
      "providerId": "openai",
      "modelName": "gpt-4o",
      "enabled": true,
      "temperature": 0.7,
      "maxTokens": 8192
    }
  ]
}
```

---

## 🔧 Settings Reference

| Setting | Default | Description |
|---|---|---|
| `customai.models` | `[]` | Array of configured custom models |
| `customai.providers` | `[]` | Array of provider endpoints |
| `customai.defaultTemperature` | `0.7` | Default response temperature (0–2) |
| `customai.defaultMaxTokens` | `4096` | Default max tokens per response |
| `customai.debug` | `false` | Enable debug logging |

---

## ❓ FAQ

**Q: My models are not showing up in the Copilot Chat picker?**

- Make sure the extension is installed and **enabled**
- Check your `customai.models` configuration
- Try **Reload Window** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *Developer: Reload Window*)

**Q: API requests are failing?**

- Verify your **API Key** is correct
- Confirm the **Base URL** is accessible from your network
- Ensure the **model name** is valid for your provider

**Q: How do I use a local model via Ollama?**

1. Make sure Ollama is running: `ollama serve`
2. Use Base URL `http://localhost:11434/v1` — no API key needed
3. Enter your Ollama model name (e.g. `llama3.2`)

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package VSIX
npm run build
```

---

## 📄 License

[MIT](LICENSE)
