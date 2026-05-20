# 🚀 Custom Copilot Chat

[English](./README.md) | [中文](./README_zh.md)

![VS Code](https://img.shields.io/badge/VS%20Code-%23007ACC?style=flat&logo=visual-studio-code&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.21-blue?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC?style=flat&logo=typescript&logoColor=white)

---

## ✨ 功能特性

<table>
  <tr>
    <td width="50%">

### 🧩 多提供商支持

支持所有 **OpenAI 兼容 API**，包括 OpenAI、Anthropic、Ollama 等任意接口。

### 🇨🇳 国内模型开箱即用

内置阶跃星辰、智谱AI、月之暗面、DeepSeek、百川、零一万物等国内主流大模型预设。

### 🔄 动态获取模型

填入 Base URL 和 API Key → 点击 **"获取可用模型"** → 多端点尝试并解析中转站嵌套返回，尽量拉全模型列表。

### 🎨 可视化配置

全部通过 VS Code Webview 面板完成配置，无需手动编辑 JSON 文件。

### 🧬 指纹管理

每个供应商可新增、编辑、删除并启用指纹 Header，适配需要设备指纹或会话指纹的中转站/本地反代。

### ⚡ 快速添加模板

每个内置提供商均有一键快捷模板，数秒内完成配置。

    </td>
    <td>

### 🛡️ 双层架构

`提供商 → 模型` 两层配置。一个提供商可管理多个模型，各自拥有独立的温度、Token 上限等参数。

### 🌡️ 逐模型温度控制

每款模型可单独设置 `temperature` 和 `maxTokens`，灵活覆盖全局默认值。

### 🔑 安全密钥存储

API Key 通过 VS Code 原生 `secretStorage` 加密保存，不落盘明文。

### 🔄 配置变更自动重载

保存配置后扩展自动感知变更并刷新模型列表，无需手动重启。

    </td>
  </tr>
</table>

---

## 📦 支持的提供商

| 提供商 | Base URL | 示例模型 |
|---|---|---|
| 🟦 **阶跃星辰** Step | `https://api.stepfun.com/v1` | step-3.5-flash-2603、step-3.5-flash |
| 🟩 **智谱 AI** GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-5.1、glm-5、glm-5-turbo |
| 🟧 **月之暗面** Moonshot | `https://api.moonshot.cn/v1` | kimi-k2.6、kimi-k2.5、moonshot-v1-128k |
| 🔴 **DeepSeek** | `https://api.deepseek.com/v1` | deepseek-v4-pro、deepseek-v4-flash |
| 🟫 **百川** Baichuan | `https://api.baichuan-ai.com/v1` | Baichuan4、Baichuan4-Air |
| 🟨 **零一万物** Yi | `https://api.lingyiwanwu.com/v1` | yi-lightning、yi-large、yi-medium |
| ⬛ **OpenAI** | `https://api.openai.com/v1` | gpt-4.1、gpt-4o、o3 |
| 🟪 **Anthropic** | `https://api.anthropic.com/v1` | claude-sonnet-4、claude-3.5-sonnet |
| 🐪 **Ollama** | `http://localhost:11434/v1` | llama3.2、qwen2.5、deepseek-r1 |
| 🔗 **自定义** | 任意 OpenAI 兼容 API | 视接口而定 |

---

## 📥 安装

### 方式一：VSIX（推荐）

1. 从 [Releases](https://github.com/ksk2023/custom_model_for_github_copliot/releases) 下载最新 `.vsix` 文件
2. 打开 VS Code → **扩展面板**（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>）
3. 点击 **⋯** 菜单 → **从 VSIX 安装...**
4. 选择下载的文件

同一个 VSIX 同时支持本地 Windows、本地 Linux、WSL 和远程 Linux 扩展主机。

### 方式二：命令行

```bash
code --install-extension custom-copilot-chat-1.1.18.vsix
```

如果要安装到 WSL 或远程 Linux，请在已经连接到该环境的 VS Code 窗口里运行安装命令，或者使用：

```bash
code --remote wsl+Ubuntu --install-extension custom-copilot-chat-1.1.18.vsix
```

---

## ⚡ 快速开始

### 1. 添加模型

按 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → **"Custom AI: Quick Add Model"**

然后：
- 选择 **提供商**（如阶跃星辰）
- 填入 **Base URL** 和 **API Key**
- 点击 **"获取可用模型列表"**
- 勾选模型 → **保存**

### 2. 在 Copilot Chat 中使用

打开 Copilot Chat（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>）→ 在**模型下拉菜单**选择你添加的模型 → 开始对话。

---

## ⚙️ 配置说明

### 方式一：配置面板（推荐）

1. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → **"Custom AI: Open Config"**
2. 点击 **+ 添加模型**
3. 选择提供商，填入 URL 和密钥
4. 点击 **获取可用模型列表**
5. 选择模型并 **保存**

### 方式二：设置 JSON

```json
{
  "customai.models": [
    {
      "id": "model-001",
      "name": "我的 GPT-4o",
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

## 🔧 配置项说明

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `customai.models` | `[]` | 已配置的自定义模型列表 |
| `customai.providers` | `[]` | 提供商端点列表 |
| `customai.defaultTemperature` | `0.7` | 默认回复温度（0–2） |
| `customai.defaultMaxTokens` | `4096` | 默认单次最大 Token 数 |
| `customai.debug` | `false` | 开启调试日志 |

---

## ❓ 常见问题

**Q: 模型没有出现在 Copilot Chat 选择器中？**

- 确认扩展已**安装并启用**
- 检查 `customai.models` 配置是否正确
- 尝试**重载窗口**（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *Developer: Reload Window*）

**Q: API 请求失败？**

- 核对 **API Key** 是否正确
- 确认 **Base URL** 网络可访问
- 检查**模型名称**是否该提供商支持的

**Q: 如何使用 Ollama 本地模型？**

1. 确保 Ollama 正在运行：`ollama serve`
2. 使用 Base URL `http://localhost:11434/v1` — 无需 API Key
3. 填写本地模型名称（如 `llama3.2`）

---

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 打包 VSIX
npm run build
```

---

## 📄 许可证

[MIT](LICENSE)
