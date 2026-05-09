# Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

---

## 功能特性

- **自定义模型支持** - 在 GitHub Copilot Chat 模型选择器中添加任何 OpenAI 兼容的 API
- **多提供商支持** - OpenAI、Anthropic (Claude)、Ollama、LM Studio 等
- **可视化配置** - 通过 VS Code 设置面板轻松配置 API 端点和密钥
- **零配置快速开始** - 提供常用提供商的预设模板

## 支持的模型类型

| 提供商 | Base URL | 模型示例 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4-turbo-preview` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-3-sonnet-20240229` |
| Ollama | `http://localhost:11434/v1` | `llama2` |
| LM Studio | `http://localhost:1234/v1` | `local-model` |
| 自定义 | 任何 OpenAI 兼容 API | 不同提供商各异 |

## 安装

1. 下载 `.vsix` 文件
2. 在 VS Code 中安装扩展：
   ```bash
   code --install-extension custom-copilot-chat-1.0.0.vsix
   ```
3. 或者直接在 VS Code 中双击 `.vsix` 文件安装

## 配置

### 方式一：通过设置面板

1. 打开 VS Code 设置 (`Ctrl+,`)
2. 搜索 "Custom Copilot Chat"
3. 在 `customai.models` 中添加模型配置

### 方式二：通过命令

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "Custom AI: Open Config"
3. 点击 "Add Model" 添加新模型

### 模型配置示例

```json
{
  "customai.models": [
    {
      "id": "1234567890",
      "name": "我的 GPT-4",
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-...",
      "modelName": "gpt-4-turbo-preview",
      "enabled": true
    },
    {
      "id": "0987654321",
      "name": "我的 Claude",
      "provider": "anthropic",
      "baseUrl": "https://api.anthropic.com/v1",
      "apiKey": "sk-ant-...",
      "modelName": "claude-3-sonnet-20240229",
      "enabled": true
    }
  ]
}
```

## 使用方法

1. **打开 Copilot Chat** - 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Shift+I` (Mac)
2. **选择模型** - 在模型下拉菜单中选择 "Custom AI" 下的你配置的模型
3. **开始对话** - 像使用 Copilot 一样正常对话

## 常见问题

**Q: 模型没有出现在选择器中？**
- 确保已安装并启用了扩展
- 检查 `customai.models` 配置是否正确
- 尝试重新加载 VS Code 窗口

**Q: API 请求失败？**
- 验证 API Key 是否正确
- 检查 Base URL 是否可访问
- 确认模型名称是否有效

## 开发

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 打包 vsix
npm run build
```

## 许可证

MIT
