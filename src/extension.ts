/**
 * extension.ts — 扩展主入口
 *
 * 职责：
 *   1. 激活扩展 + 注册命令 + 迁移旧配置
 *   2. 快速添加模型（QuickPick 流程，不走 Webview）
 *   3. 配置面板 Webview（供应商管理 + 模型可见性勾选）
 *   4. 从 API 获取模型列表并解析元数据（上下文窗口、推理选项等）
 */

import * as vscode from "vscode";
import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
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
const configWebviews = new Set<vscode.Webview>();

/** API 返回的模型元数据 */
interface FetchedModelInfo {
  id: string;
  displayName?: string;
  maxInputTokens?: number;
  reasoningEffortOptions?: string[];
  thinkingTypeOptions?: string[];
  supportedParameters?: string[];
  inputModalities?: string[];
}

/**
 * 扩展激活入口
 * - 启动日志
 * - 迁移旧格式配置
 * - 注册 chat participant + 命令 + language model provider
 */
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
    vscode.window.registerWebviewViewProvider(
      "customai.configView",
      new CustomAIConfigViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.openConfig", async () => await focusConfigView(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModel", async () => await focusConfigView(context))
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

class CustomAIConfigViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    log("CustomAIConfigViewProvider: resolving sidebar view");
    const disposable = configureConfigWebview(webviewView.webview, this.context, "sidebar");
    webviewView.onDidDispose(() => disposable.dispose());
  }
}

async function focusConfigView(context: vscode.ExtensionContext): Promise<void> {
  try {
    await vscode.commands.executeCommand("customai.configView.focus");
  } catch (error) {
    log(`focusConfigView failed, opening panel fallback: ${(error as Error).message}`);
    showConfigPanel(context);
  }
}

