import * as vscode from "vscode";
import { CustomAIProvider } from "./provider.js";
import { initLogger, log } from "./logger.js";
import { getWebviewContent } from "./webview.js";
import { inferMaxInputTokens } from "./modelMetadata.js";
import {
  Provider,
  AIModel,
  getProviders,
  saveProvider,
  deleteProvider,
  getModels,
  saveModels,
  migrateOldConfigIfNeeded,
} from "./config.js";

let provider: CustomAIProvider | undefined;
let configPanel: vscode.WebviewPanel | undefined;

interface FetchedModelInfo {
  id: string;
  maxInputTokens?: number;
  reasoningEffortOptions?: string[];
  thinkingTypeOptions?: string[];
}

export function activate(context: vscode.ExtensionContext): void {
  initLogger();
  log("Extension activating...");

  const migrated = migrateOldConfigIfNeeded();
  if (migrated) {
    log("Migrated old config to new Provider/Model format");
  }

  provider = new CustomAIProvider(context);
  log("CustomAIProvider created");

  const setupParticipant = vscode.chat.createChatParticipant(
    "customai.setup",
    async (request, _chatCtx, stream, _token) => {
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
    vscode.commands.registerCommand("customai.openConfig", () => showConfigPanel(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModel", () => showConfigPanel(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModelQuick", async () => await quickAddModel())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("customai.listModels", async () => {
      const models = getModels();
      if (models.length === 0) {
        vscode.window.showInformationMessage("没有配置任何模型。请使用 'Custom AI: Open Config' 添加。");
      } else {
        const list = models.map((m) => `• ${m.displayName} (${m.modelName})`).join("\n");
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

// ══════════════════════════════════════════════════════
//  Quick Add Model (lightning-fast flow, no webview)
// ══════════════════════════════════════════════════════

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
    { label: "$(gear) 自定义 API", description: "任何 OpenAI 兼容 API", alwaysShow: true },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择要添加的模型提供商",
    title: "快速添加自定义模型",
    matchOnDescription: true,
  });
  if (!selected) return;

  const labelText = selected.label.replace(/^\$\(star-full\)\s*/, "").replace(/^\$\(gear\)\s*/, "");

  const defaults: Record<string, { baseUrl: string; providerName: string }> = {
    "阶跃星辰 (step)": { baseUrl: "https://api.stepfun.com/v1", providerName: "阶跃星辰" },
    "智谱 ai (glm)": { baseUrl: "https://open.bigmodel.cn/api/paas/v4", providerName: "智谱AI" },
    "月之暗面 (moonshot)": { baseUrl: "https://api.moonshot.cn/v1", providerName: "月之暗面" },
    "deepseek": { baseUrl: "https://api.deepseek.com/v1", providerName: "DeepSeek" },
    "百川 (baichuan)": { baseUrl: "https://api.baichuan-ai.com/v1", providerName: "百川" },
    "零一万物 (yi)": { baseUrl: "https://api.lingyiwanwu.com/v1", providerName: "零一万物" },
    "openai": { baseUrl: "https://api.openai.com/v1", providerName: "OpenAI" },
    "anthropic (claude)": { baseUrl: "https://api.anthropic.com/v1", providerName: "Anthropic" },
    "ollama": { baseUrl: "http://localhost:11434/v1", providerName: "Ollama" },
    "自定义 api": { baseUrl: "", providerName: labelText },
  };
  const d = defaults[labelText.toLowerCase()] || defaults["自定义 api"];

  const baseUrl = await vscode.window.showInputBox({
    prompt: "输入 Base URL",
    value: d.baseUrl,
    validateInput: (v) => (v.trim() ? null : "URL 不能为空"),
  });
  if (!baseUrl) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: "输入 API Key",
    password: true,
    placeHolder: "sk-...",
  });
  if (apiKey === undefined) return;

  const provId = Date.now().toString();
  const newProvider: Provider = {
    id: provId,
    name: d.providerName,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey?.trim() || "",
  };

  const fetchedModels: FetchedModelInfo[] = [];
  try {
    const url = baseUrl.trim().replace(/\/$/, "") + "/models";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const resp = await fetch(url, { method: "GET", headers });
    if (resp.ok) {
      const data = await resp.json();
      fetchedModels.push(...parseFetchedModels(data));
    }
  } catch (err) {
    log(`quickAddModel fetchModels error: ${err}`);
  }

  let visibleModelIds: string[] = [];
  if (fetchedModels.length > 0) {
    const fetchedModelIds = fetchedModels.map((m) => m.id);
    const picks = await vscode.window.showQuickPick(
      fetchedModelIds.map((m) => ({ label: m, picked: true, alwaysShow: true })),
      {
        placeHolder: "勾选要启用的模型（取消勾选则不添加）",
        title: "可用模型列表",
        canPickMany: true,
      }
    );
    if (!picks || picks.length === 0) return;
    visibleModelIds = picks.map((p) => p.label);
  } else {
    const manual = await vscode.window.showInputBox({
      prompt: "未获取到模型列表，请手动输入模型名称",
      placeHolder: "gpt-4-turbo-preview",
    });
    if (!manual) return;
    visibleModelIds = [manual.trim()];
  }

  await saveProvider(newProvider);

  const existingModels = getModels();
  const existingModelNames = new Set(
    existingModels
      .filter((m) => m.providerId === provId)
      .map((m) => m.modelName)
  );

  const fetchedModelMap = new Map(fetchedModels.map((m) => [m.id, m]));
  const newModels: AIModel[] = [];
  for (const mName of [...new Set([...visibleModelIds, ...fetchedModels.map((m) => m.id)])]) {
    if (existingModelNames.has(mName)) continue;
    const fetchedModel = fetchedModelMap.get(mName);
    newModels.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      providerId: provId,
      modelName: mName,
      displayName: `${d.providerName} - ${mName}`,
      maxInputTokens: fetchedModel?.maxInputTokens || inferMaxInputTokens(mName, d.providerName),
      reasoningProfile: "auto",
      reasoningEffort: "default",
      reasoningEffortOptions: fetchedModel?.reasoningEffortOptions || [],
      thinkingType: "default",
      thinkingTypeOptions: fetchedModel?.thinkingTypeOptions || [],
      thinkingBudget: undefined,
      customRequestParams: "",
      visible: visibleModelIds.includes(mName),
    });
  }

  if (newModels.length === 0) {
    vscode.window.showInformationMessage(`供应商 "${d.providerName}" 已存在，没有新模型需要添加。`);
  } else {
    existingModels.push(...newModels);
    await saveModels(existingModels);
    vscode.window.showInformationMessage(
      `已添加供应商 "${d.providerName}"，共 ${newModels.filter((m) => m.visible).length} 个模型可见！`
    );
  }

  provider?.refreshModelPicker();
}

