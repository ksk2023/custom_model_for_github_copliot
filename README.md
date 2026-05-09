# Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

---

## Features

- **Custom Model Support** - Add any OpenAI-compatible API to GitHub Copilot Chat model picker
- **Multi-Provider Support** - Chinese providers (Step, Zhipu, Moonshot, DeepSeek, Baichuan, Yi), OpenAI, Anthropic, Ollama, etc.
- **Dynamic Model Fetching** - Automatically fetch available models from API endpoint
- **Visual Configuration** - Easy setup through VS Code settings panel
- **Quick Add** - Preset templates for popular providers

## Supported Providers

| Provider | Base URL | Example Models |
|----------|----------|----------------|
| 阶跃星辰 (Step) | `https://api.stepfun.com/v1` | Step-1.5V, Step-2 |
| 智谱 AI (GLM) | `https://open.bigmodel.cn/api/paas/v4` | GLM-4 |
| 月之暗面 (Moonshot) | `https://api.moonshot.cn/v1` | moonshot-v1-8k/32k/128k |
| DeepSeek | `https://api.deepseek.com/v1` | DeepSeek-V3, DeepSeek-R1 |
| 百川 (Baichuan) | `https://api.baichuan-ai.com/v1` | Baichuan4 |
| 零一万物 (Yi) | `https://api.lingyiwanwu.com/v1` | yi-large, yi-medium |
| OpenAI | `https://api.openai.com/v1` | GPT-4o, GPT-4 |
| Anthropic | `https://api.anthropic.com/v1` | Claude 3.5 Sonnet |
| Ollama | `http://localhost:11434/v1` | Llama, Mistral |
| Custom | Any OpenAI-compatible API | Varies |

## Installation

1. Download the `.vsix` file from [Releases](https://github.com/ksk2023/custom_model_for_github_copliot/releases)
2. Install in VS Code:
   ```bash
   code --install-extension custom-copilot-chat-1.0.9.vsix
   ```
3. Or double-click the `.vsix` file in VS Code

## Quick Start

1. Press `Ctrl+Shift+P` → type "Custom AI: Quick Add Model"
2. Select a provider (e.g., 阶跃星辰)
3. Enter Base URL and API Key
4. Click "获取可用模型列表" to fetch available models
5. Select models from the dropdown
6. Open Copilot Chat and select your model

## Configuration

### Method 1: Config Panel

1. Press `Ctrl+Shift+P` → "Custom AI: Open Config"
2. Click "+ 添加模型"
3. Fill in provider, Base URL, API Key
4. Click "获取可用模型列表" to fetch models
5. Select and save

### Method 2: Settings JSON

```json
{
  "customai.models": [
    {
      "id": "1234567890",
      "name": "My GPT-4",
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-...",
      "modelName": "gpt-4-turbo-preview",
      "enabled": true
    }
  ]
}
```

## Usage

1. **Open Copilot Chat** - Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)
2. **Select Model** - Choose your configured model from the model dropdown
3. **Start Chatting** - Chat normally like with Copilot

## FAQ

**Q: Models not showing in picker?**
- Make sure the extension is installed and enabled
- Check `customai.models` configuration
- Try reloading VS Code window

**Q: API request failed?**
- Verify API Key is correct
- Check if Base URL is accessible
- Confirm model name is valid

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package vsix
npm run build
```

## License

MIT
