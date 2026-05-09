import * as vscode from "vscode";
import { CustomAIProvider } from "./provider.js";

let provider: CustomAIProvider | undefined;
let configPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  provider = new CustomAIProvider(context);

  // Register chat participant for setup
  const setupParticipant = vscode.chat.createChatParticipant(
    "customai.setup",
    async (request, context, stream, token) => {
      const prompt = request.prompt.toLowerCase();

      if (prompt.includes("add") || prompt.includes("添加") || prompt.includes("配置")) {
        stream.markdown(`# 添加自定义模型

请选择一个选项来添加模型：

1. **OpenAI** - GPT-4, GPT-3.5
2. **Anthropic** - Claude 3
3. **Ollama** - 本地模型
4. **LM Studio** - 本地模型
5. **自定义 API** - 任何 OpenAI 兼容 API

或者点击按钮直接添加：

- 运行命令 **"Custom AI: Quick Add Model"** 快速添加
- 运行命令 **"Custom AI: Open Config"** 打开配置面板
`);
        return;
      }

      stream.markdown(`# Custom AI Setup

To add a model, run the command:
\`Custom AI: Add Model\` or \`Custom AI: Quick Add Model\`

You can also open the config panel with:
\`Custom AI: Open Config\`
`);
    }
  );

  context.subscriptions.push(setupParticipant);

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.openConfig", () => {
      showConfigPanel(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModel", () => {
      showConfigPanel(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModelQuick", async () => {
      await quickAddModel();
    })
  );

  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider("customai", provider)
  );

  provider.refreshModelPicker();
}

async function quickAddModel(): Promise<void> {
  const items: vscode.QuickPickItem[] = [
    { label: "$(gear) OpenAI", description: "GPT-4, GPT-3.5 Turbo", alwaysShow: true },
    { label: "$(gear) Anthropic (Claude)", description: "Claude 3 Sonnet, Opus, Haiku", alwaysShow: true },
    { label: "$(gear) Ollama", description: "本地模型 (Llama2, Mistral等)", alwaysShow: true },
    { label: "$(gear) LM Studio", description: "本地模型 via LM Studio", alwaysShow: true },
    { label: "$(gear) 自定义 API", description: "任何 OpenAI 兼容 API", alwaysShow: true },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择要添加的模型提供商",
    title: "快速添加自定义模型",
    matchOnDescription: true,
  });

  if (!selected) return;

  const providerMap: Record<string, string> = {
    "openai": "openai",
    "anthropic": "anthropic",
    "ollama": "ollama",
    "lm studio": "lmstudio",
    "自定义 api": "custom",
  };

  const selectedProvider = providerMap[selected.label.toLowerCase().replace(/^\$\(gear\)\s*/, "")] || "custom";

  const defaults: Record<string, { baseUrl: string; modelName: string }> = {
    openai: { baseUrl: "https://api.openai.com/v1", modelName: "gpt-4-turbo-preview" },
    anthropic: { baseUrl: "https://api.anthropic.com/v1", modelName: "claude-3-sonnet-20240229" },
    ollama: { baseUrl: "http://localhost:11434/v1", modelName: "llama2" },
    lmstudio: { baseUrl: "http://localhost:1234/v1", modelName: "local-model" },
    custom: { baseUrl: "", modelName: "" },
  };

  const d = defaults[selectedProvider] || defaults.custom;
  const displayName = selected.label.replace(/^\$\(gear\)\s*/, "");

  const name = await vscode.window.showInputBox({
    prompt: "输入模型显示名称",
    value: displayName,
    validateInput: (value) => (value.trim() ? null : "名称不能为空"),
  });

  if (!name) return;

  const baseUrl = await vscode.window.showInputBox({
    prompt: "输入 Base URL",
    value: d.baseUrl,
    validateInput: (value) => (value.trim() ? null : "URL 不能为空"),
  });

  if (!baseUrl) return;

  const modelName = await vscode.window.showInputBox({
    prompt: "输入模型名称",
    value: d.modelName,
    validateInput: (value) => (value.trim() ? null : "模型名称不能为空"),
  });

  if (!modelName) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: "输入 API Key（可选）",
    password: true,
  });

  const model = {
    id: Date.now().toString(),
    name: name.trim(),
    provider: selectedProvider,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey?.trim() || "",
    modelName: modelName.trim(),
    enabled: true,
  };

  const config = vscode.workspace.getConfiguration("customai");
  const models = config.get<any[]>("models", []) || [];
  models.push(model);
  
  const target = vscode.workspace.workspaceFolders 
    ? vscode.ConfigurationTarget.Workspace 
    : vscode.ConfigurationTarget.Global;
  await config.update("models", models, target);

  provider?.refreshModelPicker();

  vscode.window.showInformationMessage(`模型 "${name}" 已添加！请在 Copilot Chat 中选择使用。`);
}