// ══════════════════════════════════════════════════════
//  Config Panel Webview
// ══════════════════════════════════════════════════════

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<FetchedModelInfo[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  log(`Fetching models from: ${url}`);
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return parseFetchedModels(await response.json());
}

function parseFetchedModels(payload: unknown): FetchedModelInfo[] {
  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: unknown[] }).data
      : Array.isArray((payload as { models?: unknown[] })?.models)
        ? (payload as { models: unknown[] }).models
        : [];

  return rawModels
    .map(parseFetchedModel)
    .filter((model): model is FetchedModelInfo => !!model?.id);
}

function parseFetchedModel(raw: unknown): FetchedModelInfo | undefined {
  if (typeof raw === "string") {
    return { id: raw };
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const id = readString(record, ["id", "name", "model"]);
  if (!id) return undefined;

  return {
    id,
    maxInputTokens: readTokenLimit(record, [
      "maxInputTokens",
      "max_input_tokens",
      "input_token_limit",
      "prompt_token_limit",
      "context_length",
      "context_window",
      "contextWindow",
      "max_context_length",
      "max_context_tokens",
      "maxContextTokens",
      "n_ctx",
    ]),
    reasoningEffortOptions: readOptionList(record, [
      "reasoningEffortOptions",
      "reasoning_effort_options",
      "reasoning_efforts",
      "supported_reasoning_efforts",
      "supported_reasoning_effort",
    ], ["reasoning_effort", "reasoning.effort", "reasoning", "effort"]),
    thinkingTypeOptions: readOptionList(record, [
      "thinkingTypeOptions",
      "thinking_type_options",
      "thinking_types",
      "supported_thinking_types",
    ], ["thinking.type", "thinking", "type"]),
  };
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readTokenLimit(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = readNumber(record[key]);
    if (value) return value;
  }

  for (const nestedKey of ["limits", "capabilities", "metadata", "top_provider"]) {
    const nested = record[nestedKey];
    if (nested && typeof nested === "object") {
      const value = readTokenLimit(nested as Record<string, unknown>, keys);
      if (value) return value;
    }
  }

  return undefined;
}

function readOptionList(record: Record<string, unknown>, directKeys: string[], parameterPaths: string[]): string[] | undefined {
  for (const key of directKeys) {
    const direct = readStringArray(record[key]);
    if (direct.length > 0) return direct;
  }

  const fromParams = readOptionsFromParameterSchemas(record, parameterPaths);
  if (fromParams.length > 0) return fromParams;

  for (const nestedKey of ["limits", "capabilities", "metadata", "parameters", "supported_parameters"]) {
    const nested = record[nestedKey];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedOptions = readOptionList(nested as Record<string, unknown>, directKeys, parameterPaths);
      if (nestedOptions?.length) return nestedOptions;
    }
  }

  return undefined;
}