// ══════════════════════════════════════════════════════
//  Quick Add Model — 快速添加流程（不走 Webview）
//  用户选择预设供应商 → 填 API Key → 自动获取模型列表 → 多选勾选 → 保存
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

  // 从 /models 端点获取可用模型列表及其元数据
  const fetchedModels: FetchedModelInfo[] = [];
  try {
    fetchedModels.push(...await fetchAvailableModels(newProvider));
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

  // 去重：跳过已存在的模型
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
//  Config Panel Webview — 配置面板（供应商管理 + 模型勾选）
// ══════════════════════════════════════════════════════

/** 通过 Extension Host 的 Node.js fetch 请求 API（不受 CORS 限制） */
async function fetchAvailableModels(providerConfig: Pick<Provider, "baseUrl" | "apiKey"> & Partial<Provider>): Promise<FetchedModelInfo[]> {
  const urls = resolveModelEndpoints(providerConfig.baseUrl);
  const merged = new Map<string, FetchedModelInfo>();
  const errors: string[] = [];

  for (const url of urls) {
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (providerConfig.apiKey) headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
    applyProviderFingerprintHeaders(headers, providerConfig);
    log(`Fetching models from: ${url}`);

    try {
      const response = await requestWithLocalFallback(url, { method: "GET", headers });
      if (!response.ok) {
        errors.push(`${url}: HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
        continue;
      }

      for (const model of parseFetchedModels(await response.json())) {
        if (!merged.has(model.id)) merged.set(model.id, model);
      }
    } catch (error) {
      errors.push(`${url}: ${(error as Error).message}`);
    }
  }

  if (merged.size === 0 && errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function testProviderConnection(
  baseUrl: string,
  apiKey: string,
  modelName: string,
  providerName: string,
  providerConfig?: Partial<Provider>
): Promise<{ ok: boolean; detail: string }> {
  const isAnthropic = providerName.toLowerCase().includes("anthropic") || providerName.toLowerCase().includes("claude");
  const endpoint = resolveChatEndpoint(baseUrl, isAnthropic);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  const body: Record<string, unknown> = isAnthropic
    ? {
        model: modelName || "claude-3-5-sonnet-latest",
        max_tokens: 16,
        messages: [{ role: "user", content: "ping" }],
      }
    : {
        model: modelName || "test",
        messages: [{ role: "user", content: "ping" }],
        stream: false,
        max_tokens: 16,
      };

  if (apiKey) {
    if (isAnthropic) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }
  applyProviderFingerprintHeaders(headers, providerConfig);

  try {
    const response = await requestWithLocalFallback(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}: ${text.slice(0, 180)}` };
    }
    return { ok: true, detail: text ? text.slice(0, 120).replace(/\s+/g, " ") : "连接正常" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

function resolveProviderFromMessage(message: any): Provider {
  const existing = getProviders().find((item) => item.id === message.providerId);
  if (existing) return existing;
  return {
    id: message.providerId || Date.now().toString(),
    name: message.providerName || "Custom AI",
    baseUrl: message.baseUrl || "",
    apiKey: message.apiKey || "",
    fingerprints: Array.isArray(message.fingerprints) ? message.fingerprints : [],
    activeFingerprintId: message.activeFingerprintId,
  };
}

function applyProviderFingerprintHeaders(headers: Record<string, string>, providerConfig?: Partial<Provider>): void {
  const fingerprint = resolveActiveFingerprint(providerConfig);
  if (!fingerprint) return;

  const value = (fingerprint.value || "").trim();
  if (!value) return;

  const jsonHeaders = parseFingerprintHeaders(value);
  if (jsonHeaders) {
    Object.assign(headers, jsonHeaders);
    log(`Applied fingerprint headers for model fetch: ${fingerprint.name || fingerprint.id}`);
    return;
  }

  const headerName = (fingerprint.headerName || "X-Fingerprint").trim() || "X-Fingerprint";
  headers[headerName] = value;
  log(`Applied fingerprint header ${headerName} for model fetch: ${fingerprint.name || fingerprint.id}`);
}

function resolveActiveFingerprint(providerConfig?: Partial<Provider>): { id: string; name: string; value: string; headerName?: string } | undefined {
  const fingerprints = Array.isArray(providerConfig?.fingerprints)
    ? providerConfig.fingerprints.filter((item) => item && item.value)
    : [];
  if (fingerprints.length === 0) return undefined;
  return fingerprints.find((item) => item.id === providerConfig?.activeFingerprintId) || fingerprints[0];
}

function parseFingerprintHeaders(value: string): Record<string, string> | undefined {
  if (!value.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const source = parsed.headers && typeof parsed.headers === "object" && !Array.isArray(parsed.headers)
      ? parsed.headers as Record<string, unknown>
      : parsed;
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(source)) {
      if (!key || raw === undefined || raw === null) continue;
      result[key] = typeof raw === "string" ? raw : JSON.stringify(raw);
    }
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

type SimpleHttpResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

async function requestWithLocalFallback(url: string, init: RequestInit): Promise<SimpleHttpResponse> {
  if (isLocalEndpoint(url)) {
    const configuredHosts = vscode.workspace.getConfiguration("customai").get<string[]>("localEndpointHosts", []);
    const candidates = resolveLocalEndpointCandidates(url, configuredHosts);
    ensureNoProxyForLocalEndpoints(candidates);
    let lastError: unknown;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      try {
        log(index === 0
          ? `Local endpoint detected; using direct HTTP transport: ${candidate}`
          : `Trying local endpoint candidate ${index + 1}/${candidates.length}: ${candidate}`);
        return await requestDirect(candidate, init);
      } catch (error) {
        lastError = error;
        const canTryNext = index < candidates.length - 1 && isRetryableTransportError(error);
        if (!canTryNext) throw error;
        log(`Local endpoint candidate failed (${describeError(error)}); trying next candidate`);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return await fetch(url, init);
}

function requestDirect(urlString: string, init: RequestInit): Promise<SimpleHttpResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch (error) {
      reject(error);
      return;
    }

    const body = typeof init.body === "string" ? init.body : init.body ? String(init.body) : undefined;
    const headers = { ...(init.headers as Record<string, string> || {}) };
    if (body !== undefined) {
      headers["Content-Length"] = Buffer.byteLength(body).toString();
    }

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, {
      method: init.method || "GET",
      agent: false,
      headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const status = res.statusCode || 0;
        const payload = Buffer.concat(chunks).toString("utf8");
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: async () => payload,
          json: async () => JSON.parse(payload),
        });
      });
    });

    req.setTimeout(30000, () => {
      const error = new Error("Request timed out after 30s");
      error.name = "TimeoutError";
      req.destroy(error);
    });

    req.on("error", reject);
    req.end(body);
  });
}

