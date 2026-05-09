import * as vscode from "vscode";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  enabled: boolean;
}

export interface ExtensionConfig {
  models: AIModel[];
  debug: boolean;
}

export class ConfigViewProvider implements vscode.WebviewViewProvider {
  private readonly context: vscode.ExtensionContext;
  private readonly chatHandler: any;
  private webviewView: vscode.WebviewView | undefined;
  private readonly configKey = "customCopilot.models";

  constructor(context: vscode.ExtensionContext, chatHandler: any) {
    this.context = context;
    this.chatHandler = chatHandler;
  }

  public async showAddModelDialog(): Promise<void> {
    if (this.webviewView) {
      this.webviewView.show();
      this.webviewView.webview.postMessage({ type: "showAddDialog" });
    }
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: []
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "getModels":
          this.sendModels();
          break;
        case "addModel":
          await this.addModel(message.model);
          break;
        case "updateModel":
          await this.updateModel(message.model);
          break;
        case "deleteModel":
          await this.deleteModel(message.id);
          break;
        case "toggleModel":
          await this.toggleModel(message.id, message.enabled);
          break;
        case "chat":
          await this.chatHandler.handleChatRequest(message.prompt, message.modelId);
          break;
      }
    });

    this.sendModels();
  }

  private sendModels(): void {
    const models = this.getModels();
    this.webviewView?.webview.postMessage({ type: "models", models });
  }

  private getModels(): AIModel[] {
    const config = vscode.workspace.getConfiguration("customCopilot");
    return config.get<AIModel[]>(this.configKey, []);
  }

  private async saveModels(models: AIModel[]): Promise<void> {
    const config = vscode.workspace.getConfiguration("customCopilot");
    await config.update(this.configKey, models, vscode.ConfigurationTarget.Workspace);
    this.chatHandler.updateModels(models);
    this.sendModels();
  }

  private async addModel(model: AIModel): Promise<void> {
    const models = this.getModels();
    model.id = Date.now().toString();
    models.push(model);
    await this.saveModels(models);
    vscode.window.showInformationMessage(`Model "${model.name}" added!`);
  }

  private async updateModel(model: AIModel): Promise<void> {
    const models = this.getModels();
    const index = models.findIndex((m: AIModel) => m.id === model.id);
    if (index !== -1) {
      models[index] = model;
      await this.saveModels(models);
    }
  }

  private async deleteModel(id: string): Promise<void> {
    const models = this.getModels();
    const filtered = models.filter((m: AIModel) => m.id !== id);
    await this.saveModels(filtered);
    vscode.window.showInformationMessage("Model deleted");
  }

  private async toggleModel(id: string, enabled: boolean): Promise<void> {
    const models = this.getModels();
    const model = models.find((m: AIModel) => m.id === id);
    if (model) {
      model.enabled = enabled;
      await this.saveModels(models);
    }
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #1e1e1e;
      --bg2: #252526;
      --bg3: #2d2d2d;
      --border: #3c3c3c;
      --text: #cccccc;
      --text2: #858585;
      --accent: #0e639c;
      --accent2: #1177bb;
      --danger: #f14c4c;
      --success: #89d185;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 16px;
      height: 100vh;
      overflow-y: auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .header h2 {
      font-size: 14px;
      font-weight: 600;
    }
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    .btn-primary:hover { background: var(--accent2); }
    .btn-danger { background: var(--danger); color: white; }
    .btn-secondary {
      background: var(--bg3);
      color: var(--text);
    }
    .model-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .model-card.disabled { opacity: 0.5; }
    .model-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .model-name {
      font-weight: 600;
      font-size: 13px;
    }
    .model-provider {
      font-size: 11px;
      color: var(--text2);
      margin-top: 2px;
    }
    .model-info {
      font-size: 11px;
      color: var(--text2);
      margin-top: 6px;
      word-break: break-all;
    }
    .model-url {
      font-size: 10px;
      color: var(--text2);
      margin-top: 4px;
      word-break: break-all;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--bg3);
      border-radius: 20px;
      transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }
    .toggle input:checked + .toggle-slider { background: var(--success); }
    .toggle input:checked + .toggle-slider:before { transform: translateX(16px); }
    .model-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }
    .btn-sm { padding: 4px 8px; font-size: 11px; }
    .empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--text2);
    }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 100;
      justify-content: center;
      align-items: center;
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 6px;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: 14px;
    }
    .modal-body { padding: 16px; }
    .form-group { margin-bottom: 12px; }
    .form-group label {
      display: block;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--text2);
    }
    .form-group input, .form-group select {
      width: 100%;
      padding: 8px 10px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      font-size: 13px;
    }
    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: var(--accent);
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .quick-add {
      background: var(--bg3);
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .quick-add-title {
      font-size: 11px;
      color: var(--text2);
      margin-bottom: 6px;
    }
    .quick-add-btns {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .provider-btn {
      padding: 4px 10px;
      font-size: 11px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      cursor: pointer;
    }
    .provider-btn:hover { border-color: var(--accent); }
    .status-bar {
      background: var(--bg3);
      padding: 6px 10px;
      font-size: 11px;
      color: var(--text2);
      border-radius: 4px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Custom AI Models</h2>
    <button class="btn btn-primary" onclick="showAddModal()">+ Add Model</button>
  </div>

  <div class="quick-add">
    <div class="quick-add-title">Quick Add</div>
    <div class="quick-add-btns">
      <button class="provider-btn" onclick="quickAdd('openai')">OpenAI</button>
      <button class="provider-btn" onclick="quickAdd('anthropic')">Anthropic</button>
      <button class="provider-btn" onclick="quickAdd('ollama')">Ollama</button>
      <button class="provider-btn" onclick="quickAdd('lmstudio')">LM Studio</button>
      <button class="provider-btn" onclick="quickAdd('custom')">Custom API</button>
    </div>
  </div>

  <div class="status-bar" id="statusBar">Loading models...</div>

  <div id="modelsList"></div>

  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <div class="modal-header" id="modalTitle">Add Model</div>
      <div class="modal-body">
        <div class="form-group">
          <label>Model Name</label>
          <input type="text" id="modelName" placeholder="My GPT-4">
        </div>
        <div class="form-group">
          <label>Provider</label>
          <select id="modelProvider" onchange="onProviderChange()">
            <option value="openai">OpenAI Compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="lmstudio">LM Studio</option>
            <option value="custom">Custom API</option>
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
          <label>Model Name</label>
          <input type="text" id="modelName2" placeholder="gpt-4-turbo">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveModel()" id="saveBtn">Add Model</button>
      </div>
    </div>
  </div>

  <script>
    let models = [];
    let editingId = null;

    const providerDefaults = {
      openai: { baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4-turbo-preview' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', modelName: 'claude-3-sonnet-20240229' },
      ollama: { baseUrl: 'http://localhost:11434/v1', modelName: 'llama2' },
      lmstudio: { baseUrl: 'http://localhost:1234/v1', modelName: 'local-model' },
      custom: { baseUrl: '', modelName: '' }
    };

    const vscode = acquireVsCodeApi();

    function showAddModal() {
      editingId = null;
      document.getElementById('modalTitle').textContent = 'Add Model';
      document.getElementById('saveBtn').textContent = 'Add Model';
      document.getElementById('modelName').value = '';
      document.getElementById('modelProvider').value = 'openai';
      document.getElementById('baseUrl').value = '';
      document.getElementById('apiKey').value = '';
      document.getElementById('modelName2').value = '';
      onProviderChange();
      document.getElementById('modalOverlay').classList.add('show');
    }

    function hideModal() {
      document.getElementById('modalOverlay').classList.remove('show');
    }

    function onProviderChange() {
      const provider = document.getElementById('modelProvider').value;
      const defaults = providerDefaults[provider];
      if (defaults) {
        if (!document.getElementById('baseUrl').value) {
          document.getElementById('baseUrl').value = defaults.baseUrl;
        }
        if (!document.getElementById('modelName2').value) {
          document.getElementById('modelName2').value = defaults.modelName;
        }
      }
    }

    function quickAdd(provider) {
      const defaults = providerDefaults[provider];
      if (!defaults) return;

      document.getElementById('modelProvider').value = provider;
      document.getElementById('baseUrl').value = defaults.baseUrl;
      document.getElementById('modelName2').value = defaults.modelName;
      document.getElementById('modelName').value = provider.charAt(0).toUpperCase() + provider.slice(1);
      document.getElementById('apiKey').value = '';
      document.getElementById('modalOverlay').classList.add('show');
    }

    function editModel(id) {
      const model = models.find(m => m.id === id);
      if (!model) return;

      editingId = id;
      document.getElementById('modalTitle').textContent = 'Edit Model';
      document.getElementById('saveBtn').textContent = 'Save Changes';
      document.getElementById('modelName').value = model.name;
      document.getElementById('modelProvider').value = model.provider;
      document.getElementById('baseUrl').value = model.baseUrl;
      document.getElementById('apiKey').value = model.apiKey;
      document.getElementById('modelName2').value = model.modelName;
      document.getElementById('modalOverlay').classList.add('show');
    }

    async function saveModel() {
      const name = document.getElementById('modelName').value.trim();
      const provider = document.getElementById('modelProvider').value;
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const apiKey = document.getElementById('apiKey').value;
      const modelName = document.getElementById('modelName2').value.trim();

      if (!name || !baseUrl || !modelName) {
        vscode.postMessage({ type: 'showError', message: 'Please fill in all required fields' });
        return;
      }

      const model = { name, provider, baseUrl, apiKey, modelName, enabled: true };

      if (editingId) {
        model.id = editingId;
        model.enabled = models.find(m => m.id === editingId)?.enabled ?? true;
        vscode.postMessage({ type: 'updateModel', model });
      } else {
        vscode.postMessage({ type: 'addModel', model });
      }

      hideModal();
    }

    async function deleteModel(id) {
      if (confirm('Are you sure you want to delete this model?')) {
        vscode.postMessage({ type: 'deleteModel', id });
      }
    }

    async function toggleModel(id, enabled) {
      vscode.postMessage({ type: 'toggleModel', id, enabled });
    }

    function renderModels() {
      const list = document.getElementById('modelsList');
      const statusBar = document.getElementById('statusBar');

      if (models.length === 0) {
        statusBar.textContent = 'No models configured. Click "Add Model" to get started.';
        list.innerHTML = '';
        return;
      }

      const enabled = models.filter(m => m.enabled).length;
      statusBar.textContent = \`\${models.length} model(s) configured, \${enabled} enabled\`;

      list.innerHTML = models.map(m => \`
        <div class="model-card \${m.enabled ? '' : 'disabled'}">
          <div class="model-header">
            <div>
              <div class="model-name">\${m.name}</div>
              <div class="model-provider">\${m.provider} / \${m.modelName}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" \${m.enabled ? 'checked' : ''} onchange="toggleModel('\${m.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="model-url">\${m.baseUrl}</div>
          <div class="model-info">API Key: \${m.apiKey ? '***' + m.apiKey.slice(-4) : 'Not set'}</div>
          <div class="model-actions">
            <button class="btn btn-secondary btn-sm" onclick="editModel('\${m.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteModel('\${m.id}')">Delete</button>
          </div>
        </div>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'models':
          models = message.models || [];
          renderModels();
          break;
        case 'showAddDialog':
          showAddModal();
          break;
      }
    });

    vscode.postMessage({ type: 'getModels' });
  </script>
</body>
</html>`;
  }

  dispose(): void {}
}
