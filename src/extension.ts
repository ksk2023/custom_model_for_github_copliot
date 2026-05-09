import * as vscode from "vscode";
import { CustomAIProvider } from "./provider.js";
import { initLogger, log } from "./logger.js";

let provider: CustomAIProvider | undefined;
let configPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  initLogger();
  log("Extension activating...");

  provider = new CustomAIProvider(context);
  log("CustomAIProvider created");

  const models = getModels();
  log(`Found ${models.length} models in config`);

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
    vscode.commands.registerCommand("customai.listModels", async () => {
      const models = getModels();
      if (models.length === 0) {
        vscode.window.showInformationMessage("没有配置任何模型。请使用 'Custom AI: Quick Add Model' 添加。");
      } else {
        const list = models.map(m => `• ${m.name} (${m.provider}) - ${m.modelName}`).join("\n");
        vscode.window.showInformationMessage(`已配置 ${models.length} 个模型:\n${list}`, { modal: true });
      }
    })
  );

  log("Registering language model chat provider...");
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider("customai", provider!)
  );
  log("Provider registered successfully");

  log("Calling refreshModelPicker...");
  provider!.refreshModelPicker();
  log("Activation complete");
}

async function quickAddModel(): Promise<void> {
  const items: vscode.QuickPickItem[] = [
    { label: "$(star-full) 阶跃星辰 (Step)", description: "Step-1.5V, Step-2 等", alwaysShow: true },
    { label: "$(star-full) 智谱 AI (GLM)", description: "GLM-4, CogVideo 等", alwaysShow: true },
    { label: "$(star-full) 月之暗面 (Moonshot)", description: "moonshot-v1-8k/32k/128k", alwaysShow: true },
    { label: "$(star-full) DeepSeek", description: "DeepSeek-V3, DeepSeek-R1", alwaysShow: true },
    { label: "$(star-full) 百川 (Baichuan)", description: "Baichuan4", alwaysShow: true },
    { label: "$(star-full) 零一万物 (Yi)", description: "yi-large, yi-medium", alwaysShow: true },
    { label: "$(gear) OpenAI", description: "GPT-4o, GPT-4, GPT-3.5", alwaysShow: true },
    { label: "$(gear) Anthropic (Claude)", description: "Claude 3.5 Sonnet, Opus", alwaysShow: true },
    { label: "$(gear) Ollama", description: "本地模型 (Llama, Mistral等)", alwaysShow: true },
    { label: "$(gear) LM Studio", description: "本地模型 via LM Studio", alwaysShow: true },
    { label: "$(gear) 自定义 API", description: "任何 OpenAI 兼容 API", alwaysShow: true },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择要添加的模型提供商",
    title: "快速添加自定义模型",
    matchOnDescription: true,
  });

  if (!selected) return;

  const providerKey = selected.label.replace(/^\$\(star-full\)\s*/, "").replace(/^\$\(gear\)\s*/, "").toLowerCase();

  const defaults: Record<string, { baseUrl: string; apiKeyPlaceholder: string }> = {
    "阶跃星辰 (step)": { baseUrl: "https://api.stepfun.com/v1", apiKeyPlaceholder: "Step API Key" },
    "智谱 ai (glm)": { baseUrl: "https://open.bigmodel.cn/api/paas/v4", apiKeyPlaceholder: "智谱 API Key" },
    "月之暗面 (moonshot)": { baseUrl: "https://api.moonshot.cn/v1", apiKeyPlaceholder: "Moonshot API Key" },
    "deepseek": { baseUrl: "https://api.deepseek.com/v1", apiKeyPlaceholder: "DeepSeek API Key" },
    "百川 (baichuan)": { baseUrl: "https://api.baichuan-ai.com/v1", apiKeyPlaceholder: "百川 API Key" },
    "零一万物 (yi)": { baseUrl: "https://api.lingyiwanwu.com/v1", apiKeyPlaceholder: "零一万物 API Key" },
    "openai": { baseUrl: "https://api.openai.com/v1", apiKeyPlaceholder: "sk-..." },
    "anthropic (claude)": { baseUrl: "https://api.anthropic.com/v1", apiKeyPlaceholder: "sk-ant-..." },
    "ollama": { baseUrl: "http://localhost:11434/v1", apiKeyPlaceholder: "" },
    "lm studio": { baseUrl: "http://localhost:1234/v1", apiKeyPlaceholder: "" },
    "自定义 api": { baseUrl: "", apiKeyPlaceholder: "API Key" },
  };

  const d = defaults[providerKey] || defaults["自定义 api"];

  const baseUrl = await vscode.window.showInputBox({
    prompt: "输入 Base URL",
    value: d.baseUrl,
    validateInput: (value) => (value.trim() ? null : "URL 不能为空"),
  });

  if (!baseUrl) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: "输入 API Key",
    password: true,
    placeHolder: d.apiKeyPlaceholder,
  });

  if (apiKey === undefined) return;

  let selectedModels: string[] = [];
  try {
    const models = await fetchAvailableModels(baseUrl.trim(), apiKey?.trim() || "");
    if (models.length > 0) {
      const picks = await vscode.window.showQuickPick(
        models.map((m) => ({ label: m, picked: true, alwaysShow: true })),
        {
          placeHolder: "勾选要启用的模型（取消勾选则不添加）",
          title: "可用模型列表",
          canPickMany: true,
        }
      );
      if (!picks || picks.length === 0) return;
      selectedModels = picks.map((p) => p.label);
    } else {
      const manualModel = await vscode.window.showInputBox({
        prompt: "未获取到模型列表，请手动输入模型名称",
        placeHolder: "gpt-4-turbo-preview",
      });
      if (!manualModel) return;
      selectedModels = [manualModel.trim()];
    }
  } catch (err) {
    log(`fetchModels error: ${err}`);
    const manualModel = await vscode.window.showInputBox({
      prompt: `获取模型失败: ${err}，请手动输入模型名称`,
      placeHolder: "gpt-4-turbo-preview",
    });
    if (!manualModel) return;
    selectedModels = [manualModel.trim()];
  }

  const config = vscode.workspace.getConfiguration("customai");
  const existingModels: any[] = config.get<any[]>("models", []) || [];

  for (const modelName of selectedModels) {
    const displayName = `${selected.label.replace(/^\$\(star-full\)\s*/, "").replace(/^\$\(gear\)\s*/, "")} - ${modelName}`;
    existingModels.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      name: displayName,
      provider: providerKey,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey?.trim() || "",
      modelName: modelName,
      enabled: true,
    });
  }

  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("models", existingModels, target);

  provider?.refreshModelPicker();

  vscode.window.showInformationMessage(`已添加 ${selectedModels.length} 个模型！请在 Copilot Chat 中选择使用。`);
}

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  log(`Fetching models from: ${url}`);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { data?: Array<{ id: string }> };
  const models = (data.data || []).map((m) => m.id).filter((id) => !!id);
  log(`Fetched ${models.length} models from API`);
  return models;
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
    #fetchBtn {
      margin-top: 4px;
    }
    #modelSelector {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      color: var(--vscode-input-foreground);
      margin-bottom: 6px;
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
    <button class="provider-btn" onclick="quickAdd('step')">阶跃星辰</button>
    <button class="provider-btn" onclick="quickAdd('zhipu')">智谱 AI</button>
    <button class="provider-btn" onclick="quickAdd('moonshot')">月之暗面</button>
    <button class="provider-btn" onclick="quickAdd('deepseek')">DeepSeek</button>
    <button class="provider-btn" onclick="quickAdd('baichuan')">百川</button>
    <button class="provider-btn" onclick="quickAdd('yi')">零一万物</button>
    <button class="provider-btn" onclick="quickAdd('openai')">OpenAI</button>
    <button class="provider-btn" onclick="quickAdd('anthropic')">Anthropic</button>
    <button class="provider-btn" onclick="quickAdd('ollama')">Ollama</button>
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
            <option value="step">阶跃星辰 (Step)</option>
            <option value="zhipu">智谱 AI (GLM)</option>
            <option value="moonshot">月之暗面 (Moonshot)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="baichuan">百川 (Baichuan)</option>
            <option value="yi">零一万物 (Yi)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="ollama">Ollama</option>
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
          <button class="btn btn-primary" onclick="fetchModels()" id="fetchBtn" style="width:100%">获取可用模型列表</button>
        </div>
        <div class="form-group">
          <label>模型名称</label>
          <select id="modelSelector" style="display:none" onchange="onModelSelect()">
            <option value="">-- 选择模型 --</option>
          </select>
          <input type="text" id="modelName2" placeholder="手动输入模型名称，或点击上方按钮自动获取">
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
      step: { baseUrl: 'https://api.stepfun.com/v1', modelName: '' },
      zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', modelName: '' },
      moonshot: { baseUrl: 'https://api.moonshot.cn/v1', modelName: '' },
      deepseek: { baseUrl: 'https://api.deepseek.com/v1', modelName: '' },
      baichuan: { baseUrl: 'https://api.baichuan-ai.com/v1', modelName: '' },
      yi: { baseUrl: 'https://api.lingyiwanwu.com/v1', modelName: '' },
      openai: { baseUrl: 'https://api.openai.com/v1', modelName: '' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', modelName: '' },
      ollama: { baseUrl: 'http://localhost:11434/v1', modelName: '' },
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
            <button class="btn btn-primary btn-sm" onclick="editModel('\${btoa(m.id)}')">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="deleteModel('\${btoa(m.id)}')">删除</button>
          </div>
        </div>
      \`).join('');
    }

    function showAddModal() {
      editingId = null;
      document.getElementById('modalTitle').textContent = '添加模型';
      document.getElementById('saveBtn').textContent = '添加';
      document.getElementById('modelName').value = '';
      document.getElementById('modelProvider').value = 'step';
      document.getElementById('baseUrl').value = '';
      document.getElementById('apiKey').value = '';
      document.getElementById('modelName2').value = '';
      document.getElementById('modelSelector').style.display = 'none';
      document.getElementById('modal').classList.add('show');
    }

    function editModel(id) {
      const decodedId = atob(id);
      const model = models.find(m => m.id === decodedId);
      if (!model) return;
      editingId = decodedId;
      document.getElementById('modalTitle').textContent = '编辑模型';
      document.getElementById('saveBtn').textContent = '保存';
      document.getElementById('modelName').value = model.name;
      document.getElementById('modelProvider').value = model.provider;
      document.getElementById('baseUrl').value = model.baseUrl;
      document.getElementById('apiKey').value = model.apiKey || '';
      document.getElementById('modelName2').value = model.modelName;
      document.getElementById('modelSelector').style.display = 'none';
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
      }
    }

    function onModelSelect() {
      const selector = document.getElementById('modelSelector');
      const input = document.getElementById('modelName2');
      if (selector.value) {
        input.value = selector.value;
      }
    }

    async function fetchModels() {
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value.trim();
      const btn = document.getElementById('fetchBtn');
      const selector = document.getElementById('modelSelector');

      if (!baseUrl) {
        alert('请先填写 Base URL');
        return;
      }

      btn.textContent = '获取中...';
      btn.disabled = true;

      try {
        const url = baseUrl.replace(/\/$/, '') + '/models';
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = 'Bearer ' + apiKey;
        }

        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + await response.text());
        }

        const data = await response.json();
        const modelIds = (data.data || []).map(m => m.id).filter(id => !!id);

        if (modelIds.length > 0) {
          selector.innerHTML = '<option value="">-- 选择模型 --</option>';
          modelIds.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            selector.appendChild(opt);
          });
          selector.style.display = 'block';
          btn.textContent = '获取成功！';
        } else {
          alert('未获取到模型列表，请手动输入模型名称');
          selector.style.display = 'none';
          btn.textContent = '获取可用模型列表';
        }
      } catch (err) {
        alert('获取模型失败: ' + err.message);
        selector.style.display = 'none';
        btn.textContent = '获取可用模型列表';
      }

      btn.disabled = false;
    }

    function quickAdd(provider) {
      const d = defaults[provider];
      document.getElementById('modelProvider').value = provider;
      document.getElementById('baseUrl').value = d.baseUrl;
      document.getElementById('modelName2').value = '';
      document.getElementById('modelName').value = '';
      document.getElementById('apiKey').value = '';
      document.getElementById('modelSelector').style.display = 'none';
      document.getElementById('modal').classList.add('show');
    }

    function saveModel() {
      const name = document.getElementById('modelName').value.trim();
      const provider = document.getElementById('modelProvider').value;
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value;
      const modelName = document.getElementById('modelName2').value.trim();
      const selector = document.getElementById('modelSelector');

      if (!baseUrl) {
        alert('请填写 Base URL');
        return;
      }

      const finalModelName = modelName || selector.value;
      if (!finalModelName) {
        alert('请选择或输入模型名称');
        return;
      }

      const displayName = name || (provider.charAt(0).toUpperCase() + provider.slice(1) + ' - ' + finalModelName);

      vscode.postMessage({
        type: 'saveModel',
        model: { id: editingId, name: displayName, provider, baseUrl, apiKey, modelName: finalModelName }
      });

      hideModal();
    }

    function deleteModel(id) {
      if (confirm('确定要删除这个模型吗？')) {
        vscode.postMessage({ type: 'deleteModel', id: atob(id) });
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