function isLocalEndpoint(endpoint: string): boolean {
  try {
    return isLocalHostname(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

function resolveLocalEndpointCandidates(endpoint: string, configuredHosts: string[]): string[] {
  const candidates = [endpoint];
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return candidates;
  }

  const hosts = getLocalEndpointHostCandidates(url.hostname, configuredHosts);
  for (const host of hosts) {
    try {
      const candidate = new URL(endpoint);
      candidate.hostname = host;
      const candidateUrl = candidate.toString();
      if (!candidates.includes(candidateUrl)) candidates.push(candidateUrl);
    } catch {
      // Ignore invalid configured host overrides.
    }
  }
  if (candidates.length > 1) log(`Local endpoint candidates: ${candidates.join(", ")}`);
  return candidates;
}

function getLocalEndpointHostCandidates(currentHost: string, configuredHosts: string[]): string[] {
  const current = normalizeHostname(currentHost);
  const hosts: string[] = [];
  const addHost = (host: string | undefined): void => {
    const normalized = normalizeHostname(host || "");
    if (!normalized || normalized === current || hosts.includes(normalized)) return;
    hosts.push(normalized);
  };

  for (const host of configuredHosts || []) addHost(host);
  addHost("localhost");
  addHost("127.0.0.1");

  if (isWslEnvironment()) {
    for (const host of readWslHostCandidates()) addHost(host);
    addHost("host.docker.internal");
  }

  return hosts;
}

function ensureNoProxyForLocalEndpoints(endpoints: string[]): void {
  const hasLocalEndpoint = endpoints.some((endpoint) => isLocalEndpoint(endpoint));
  if (!hasLocalEndpoint) return;

  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  for (const endpoint of endpoints) {
    try {
      const hostname = normalizeHostname(new URL(endpoint).hostname);
      if (hostname) hosts.add(hostname);
    } catch {
      // Ignore invalid endpoint candidates.
    }
  }
  mergeNoProxyHosts([...hosts]);
}

function mergeNoProxyHosts(hosts: string[]): void {
  const current = `${process.env.NO_PROXY || ""},${process.env.no_proxy || ""}`;
  const values = current
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const normalized = new Set(values.map((value) => normalizeHostname(value)));
  let changed = false;

  for (const host of hosts) {
    const normalizedHost = normalizeHostname(host);
    if (!normalizedHost || normalized.has(normalizedHost)) continue;
    values.push(host);
    normalized.add(normalizedHost);
    changed = true;
  }

  if (changed) {
    const next = values.join(",");
    process.env.NO_PROXY = next;
    process.env.no_proxy = next;
    log(`NO_PROXY updated for local endpoints: ${hosts.join(", ")}`);
  }
}

function readWslHostCandidates(): string[] {
  const hosts: string[] = [];
  const add = (value: string | undefined): void => {
    const host = (value || "").trim();
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !hosts.includes(host)) hosts.push(host);
  };

  add(process.env.CUSTOMAI_LOCAL_HOST);
  add(process.env.WSL_HOST_IP);

  try {
    const resolvConf = fs.readFileSync("/etc/resolv.conf", "utf8");
    for (const match of resolvConf.matchAll(/^\s*nameserver\s+([^\s#]+)/gm)) {
      add(match[1]);
    }
  } catch {
    // Not running on WSL/Linux or resolv.conf is unavailable.
  }

  return hosts;
}

function isWslEnvironment(): boolean {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLocalHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "host.docker.internal"
    || normalized.endsWith(".local")
    || isPrivateIpv4(normalized);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

function isRetryableTransportError(error: unknown): boolean {
  const messages = collectErrorChain(error)
    .map((item) => item.message.toLowerCase())
    .join(" ");
  const codes = collectErrorChain(error)
    .map((item) => item.code.toLowerCase())
    .filter(Boolean);
  return [
    "socket hang up",
    "fetch failed",
    "econnreset",
    "econnrefused",
    "etimedout",
    "ehostunreach",
    "enetworkdown",
    "enotfound",
    "socket closed",
    "premature close",
    "aborted",
    "terminated",
    "connection closed",
    "und_err_socket",
  ].some((value) => messages.includes(value) || codes.includes(value));
}

function describeError(error: unknown): string {
  return collectErrorChain(error)
    .map((item) => item.code ? `${item.message} (${item.code})` : item.message)
    .filter(Boolean)
    .join("; ") || String(error);
}

function collectErrorChain(error: unknown): Array<{ message: string; code: string }> {
  const result: Array<{ message: string; code: string }> = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const err = current as NodeJS.ErrnoException & { cause?: unknown };
      result.push({
        message: err.message || err.name || "",
        code: typeof err.code === "string" ? err.code : "",
      });
      current = err.cause;
      continue;
    }
    if (typeof current === "object") {
      const record = current as Record<string, unknown>;
      result.push({
        message: typeof record.message === "string" ? record.message : "",
        code: typeof record.code === "string" ? record.code : "",
      });
      current = record.cause;
      continue;
    }
    result.push({ message: String(current), code: "" });
    break;
  }
  return result;
}

function resolveModelsEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/models")) return trimmed;
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed.replace(/\/chat\/completions$/, "/models");
  }
  if (trimmed.endsWith("/messages")) {
    return trimmed.replace(/\/messages$/, "/models");
  }
  return `${trimmed}/models`;
}

function resolveModelEndpoints(baseUrl: string): string[] {
  const primary = resolveModelsEndpoint(baseUrl);
  const urls = new Set<string>([primary]);

  try {
    const parsed = new URL(primary);
    const variants: Array<[string, string]> = [
      ["all", "true"],
      ["include", "all"],
      ["full", "true"],
      ["with_metadata", "true"],
      ["limit", "1000"],
    ];

    for (const [key, value] of variants) {
      const variant = new URL(parsed.toString());
      variant.searchParams.set(key, value);
      urls.add(variant.toString());
    }
  } catch {
    // 保持 primary；无效 URL 会在实际请求时返回明确错误。
  }

  return Array.from(urls);
}

function resolveChatEndpoint(baseUrl: string, isAnthropic: boolean): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (isAnthropic) {
    return trimmed.endsWith("/messages") ? trimmed : `${trimmed}/messages`;
  }
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

/**
 * 解析 API 返回的模型列表为 FetchedModelInfo 数组。
 * 兼容中转站常见格式：{data:[...]}, {models:[...]}, {result:{models:[...]}}, {payload:{data:[...]}} 等。
 */
function parseFetchedModels(payload: unknown): FetchedModelInfo[] {
  const merged = new Map<string, FetchedModelInfo>();
  for (const raw of collectModelCandidates(payload, 0, Array.isArray(payload))) {
    const model = parseFetchedModel(raw);
    if (model?.id && !merged.has(model.id)) {
      merged.set(model.id, model);
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function collectModelCandidates(payload: unknown, depth = 0, inModelList = true): unknown[] {
  if (depth > 8 || payload === undefined || payload === null) return [];

  if (Array.isArray(payload)) {
    const result: unknown[] = [];
    for (const item of payload) {
      if (inModelList || isLikelyModelRecord(item)) {
        result.push(item);
      }
      result.push(...collectModelCandidates(item, depth + 1, false));
    }
    return result;
  }

  if (typeof payload !== "object") {
    return inModelList ? [payload] : [];
  }

  const record = payload as Record<string, unknown>;
  const result: unknown[] = [];
  if (isLikelyModelRecord(record)) {
    result.push(record);
  }

  if (inModelList && !isLikelyModelRecord(record) && looksLikeModelMap(record)) {
    for (const [modelId, value] of Object.entries(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result.push({ id: modelId, ...(value as Record<string, unknown>) });
      } else if (typeof value === "string") {
        result.push({ id: modelId, name: value });
      } else if (value === true || value === null) {
        result.push({ id: modelId });
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, "");
    const isModelContainer = [
      "data",
      "models",
      "modellist",
      "modelinfo",
      "modelinfos",
      "modelinfolist",
      "availablemodels",
      "modeloptions",
      "chatmodels",
      "llms",
      "items",
      "results",
    ].includes(normalizedKey);
    if (isModelContainer || arrayLooksLikeModelList(value)) {
      result.push(...collectModelCandidates(value, depth + 1, isModelContainer));
    } else if (value && typeof value === "object" && depth < 4) {
      result.push(...collectModelCandidates(value, depth + 1, false));
    }
  }

  return result;
}

function looksLikeModelMap(record: Record<string, unknown>): boolean {
  const entries = Object.entries(record).filter(([key]) => !isEnvelopeKey(key));
  if (entries.length === 0) return false;
  return entries.every(([key, value]) => {
    if (!looksLikeModelId(key)) return false;
    return value === true
      || value === null
      || typeof value === "string"
      || isLikelyModelRecord(value)
      || (value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value));
  });
}

function arrayLooksLikeModelList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.slice(0, 8).some((item) => isLikelyModelRecord(item));
}

function isLikelyModelRecord(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const record = raw as Record<string, unknown>;
  return !!readString(record, ["id", "name", "model", "modelName", "model_name", "slug", "value", "label"]);
}

function isEnvelopeKey(key: string): boolean {
  return [
    "object",
    "success",
    "ok",
    "status",
    "code",
    "message",
    "error",
    "data",
    "result",
    "results",
    "payload",
    "response",
    "meta",
    "metadata",
    "pagination",
    "page",
    "total",
    "count",
  ].includes(key.toLowerCase().replace(/[-_\s]/g, ""));
}

function looksLikeModelId(value: string): boolean {
  const id = value.trim().toLowerCase();
  if (!id || isEnvelopeKey(id)) return false;
  return /[/:.\-]/.test(id)
    || /^(gpt|o\d|chatgpt|claude|gemini|deepseek|qwen|glm|kimi|moonshot|yi-|llama|mistral|mixtral|command|doubao|ernie|hunyuan|step|baichuan|minimax)/.test(id);
}

function isReservedModelId(value: string): boolean {
  return [
    "object",
    "success",
    "ok",
    "status",
    "code",
    "message",
    "error",
    "data",
    "result",
    "results",
    "payload",
    "response",
    "list",
    "true",
    "false",
  ].includes(value.trim().toLowerCase());
}

/** 解析单个 API 模型对象（可能是字符串或对象） */
function parseFetchedModel(raw: unknown): FetchedModelInfo | undefined {
  if (typeof raw === "string") {
    const id = raw.trim();
    return id && !isReservedModelId(id) ? { id } : undefined;
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const id = readString(record, ["id", "name", "model", "modelName", "model_name", "slug", "value", "label"]);
  if (!id || isReservedModelId(id)) return undefined;

  const supportedParameters = readStringArray(record.supported_parameters || record.supportedParameters);
  const inputModalities = readStringArray(readPath(record, "architecture.input_modalities") || record.input_modalities || record.inputModalities);
  const reasoningEffortOptions = readOptionList(record, [
    "reasoningEffortOptions",
    "reasoning_effort_options",
    "reasoning_efforts",
    "supported_reasoning_efforts",
    "supported_reasoning_effort",
  ], ["reasoning_effort", "reasoning.effort", "reasoning", "effort"])
    || inferReasoningOptionsFromRelayMetadata(record, supportedParameters);

  return {
    id,
    displayName: readString(record, ["displayName", "display_name", "title", "name"]),
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
    reasoningEffortOptions,
    thinkingTypeOptions: readOptionList(record, [
      "thinkingTypeOptions",
      "thinking_type_options",
      "thinking_types",
      "supported_thinking_types",
    ], ["thinking.type", "thinking", "type"]),
    supportedParameters: supportedParameters.length > 0 ? supportedParameters : undefined,
    inputModalities: inputModalities.length > 0 ? inputModalities : undefined,
  };
}

function inferReasoningOptionsFromRelayMetadata(record: Record<string, unknown>, supportedParameters: string[]): string[] | undefined {
  const hasReasoningParam = supportedParameters.some((item) => item.toLowerCase().includes("reasoning") || item.toLowerCase().includes("thinking"));
  const internalReasoning = readNumber(readPath(record, "pricing.internal_reasoning"));
  const supportsReasoning = hasReasoningParam || !!internalReasoning || !!readPath(record, "features.reasoning");
  return supportsReasoning ? ["low", "medium", "high"] : undefined;
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
    sendConfig(configPanel.webview);
    return;
  }

  configPanel = vscode.window.createWebviewPanel(
    "customai.config",
    "Custom AI 配置",
    vscode.ViewColumn.One,
    { retainContextWhenHidden: true, enableScripts: true }
  );

  const disposable = configureConfigWebview(configPanel.webview, context, "panel");
  configPanel.onDidDispose(() => {
    configPanel = undefined;
    disposable.dispose();
  });
}

function configureConfigWebview(
  webview: vscode.Webview,
  _context: vscode.ExtensionContext,
  source: string
): vscode.Disposable {
  webview.options = { enableScripts: true };
  configWebviews.add(webview);

  const messageDisposable = webview.onDidReceiveMessage(async (message) => {
    await handleConfigWebviewMessage(webview, message, source);
  });

  webview.html = getWebviewContent();
  scheduleConfigSends(webview);

  return new vscode.Disposable(() => {
    configWebviews.delete(webview);
    messageDisposable.dispose();
  });
}

async function handleConfigWebviewMessage(webview: vscode.Webview, message: any, source: string): Promise<void> {
  log(`${source}: received message ${message?.type || "unknown"}`);
  switch (message.type) {
    case "getConfig":
      sendConfig(webview);
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
        const providerConfig = resolveProviderFromMessage(message);
        const fetched = await fetchAvailableModels(providerConfig);
        webview.postMessage({ type: "modelsFetched", models: fetched, providerId: message.providerId });
      } catch (err: any) {
        webview.postMessage({ type: "modelsFetchError", error: err.message, providerId: message.providerId });
      }
      break;
    }
    case "testProvider": {
      const result = await testProviderConnection(
        message.baseUrl,
        message.apiKey || "",
        message.modelName || "",
        message.providerName || "",
        resolveProviderFromMessage(message)
      );
      webview.postMessage({
        type: "providerTestResult",
        providerId: message.providerId,
        ok: result.ok,
        detail: result.detail,
      });
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
}

function scheduleConfigSends(webview: vscode.Webview): void {
  let retries = 0;
  const retrySend = setInterval(() => {
    if (!configWebviews.has(webview)) {
      clearInterval(retrySend);
      return;
    }
    sendConfig(webview);
    retries++;
    if (retries >= 5) clearInterval(retrySend);
  }, 150);
}

/** 向一个或全部 Webview 发送完整的 providers + models 配置数据 */
function sendConfig(target?: vscode.Webview): void {
  const p = getProviders();
  const m = getModels();
  log(`sendConfig: providers=${p.length}, models=${m.length}`);

  const targets = target ? [target] : Array.from(configWebviews);
  if (targets.length === 0) {
    log("sendConfig: no active config webviews");
    return;
  }

  for (const webview of targets) {
    webview.postMessage({ type: "config", providers: p, models: m });
  }
}

// ══════════════════════════════════════════════════════
export function deactivate(): void {
  provider?.prepareForDeactivate();
  configPanel?.dispose();
  configWebviews.clear();
}

