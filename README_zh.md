# Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

---

## 功能特性

- **自定义模型支持** - 在 GitHub Copilot Chat 模型选择器中添加任何 OpenAI 兼容的 API
- **国内模型预设** - 阶跃星辰、智谱AI、月之暗面、DeepSeek、百川、零一万物
- **动态获取模型** - 填写 Base URL 和 API Key 后，自动从 API 获取可用模型列表
- **可视化配置** - 通过 VS Code 设置面板轻松配置
- **快速添加** - 常用提供商的预设模板

## 支持的提供商

| 提供商 | Base URL | 示例模型 |
|--------|----------|----------|
| 阶跃星辰 (Step) | `https://api.stepfun.com/v1` | Step-1.5V, Step-2 |
| 智谱 AI (GLM) | `https://open.bigmodel.cn/api/paas/v4` | GLM-4 |
| 月之暗面 (Moonshot) | `https://api.moonshot.cn/v1` | moonshot-v1-8k/32k/128k |
| DeepSeek | `https://api.deepseek.com/v1` | DeepSeek-V3, DeepSeek-R1 |
| 百川 (Baichuan) | `https://api.baichuan-ai.com/v1` | Baichuan4 |
| 零一万物 (Yi) | `https://api.lingyiwanwu.com/v1` | yi-large, yi-medium |
| OpenAI | `https://api.openai.com/v1` | GPT-4o, GPT-4 |
| Anthropic | `https://api.anthropic.com/v1` | Claude 3.5 Sonnet |
| Ollama | `http://localhost:11434/v1` | Llama, Mistral |
| 自定义 | 任何 OpenAI 兼容 API | 不同提供商各异 |

## 安装

1. 从 [Releases](https://github.com/ksk2023/custom_model_for_github_copliot/releases) 下载 `.vsix` 文件
2. 在 VS Code 中安装：
   ```bash
   code --install-extension custom-copilot-chat-1.0.9.vsix
   ```
3. 或者直接在 VS Code 中双击 `.vsix` 文件安装

## 快速开始

1. 按 `Ctrl+Shift+P` → 输入 "Custom AI: Quick Add Model"
2. 选择提供商（如阶跃星辰）
3. 填写 Base URL 和 API Key
4. 点击"获取可用模型列表"自动获取模型
5. 从下拉列表选择要启用的模型
6. 打开 Copilot Chat 选择你的模型

## 配置

### 方式一：配置面板

1. 按 `Ctrl+Shift+P` → "Custom AI: Open Config"
2. 点击 "+ 添加模型"
3. 选择提供商，填写 Base URL 和 API Key
4. 点击"获取可用模型列表"
5. 选择模型并保存

### 方式二：设置 JSON

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
    }
  ]
}
```

## 使用方法

1. **打开 Copilot Chat** - 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Shift+I` (Mac)
2. **选择模型** - 在模型下拉菜单中选择你配置的模型
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
