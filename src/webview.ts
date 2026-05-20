export function getWebviewContent(): string {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "  <meta charset=\"UTF-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
    "  <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';\">",
    "  <style>",
    "    :root {",
    "      --bg: var(--vscode-editor-background, #1e1e1e);",
    "      --fg: var(--vscode-editor-foreground, #cccccc);",
    "      --card-bg: var(--vscode-textCodeBlock-background, #252526);",
    "      --border: var(--vscode-widget-border, #3c3c3c);",
    "      --btn-bg: var(--vscode-button-background, #0e639c);",
    "      --btn-fg: var(--vscode-button-foreground, #ffffff);",
    "      --desc: var(--vscode-descriptionForeground, #858585);",
    "      --input-bg: var(--vscode-input-background, #3c3c3c);",
    "      --input-border: var(--vscode-input-border, #5a5a5a);",
    "      --focus: var(--vscode-focusBorder, #007fd4);",
    "    }",
    "    * { box-sizing: border-box; margin: 0; padding: 0; }",
    "    body {",
    "      font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;",
    "      padding: 16px;",
    "      background: var(--bg);",
    "      color: var(--fg);",
    "    }",
    "    .header {",
    "      display: flex;",
    "      justify-content: space-between;",
    "      align-items: center;",
    "      margin-bottom: 16px;",
    "      padding-bottom: 12px;",
    "      border-bottom: 1px solid var(--border);",
    "    }",
    "    h2 { font-size: 15px; font-weight: 600; }",
    "    .btn {",
    "      padding: 5px 12px;",
    "      border: none;",
    "      border-radius: 3px;",
    "      cursor: pointer;",
    "      font-size: 12px;",
    "      font-family: inherit;",
    "    }",
    "    .btn:disabled { opacity: 0.6; cursor: not-allowed; }",
    "    .btn-primary { background: var(--btn-bg); color: var(--btn-fg); }",
    "    .btn-primary:hover { opacity: 0.9; }",
    "    .btn-danger { background: #c53434; color: #fff; }",
    "    .btn-danger:hover { opacity: 0.9; }",
    "    .btn-sm { padding: 3px 8px; font-size: 11px; }",
    "    .btn-xs { padding: 2px 6px; font-size: 10px; }",
    "    .provider-card {",
    "      background: var(--card-bg);",
    "      border: 1px solid var(--border);",
    "      border-radius: 5px;",
    "      padding: 12px;",
    "      margin-bottom: 10px;",
    "    }",
    "    .provider-header {",
    "      display: flex;",
    "      justify-content: space-between;",
    "      align-items: flex-start;",
    "      gap: 12px;",
    "    }",
    "    .provider-name { font-weight: 600; font-size: 13px; }",
    "    .provider-meta { font-size: 10px; color: var(--desc); margin-top: 3px; word-break: break-all; }",
    "    .provider-actions { display: flex; gap: 5px; flex-shrink: 0; }",
    "    .fingerprint-section {",
    "      margin-top: 10px;",
    "      padding-top: 10px;",
    "      border-top: 1px solid var(--border);",
    "    }",
    "    .fingerprint-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; color: var(--desc); margin-bottom: 6px; }",
    "    .fingerprint-row {",
    "      display: flex;",
    "      align-items: center;",
    "      gap: 6px;",
    "      padding: 5px 0;",
    "      font-size: 11px;",
    "      border-top: 1px solid rgba(128,128,128,0.18);",
    "    }",
    "    .fingerprint-info { flex: 1; min-width: 0; }",
    "    .fingerprint-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "    .fingerprint-meta { color: var(--desc); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "    .fingerprint-actions { display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }",
    "    .badge-active { background: #2e7d32; }",
    "    .badge {",
    "      display: inline-block;",
    "      background: var(--vscode-badge-background, #4d4d4d);",
    "      color: var(--vscode-badge-foreground, #fff);",
    "      border-radius: 10px;",
    "      padding: 1px 7px;",
    "      font-size: 10px;",
    "      margin-left: 6px;",
    "      vertical-align: middle;",
    "    }",
    "    .models-section {",
    "      margin-top: 10px;",
    "      padding-top: 10px;",
    "      border-top: 1px solid var(--border);",
    "    }",
    "    .model-row {",
    "      display: flex;",
    "      align-items: center;",
    "      gap: 8px;",
    "      padding: 4px 0;",
    "      font-size: 12px;",
    "      cursor: pointer;",
    "    }",
    "    .model-row input[type=\"checkbox\"] { accent-color: var(--focus); }",
    "    .model-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
    "    .model-option {",
    "      padding: 2px 5px;",
    "      background: var(--input-bg);",
    "      border: 1px solid var(--input-border);",
    "      border-radius: 3px;",
    "      color: var(--fg);",
    "      font-size: 10px;",
    "    }",
    "    .model-budget { width: 72px; }",
    "    .model-json { width: 150px; }",
    "    .models-toolbar { display: flex; gap: 5px; margin-bottom: 6px; align-items: center; }",
    "    .fetch-status { font-size: 10px; color: var(--desc); margin-left: 8px; }",
    "    .status-bar {",
    "      background: var(--card-bg);",
    "      padding: 6px 10px;",
    "      border-radius: 4px;",
    "      font-size: 11px;",
    "      color: var(--desc);",
    "      margin-bottom: 12px;",
    "    }",
    "    .empty {",
    "      text-align: center;",
    "      padding: 30px 10px;",
    "      color: var(--desc);",
    "      font-size: 12px;",
    "    }",
    "    .empty-btn { margin-top: 12px; }",
    "    .modal {",
    "      display: none;",
    "      position: fixed;",
    "      top: 0; left: 0; right: 0; bottom: 0;",
    "      background: rgba(0,0,0,0.5);",
    "      z-index: 100;",
    "      justify-content: center;",
    "      align-items: center;",
    "    }",
    "    .modal.show { display: flex; }",
    "    .modal-content {",
    "      background: var(--bg);",
    "      border: 1px solid var(--border);",
    "      border-radius: 6px;",
    "      width: 440px;",
    "      max-height: 80vh;",
    "      overflow-y: auto;",
    "    }",
    "    .modal-header {",
    "      padding: 12px 14px;",
    "      border-bottom: 1px solid var(--border);",
    "      font-weight: 600;",
    "      font-size: 13px;",
    "    }",
    "    .modal-body { padding: 14px; }",
    "    .modal-footer {",
    "      padding: 10px 14px;",
    "      border-top: 1px solid var(--border);",
    "      display: flex;",
    "      justify-content: flex-end;",
    "      gap: 8px;",
    "    }",
    "    .form-group { margin-bottom: 10px; }",
    "    .form-group label {",
    "      display: block;",
    "      font-size: 11px;",
    "      margin-bottom: 3px;",
    "      color: var(--desc);",
    "    }",
    "    .form-group input, .form-group textarea {",
    "      width: 100%;",
    "      padding: 7px 8px;",
    "      background: var(--input-bg);",
    "      border: 1px solid var(--input-border);",
    "      border-radius: 3px;",
    "      color: var(--fg);",
    "      font-size: 12px;",
    "      font-family: inherit;",
    "    }",
    "    .form-group textarea { resize: vertical; min-height: 82px; }",
    "    .form-help { color: var(--desc); font-size: 10px; margin-top: 4px; line-height: 1.4; }",
    "    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--focus); }",
    "    .error-text { color: #f14c4c; font-size: 11px; margin-top: 8px; }",
    "    .success-text { color: #89d185; font-size: 11px; }",
    "    @media (max-width: 480px) {",
    "      body { padding: 10px; }",
    "      .header { align-items: stretch; gap: 8px; flex-direction: column; }",
    "      .header .btn { width: 100%; }",
    "      .provider-header { flex-direction: column; gap: 8px; }",
    "      .provider-actions, .models-toolbar, .fingerprint-row { flex-wrap: wrap; }",
    "      .provider-actions .btn { flex: 1 1 auto; }",
    "      .model-row { align-items: flex-start; flex-wrap: wrap; gap: 6px; }",
    "      .model-name { flex: 1 1 calc(100% - 28px); }",
    "      .model-option, .model-json, .model-budget { width: 100%; }",
    "      .fetch-status { display: block; flex: 1 1 100%; margin-left: 0; margin-top: 4px; }",
    "      .modal-content { width: calc(100vw - 24px) !important; }",
    "    }",
  "  </style>",
    "</head>",
    "<body>",
    "  <div class=\"header\">",
    "    <h2>Custom AI 模型配置</h2>",
    "    <button class=\"btn btn-primary\" id=\"btnAddProvider\">+ 添加供应商</button>",
    "  </div>",
    "  <div class=\"status-bar\" id=\"statusBar\">正在加载...</div>",
    "  <div id=\"providersList\"></div>",
    "  <div class=\"modal\" id=\"modalProvider\">",
    "    <div class=\"modal-content\">",
    "      <div class=\"modal-header\" id=\"modalTitle\">添加供应商</div>",
    "      <div class=\"modal-body\">",
    "        <div class=\"form-group\">",
    "          <label>供应商名称</label>",
    "          <input type=\"text\" id=\"inputName\" placeholder=\"如：我的阶跃星辰\">",
    "        </div>",
    "        <div class=\"form-group\">",
    "          <label>Base URL</label>",
    "          <input type=\"text\" id=\"inputUrl\" placeholder=\"https://api.stepfun.com/v1\">",
    "        </div>",
    "        <div class=\"form-group\">",
    "          <label>API Key</label>",
    "          <input type=\"password\" id=\"inputKey\" placeholder=\"sk-...\">",
    "        </div>",
    "      </div>",
    "      <div class=\"modal-footer\">",
    "        <button class=\"btn btn-primary\" id=\"btnCancel\">取消</button>",
    "        <button class=\"btn btn-primary\" id=\"btnSave\">保存</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "  <div class=\"modal\" id=\"modalFingerprint\">",
    "    <div class=\"modal-content\">",
    "      <div class=\"modal-header\" id=\"fingerprintTitle\">添加指纹</div>",
    "      <div class=\"modal-body\">",
    "        <div class=\"form-group\">",
    "          <label>指纹名称</label>",
    "          <input type=\"text\" id=\"fpName\" placeholder=\"如：GPT Plus 本地反代\">",
    "        </div>",
    "        <div class=\"form-group\">",
    "          <label>请求头名称</label>",
    "          <input type=\"text\" id=\"fpHeaderName\" placeholder=\"默认：X-Fingerprint\">",
    "          <div class=\"form-help\">如果下面填写 JSON，可留空；JSON 会批量写入请求头。</div>",
    "        </div>",
    "        <div class=\"form-group\">",
    "          <label>指纹值 / JSON 请求头</label>",
    "          <textarea id=\"fpValue\" placeholder=\"abc123 或 {&quot;headers&quot;:{&quot;X-Fingerprint&quot;:&quot;abc123&quot;}}\"></textarea>",
    "        </div>",
    "      </div>",
    "      <div class=\"modal-footer\">",
    "        <button class=\"btn btn-primary\" id=\"btnFingerprintCancel\">取消</button>",
    "        <button class=\"btn btn-primary\" id=\"btnFingerprintSave\">保存指纹</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "  <div class=\"modal\" id=\"modalDelete\">",
    "    <div class=\"modal-content\" style=\"width:360px\">",
    "      <div class=\"modal-header\">确认删除</div>",
    "      <div class=\"modal-body\">",
    "        <p id=\"deleteMsg\">确定要删除此供应商及其所有模型吗？</p>",
    "      </div>",
    "      <div class=\"modal-footer\">",
    "        <button class=\"btn btn-primary\" id=\"btnDeleteCancel\">取消</button>",
    "        <button class=\"btn btn-danger\" id=\"btnDeleteConfirm\">确认删除</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "  <script>",
    getWebviewScript(),
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function getWebviewScript(): string {
  const lines: string[] = [];

  lines.push("(function() {");
  lines.push("  var vscode = null;");
  lines.push("  var providers = [];");
  lines.push("  var models = [];");
  lines.push("  var editingId = null;");
  lines.push("  var deletingId = null;");
  lines.push("  var fingerprintProviderId = null;");
  lines.push("  var editingFingerprintId = null;");
  lines.push("  var loadTimer = null;");
  lines.push("");
  lines.push("  boot();");
  lines.push("");
  lines.push("  function boot() {");
  lines.push("    try {");
  lines.push("      vscode = acquireVsCodeApi();");
  lines.push("      bindStaticEvents();");
  lines.push("      window.addEventListener('message', onMessage);");
  lines.push("      setStatus('正在加载...');");
  lines.push("      requestConfig();");
  lines.push("      loadTimer = setTimeout(function() {");
  lines.push("        if (providers.length === 0 && models.length === 0) {");
  lines.push("          setStatus('加载超时 — 请检查 customai.providers 配置');");
  lines.push("          var el = document.getElementById('providersList');");
  lines.push("          if (el) {");
  lines.push("            el.innerHTML = '<div class=\"empty\">配置还没有返回。<br><br><button class=\"btn btn-primary empty-btn\" id=\"btnReload\">🔄 重新加载</button></div>'; ");
  lines.push("            var reload = document.getElementById('btnReload');");
  lines.push("            if (reload) reload.onclick = requestConfig;");
  lines.push("          }");
  lines.push("        }");
  lines.push("      }, 2500);");
  lines.push("    } catch (err) {");
  lines.push("      showFatal('初始化错误', err);");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  function onMessage(event) {");
  lines.push("    try {");
  lines.push("      var msg = event.data;");
  lines.push("      if (!msg || !msg.type) return;");
  lines.push("      if (msg.type === 'config') {");
  lines.push("        providers = msg.providers || [];");
  lines.push("        models = msg.models || [];");
  lines.push("        if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }");
  lines.push("        render();");
  lines.push("        setStatus(providers.length + ' 个供应商, ' + models.length + ' 个模型');");
  lines.push("      }");
  lines.push("      if (msg.type === 'modelsFetched') {");
  lines.push("        handleModelsFetched(msg.providerId, msg.models || []);");
  lines.push("      }");
  lines.push("      if (msg.type === 'modelsFetchError') {");
  lines.push("        showError(msg.providerId, msg.error || '未知错误');");
  lines.push("      }");
  lines.push("      if (msg.type === 'providerTestResult') {");
  lines.push("        setFetchStatus(msg.providerId, msg.ok ? ('✓ 测试成功: ' + msg.detail) : ('测试失败: ' + msg.detail));");
  lines.push("      }");
  lines.push("    } catch (err) {");
  lines.push("      showFatal('消息处理错误', err);");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  function requestConfig() {");
  lines.push("    setStatus('正在加载...');");
  lines.push("    vscode.postMessage({ type: 'getConfig' });");
  lines.push("  }");
  lines.push("");
  lines.push("  function render() {");
  lines.push("    var el = document.getElementById('providersList');");
  lines.push("    if (!el) return;");
  lines.push("    if (providers.length === 0) {");
  lines.push("      el.innerHTML = '<div class=\"empty\">暂无供应商<br><br><button class=\"btn btn-primary empty-btn\" id=\"btnFirstAdd\">+ 添加第一个供应商</button></div>'; ");
  lines.push("      var firstAdd = document.getElementById('btnFirstAdd');");
  lines.push("      if (firstAdd) firstAdd.onclick = function() { showModal(null); };");
  lines.push("      return;");
  lines.push("    }");
  lines.push("    var html = '';");
  lines.push("    for (var i = 0; i < providers.length; i++) {");
  lines.push("      var provider = providers[i];");
  lines.push("      var providerModels = getProviderModels(provider.id);");
  lines.push("      var visibleCount = 0;");
  lines.push("      for (var k = 0; k < providerModels.length; k++) {");
  lines.push("        if (providerModels[k].visible) visibleCount++;");
  lines.push("      }");
  lines.push("      html += '<div class=\"provider-card\">';");
  lines.push("      html += '<div class=\"provider-header\">';");
  lines.push("      html += '<div>';");
  lines.push("      html += '<div class=\"provider-name\">' + esc(provider.name) + '<span class=\"badge\">' + visibleCount + '/' + providerModels.length + ' 可见</span></div>'; ");
  lines.push("      html += '<div class=\"provider-meta\">' + esc(provider.baseUrl) + '</div>'; ");
  lines.push("      html += '</div>';");
  lines.push("      html += '<div class=\"provider-actions\">';");
  lines.push("      html += '<button class=\"btn btn-primary btn-sm\" data-action=\"test\" data-id=\"' + attr(provider.id) + '\">测试</button>'; ");
  lines.push("      html += '<button class=\"btn btn-primary btn-sm\" data-action=\"fetch\" data-id=\"' + attr(provider.id) + '\">获取模型</button>'; ");
  lines.push("      html += '<button class=\"btn btn-primary btn-sm\" data-action=\"edit\" data-id=\"' + attr(provider.id) + '\">编辑</button>'; ");
  lines.push("      html += '<button class=\"btn btn-danger btn-sm\" data-action=\"delete\" data-id=\"' + attr(provider.id) + '\">删除</button>'; ");
  lines.push("      html += '</div>';");
  lines.push("      html += '</div>';");
  lines.push("      html += renderFingerprintSection(provider);");
  lines.push("      html += '<div class=\"models-section\">';");
  lines.push("      if (providerModels.length > 0) {");
  lines.push("        html += '<div class=\"models-toolbar\">';");
  lines.push("        html += '<button class=\"btn btn-primary btn-xs\" data-action=\"all-visible\" data-id=\"' + attr(provider.id) + '\">全选</button>'; ");
  lines.push("        html += '<button class=\"btn btn-primary btn-xs\" data-action=\"all-hidden\" data-id=\"' + attr(provider.id) + '\">全不选</button>'; ");
  lines.push("        html += '<button class=\"btn btn-primary btn-xs\" data-action=\"save-models\" data-id=\"' + attr(provider.id) + '\">保存勾选</button>'; ");
  lines.push("        html += '<span class=\"fetch-status\" id=\"fs_' + attr(provider.id) + '\"></span>'; ");
  lines.push("        html += '</div>';");
  lines.push("        for (var m = 0; m < providerModels.length; m++) {");
  lines.push("          var model = providerModels[m];");
  lines.push("          html += '<div class=\"model-row\">';");
  lines.push("          html += '<input type=\"checkbox\" ' + (model.visible ? 'checked' : '') + ' id=\"cb_' + attr(model.id) + '\" data-model-id=\"' + attr(model.id) + '\">'; ");
  lines.push("          html += '<span class=\"model-name\">' + esc(model.modelName) + '</span>'; ");
  lines.push("          html += renderReasoningControls(model, provider);");
  lines.push("          html += '</div>';");
  lines.push("        }");
  lines.push("      } else {");
  lines.push("        html += '<div class=\"fetch-status\" id=\"fs_' + attr(provider.id) + '\">点击上方「获取模型」按钮加载模型列表</div>'; ");
  lines.push("      }");
  lines.push("      html += '</div>';");
  lines.push("      html += '</div>';");
  lines.push("    }");
  lines.push("    el.innerHTML = html;");
  lines.push("    bindProviderEvents();");
  lines.push("  }");
  lines.push("");
  lines.push("  function renderFingerprintSection(provider) {");
  lines.push("    var fingerprints = getFingerprints(provider);");
  lines.push("    var html = '<div class=\"fingerprint-section\">';");
  lines.push("    html += '<div class=\"fingerprint-title\"><span>指纹管理 <span class=\"badge\">' + fingerprints.length + '</span></span><button class=\"btn btn-primary btn-xs\" data-action=\"add-fingerprint\" data-id=\"' + attr(provider.id) + '\">+ 指纹</button></div>'; ");
  lines.push("    if (fingerprints.length === 0) {");
  lines.push("      html += '<div class=\"fingerprint-meta\">未配置指纹；需要中转站/反代专属 Header 时可添加。</div>'; ");
  lines.push("    }");
  lines.push("    for (var i = 0; i < fingerprints.length; i++) {");
  lines.push("      var fp = fingerprints[i];");
  lines.push("      var active = fp.id === provider.activeFingerprintId || (!provider.activeFingerprintId && i === 0);");
  lines.push("      html += '<div class=\"fingerprint-row\">';");
  lines.push("      html += '<div class=\"fingerprint-info\">';");
  lines.push("      html += '<div class=\"fingerprint-name\">' + esc(fp.name || '未命名指纹') + (active ? '<span class=\"badge badge-active\">启用</span>' : '') + '</div>'; ");
  lines.push("      html += '<div class=\"fingerprint-meta\">' + esc((fp.headerName || 'X-Fingerprint') + ': ' + previewFingerprint(fp.value || '')) + '</div>'; ");
  lines.push("      html += '</div>'; ");
  lines.push("      html += '<div class=\"fingerprint-actions\">';");
  lines.push("      if (!active) html += '<button class=\"btn btn-primary btn-xs\" data-action=\"activate-fingerprint\" data-id=\"' + attr(provider.id) + '\" data-fingerprint-id=\"' + attr(fp.id) + '\">启用</button>'; ");
  lines.push("      html += '<button class=\"btn btn-primary btn-xs\" data-action=\"edit-fingerprint\" data-id=\"' + attr(provider.id) + '\" data-fingerprint-id=\"' + attr(fp.id) + '\">编辑</button>'; ");
  lines.push("      html += '<button class=\"btn btn-danger btn-xs\" data-action=\"delete-fingerprint\" data-id=\"' + attr(provider.id) + '\" data-fingerprint-id=\"' + attr(fp.id) + '\">删除</button>'; ");
  lines.push("      html += '</div></div>'; ");
  lines.push("    }");
  lines.push("    html += '</div>'; ");
  lines.push("    return html;");
  lines.push("  }");
  lines.push("");
  lines.push("  function bindStaticEvents() {");
  lines.push("    document.getElementById('btnAddProvider').onclick = function() { showModal(null); };");
  lines.push("    document.getElementById('btnSave').onclick = saveProvider;");
  lines.push("    document.getElementById('btnCancel').onclick = function() { hideModal('modalProvider'); };");
  lines.push("    document.getElementById('btnDeleteConfirm').onclick = confirmDelete;");
  lines.push("    document.getElementById('btnDeleteCancel').onclick = function() { hideModal('modalDelete'); deletingId = null; };");
  lines.push("    document.getElementById('btnFingerprintSave').onclick = saveFingerprint;");
  lines.push("    document.getElementById('btnFingerprintCancel').onclick = function() { hideModal('modalFingerprint'); fingerprintProviderId = null; editingFingerprintId = null; };");
  lines.push("  }");
  lines.push("");
  lines.push("  function bindProviderEvents() {");
  lines.push("    var buttons = document.querySelectorAll('[data-action]');");
  lines.push("    Array.prototype.forEach.call(buttons, function(button) {");
  lines.push("      button.onclick = function() {");
  lines.push("        var action = button.getAttribute('data-action');");
  lines.push("        var id = button.getAttribute('data-id');");
  lines.push("        var fingerprintId = button.getAttribute('data-fingerprint-id');");
  lines.push("        if (action === 'fetch') fetchModels(id);");
  lines.push("        if (action === 'test') testProvider(id);");
  lines.push("        if (action === 'edit') showModal(id);");
  lines.push("        if (action === 'delete') askDelete(id);");
  lines.push("        if (action === 'add-fingerprint') showFingerprintModal(id, null);");
  lines.push("        if (action === 'edit-fingerprint') showFingerprintModal(id, fingerprintId);");
  lines.push("        if (action === 'delete-fingerprint') deleteFingerprint(id, fingerprintId);");
  lines.push("        if (action === 'activate-fingerprint') activateFingerprint(id, fingerprintId);");
  lines.push("        if (action === 'all-visible') toggleAll(id, true);");
  lines.push("        if (action === 'all-hidden') toggleAll(id, false);");
  lines.push("        if (action === 'save-models') saveModels(id);");
  lines.push("      };");
  lines.push("    });");
  lines.push("  }");
  lines.push("");
  lines.push("  function renderReasoningControls(model, provider) {");
  lines.push("    var html = '';");
  lines.push("    html += '<select class=\"model-option\" id=\"profile_' + attr(model.id) + '\" title=\"推理协议\">';");
  lines.push("    var profile = getReasoningProfile(model, provider);");
  lines.push("    var profiles = ['auto', 'off', 'openai', 'deepseek', 'qwen', 'glm', 'stepfun', 'claude', 'gemini', 'minimax', 'custom'];");
  lines.push("    for (var p = 0; p < profiles.length; p++) html += optionHtml(profiles[p], profileLabel(profiles[p]), profile);");
  lines.push("    html += '</select>';");
  lines.push("    var reasoningOptions = getReasoningEffortOptions(model, provider);");
  lines.push("    if (reasoningOptions.length > 0) {");
  lines.push("      html += '<select class=\"model-option\" id=\"reasoning_' + attr(model.id) + '\" title=\"推理强度\">';");
  lines.push("      html += optionHtml('default', '自动', model.reasoningEffort || 'default');");
  lines.push("      for (var r = 0; r < reasoningOptions.length; r++) {");
  lines.push("        html += optionHtml(reasoningOptions[r], optionLabel(reasoningOptions[r], 'reasoning'), model.reasoningEffort || 'default');");
  lines.push("      }");
  lines.push("      html += '</select>';");
  lines.push("    }");
  lines.push("    var thinkingOptions = getThinkingTypeOptions(model, provider);");
  lines.push("    if (thinkingOptions.length > 0) {");
  lines.push("      html += '<select class=\"model-option\" id=\"thinking_' + attr(model.id) + '\" title=\"思考模式\">';");
  lines.push("      html += optionHtml('default', '默认思考', model.thinkingType || 'default');");
  lines.push("      for (var t = 0; t < thinkingOptions.length; t++) {");
  lines.push("        html += optionHtml(thinkingOptions[t], optionLabel(thinkingOptions[t], 'thinking'), model.thinkingType || 'default');");
  lines.push("      }");
  lines.push("      html += '</select>';");
  lines.push("    }");
  lines.push("    if (shouldShowThinkingBudget(model, provider)) {");
  lines.push("      html += '<input class=\"model-option model-budget\" type=\"number\" min=\"0\" id=\"budget_' + attr(model.id) + '\" title=\"思考预算 Token\" placeholder=\"预算\" value=\"' + attr(model.thinkingBudget || '') + '\">';");
  lines.push("    }");
  lines.push("    html += '<input class=\"model-option model-json\" id=\"custom_' + attr(model.id) + '\" title=\"自定义请求 JSON，会合并到请求体\" placeholder=\"JSON参数\" value=\"' + attr(model.customRequestParams || '') + '\">';");
  lines.push("    return html;");
  lines.push("  }");
  lines.push("");
  lines.push("  function optionHtml(value, label, selected) {");
  lines.push("    return '<option value=\"' + attr(value) + '\"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>'; ");
  lines.push("  }");
  lines.push("");
  lines.push("  function optionLabel(value, kind) {");
  lines.push("    var labels = {");
  lines.push("      none: '无推理',");
  lines.push("      minimal: '最少推理',");
  lines.push("      low: '低推理',");
  lines.push("      medium: '中推理',");
  lines.push("      high: '高推理',");
  lines.push("      xhigh: '超高推理',");
  lines.push("      enabled: '开启思考',");
  lines.push("      disabled: '关闭思考'");
  lines.push("    };");
  lines.push("    return labels[value] || value;");
  lines.push("  }");
  lines.push("");
  lines.push("  function profileLabel(value) {");
  lines.push("    var labels = {");
  lines.push("      auto: '自动',");
  lines.push("      off: '关闭推理参数',");
  lines.push("      openai: 'OpenAI/GPT',");
  lines.push("      deepseek: 'DeepSeek',");
  lines.push("      qwen: 'Qwen',");
  lines.push("      glm: 'GLM',");
  lines.push("      stepfun: 'StepFun',");
  lines.push("      claude: 'Claude',");
  lines.push("      gemini: 'Gemini',");
  lines.push("      minimax: 'MiniMax',");
  lines.push("      custom: '自定义'");
  lines.push("    };");
  lines.push("    return labels[value] || value;");
  lines.push("  }");
  lines.push("");
  lines.push("  function showModal(providerId) {");
  lines.push("    if (providerId) {");
  lines.push("      var provider = getProvider(providerId);");
  lines.push("      if (!provider) return;");
  lines.push("      editingId = providerId;");
  lines.push("      document.getElementById('modalTitle').textContent = '编辑供应商';");
  lines.push("      document.getElementById('inputName').value = provider.name || '';");
  lines.push("      document.getElementById('inputUrl').value = provider.baseUrl || '';");
  lines.push("      document.getElementById('inputKey').value = provider.apiKey || '';");
  lines.push("    } else {");
  lines.push("      editingId = null;");
  lines.push("      document.getElementById('modalTitle').textContent = '添加供应商';");
  lines.push("      document.getElementById('inputName').value = '';");
  lines.push("      document.getElementById('inputUrl').value = '';");
  lines.push("      document.getElementById('inputKey').value = '';");
  lines.push("    }");
  lines.push("    document.getElementById('modalProvider').classList.add('show');");
  lines.push("  }");
  lines.push("");
  lines.push("  function saveProvider() {");
  lines.push("    var name = document.getElementById('inputName').value.trim();");
  lines.push("    var url = document.getElementById('inputUrl').value.trim();");
  lines.push("    var key = document.getElementById('inputKey').value.trim();");
  lines.push("    if (!name || !url) { alert('请填写名称和 URL'); return; }");
  lines.push("    var existing = editingId ? getProvider(editingId) : null;");
  lines.push("    vscode.postMessage({ type: 'saveProvider', provider: { id: editingId, name: name, baseUrl: url, apiKey: key, fingerprints: getFingerprints(existing), activeFingerprintId: existing ? existing.activeFingerprintId : undefined } });");
  lines.push("    hideModal('modalProvider');");
  lines.push("  }");
  lines.push("");
  lines.push("  function showFingerprintModal(providerId, fingerprintId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    if (!provider) return;");
  lines.push("    var fingerprint = fingerprintId ? getFingerprint(provider, fingerprintId) : null;");
  lines.push("    fingerprintProviderId = providerId;");
  lines.push("    editingFingerprintId = fingerprintId;");
  lines.push("    document.getElementById('fingerprintTitle').textContent = fingerprint ? '编辑指纹' : '添加指纹';");
  lines.push("    document.getElementById('fpName').value = fingerprint ? (fingerprint.name || '') : '';");
  lines.push("    document.getElementById('fpHeaderName').value = fingerprint ? (fingerprint.headerName || '') : '';");
  lines.push("    document.getElementById('fpValue').value = fingerprint ? (fingerprint.value || '') : '';");
  lines.push("    document.getElementById('modalFingerprint').classList.add('show');");
  lines.push("  }");
  lines.push("");
  lines.push("  function saveFingerprint() {");
  lines.push("    var provider = getProvider(fingerprintProviderId);");
  lines.push("    if (!provider) return;");
  lines.push("    var name = document.getElementById('fpName').value.trim();");
  lines.push("    var headerName = document.getElementById('fpHeaderName').value.trim();");
  lines.push("    var value = document.getElementById('fpValue').value.trim();");
  lines.push("    if (!name || !value) { alert('请填写指纹名称和指纹值'); return; }");
  lines.push("    var fingerprints = getFingerprints(provider).slice();");
  lines.push("    var id = editingFingerprintId || ('fp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));");
  lines.push("    var next = { id: id, name: name, value: value, headerName: headerName || undefined };");
  lines.push("    var replaced = false;");
  lines.push("    for (var i = 0; i < fingerprints.length; i++) {");
  lines.push("      if (fingerprints[i].id === id) { fingerprints[i] = next; replaced = true; break; }");
  lines.push("    }");
  lines.push("    if (!replaced) fingerprints.push(next);");
  lines.push("    provider.fingerprints = fingerprints;");
  lines.push("    if (!provider.activeFingerprintId) provider.activeFingerprintId = id;");
  lines.push("    saveProviderObject(provider);");
  lines.push("    hideModal('modalFingerprint');");
  lines.push("    fingerprintProviderId = null;");
  lines.push("    editingFingerprintId = null;");
  lines.push("  }");
  lines.push("");
  lines.push("  function deleteFingerprint(providerId, fingerprintId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    if (!provider || !fingerprintId) return;");
  lines.push("    var fingerprint = getFingerprint(provider, fingerprintId);");
  lines.push("    if (!confirm('确定删除指纹 \"' + (fingerprint ? fingerprint.name : fingerprintId) + '\" 吗？')) return;");
  lines.push("    var fingerprints = getFingerprints(provider).filter(function(item) { return item.id !== fingerprintId; });");
  lines.push("    provider.fingerprints = fingerprints;");
  lines.push("    if (provider.activeFingerprintId === fingerprintId) provider.activeFingerprintId = fingerprints.length > 0 ? fingerprints[0].id : undefined;");
  lines.push("    saveProviderObject(provider);");
  lines.push("  }");
  lines.push("");
  lines.push("  function activateFingerprint(providerId, fingerprintId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    if (!provider || !fingerprintId) return;");
  lines.push("    provider.activeFingerprintId = fingerprintId;");
  lines.push("    saveProviderObject(provider);");
  lines.push("  }");
  lines.push("");
  lines.push("  function saveProviderObject(provider) {");
  lines.push("    render();");
  lines.push("    vscode.postMessage({ type: 'saveProvider', provider: provider });");
  lines.push("  }");
  lines.push("");
  lines.push("  function askDelete(id) {");
  lines.push("    var provider = getProvider(id);");
  lines.push("    deletingId = id;");
  lines.push("    var count = getProviderModels(id).length;");
  lines.push("    document.getElementById('deleteMsg').textContent = '确定要删除供应商 \"' + (provider ? provider.name : id) + '\" 吗？' + (count > 0 ? ' 将同时删除其下的 ' + count + ' 个模型。' : '');");
  lines.push("    document.getElementById('modalDelete').classList.add('show');");
  lines.push("  }");
  lines.push("");
  lines.push("  function confirmDelete() {");
  lines.push("    if (deletingId) vscode.postMessage({ type: 'deleteProvider', id: deletingId });");
  lines.push("    hideModal('modalDelete');");
  lines.push("    deletingId = null;");
  lines.push("  }");
  lines.push("");
  lines.push("  function testProvider(providerId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    if (!provider) return;");
  lines.push("    var providerModels = getProviderModels(providerId);");
  lines.push("    var modelName = providerModels.length > 0 ? providerModels[0].modelName : '';");
  lines.push("    setFetchStatus(providerId, '测试中...');");
  lines.push("    vscode.postMessage({ type: 'testProvider', providerId: providerId, baseUrl: provider.baseUrl, apiKey: provider.apiKey || '', modelName: modelName, providerName: provider.name });");
  lines.push("  }");
  lines.push("");
  lines.push("  function fetchModels(providerId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    if (!provider) return;");
  lines.push("    setFetchStatus(providerId, '获取中...');");
  lines.push("    vscode.postMessage({ type: 'fetchModels', baseUrl: provider.baseUrl, apiKey: provider.apiKey || '', providerId: providerId });");
  lines.push("  }");
  lines.push("");
  lines.push("  function handleModelsFetched(providerId, fetchedIds) {");
  lines.push("    if (!fetchedIds || fetchedIds.length === 0) {");
  lines.push("      setFetchStatus(providerId, '未获取到模型');");
  lines.push("      return;");
  lines.push("    }");
  lines.push("    var existingIds = {};");
  lines.push("    for (var i = 0; i < models.length; i++) {");
  lines.push("      if (models[i].providerId === providerId) existingIds[models[i].modelName] = true;");
  lines.push("    }");
  lines.push("    var newCount = 0;");
  lines.push("    for (var j = 0; j < fetchedIds.length; j++) {");
  lines.push("      var fetchedModel = normalizeFetchedModel(fetchedIds[j]);");
  lines.push("      var modelName = fetchedModel.id;");
  lines.push("      if (!modelName || existingIds[modelName]) continue;");
  lines.push("      var modelLabel = fetchedModel.displayName && fetchedModel.displayName !== modelName ? fetchedModel.displayName : modelName;");
  lines.push("      models.push({");
  lines.push("        id: 'm_' + Date.now() + '_' + j + '_' + Math.random().toString(36).slice(2, 7),");
  lines.push("        providerId: providerId,");
  lines.push("        modelName: modelName,");
  lines.push("        displayName: getProviderName(providerId) + ' - ' + modelLabel,");
  lines.push("        maxInputTokens: fetchedModel.maxInputTokens || inferMaxInputTokens(modelName, getProviderName(providerId)),");
  lines.push("        reasoningProfile: 'auto',");
  lines.push("        reasoningEffort: 'default',");
  lines.push("        reasoningEffortOptions: fetchedModel.reasoningEffortOptions || [],");
  lines.push("        thinkingType: 'default',");
  lines.push("        thinkingTypeOptions: fetchedModel.thinkingTypeOptions || [],");
  lines.push("        thinkingBudget: undefined,");
  lines.push("        customRequestParams: '',");
  lines.push("        visible: true");
  lines.push("      });");
  lines.push("      existingIds[modelName] = true;");
  lines.push("      newCount++;");
  lines.push("    }");
  lines.push("    render();");
  lines.push("    saveModels(providerId);");
  lines.push("    setFetchStatus(providerId, newCount > 0 ? '✓ +' + newCount + ' 个新模型' : '✓ 已同步');");
  lines.push("  }");
  lines.push("");
  lines.push("  function showError(providerId, error) {");
  lines.push("    setFetchStatus(providerId, '获取失败: ' + error);");
  lines.push("    setStatus('获取模型失败');");
  lines.push("  }");
  lines.push("");
  lines.push("  function toggleAll(providerId, visible) {");
  lines.push("    for (var i = 0; i < models.length; i++) {");
  lines.push("      if (models[i].providerId === providerId) models[i].visible = visible;");
  lines.push("    }");
  lines.push("    render();");
  lines.push("    saveModels(providerId);");
  lines.push("  }");
  lines.push("");
  lines.push("  function saveModels(providerId) {");
  lines.push("    var providerModels = [];");
  lines.push("    for (var i = 0; i < models.length; i++) {");
  lines.push("      if (models[i].providerId === providerId) {");
  lines.push("        var checkbox = document.getElementById('cb_' + models[i].id);");
  lines.push("        if (checkbox) models[i].visible = checkbox.checked;");
  lines.push("        var profile = document.getElementById('profile_' + models[i].id);");
  lines.push("        if (profile) models[i].reasoningProfile = profile.value;");
  lines.push("        var reasoning = document.getElementById('reasoning_' + models[i].id);");
  lines.push("        if (reasoning) models[i].reasoningEffort = reasoning.value;");
  lines.push("        var thinking = document.getElementById('thinking_' + models[i].id);");
  lines.push("        if (thinking) models[i].thinkingType = thinking.value;");
  lines.push("        var budget = document.getElementById('budget_' + models[i].id);");
  lines.push("        if (budget) models[i].thinkingBudget = budget.value === '' ? undefined : parseInt(budget.value, 10);");
  lines.push("        var custom = document.getElementById('custom_' + models[i].id);");
  lines.push("        if (custom) models[i].customRequestParams = custom.value;");
  lines.push("        providerModels.push(models[i]);");
  lines.push("      }");
  lines.push("    }");
  lines.push("    vscode.postMessage({ type: 'saveModels', providerId: providerId, models: providerModels });");
  lines.push("    setFetchStatus(providerId, '✓ 已保存');");
  lines.push("  }");
  lines.push("");
  lines.push("  function getProvider(providerId) {");
  lines.push("    for (var i = 0; i < providers.length; i++) {");
  lines.push("      if (providers[i].id === providerId) return providers[i];");
  lines.push("    }");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  function getFingerprints(provider) {");
  lines.push("    return provider && Array.isArray(provider.fingerprints) ? provider.fingerprints : [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function getFingerprint(provider, fingerprintId) {");
  lines.push("    var fingerprints = getFingerprints(provider);");
  lines.push("    for (var i = 0; i < fingerprints.length; i++) {");
  lines.push("      if (fingerprints[i].id === fingerprintId) return fingerprints[i];");
  lines.push("    }");
  lines.push("    return null;");
  lines.push("  }");
  lines.push("");
  lines.push("  function previewFingerprint(value) {");
  lines.push("    var text = String(value || '').replace(/\\s+/g, ' ').trim();");
  lines.push("    if (!text) return '';");
  lines.push("    if (text.length <= 14) return text.length <= 6 ? '••••••' : text.slice(0, 4) + '••••' + text.slice(-4);");
  lines.push("    return text.slice(0, 8) + '…' + text.slice(-6);");
  lines.push("  }");
  lines.push("");
  lines.push("  function getProviderName(providerId) {");
  lines.push("    var provider = getProvider(providerId);");
  lines.push("    return provider ? provider.name : '';");
  lines.push("  }");
  lines.push("");
  lines.push("  function inferMaxInputTokens(modelName, providerName) {");
  lines.push("    var name = String(modelName || '').trim().toLowerCase();");
  lines.push("    var provider = String(providerName || '').trim().toLowerCase();");
  lines.push("    if (name === 'step-router-v1') return 384000;");
  lines.push("    if (name === 'step-3.5-flash' || name === 'step-3.5-flash-2603' || name.indexOf('step-3.5-flash') >= 0) return 256000;");
  lines.push("    if (name === 'step-image-edit-2' || name.indexOf('image') >= 0 || name.indexOf('edit') >= 0 || provider.indexOf('image') >= 0) return 512;");
  lines.push("    if (name === 'stepaudio-2.5-asr') return 1024;");
  lines.push("    if (name.indexOf('stepaudio') === 0 || provider.indexOf('audio') >= 0) return 10000;");
  lines.push("    if (name.indexOf('glm-4.5') === 0) return 128000;");
  lines.push("    if (name === 'glm-4.6' || name === 'glm-4.7' || name === 'glm-5' || name === 'glm-5-turbo' || name === 'glm-5.1' || name.indexOf('glm-5') === 0) return 200000;");
  lines.push("    return 128000;");
  lines.push("  }");
  lines.push("");
  lines.push("  function getReasoningEffortOptions(model, provider) {");
  lines.push("    if (Array.isArray(model.reasoningEffortOptions) && model.reasoningEffortOptions.length > 0) return model.reasoningEffortOptions;");
  lines.push("    var profile = getReasoningProfile(model, provider);");
  lines.push("    var name = String(model.modelName || '').trim().toLowerCase();");
  lines.push("    if (profile === 'openai') return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];");
  lines.push("    if (profile === 'deepseek') return ['high', 'max'];");
  lines.push("    if (profile === 'stepfun') return ['low', 'high'];");
  lines.push("    if (profile === 'claude') return ['low', 'medium', 'high', 'max'];");
  lines.push("    if (profile === 'gemini' && name.indexOf('gemini-3') === 0) return ['low', 'high'];");
  lines.push("    if (profile === 'custom') return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];");
  lines.push("    if (name.indexOf('gpt-5.5') === 0 || name.indexOf('gpt-5.4') === 0) return ['none', 'low', 'medium', 'high', 'xhigh'];");
  lines.push("    if (name.indexOf('gpt-5.1') === 0) return ['none', 'low', 'medium', 'high'];");
  lines.push("    if (name.indexOf('gpt-5') === 0) return ['minimal', 'low', 'medium', 'high'];");
  lines.push("    if (name.indexOf('gpt-oss') === 0 || /^o\\d/.test(name)) return ['low', 'medium', 'high'];");
  lines.push("    if (name === 'step-3.5-flash-2603') return ['low', 'high'];");
  lines.push("    return [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function getThinkingTypeOptions(model, provider) {");
  lines.push("    if (Array.isArray(model.thinkingTypeOptions) && model.thinkingTypeOptions.length > 0) return model.thinkingTypeOptions;");
  lines.push("    var profile = getReasoningProfile(model, provider);");
  lines.push("    var name = String(model.modelName || '').trim().toLowerCase();");
  lines.push("    if (profile === 'deepseek' || profile === 'qwen' || profile === 'glm' || profile === 'minimax') return ['enabled', 'disabled'];");
  lines.push("    if (profile === 'claude') return ['adaptive', 'enabled', 'disabled'];");
  lines.push("    if (profile === 'custom') return ['enabled', 'disabled', 'adaptive'];");
  lines.push("    if (name.indexOf('glm-4.5') === 0 || name === 'glm-4.6' || name === 'glm-4.7' || name === 'glm-5' || name === 'glm-5-turbo' || name === 'glm-5.1' || name.indexOf('glm-5') === 0) return ['enabled', 'disabled'];");
  lines.push("    return [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function shouldShowThinkingBudget(model, provider) {");
  lines.push("    var profile = getReasoningProfile(model, provider);");
  lines.push("    return profile === 'qwen' || profile === 'claude' || profile === 'gemini' || profile === 'custom' || !!model.thinkingBudget;");
  lines.push("  }");
  lines.push("");
  lines.push("  function getReasoningProfile(model, provider) {");
  lines.push("    var explicit = String(model.reasoningProfile || 'auto').toLowerCase();");
  lines.push("    if (explicit !== 'auto') return explicit;");
  lines.push("    var name = String(model.modelName || '').trim().toLowerCase();");
  lines.push("    var providerText = (String(provider.name || '') + ' ' + String(provider.baseUrl || '')).toLowerCase();");
  lines.push("    var value = providerText + ' ' + name;");
  lines.push("    if (value.indexOf('deepseek') >= 0) return 'deepseek';");
  lines.push("    if (value.indexOf('dashscope') >= 0 || value.indexOf('qwen') >= 0 || value.indexOf('aliyun') >= 0 || value.indexOf('alibaba') >= 0) return 'qwen';");
  lines.push("    if (value.indexOf('bigmodel') >= 0 || value.indexOf('zhipu') >= 0 || value.indexOf('智谱') >= 0 || value.indexOf('glm') >= 0) return 'glm';");
  lines.push("    if (value.indexOf('stepfun') >= 0 || value.indexOf('阶跃') >= 0 || value.indexOf('step-') >= 0) return 'stepfun';");
  lines.push("    if (value.indexOf('anthropic') >= 0 || value.indexOf('claude') >= 0) return 'claude';");
  lines.push("    if (value.indexOf('gemini') >= 0 || value.indexOf('googleapis') >= 0 || value.indexOf('google') >= 0) return 'gemini';");
  lines.push("    if (value.indexOf('minimax') >= 0 || value.indexOf('minimaxi') >= 0) return 'minimax';");
  lines.push("    if (value.indexOf('openai') >= 0 || value.indexOf('gpt-') >= 0 || /^o\\d/.test(name)) return 'openai';");
  lines.push("    return 'custom';");
  lines.push("  }");
  lines.push("");
  lines.push("  function normalizeFetchedModel(raw) {");
  lines.push("    if (typeof raw === 'string') return { id: raw };");
  lines.push("    if (!raw || typeof raw !== 'object') return { id: '' };");
  lines.push("    return {");
  lines.push("      id: String(raw.id || raw.name || raw.model || raw.modelName || raw.model_name || raw.slug || raw.value || raw.label || ''),");
  lines.push("      displayName: raw.displayName || raw.display_name || raw.title || raw.name || '',");
  lines.push("      maxInputTokens: readTokenLimit(raw),");
  lines.push("      reasoningEffortOptions: readOptionList(raw, ['reasoningEffortOptions', 'reasoning_effort_options', 'reasoning_efforts', 'supported_reasoning_efforts', 'supported_reasoning_effort'], ['reasoning_effort', 'reasoning.effort', 'reasoning', 'effort']),");
  lines.push("      thinkingTypeOptions: readOptionList(raw, ['thinkingTypeOptions', 'thinking_type_options', 'thinking_types', 'supported_thinking_types'], ['thinking.type', 'thinking', 'type'])");
  lines.push("    };");
  lines.push("  }");
  lines.push("");
  lines.push("  function readTokenLimit(raw) {");
  lines.push("    var keys = ['maxInputTokens', 'max_input_tokens', 'input_token_limit', 'prompt_token_limit', 'context_length', 'context_window', 'contextWindow', 'max_context_length', 'max_context_tokens', 'maxContextTokens', 'n_ctx'];");
  lines.push("    for (var i = 0; i < keys.length; i++) {");
  lines.push("      var value = readPositiveNumber(raw[keys[i]]);");
  lines.push("      if (value) return value;");
  lines.push("    }");
  lines.push("    var nestedKeys = ['limits', 'capabilities', 'metadata', 'top_provider'];");
  lines.push("    for (var j = 0; j < nestedKeys.length; j++) {");
  lines.push("      var nested = raw[nestedKeys[j]];");
  lines.push("      if (nested && typeof nested === 'object') {");
  lines.push("        var nestedValue = readTokenLimit(nested);");
  lines.push("        if (nestedValue) return nestedValue;");
  lines.push("      }");
  lines.push("    }");
  lines.push("    return undefined;");
  lines.push("  }");
  lines.push("");
  lines.push("  function readOptionList(raw, directKeys, parameterPaths) {");
  lines.push("    for (var i = 0; i < directKeys.length; i++) {");
  lines.push("      var direct = readStringArray(raw[directKeys[i]]);");
  lines.push("      if (direct.length > 0) return direct;");
  lines.push("    }");
  lines.push("    var fromParams = readOptionsFromParameterSchemas(raw, parameterPaths);");
  lines.push("    if (fromParams.length > 0) return fromParams;");
  lines.push("    var nestedKeys = ['limits', 'capabilities', 'metadata', 'parameters', 'supported_parameters'];");
  lines.push("    for (var j = 0; j < nestedKeys.length; j++) {");
  lines.push("      var nested = raw[nestedKeys[j]];");
  lines.push("      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {");
  lines.push("        var nestedOptions = readOptionList(nested, directKeys, parameterPaths);");
  lines.push("        if (nestedOptions && nestedOptions.length > 0) return nestedOptions;");
  lines.push("      }");
  lines.push("    }");
  lines.push("    return [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function readOptionsFromParameterSchemas(raw, parameterPaths) {");
  lines.push("    for (var i = 0; i < parameterPaths.length; i++) {");
  lines.push("      var schema = readPath(raw, parameterPaths[i]);");
  lines.push("      var direct = readStringArray(schema);");
  lines.push("      if (direct.length > 0) return direct;");
  lines.push("      if (schema && typeof schema === 'object') {");
  lines.push("        var keys = ['enum', 'values', 'options', 'allowed', 'supported_values', 'choices'];");
  lines.push("        for (var j = 0; j < keys.length; j++) {");
  lines.push("          var values = readStringArray(schema[keys[j]]);");
  lines.push("          if (values.length > 0) return values;");
  lines.push("        }");
  lines.push("      }");
  lines.push("    }");
  lines.push("    return [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function readPath(raw, path) {");
  lines.push("    var current = raw;");
  lines.push("    var parts = path.split('.');");
  lines.push("    for (var i = 0; i < parts.length; i++) {");
  lines.push("      if (!current || typeof current !== 'object') return undefined;");
  lines.push("      current = current[parts[i]];");
  lines.push("    }");
  lines.push("    return current;");
  lines.push("  }");
  lines.push("");
  lines.push("  function readStringArray(value) {");
  lines.push("    if (Array.isArray(value)) {");
  lines.push("      var result = [];");
  lines.push("      for (var i = 0; i < value.length; i++) {");
  lines.push("        if (typeof value[i] === 'string' && value[i].trim()) result.push(value[i].trim());");
  lines.push("      }");
  lines.push("      return result;");
  lines.push("    }");
  lines.push("    if (typeof value === 'string') {");
  lines.push("      return value.split(/[,\\s|\\/]+/).map(function(item) { return item.trim(); }).filter(function(item) { return !!item; });");
  lines.push("    }");
  lines.push("    return [];");
  lines.push("  }");
  lines.push("");
  lines.push("  function readPositiveNumber(value) {");
  lines.push("    if (typeof value === 'number' && isFinite(value) && value > 0) return Math.floor(value);");
  lines.push("    if (typeof value === 'string') {");
  lines.push("      var parsed = Number(value.replace(/,/g, '').trim());");
  lines.push("      if (isFinite(parsed) && parsed > 0) return Math.floor(parsed);");
  lines.push("    }");
  lines.push("    return undefined;");
  lines.push("  }");
  lines.push("");
  lines.push("  function getProviderModels(providerId) {");
  lines.push("    var result = [];");
  lines.push("    for (var i = 0; i < models.length; i++) {");
  lines.push("      if (models[i].providerId === providerId) result.push(models[i]);");
  lines.push("    }");
  lines.push("    return result;");
  lines.push("  }");
  lines.push("");
  lines.push("  function setFetchStatus(providerId, message) {");
  lines.push("    var el = document.getElementById('fs_' + providerId);");
  lines.push("    if (el) el.textContent = message;");
  lines.push("  }");
  lines.push("");
  lines.push("  function setStatus(message) {");
  lines.push("    var el = document.getElementById('statusBar');");
  lines.push("    if (el) el.textContent = message;");
  lines.push("  }");
  lines.push("");
  lines.push("  function hideModal(id) {");
  lines.push("    var el = document.getElementById(id);");
  lines.push("    if (el) el.classList.remove('show');");
  lines.push("  }");
  lines.push("");
  lines.push("  function showFatal(title, err) {");
  lines.push("    var el = document.getElementById('providersList');");
  lines.push("    var message = err && err.message ? err.message : String(err);");
  lines.push("    var stack = err && err.stack ? err.stack : '';");
  lines.push("    if (el) el.innerHTML = '<div class=\"empty\" style=\"color:#f14c4c;\">⚠️ ' + esc(title) + ': ' + esc(message) + '<br><pre style=\"font-size:10px;text-align:left;margin-top:8px;white-space:pre-wrap;\">' + esc(stack) + '</pre></div>'; ");
  lines.push("    setStatus(title);");
  lines.push("  }");
  lines.push("");
  lines.push("  function esc(value) {");
  lines.push("    var div = document.createElement('div');");
  lines.push("    div.textContent = value == null ? '' : String(value);");
  lines.push("    return div.innerHTML;");
  lines.push("  }");
  lines.push("");
  lines.push("  function attr(value) {");
  lines.push("    return String(value == null ? '' : value)");
  lines.push("      .replace(/&/g, '&amp;')");
  lines.push("      .replace(/\"/g, '&quot;')");
  lines.push("      .replace(/</g, '&lt;')");
  lines.push("      .replace(/>/g, '&gt;');");
  lines.push("  }");
  lines.push("})();");

  return lines.join("\n");
}