function showConfigPanel(context: vscode.ExtensionContext): void {
  if (configPanel) {
    configPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  configPanel = vscode.window.createWebviewPanel(
    "customai.config",
    "Custom AI 配置",
    vscode.ViewColumn.One,
    {
      retainContextWhenHidden: true,
      enableScripts: true,
    }
  );

  configPanel.webview.html = getConfigHtml();

  configPanel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case "getModels":
        const models = getModels();
        configPanel?.webview.postMessage({ type: "models", models });
        break;
      case "saveModel":
        await saveModel(message.model);
        provider?.refreshModelPicker();
        break;
      case "deleteModel":
        await deleteModel(message.id);
        provider?.refreshModelPicker();
        break;
      case "openSettings":
        vscode.commands.executeCommand("workbench.action.openSettings", "customai.models");
        break;
    }
  });

  configPanel.onDidDispose(() => {
    configPanel = undefined;
  });
}

function getModels(): any[] {
  const config = vscode.workspace.getConfiguration("customai");
  return config.get<any[]>("models", []);
}

async function saveModel(model: any): Promise<void> {
  const config = vscode.workspace.getConfiguration("customai");
  const models = getModels();

  if (model.id) {
    const index = models.findIndex((m: any) => m.id === model.id);
    if (index !== -1) {
      models[index] = model;
    }
  } else {
    model.id = Date.now().toString();
    model.enabled = true;
    models.push(model);
  }

  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("models", models, target);
  configPanel?.webview.postMessage({ type: "models", models });
}

async function deleteModel(id: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("customai");
  const models = getModels().filter((m: any) => m.id !== id);
  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("models", models, target);
  configPanel?.webview.postMessage({ type: "models", models });
}

function getConfigHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    h2 { font-size: 16px; }
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-danger { background: #f14c4c; color: white; }
    .model-card {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .model-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .model-name { font-weight: 600; font-size: 14px; }
    .model-provider { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
    .model-info { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 6px; word-break: break-all; }
    .model-actions { display: flex; gap: 8px; margin-top: 10px; }
    .btn-sm { padding: 4px 8px; font-size: 11px; }
    .empty { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
    .quick-add {
      display: flex;
      gap: 8px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    .provider-btn {
      padding: 6px 12px;
      font-size: 11px;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
    }
    .provider-btn:hover { border-color: var(--vscode-focusBorder); }
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      justify-content: center;
      align-items: center;
    }
    .modal.show { display: flex; }
    .modal-content {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      width: 450px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      padding: 15px;
      border-bottom: 1px solid var(--vscode-widget-border);
      font-weight: 600;
    }
    .modal-body { padding: 15px; }
    .form-group { margin-bottom: 12px; }
    .form-group label {
      display: block;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
    }
    .form-group input, .form-group select {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      color: var(--vscode-input-foreground);
    }
    .modal-footer {
      padding: 12px 15px;
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Custom AI 模型配置</h2>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" onclick="showAddModal()">+ 添加模型</button>
      <button class="btn btn-primary" onclick="openSettings()">编辑 JSON</button>
    </div>
  </div>

  <div class="quick-add">
    <button class="provider-btn" onclick="quickAdd('openai')">OpenAI</button>
    <button class="provider-btn" onclick="quickAdd('anthropic')">Anthropic</button>
    <button class="provider-btn" onclick="quickAdd('ollama')">Ollama</button>
    <button class="provider-btn" onclick="quickAdd('lmstudio')">LM Studio</button>
    <button class="provider-btn" onclick="quickAdd('custom')">自定义</button>
  </div>

  <div id="modelsList"></div>

  <div class="modal" id="modal">
    <div class="modal-content">
      <div class="modal-header" id="modalTitle">添加模型</div>
      <div class="modal-body">
        <div class="form-group">
          <label>显示名称</label>
          <input type="text" id="modelName" placeholder="我的 GPT-4">
        </div>
        <div class="form-group">
          <label>提供商</label>
          <select id="modelProvider" onchange="onProviderChange()">
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="ollama">Ollama</option>
            <option value="lmstudio">LM Studio</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div class="form-group">
          <label>Base URL</label>
          <input type="text" id="baseUrl" placeholder="https://api.openai.com/v1">
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input type="password" id="apiKey" placeholder="sk-...">
        </div>
        <div class="form-group">
          <label>模型名称</label>
          <input type="text" id="modelName2" placeholder="gpt-4-turbo-preview">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="hideModal()">取消</button>
        <button class="btn btn-primary" onclick="saveModel()" id="saveBtn">添加</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let models = [];
    let editingId = null;

    const defaults = {
      openai: { baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4-turbo-preview' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', modelName: 'claude-3-sonnet-20240229' },
      ollama: { baseUrl: 'http://localhost:11434/v1', modelName: 'llama2' },
      lmstudio: { baseUrl: 'http://localhost:1234/v1', modelName: 'local-model' },
      custom: { baseUrl: '', modelName: '' }
    };

    vscode.postMessage({ type: 'getModels' });

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'models') {
        models = message.models || [];
        renderModels();
      }
    });

    function renderModels() {
      const list = document.getElementById('modelsList');
      if (models.length === 0) {
        list.innerHTML = '<div class="empty">暂无配置模型<br><br><button class="btn btn-primary" onclick="showAddModal()">+ 添加第一个模型</button></div>';
        return;
      }
      list.innerHTML = models.map(m => \`
        <div class="model-card">
          <div class="model-header">
            <div>
              <div class="model-name">\${m.name}</div>
              <div class="model-provider">\${m.provider} / \${m.modelName}</div>
            </div>
          </div>
          <div class="model-info">URL: \${m.baseUrl}</div>
          <div class="model-actions">
            <button class="btn btn-primary btn-sm" onclick="editModel('\${m.id}')">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteModel('\${m.id}')">删除</button>
          </div>
        </div>
      \`).join('');
    }

    function showAddModal() {
      editingId = null;
      document.getElementById('modalTitle').textContent = '添加模型';
      document.getElementById('saveBtn').textContent = '添加';
      document.getElementById('modelName').value = '';
      document.getElementById('modelProvider').value = 'openai';
      document.getElementById('baseUrl').value = '';
      document.getElementById('apiKey').value = '';
      document.getElementById('modelName2').value = '';
      document.getElementById('modal').classList.add('show');
    }

    function editModel(id) {
      const model = models.find(m => m.id === id);
      if (!model) return;
      editingId = id;
      document.getElementById('modalTitle').textContent = '编辑模型';
      document.getElementById('saveBtn').textContent = '保存';
      document.getElementById('modelName').value = model.name;
      document.getElementById('modelProvider').value = model.provider;
      document.getElementById('baseUrl').value = model.baseUrl;
      document.getElementById('apiKey').value = model.apiKey || '';
      document.getElementById('modelName2').value = model.modelName;
      document.getElementById('modal').classList.add('show');
    }

    function hideModal() {
      document.getElementById('modal').classList.remove('show');
    }

    function onProviderChange() {
      const provider = document.getElementById('modelProvider').value;
      const d = defaults[provider];
      if (d) {
        if (!document.getElementById('baseUrl').value) {
          document.getElementById('baseUrl').value = d.baseUrl;
        }
        if (!document.getElementById('modelName2').value) {
          document.getElementById('modelName2').value = d.modelName;
        }
      }
    }

    function quickAdd(provider) {
      const d = defaults[provider];
      document.getElementById('modelProvider').value = provider;
      document.getElementById('baseUrl').value = d.baseUrl;
      document.getElementById('modelName2').value = d.modelName;
      document.getElementById('modelName').value = provider.charAt(0).toUpperCase() + provider.slice(1);
      document.getElementById('modal').classList.add('show');
    }

    function saveModel() {
      const name = document.getElementById('modelName').value.trim();
      const provider = document.getElementById('modelProvider').value;
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value;
      const modelName = document.getElementById('modelName2').value.trim();

      if (!name || !baseUrl || !modelName) {
        alert('请填写所有必填字段');
        return;
      }

      vscode.postMessage({
        type: 'saveModel',
        model: { id: editingId, name, provider, baseUrl, apiKey, modelName }
      });

      hideModal();
    }

    function deleteModel(id) {
      if (confirm('确定要删除这个模型吗？')) {
        vscode.postMessage({ type: 'deleteModel', id });
      }
    }

    function openSettings() {
      vscode.postMessage({ type: 'openSettings' });
    }
  </script>
</body>
</html>`;
}

export function deactivate(): void {
  provider?.prepareForDeactivate();
  configPanel?.dispose();
}
