# 🚀 Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

![VS Code](https://img.shields.io/badge/VS%20Code-%23007ACC?style=flat&logo=visual-studio-code&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.31-blue?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC?style=flat&logo=typescript&logoColor=white)

Custom Copilot Chat 可以让 GitHub Copilot Chat 使用 OpenAI 兼容 API、中转站、本地反代、Anthropic 兼容端点和 Ollama 本地服务里的自定义模型。

这个扩展的重点不只是“能聊天”，而是深度适配 Copilot：它会规范化中转站响应、把工具调用桥接成 VS Code Copilot 工具调用，并在侧边栏提供供应商、模型、预设和指纹管理界面。

---

## ✨ 1.1.31 更新

- **模型删除更可靠**：单个模型删除现在走扩展宿主的专用删除逻辑，不再依赖“保存剩余列表”的间接路径。
- **批量清理模型**：供应商模型列表新增 **删除未勾选**，可以先取消勾选一批不需要的中转站模型，再一次性删除。
- **手动添加解析增强**：手动输入模型时支持英文逗号、中文逗号、换行、分号和中文顿号拆分。
- **供应商模型折叠**：每个供应商的模型列表都可以折叠/展开，几百个模型也不会撑满页面。

---

## ✨ 功能特性

| 能力 | 说明 |
|---|---|
| 🧩 多供应商支持 | 支持 OpenAI 兼容 API、中转站、本地反代、Anthropic 端点、Ollama 和自定义主机。 |
| 🧠 Copilot 工具调用桥接 | 将 OpenAI `tool_calls`、旧版 `function_call`、Responses API 函数调用和 Anthropic `tool_use` 转换为 VS Code Copilot 工具调用。 |
| 🧼 中转站输出清理 | 过滤空流片段、`[DONE]`、协议事件行、HTML 页面，以及不应作为正文显示的工具参数增量。 |
| 🔄 模型获取 | 尝试中转站友好的 `/models` 端点，解析常见嵌套返回，并过滤 `success`、`object` 等非模型字段。 |
| ✍️ 手动模型 | 当中转站隐藏模型或模型列表不完整时，可以手动添加模型 ID。 |
| 📦 预设导入 | 可从侧边栏导入 GPT、Gemini、Claude、DeepSeek 等常用模型预设。 |
| 🧬 指纹管理 | 每个供应商可新增、编辑、删除并启用指纹 Header，适配需要会话/设备指纹的中转站或本地反代。 |
| 🎛️ 侧边栏设置 | 在 Custom AI 活动栏视图中添加供应商、获取模型、编辑模型、删除模型、导入预设和管理指纹。 |
| 🌉 WSL/本地支持 | 同一个 VSIX 支持本地 Windows、本地 Linux、WSL 和远程 Linux 扩展主机。 |

---

## 📦 支持的供应商

| 供应商类型 | Base URL 示例 | 说明 |
|---|---|---|
| OpenAI 兼容中转站 | `https://api.example.com` 或 `https://api.example.com/v1` | 自动规范化 host root、`/v1` 和 `/v1/chat/completions` 输入。 |
| 本地反代 | `http://127.0.0.1:58486/v1` | 适合在 VS Code、WSL 或 Remote 中调用 Windows 主机上的本地 API。 |
| OpenAI | `https://api.openai.com/v1` | 使用账号或代理暴露的 OpenAI 兼容 Chat Completions 模型。 |
| Anthropic 原生 | `https://api.anthropic.com/v1` | 仅官方 Anthropic 风格 `/messages` 端点会走 Anthropic 协议。 |
| Ollama | `http://localhost:11434/v1` | 通常无需 API Key。 |
| 自定义 | 任意兼容端点 | 如果 `/models` 不完整，可使用手动模型或预设。 |

常用预设族包括 GPT、Gemini、Claude、DeepSeek、Qwen、Kimi、GLM、Step、Baichuan、Yi，以及其他中转站暴露的 OpenAI 兼容模型 ID。

---

## 📥 安装

### 方式一：从 GitHub Releases 下载

1. 打开 [Latest Release](https://github.com/ksk2023/custom_model_for_github_copliot/releases/latest)。
2. 下载 `custom-copilot-chat-1.1.31.vsix`。
3. 在 VS Code 中打开 **扩展面板**（`Ctrl+Shift+X`）。
4. 选择 **⋯ → 从 VSIX 安装...**，然后选择下载的文件。

### 方式二：命令行安装

安装到当前本地 VS Code 扩展主机：

```bash
code --install-extension custom-copilot-chat-1.1.31.vsix
```

安装到 WSL 扩展主机：

```bash
code --remote wsl+Ubuntu --install-extension custom-copilot-chat-1.1.31.vsix
```

如果是 Remote SSH 或远程 Linux，请在已经连接到该环境的 VS Code 窗口中运行安装命令，确保扩展安装到远程扩展主机。

---

## ⚡ 快速开始

1. 从 VS Code 活动栏打开 **Custom AI**，或在命令面板运行 **Custom AI: Open Config**。
2. 点击 **添加供应商**，或编辑已有供应商。
3. 填写 **Base URL**：
   - 中转站 host root：`https://api.example.com`
   - 中转站 `/v1`：`https://api.example.com/v1`
   - 完整聊天端点：`https://api.example.com/v1/chat/completions`
   - 本地反代：`http://127.0.0.1:58486/v1`
4. 按需填写 **API Key**。
5. 点击 **获取模型**。如果中转站没有暴露完整模型列表，使用 **+ 模型** 或 **导入预设**。
6. 启用你希望出现在 Copilot Chat 里的模型。
7. 打开 Copilot Chat，在模型选择器中选择自定义模型。

---

## 🧠 中转站与工具调用兼容

很多中转站会把 Claude、Gemini、DeepSeek 或 GPT 类模型包装成 OpenAI 兼容 API。它们的返回格式通常“接近 OpenAI”，但并不完全一致。这个扩展会适配常见变体，让 Copilot 仍然可以调用读取文件、工作区搜索等 VS Code 提供的工具。

### 请求侧规范化

- 对中转站发送 OpenAI 兼容的 `messages` 和 `tools`。
- Claude 命名的中转站模型默认仍走 OpenAI 兼容路径，除非端点是官方 Anthropic `/messages`。
- 将 host root 或 `/v1` 规范化到 `/v1/chat/completions`。
- 尽可能将模型列表 URL 规范化到 `/v1/models`。
- 支持流式、非流式和本地兼容模式。

### 响应侧规范化

- 将助手文本流式输出为 `LanguageModelTextPart`。
- 累积被拆分的 `delta.tool_calls[*].function.arguments`，并发出合法 Copilot 工具调用。
- 支持旧版 OpenAI `function_call` 片段。
- 支持 OpenAI Responses API 风格的函数调用输出项。
- 支持 Anthropic 原生 `tool_use` 块和工具输入增量。
- 当中转站没有返回 `finish_reason: "tool_calls"` 时，也会在流结束时刷新待处理工具调用。
- 纯工具调用、没有助手文本的响应也会被视为合法响应。

### 边界说明

- 上游模型或中转站必须返回机器可读的工具/函数调用。普通文本里写“我要调用工具”无法转换成真正的 Copilot 工具调用。
- 扩展会过滤协议级噪音，但如果中转站把广告、隐藏提示词或策略文本作为正常助手正文输出，扩展无法可靠判断并删除。
- 如果中转站返回 HTML 应用页面而不是 JSON，通常说明 Base URL 指向了网站前端，而不是 API 端点。

---

## 🧬 指纹管理

部分本地反代或中转站需要会话、设备或账号指纹。每个供应商可以保存多个指纹，并一次启用其中一个。

默认指纹 Header 是：

```text
X-Fingerprint: your-fingerprint-value
```

也支持在指纹值中填写高级 Header JSON，例如：

```json
{
  "X-Fingerprint": "your-fingerprint",
  "X-Device-Id": "your-device-id"
}
```

启用后的指纹会同时应用到聊天请求和该供应商的模型获取请求。

---

## ⚙️ 配置项说明

| 配置项 | 默认值 | 说明 |
|---|---:|---|
| `customai.providers` | `[]` | 供应商端点，包含 `baseUrl`、`apiKey` 和可选指纹。 |
| `customai.models` | `[]` | 显示在 Copilot Chat 中的模型，每个模型属于一个供应商。 |
| `customai.defaultTemperature` | `0.7` | 模型未单独覆盖时的默认温度。 |
| `customai.defaultMaxTokens` | `4096` | 模型未单独覆盖时的默认最大 Token 值。 |
| `customai.streamMode` | `auto` | `auto`、`stream` 或 `non-stream`。 |
| `customai.localEndpointHosts` | `[]` | WSL 或远程环境下，本地端点失败时额外尝试的 host/IP。 |
| `customai.localCompatibilityMode` | `auto` | 本地反代请求兼容模式：`auto`、`full` 或 `minimal`。 |
| `customai.debug` | `false` | 在 **Custom AI** 输出通道开启详细日志。 |

设置示例：

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

API Key 会在界面中做遮罩显示，但实际保存在 VS Code 扩展设置中。不要分享包含供应商凭据的导出设置文件。

---

## 🧪 推荐配置组合

| 场景 | 推荐设置 |
|---|---|
| OpenAI 兼容中转站 | `streamMode: auto`，供应商 Base URL 填 host root 或 `/v1`。 |
| 中转站流式不稳定 | 尝试 `streamMode: non-stream`；纯工具调用的非流式响应也受支持。 |
| WSL 调用 Windows 本地反代 | 优先使用 `http://127.0.0.1:58486/v1`；必要时在 `customai.localEndpointHosts` 加 host fallback。 |
| `/models` 返回不完整 | 使用 **+ 模型** 或 **导入预设**；模型获取失败不代表聊天不可用。 |
| Claude 模型通过 OpenAI 中转站 | 保持供应商为 OpenAI 兼容/自定义；除非端点是 Anthropic 原生，否则不会强行切 Anthropic 协议。 |

---

## ❓ 常见问题

**Q: `/v1/models` 返回 502，但 curl 聊天正常，怎么办？**

使用 **+ 模型** 或 **导入预设**。有些中转站不会稳定代理模型列表请求，但聊天接口仍然可用。

**Q: 为什么遇到带 `delta.tool_calls` 的流式响应会报 `unsupported stream format`？**

请安装 `1.1.29` 或更高版本。纯工具调用流式响应现在会被视为合法响应，并转换成 Copilot 工具调用。

**Q: 为什么模型列表里出现 `success` 或 `object`？**

请使用 `1.1.29` 或更高版本。模型获取逻辑会过滤常见元数据字段，并从嵌套中转站响应里提取模型 ID。

**Q: 为什么导入预设或获取模型时出现 HTML？**

Base URL 指向了网站前端，或中转站返回了登录/应用页面。请改用 API host root、`/v1` 或 `/v1/chat/completions` 端点。

**Q: 扩展能去掉上游提示词污染吗？**

它会清理协议级噪音和工具参数泄漏，但无法安全删除上游模型作为普通助手正文输出的任意文本。

---

## 🛠️ 开发

```bash
npm install
npm run compile
npm run build
```

`npm run build` 会编译 TypeScript 并打包 VSIX。

---

## 📄 许可证

[MIT](LICENSE)