function readOptionsFromParameterSchemas(record: Record<string, unknown>, parameterPaths: string[]): string[] {
  for (const path of parameterPaths) {
    const schema = readPath(record, path);
    const direct = readStringArray(schema);
    if (direct.length > 0) return direct;
    if (schema && typeof schema === "object") {
      const schemaRecord = schema as Record<string, unknown>;
      for (const key of ["enum", "values", "options", "allowed", "supported_values", "choices"]) {
        const values = readStringArray(schemaRecord[key]);
        if (values.length > 0) return values;
      }
    }
  }
  return [];
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter((item) => !!item);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s|/]+/)
      .map((item) => item.trim())
      .filter((item) => !!item);
  }
  return [];
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return undefined;
}

function showConfigPanel(context: vscode.ExtensionContext): void {
  log("showConfigPanel: open requested");
  if (configPanel) {
    configPanel.reveal(vscode.ViewColumn.One);
    sendConfig();
    return;
  }

  configPanel = vscode.window.createWebviewPanel(
    "customai.config",
    "Custom AI 配置",
    vscode.ViewColumn.One,
    { retainContextWhenHidden: true, enableScripts: true }
  );

  configPanel.webview.onDidReceiveMessage(async (message) => {
    log(`showConfigPanel: received message ${message?.type || "unknown"}`);
    switch (message.type) {
      case "getConfig":
        sendConfig();
        break;
      case "saveProvider": {
        const prov: Provider = message.provider;
        if (!prov.name || !prov.baseUrl) return;
        await saveProvider(prov);
        provider?.refreshModelPicker();
        sendConfig();
        break;
      }
      case "deleteProvider": {
        await deleteProvider(message.id);
        provider?.refreshModelPicker();
        sendConfig();
        break;
      }
      case "fetchModels": {
        try {
          const fetched = await fetchAvailableModels(message.baseUrl, message.apiKey || "");
          configPanel?.webview.postMessage({ type: "modelsFetched", models: fetched, providerId: message.providerId });
        } catch (err: any) {
          configPanel?.webview.postMessage({ type: "modelsFetchError", error: err.message, providerId: message.providerId });
        }
        break;
      }
      case "saveModels": {
        const { providerId, models: providerModels } = message as { providerId: string; models: AIModel[] };
        const allModels = getModels();
        const otherModels = allModels.filter((m: AIModel) => m.providerId !== providerId);
        const merged = otherModels.concat(providerModels);
        await saveModels(merged);
        provider?.refreshModelPicker();
        sendConfig();
        break;
      }
    }
  });

  configPanel.webview.html = getWebviewContent();

  let retries = 0;
  const retrySend = setInterval(() => {
    sendConfig();
    retries++;
    if (retries >= 5) clearInterval(retrySend);
  }, 150);

  configPanel.onDidDispose(() => { configPanel = undefined; });
}

function sendConfig(): void {
  const p = getProviders();
  const m = getModels();
  log(`sendConfig: providers=${p.length}, models=${m.length}`);
  if (configPanel) {
    configPanel.webview.postMessage({ type: "config", providers: p, models: m });
  } else {
    log("sendConfig: configPanel is null!");
  }
}

// ══════════════════════════════════════════════════════
export function deactivate(): void {
  provider?.prepareForDeactivate();
  configPanel?.dispose();
}

