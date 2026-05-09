# Custom Copilot Chat

Add custom AI models to GitHub Copilot Chat. Configure your own API endpoints, API keys, and models with an easy-to-use visual interface.

## Features

- **Visual Model Configuration** - Add, edit, and manage custom AI models through a sidebar panel
- **Multiple Provider Support** - OpenAI, Anthropic (Claude), Ollama, LM Studio, and any OpenAI-compatible API
- **Quick Add Templates** - One-click setup for popular AI providers
- **Toggle Models** - Enable/disable models without deleting configuration
- **Secure Storage** - API keys stored securely in VS Code workspace settings

## Installation

1. Install the `.vsix` file:
   ```bash
   code --install-extension custom-copilot-chat-1.0.0.vsix
   ```

2. Or double-click the `.vsix` file in VS Code

## Usage

### Step 1: Configure a Model

1. Open VS Code Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type **"Custom AI: Open Config"** or click the **"Custom AI Config"** view in the sidebar
3. Click **"+ Add Model"**
4. Fill in the details:
   - **Model Name**: A friendly name (e.g., "My GPT-4")
   - **Provider**: Select your AI provider
   - **Base URL**: The API endpoint URL
   - **API Key**: Your API key
   - **Model Name**: The specific model to use

### Step 2: Enable the Model

Toggle the switch next to your model to enable it.

### Step 3: Start Chatting

Open GitHub Copilot Chat and talk to your custom model!

## Supported Providers

| Provider | Base URL | Model Example |
|----------|----------|---------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4-turbo-preview` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-3-sonnet-20240229` |
| Ollama | `http://localhost:11434/v1` | `llama2` |
| LM Studio | `http://localhost:1234/v1` | `local-model` |
| Custom | Any OpenAI-compatible API | Varies |

## Quick Add Templates

The extension includes quick-add buttons for popular providers:
- **OpenAI** - GPT-4, GPT-3.5 Turbo
- **Anthropic** - Claude 3 Sonnet, Opus, Haiku
- **Ollama** - Local LLMs (Llama2, Mistral, etc.)
- **LM Studio** - Local models via LM Studio
- **Custom API** - Any OpenAI-compatible endpoint

## Configuration

Models are stored in VS Code workspace settings under `customCopilot.models`.

Example configuration:
```json
{
  "customCopilot.models": [
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

## Requirements

- VS Code 1.99.0 or later
- GitHub Copilot Chat extension
- Internet connection (for cloud APIs)
- API key from your AI provider

## Troubleshooting

**Model not responding?**
- Verify your API key is correct
- Check the Base URL is accessible
- Ensure the model name exists for your provider
- Make sure the model is enabled (toggle is on)

**Connection errors?**
- Check your firewall/proxy settings
- Verify the API endpoint URL is correct
- Some providers require specific regional endpoints

## License

MIT
