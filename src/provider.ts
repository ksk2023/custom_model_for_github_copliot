/**
 * provider.ts — 模型注册与对话处理
 *
 * 通过 vscode.lm.registerLanguageModelChatProvider 将自定义 AI 模型
 * 注册到 GitHub Copilot Chat 的模型选择器中。
 *
 * 核心职责：
 *   1. provideLanguageModelChatInformation — 向 Copilot 报告可用模型
 *   2. provideLanguageModelChatResponse — 处理用户对话请求（支持流式、工具调用、推理）
 *   3. applyReasoningOptions — 根据模型元数据自动注入推理/思维链参数
 */

import * as vscode from "vscode";
import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import { AIModel, Provider, getVisibleModels, getProviders, getModels } from "./config.js";
import { log } from "./logger.js";
import { getReasoningEffortOptions, getThinkingTypeOptions, resolveModelRuntimeMetadata } from "./modelMetadata.js";

type JsonHttpResponse = {
  ok: boolean;
  status: number;
  contentType: string;
  text(): Promise<string>;
  chunks(): AsyncIterable<Uint8Array>;
};

export class CustomAIProvider {
  private context: vscode.ExtensionContext;
  isActive = true;
  onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
  onDidChangeLanguageModelChatInformation = this.onDidChangeLanguageModelChatInformationEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    log("CustomAIProvider constructor called");

    context.subscriptions.push(
      this.onDidChangeLanguageModelChatInformationEmitter,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("customai.models") || e.affectsConfiguration("customai.providers")) {
          log("Configuration changed, firing refresh");
          this.onDidChangeLanguageModelChatInformationEmitter.fire();
        }
      })
    );
  }

  /** 通知 Copilot Chat 刷新模型选择器 */
  refreshModelPicker(): void {
    this.onDidChangeLanguageModelChatInformationEmitter.fire();
  }

  /** 扩展停用时清理 */
  prepareForDeactivate(): void {
    this.isActive = false;
    this.onDidChangeLanguageModelChatInformationEmitter.fire();
  }

  /**
   * 向 Copilot Chat 报告可用模型列表
   * 只返回 visible=true 的模型，每个模型关联其供应商信息
   */
  async provideLanguageModelChatInformation(
    _options: vscode.PrepareLanguageModelChatModelOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    log(`provideLanguageModelChatInformation called, isActive=${this.isActive}`);
    if (!this.isActive) {
      log("Provider not active, returning []");
      return [];
    }

    const models = getVisibleModels();
    const allModels = getModels();
    const providers = getProviders();
    const providerMap = new Map<string, Provider>();
    for (const p of providers) {
      providerMap.set(p.id, p);
    }

    log(`=== Model Picker Debug ===`);
    log(`Total models in config: ${allModels.length}`);
    log(`Visible models: ${models.length}`);
    log(`Total providers: ${providers.length}`);
    for (const m of allModels) {
      const prov = providerMap.get(m.providerId);
      log(`  [${m.visible ? 'VISIBLE' : 'hidden'}] id=${m.id} displayName=${m.displayName} modelName=${m.modelName} providerId=${m.providerId} (${prov?.name || 'NOT FOUND'})`);
    }
    log(`=== End Debug ===`);

    const result: vscode.LanguageModelChatInformation[] = [];
    for (const m of models) {
      const provider = providerMap.get(m.providerId);
      if (provider) {
        result.push(this.toChatInfo(m, provider));
      } else {
        log(`  WARN: Visible model ${m.id} has no matching provider ${m.providerId} — skipping`);
      }
    }
    log(`Returning ${result.length} LanguageModelChatInformation items`);
    return result;
  }

  /** 将模型 + 供应商组合转换为 Copilot Chat 所需的元数据格式 */
  private toChatInfo(model: AIModel, provider: Provider): vscode.LanguageModelChatInformation {
    const hasApiKey = !!provider.apiKey && provider.apiKey.length > 0;
    const safeId = model.id.replace(/[^a-zA-Z0-9_-]/g, "_");  // 确保 ID 不含非法字符
    const metadata = resolveModelRuntimeMetadata(model.modelName, provider.name, model.maxInputTokens);

    return {
      id: `customai:${safeId}`,
      name: model.displayName,
      family: provider.name,
      version: model.modelName,
      maxInputTokens: metadata.maxInputTokens,
      maxOutputTokens: metadata.maxOutputTokens,
      isUserSelectable: true,
      capabilities: {
        imageInput: metadata.imageInput,
        toolCalling: metadata.toolCalling,
      },
      detail: hasApiKey
        ? `${provider.name} - ${provider.baseUrl}`
        : `${provider.name} - API Key 未设置`,
      tooltip: hasApiKey ? undefined : "请先配置 API Key",
    } as vscode.LanguageModelChatInformation;
  }

  /**
   * 处理 Copilot Chat 发送的对话请求
   * - 根据 modelInfo.id 查找模型和供应商
   * - 组装 API 请求（支持 OpenAI / Anthropic 双协议）
   * - 流式解析响应（支持工具调用、推理内容）
   */
  async provideLanguageModelChatResponse(
    modelInfo: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    const modelId = modelInfo.id.startsWith("customai:") ? modelInfo.id.slice("customai:".length) : modelInfo.id;
    const models = getModels();
    const model = models.find((m) => m.id === modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId} (modelInfo.id: ${modelInfo.id})`);
    }

    const providers = getProviders();
    const provider = providers.find((p) => p.id === model.providerId);

    if (!provider) {
      throw new Error(`Provider not found for model: ${modelId}`);
    }

    log(`provideLanguageModelChatResponse called for model: ${model.displayName} (provider: ${provider.name})`);

    const apiMessages = this.convertMessages(messages);
    const isAnthropic = this.shouldUseAnthropicProtocol(provider);

    const config = vscode.workspace.getConfiguration("customai");
    const temperature = config.get<number>("defaultTemperature", 0.7);
    const maxTokens = config.get<number>("defaultMaxTokens", 4096);
    const streamMode = config.get<string>("streamMode", "auto");
    const localEndpointHosts = config.get<string[]>("localEndpointHosts", []);
    const localCompatibilityMode = config.get<string>("localCompatibilityMode", "auto");

    const body: Record<string, unknown> = {
      model: model.modelName,
      messages: apiMessages,
      stream: true,
      temperature,
    };
    this.applyReasoningOptions(body, model, provider, isAnthropic);
    log(`Request reasoning profile=${this.resolveReasoningProfile(model, provider)}, effort=${model.reasoningEffort || "default"}, thinking=${model.thinkingType || "default"}, budget=${model.thinkingBudget || "default"}`);

    // 工具调用：仅 OpenAI 兼容协议支持
    if (!isAnthropic && options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
      body.tool_choice = "auto";
    }

    const endpoint = this.resolveEndpoint(provider.baseUrl, isAnthropic);
    const endpointCandidates = this.resolveEndpointCandidates(endpoint, localEndpointHosts);
    this.ensureNoProxyForLocalEndpoints(endpointCandidates);
    const localEndpoint = endpointCandidates.some((candidate) => this.isLocalEndpoint(candidate));
    const streamDecision = this.resolveStreamDecision(endpoint, streamMode, body.stream);
    body.stream = streamDecision.stream;
    if (streamDecision.reason) log(streamDecision.reason);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": body.stream === false ? "application/json, text/plain" : "text/event-stream, application/json",
    };

    if (isAnthropic) {
      // Anthropic 协议：x-api-key 头 + /messages 端点
      if (provider.apiKey) headers["x-api-key"] = provider.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      delete body.temperature;
      (body as Record<string, unknown>).model = model.modelName;
      (body as Record<string, unknown>).max_tokens = maxTokens;
    } else {
      // OpenAI 兼容协议：Bearer 头 + /chat/completions 端点
      if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
      (body as Record<string, unknown>).max_tokens = maxTokens;
    }
    this.applyProviderFingerprintHeaders(headers, provider);

    const requestBody = localEndpoint && localCompatibilityMode === "minimal"
      ? this.createLocalCompatibilityBody(body)
      : body;
    const requestHeaders = localEndpoint && localCompatibilityMode === "minimal"
      ? this.createLocalCompatibilityHeaders(headers, requestBody)
      : headers;
    this.logRequestShape(endpoint, requestBody, localCompatibilityMode);

    progress.report(new vscode.LanguageModelTextPart(""));

    try {
      try {
        await this.postJsonAndReportWithEndpointFallback(endpointCandidates, requestHeaders, requestBody, progress, isAnthropic, token);
      } catch (error) {
        if (
          localEndpoint
          && localCompatibilityMode !== "full"
          && localCompatibilityMode !== "minimal"
          && this.shouldRetryLocalCompatibility(error)
          && !token.isCancellationRequested
        ) {
          log(`Local reverse proxy compatibility fallback after ${this.describeError(error)}`);
          const fallbackBody = this.createLocalCompatibilityBody(body);
          const fallbackHeaders = this.createLocalCompatibilityHeaders(headers, fallbackBody);
          this.logRequestShape(endpoint, fallbackBody, "minimal-fallback");
          try {
            await this.postJsonAndReportWithEndpointFallback(endpointCandidates, fallbackHeaders, fallbackBody, progress, isAnthropic, token);
          } catch (fallbackError) {
            if (!this.shouldRetryLocalCompatibility(fallbackError) || token.isCancellationRequested) {
              throw fallbackError;
            }
            log(`Minimal fallback failed after ${this.describeError(fallbackError)}; trying single-turn local fallback`);
            const singleTurnBody = this.createSingleTurnLocalCompatibilityBody(body);
            const singleTurnHeaders = this.createLocalCompatibilityHeaders(headers, singleTurnBody);
            this.logRequestShape(endpoint, singleTurnBody, "single-turn-fallback");
            await this.postJsonAndReportWithEndpointFallback(endpointCandidates, singleTurnHeaders, singleTurnBody, progress, isAnthropic, token);
          }
          return;
        }

        if (
          localEndpoint
          && localCompatibilityMode === "minimal"
          && this.shouldRetryLocalCompatibility(error)
          && !token.isCancellationRequested
        ) {
          log(`Minimal local compatibility request failed after ${this.describeError(error)}; trying single-turn local fallback`);
          const singleTurnBody = this.createSingleTurnLocalCompatibilityBody(body);
          const singleTurnHeaders = this.createLocalCompatibilityHeaders(headers, singleTurnBody);
          this.logRequestShape(endpoint, singleTurnBody, "single-turn-fallback");
          await this.postJsonAndReportWithEndpointFallback(endpointCandidates, singleTurnHeaders, singleTurnBody, progress, isAnthropic, token);
          return;
        }

        if (requestBody.stream !== false && streamMode !== "stream" && this.isRetryableTransportError(error) && !token.isCancellationRequested) {
          log(`Stream transport failed (${this.describeError(error)}); using one-shot non-stream fallback`);
          const fallbackBody = { ...requestBody, stream: false };
          const fallbackHeaders = { ...requestHeaders, Accept: "application/json, text/plain" };
          await this.postJsonAndReportWithEndpointFallback(endpointCandidates, fallbackHeaders, fallbackBody, progress, isAnthropic, token);
          return;
        }
        throw error;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      throw new Error(`Request failed: ${(error as Error).message}`);
    }
  }

  /**
   * 将 Copilot Chat 的消息格式转换为 OpenAI 兼容格式
   * 处理 User / Assistant / ToolResult / ToolCall 四种角色
   */
  private convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
  ): Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> {
    const result: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [];

    for (const msg of messages) {
      if (msg.role === vscode.LanguageModelChatMessageRole.User) {
        let textContent = "";
        const toolResults: Array<{ callId: string; content: string }> = [];

        for (const part of msg.content) {
          if (part instanceof vscode.LanguageModelTextPart) {
            textContent += part.value;
          } else if (part instanceof vscode.LanguageModelToolResultPart) {
            let tc = "";
            for (const item of part.content) {
              if (item instanceof vscode.LanguageModelTextPart) {
                tc += item.value;
              }
            }
            if (!tc) {
              try { tc = JSON.stringify(part.content); } catch { tc = ""; }
            }
            toolResults.push({ callId: part.callId, content: tc });
          }
        }

        if (textContent) {
          result.push({ role: "user", content: textContent });
        }
        for (const tr of toolResults) {
          result.push({ role: "tool", tool_call_id: tr.callId, content: tr.content });
        }
      } else if (msg.role === vscode.LanguageModelChatMessageRole.Assistant) {
        let textContent = "";
        const toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = [];

        for (const part of msg.content) {
          if (part instanceof vscode.LanguageModelTextPart) {
            textContent += part.value;
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            toolCalls.push({
              id: part.callId,
              type: "function",
              function: {
                name: part.name,
                arguments: JSON.stringify(part.input),
              },
            });
          }
        }

        if (textContent || toolCalls.length > 0) {
          const msgObj: { role: string; content: string | null; tool_calls?: unknown[] } = {
            role: "assistant",
            content: textContent || null,
          };
          if (toolCalls.length > 0) {
            msgObj.tool_calls = toolCalls;
          }
          result.push(msgObj);
        }
      }
    }

    return result;
  }

  private resolveEndpoint(baseUrl: string, isAnthropic: boolean): string {
    const trimmed = baseUrl.trim().replace(/\/$/, "");
    if (isAnthropic) {
      return trimmed.endsWith("/messages") ? trimmed : `${trimmed}/messages`;
    }
    if (trimmed.endsWith("/chat/completions") || trimmed.endsWith("/responses")) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/\/+$/, "");
      if (!path || path === "/" || path === "/v1") {
        return `${parsed.origin}/v1/chat/completions`;
      }
      if (path.endsWith("/v1")) {
        return `${parsed.origin}${path}/chat/completions`;
      }
      if (path === "/openai" || path.endsWith("/openai")) {
        return `${parsed.origin}${path}/v1/chat/completions`;
      }
    } catch {
      // Fall back to legacy concatenation for non-standard URLs.
    }
    return `${trimmed}/chat/completions`;
  }

  private shouldUseAnthropicProtocol(provider: Provider): boolean {
    const name = provider.name.toLowerCase();
    const baseUrl = provider.baseUrl.toLowerCase();
    if (baseUrl.includes("api.anthropic.com")) return true;
    if (baseUrl.endsWith("/messages")) return true;
    if (baseUrl.includes("/v1/chat/completions") || baseUrl.includes("/chat/completions")) return false;
    if (baseUrl.includes("/openai") || baseUrl.includes("oneapi") || baseUrl.includes("new-api")) return false;
    return name.includes("anthropic") || name.includes("claude");
  }

  private resolveEndpointCandidates(endpoint: string, configuredHosts: string[]): string[] {
    const candidates = [endpoint];
    if (!this.isLocalEndpoint(endpoint)) return candidates;

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return candidates;
    }

    const hosts = this.getLocalEndpointHostCandidates(url.hostname, configuredHosts);
    for (const host of hosts) {
      try {
        const candidate = new URL(endpoint);
        candidate.hostname = host;
        const candidateUrl = candidate.toString();
        if (!candidates.includes(candidateUrl)) {
          candidates.push(candidateUrl);
        }
      } catch {
        // Ignore invalid configured host overrides.
      }
    }

    if (candidates.length > 1) {
      log(`Local endpoint candidates: ${candidates.join(", ")}`);
    }
    return candidates;
  }

  private getLocalEndpointHostCandidates(currentHost: string, configuredHosts: string[]): string[] {
    const current = this.normalizeHostname(currentHost);
    const hosts: string[] = [];
    const addHost = (host: string | undefined): void => {
      const normalized = this.normalizeHostname(host || "");
      if (!normalized || normalized === current || hosts.includes(normalized)) return;
      hosts.push(normalized);
    };

    for (const host of configuredHosts || []) addHost(host);
    addHost("localhost");
    addHost("127.0.0.1");

    if (this.isWslEnvironment()) {
      for (const host of this.readWslHostCandidates()) addHost(host);
      addHost("host.docker.internal");
    }

    return hosts;
  }

  private ensureNoProxyForLocalEndpoints(endpoints: string[]): void {
    const hasLocalEndpoint = endpoints.some((endpoint) => this.isLocalEndpoint(endpoint));
    if (!hasLocalEndpoint) return;

    const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
    for (const endpoint of endpoints) {
      try {
        const hostname = this.normalizeHostname(new URL(endpoint).hostname);
        if (hostname) hosts.add(hostname);
      } catch {
        // Ignore invalid endpoint candidates.
      }
    }
    this.mergeNoProxyHosts([...hosts]);
  }

  private mergeNoProxyHosts(hosts: string[]): void {
    const current = `${process.env.NO_PROXY || ""},${process.env.no_proxy || ""}`;
    const values = current
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const normalized = new Set(values.map((value) => this.normalizeHostname(value)));
    let changed = false;

    for (const host of hosts) {
      const normalizedHost = this.normalizeHostname(host);
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

  private readWslHostCandidates(): string[] {
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

  private isWslEnvironment(): boolean {
    if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
    try {
      return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
    } catch {
      return false;
    }
  }

  private normalizeHostname(hostname: string): string {
    return hostname.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  }

  private isLocalHostname(hostname: string): boolean {
    const normalized = this.normalizeHostname(hostname);
    return normalized === "localhost"
      || normalized === "127.0.0.1"
      || normalized === "::1"
      || normalized === "host.docker.internal"
      || normalized.endsWith(".local")
      || this.isPrivateIpv4(normalized);
  }

  private isPrivateIpv4(hostname: string): boolean {
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

  private resolveStreamDecision(
    endpoint: string,
    streamMode: string,
    requestedStream: unknown
  ): { stream: boolean; reason?: string } {
    const normalizedMode = streamMode === "stream" || streamMode === "non-stream" ? streamMode : "auto";
    if (normalizedMode === "stream") {
      return { stream: true, reason: `Stream mode forced by setting for endpoint: ${endpoint}` };
    }
    if (normalizedMode === "non-stream") {
      return { stream: false, reason: `Non-stream mode forced by setting for endpoint: ${endpoint}` };
    }
    if (requestedStream === false) {
      return { stream: false, reason: `Model JSON parameters disabled streaming for endpoint: ${endpoint}` };
    }
    if (this.isLocalEndpoint(endpoint)) {
      return { stream: false, reason: `Local endpoint detected; using non-stream direct HTTP compatibility mode: ${endpoint}` };
    }
    return { stream: true };
  }

  private createLocalCompatibilityBody(body: Record<string, unknown>): Record<string, unknown> {
    const compatible: Record<string, unknown> = {
      model: body.model,
      messages: this.normalizeMessagesForLocalCompatibility(body.messages),
      stream: false,
    };

    if (typeof body.temperature === "number") {
      compatible.temperature = body.temperature;
    }
    if (typeof body.max_tokens === "number") {
      compatible.max_tokens = body.max_tokens;
    }

    return compatible;
  }

  private createSingleTurnLocalCompatibilityBody(body: Record<string, unknown>): Record<string, unknown> {
    const messages = this.normalizeMessagesForLocalCompatibility(body.messages);
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => {
        if (!message || typeof message !== "object") return false;
        const record = message as Record<string, unknown>;
        return record.role === "user" && typeof record.content === "string" && record.content.trim().length > 0;
      });
    const fallbackMessage = latestUserMessage || messages[messages.length - 1] || {
      role: "user",
      content: "Please answer the latest user request.",
    };

    return {
      model: body.model,
      messages: [fallbackMessage],
      stream: false,
    };
  }

  private normalizeMessagesForLocalCompatibility(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];

    return value.map((message) => {
      if (!message || typeof message !== "object") return message;
      const record = message as Record<string, unknown>;
      const role = typeof record.role === "string" ? record.role : "user";
      const content = this.extractTextValue(record.content) || "";

      if (role === "tool") {
        const toolId = typeof record.tool_call_id === "string" ? record.tool_call_id : "tool";
        return {
          role: "user",
          content: `Tool result (${toolId}): ${content}`,
        };
      }

      if (role === "assistant" && record.tool_calls) {
        return {
          role: "assistant",
          content,
        };
      }

      return {
        role,
        content,
      };
    });
  }

  private createLocalCompatibilityHeaders(
    headers: Record<string, string>,
    body: Record<string, unknown>
  ): Record<string, string> {
    const compatible: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": body.stream === false ? "application/json" : "text/event-stream, application/json",
      "User-Agent": "CustomCopilotChat/1.1",
      "Accept-Encoding": "identity",
      "Connection": "close",
    };

    for (const [key, value] of Object.entries(headers)) {
      const normalized = key.toLowerCase();
      if (normalized === "content-type" || normalized === "accept") continue;
      compatible[key] = value;
    }

    return compatible;
  }

  private applyProviderFingerprintHeaders(headers: Record<string, string>, provider: Provider): void {
    const fingerprint = this.resolveActiveFingerprint(provider);
    if (!fingerprint) return;

    const value = (fingerprint.value || "").trim();
    if (!value) return;

    const jsonHeaders = this.parseFingerprintHeaders(value);
    if (jsonHeaders) {
      Object.assign(headers, jsonHeaders);
      log(`Applied fingerprint headers: ${fingerprint.name || fingerprint.id}`);
      return;
    }

    const headerName = (fingerprint.headerName || "X-Fingerprint").trim() || "X-Fingerprint";
    headers[headerName] = value;
    log(`Applied fingerprint header ${headerName}: ${fingerprint.name || fingerprint.id}`);
  }

  private resolveActiveFingerprint(provider: Provider): { id: string; name: string; value: string; headerName?: string } | undefined {
    const fingerprints = Array.isArray(provider.fingerprints)
      ? provider.fingerprints.filter((item) => item && item.value)
      : [];
    if (fingerprints.length === 0) return undefined;
    return fingerprints.find((item) => item.id === provider.activeFingerprintId) || fingerprints[0];
  }

  private parseFingerprintHeaders(value: string): Record<string, string> | undefined {
    if (!value.startsWith("{")) return undefined;
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const source = parsed.headers && typeof parsed.headers === "object" && !Array.isArray(parsed.headers)
        ? parsed.headers as Record<string, unknown>
        : parsed;
      const headers: Record<string, string> = {};
      for (const [key, raw] of Object.entries(source)) {
        if (!key || raw === undefined || raw === null) continue;
        headers[key] = typeof raw === "string" ? raw : JSON.stringify(raw);
      }
      return Object.keys(headers).length > 0 ? headers : undefined;
    } catch {
      return undefined;
    }
  }

  private shouldRetryLocalCompatibility(error: unknown): boolean {
    if (this.isRetryableTransportError(error)) return true;
    const message = this.describeError(error).toLowerCase();
    return [
      "api error (400)",
      "api error (408)",
      "api error (409)",
      "api error (422)",
      "api error (500)",
      "api error (502)",
      "api error (503)",
      "api error (504)",
      "api returned no text content",
      "unsupported stream format",
    ].some((value) => message.includes(value));
  }

  private logRequestShape(endpoint: string, body: Record<string, unknown>, compatibilityMode: string): void {
    const toolCount = Array.isArray(body.tools) ? body.tools.length : 0;
    const hasReasoning = Object.keys(body).some((key) => key.toLowerCase().includes("reasoning") || key === "thinking");
    log(`Request shape endpoint=${endpoint}, stream=${String(body.stream)}, tools=${toolCount}, reasoning=${hasReasoning}, compatibility=${compatibilityMode}`);
  }

  private async postJsonAndReport(
    endpoint: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean,
    token: vscode.CancellationToken
  ): Promise<void> {
    const response = await this.postJson(endpoint, headers, body, token);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const contentType = response.contentType;
    if (!contentType.includes("text/event-stream")) {
      const payload = await response.text();
      if (this.isHtmlResponse(contentType, payload)) {
        throw new Error(`API returned an HTML page instead of a model response. Check Base URL; OpenAI-compatible relay hosts should resolve to /v1/chat/completions. Resolved endpoint: ${endpoint}`);
      }
      const emitted = this.reportJsonResponse(payload, progress, isAnthropic);
      if (!emitted) {
        throw new Error(`API returned no text content: ${payload.slice(0, 500)}`);
      }
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }> = new Map();
    let emittedResponse = false;
    const unknownChunkPreviews: string[] = [];
    const eventDataLines: string[] = [];
    const flushEventData = (): void => {
      if (eventDataLines.length === 0) return;
      const data = eventDataLines.join("\n").trim();
      eventDataLines.length = 0;
      if (this.reportStreamChunk(data, progress, isAnthropic, toolCallAccumulators, unknownChunkPreviews)) {
        emittedResponse = true;
      }
    };

    for await (const value of response.chunks()) {
      if (token.isCancellationRequested) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
          flushEventData();
          continue;
        }
        if (trimmedLine.startsWith(":") || trimmedLine.startsWith("event:")) continue;

        if (trimmedLine.startsWith("data:")) {
          eventDataLines.push(trimmedLine.slice(5).trimStart());
        } else {
          flushEventData();
          if (this.reportStreamChunk(trimmedLine, progress, isAnthropic, toolCallAccumulators, unknownChunkPreviews)) {
            emittedResponse = true;
          }
        }
      }
    }
    if (buffer.trim()) {
      const trimmedBuffer = buffer.trim();
      eventDataLines.push(trimmedBuffer.startsWith("data:") ? trimmedBuffer.slice(5).trimStart() : trimmedBuffer);
    }
    flushEventData();
    if (this.flushToolCallAccumulators(toolCallAccumulators, progress)) {
      emittedResponse = true;
    }
    if (!emittedResponse && unknownChunkPreviews.length > 0) {
      log(`No text emitted from stream. Sample chunks: ${unknownChunkPreviews.join(" | ")}`);
    }
    if (!emittedResponse) {
      const sample = unknownChunkPreviews.length > 0
        ? ` Sample chunks: ${unknownChunkPreviews.join(" | ")}`
        : "";
      throw new Error(`API response completed without text content; unsupported stream format. See the Custom AI output log.${sample}`);
    }
  }

  private isHtmlResponse(contentType: string, payload: string): boolean {
    const trimmed = payload.trim().slice(0, 200).toLowerCase();
    return contentType.toLowerCase().includes("text/html")
      || trimmed.startsWith("<!doctype html")
      || trimmed.startsWith("<html")
      || trimmed.includes("<head")
      || trimmed.includes("<body");
  }

  private async postJsonAndReportWithEndpointFallback(
    endpoints: string[],
    headers: Record<string, string>,
    body: Record<string, unknown>,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean,
    token: vscode.CancellationToken
  ): Promise<void> {
    let lastError: unknown;
    for (let index = 0; index < endpoints.length; index++) {
      const endpoint = endpoints[index];
      try {
        if (index > 0) {
          log(`Trying local endpoint candidate ${index + 1}/${endpoints.length}: ${endpoint}`);
        }
        await this.postJsonAndReport(endpoint, headers, body, progress, isAnthropic, token);
        return;
      } catch (error) {
        lastError = error;
        const canTryNext = index < endpoints.length - 1
          && this.isRetryableTransportError(error)
          && !token.isCancellationRequested;
        if (!canTryNext) throw error;
        log(`Local endpoint candidate failed (${this.describeError(error)}); trying next candidate`);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private reportJsonResponse(
    payload: string,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean
  ): boolean {
    const trimmedPayload = payload.trim();
    if (trimmedPayload) {
      try {
        const parsed = JSON.parse(trimmedPayload);
        return this.reportParsedJsonResponse(parsed, progress, isAnthropic);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        // Fall back to line-oriented parsing below.
      }
    }

    const chunks = payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && line !== "[DONE]" && !line.startsWith("event:") && !line.startsWith(":"))
      .map((line) => line.startsWith("data:") ? line.slice(5).trim() : line);

    let emitted = false;
    const candidates = chunks.length > 0 ? chunks : [payload];
    for (const chunk of candidates) {
      if (!chunk || chunk === "[DONE]") continue;
      let parsed: any;
      try {
        parsed = JSON.parse(chunk);
      } catch {
        if (candidates.length === 1 && chunk && !chunk.startsWith("{") && !chunk.startsWith("[")) {
          progress.report(new vscode.LanguageModelTextPart(chunk));
          emitted = true;
        }
        continue;
      }
      if (this.reportParsedJsonResponse(parsed, progress, isAnthropic)) emitted = true;
    }
    return emitted;
  }

  private reportParsedJsonResponse(
    parsed: unknown,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean
  ): boolean {
    this.throwIfApiError(parsed);

    let emitted = false;
    const text = this.extractResponseText(parsed, isAnthropic);
    if (text) {
      progress.report(new vscode.LanguageModelTextPart(text));
      emitted = true;
    }

    if (this.reportJsonToolCalls(parsed, progress)) {
      emitted = true;
    }

    return emitted;
  }

  private reportJsonToolCalls(
    parsed: unknown,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>
  ): boolean {
    const seen = new Set<string>();
    let emitted = false;
    let fallbackIndex = 0;

    const emitToolCall = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const toolCall = this.toToolCallSpec(value as Record<string, unknown>, fallbackIndex++);
      if (!toolCall) return;
      const key = `${toolCall.id}:${toolCall.name}:${this.safeJsonPreview(toolCall.input)}`;
      if (seen.has(key)) return;
      seen.add(key);
      progress.report(new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.name, toolCall.input));
      emitted = true;
    };

    const visit = (value: unknown, depth = 0): void => {
      if (!value || depth > 8) return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, depth + 1);
        return;
      }
      if (typeof value !== "object") return;

      const record = value as Record<string, unknown>;
      const directToolCalls = this.asArray(record.tool_calls) || this.asArray(record.toolCalls);
      if (directToolCalls) {
        for (const toolCall of directToolCalls) emitToolCall(toolCall);
      }

      if (this.isToolCallLikeObject(record)) {
        emitToolCall(record);
      }

      for (const field of [
        "choices",
        "message",
        "delta",
        "output",
        "content",
        "data",
        "response",
        "result",
        "item",
        "items",
      ]) {
        visit(record[field], depth + 1);
      }
    };

    visit(parsed);
    return emitted;
  }

  private toToolCallSpec(
    record: Record<string, unknown>,
    fallbackIndex: number
  ): { id: string; name: string; input: Record<string, unknown> } | undefined {
    const fn = record.function && typeof record.function === "object"
      ? record.function as Record<string, unknown>
      : undefined;

    const name = this.firstString(fn?.name, record.name, record.tool_name, record.toolName);
    if (!name) return undefined;

    const id = this.firstString(record.id, record.call_id, record.callId, record.tool_call_id, record.toolCallId)
      || `tool_call_${fallbackIndex + 1}`;
    const rawInput = fn?.arguments
      ?? record.arguments
      ?? record.input
      ?? record.args
      ?? record.parameters
      ?? {};

    return {
      id,
      name,
      input: this.parseToolCallInput(rawInput),
    };
  }

  private isToolCallLikeObject(record: Record<string, unknown>): boolean {
    const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
    if (type === "function_call" || type === "tool_use" || type === "tool_call") return true;
    if (record.function && typeof record.function === "object") {
      const fn = record.function as Record<string, unknown>;
      return typeof fn.name === "string";
    }
    return !!this.firstString(record.name, record.tool_name, record.toolName)
      && (record.arguments !== undefined || record.input !== undefined || record.args !== undefined);
  }

  private parseToolCallInput(value: unknown): Record<string, unknown> {
    if (value === undefined || value === null || value === "") return {};
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return this.parseToolCallInput(parsed);
      } catch {
        return { input: value };
      }
    }
    if (Array.isArray(value)) return { value };
    if (typeof value === "object") return value as Record<string, unknown>;
    return { value };
  }

  private asArray(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  private async postJson(
    endpoint: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    token: vscode.CancellationToken
  ): Promise<JsonHttpResponse> {
    const payload = JSON.stringify(body);

    if (this.isLocalEndpoint(endpoint)) {
      log(`Local endpoint detected; using direct HTTP transport: ${endpoint}`);
      return await this.postJsonDirect(endpoint, headers, payload, token);
    }

    try {
      const abortController = new AbortController();
      const cancellation = token.onCancellationRequested(() => abortController.abort());
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: payload,
          signal: abortController.signal,
        });
        return this.wrapFetchResponse(response);
      } finally {
        cancellation.dispose();
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw error;
      }
      if (this.isRetryableTransportError(error)) {
        log(`Fetch transport failed (${this.describeError(error)}); using direct HTTP transport once: ${endpoint}`);
        return await this.postJsonDirect(endpoint, headers, payload, token);
      }
      throw error;
    }
  }

  private wrapFetchResponse(response: Response): JsonHttpResponse {
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      text: () => response.text(),
      chunks: async function* () {
        if (!response.body) return;
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      },
    };
  }

  private postJsonDirect(
    endpoint: string,
    headers: Record<string, string>,
    payload: string,
    token: vscode.CancellationToken
  ): Promise<JsonHttpResponse> {
    return new Promise((resolve, reject) => {
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch (error) {
        reject(error);
        return;
      }

      const transport = url.protocol === "https:" ? https : http;
      const requestHeaders = {
        "User-Agent": "CustomCopilotChat/1.1",
        "Accept-Encoding": "identity",
        "Connection": "close",
        ...headers,
        "Content-Length": Buffer.byteLength(payload).toString(),
      };

      let cancellation: vscode.Disposable | undefined;
      const req = transport.request(url, {
        method: "POST",
        agent: false,
        headers: requestHeaders,
      }, (res) => {
        const status = res.statusCode || 0;
        const contentTypeHeader = res.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader.join("; ")
          : contentTypeHeader || "";
        const disposeCancellation = () => {
          cancellation?.dispose();
          cancellation = undefined;
        };

        resolve({
          ok: status >= 200 && status < 300,
          status,
          contentType,
          text: async () => {
            const chunks: Buffer[] = [];
            try {
              for await (const chunk of res) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              return Buffer.concat(chunks).toString("utf8");
            } finally {
              disposeCancellation();
            }
          },
          chunks: async function* () {
            try {
              for await (const chunk of res) {
                yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              }
            } finally {
              disposeCancellation();
            }
          },
        });
      });

      cancellation = token.onCancellationRequested(() => {
        const error = new Error("AbortError");
        error.name = "AbortError";
        req.destroy(error);
      });

      req.setTimeout(300000, () => {
        const error = new Error("Request timed out after 300s");
        error.name = "TimeoutError";
        req.destroy(error);
      });

      req.on("error", (error) => {
        cancellation?.dispose();
        reject(error);
      });
      req.end(payload);
    });
  }

  private shouldRetryWithDirectHttp(endpoint: string, status: number): boolean {
    return this.isLocalEndpoint(endpoint) && (status === 502 || status === 503 || status === 504);
  }

  private isRetryableTransportError(error: unknown): boolean {
    const messages = this.collectErrorChain(error)
      .map((item) => item.message.toLowerCase())
      .join(" ");
    const codes = this.collectErrorChain(error)
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

  private describeError(error: unknown): string {
    return this.collectErrorChain(error)
      .map((item) => item.code ? `${item.message} (${item.code})` : item.message)
      .filter(Boolean)
      .join("; ") || String(error);
  }

  private collectErrorChain(error: unknown): Array<{ message: string; code: string }> {
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

  private isLocalEndpoint(endpoint: string): boolean {
    try {
      return this.isLocalHostname(new URL(endpoint).hostname);
    } catch {
      return false;
    }
  }

  private reportStreamChunk(
    data: string,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean,
    toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }>,
    unknownChunkPreviews: string[]
  ): boolean {
    const trimmed = data.trim();
    if (!trimmed || trimmed === "[DONE]") return false;

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      if (this.isPlainTextStreamChunk(trimmed)) {
        progress.report(new vscode.LanguageModelTextPart(trimmed));
        return true;
      }
      this.captureUnknownChunkPreview(unknownChunkPreviews, trimmed);
      return false;
    }

    this.throwIfApiError(parsed);
    const text = this.extractResponseText(parsed, isAnthropic);
    let emitted = false;
    let handledKnownStreamEvent = false;
    if (text) {
      progress.report(new vscode.LanguageModelTextPart(text));
      emitted = true;
    }

    if (this.isKnownEmptyStreamChunk(parsed)) {
      handledKnownStreamEvent = true;
    }

    if (!isAnthropic) {
      const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
      for (const choice of choices) {
        const delta = choice?.delta || choice?.message || {};
        const finishReason = choice?.finish_reason || choice?.finishReason;

        if (delta?.tool_calls || delta?.toolCalls || choice?.tool_calls || choice?.toolCalls) {
          const toolCalls = delta?.tool_calls || delta?.toolCalls || choice?.tool_calls || choice?.toolCalls;
          if (this.accumulateToolCallDeltas(toolCalls, toolCallAccumulators)) {
            handledKnownStreamEvent = true;
          }
        }

        const legacyFunctionCall = delta?.function_call || delta?.functionCall || choice?.function_call || choice?.functionCall;
        if (legacyFunctionCall) {
          if (this.accumulateLegacyFunctionCall(legacyFunctionCall, choice?.index, toolCallAccumulators)) {
            handledKnownStreamEvent = true;
          }
        }

        if (finishReason === "tool_calls" || finishReason === "tool_use" || finishReason === "function_call") {
          if (this.flushToolCallAccumulators(toolCallAccumulators, progress)) {
            emitted = true;
          }
        }
      }
    }

    if (this.accumulateResponsesApiToolCall(parsed, toolCallAccumulators)) {
      handledKnownStreamEvent = true;
    }

    if (this.reportAnthropicToolUse(parsed, progress)) {
      emitted = true;
    }

    if (!text && !handledKnownStreamEvent && !emitted) {
      this.captureUnknownChunkPreview(unknownChunkPreviews, trimmed);
    }

    return emitted || handledKnownStreamEvent;
  }

  private accumulateToolCallDeltas(
    toolCalls: unknown,
    toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }>
  ): boolean {
    if (!Array.isArray(toolCalls)) return false;
    let handled = false;
    for (let fallbackIndex = 0; fallbackIndex < toolCalls.length; fallbackIndex++) {
      const rawToolCall = toolCalls[fallbackIndex];
      if (!rawToolCall || typeof rawToolCall !== "object") continue;
      const toolCall = rawToolCall as Record<string, any>;
      const index = typeof toolCall.index === "number" ? toolCall.index : fallbackIndex;
      const existing = toolCallAccumulators.get(index) || { arguments: "" };
      if (typeof toolCall.id === "string" && toolCall.id) existing.id = toolCall.id;
      if (typeof toolCall.name === "string" && toolCall.name) existing.name = toolCall.name;
      if (typeof toolCall.tool_name === "string" && toolCall.tool_name) existing.name = toolCall.tool_name;
      if (typeof toolCall.toolName === "string" && toolCall.toolName) existing.name = toolCall.toolName;

      const fn = toolCall.function && typeof toolCall.function === "object"
        ? toolCall.function as Record<string, unknown>
        : undefined;
      if (typeof fn?.name === "string" && fn.name) existing.name = fn.name;

      const argumentDelta = fn?.arguments ?? toolCall.arguments ?? toolCall.input ?? toolCall.args;
      if (typeof argumentDelta === "string") {
        existing.arguments += argumentDelta;
      } else if (argumentDelta !== undefined && argumentDelta !== null) {
        existing.arguments += JSON.stringify(argumentDelta);
      }

      toolCallAccumulators.set(index, existing);
      handled = true;
    }
    return handled;
  }

  private accumulateLegacyFunctionCall(
    functionCall: unknown,
    indexHint: unknown,
    toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }>
  ): boolean {
    if (!functionCall || typeof functionCall !== "object") return false;
    const record = functionCall as Record<string, unknown>;
    const index = typeof indexHint === "number" ? indexHint : 0;
    const existing = toolCallAccumulators.get(index) || { arguments: "" };
    const name = this.firstString(record.name, record.tool_name, record.toolName);
    if (name) existing.name = name;
    const id = this.firstString(record.id, record.call_id, record.callId);
    if (id) existing.id = id;
    const argumentDelta = record.arguments ?? record.input ?? record.args;
    if (typeof argumentDelta === "string") {
      existing.arguments += argumentDelta;
    } else if (argumentDelta !== undefined && argumentDelta !== null) {
      existing.arguments += JSON.stringify(argumentDelta);
    }
    toolCallAccumulators.set(index, existing);
    return true;
  }

  private accumulateResponsesApiToolCall(
    parsed: unknown,
    toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }>
  ): boolean {
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as Record<string, any>;
    const type = typeof record.type === "string" ? record.type : "";
    const item = record.item && typeof record.item === "object" ? record.item : record;

    if (type.includes("function_call_arguments") && typeof record.delta === "string") {
      const index = typeof record.output_index === "number" ? record.output_index : 0;
      const existing = toolCallAccumulators.get(index) || { arguments: "" };
      existing.id = this.firstString(record.item_id, record.call_id, record.callId, existing.id) || existing.id;
      existing.arguments += record.delta;
      toolCallAccumulators.set(index, existing);
      return true;
    }

    if (item && (item.type === "function_call" || item.type === "tool_call")) {
      const index = typeof record.output_index === "number"
        ? record.output_index
        : typeof item.index === "number"
          ? item.index
          : 0;
      const existing = toolCallAccumulators.get(index) || { arguments: "" };
      existing.id = this.firstString(item.call_id, item.callId, item.id, record.item_id, existing.id) || existing.id;
      existing.name = this.firstString(item.name, item.tool_name, item.toolName, existing.name) || existing.name;
      if (typeof item.arguments === "string") existing.arguments += item.arguments;
      toolCallAccumulators.set(index, existing);
      return true;
    }

    return false;
  }

  private reportAnthropicToolUse(
    parsed: unknown,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>
  ): boolean {
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as Record<string, any>;
    if (record.type !== "content_block_start") return false;
    const block = record.content_block;
    if (!block || typeof block !== "object" || block.type !== "tool_use") return false;
    const id = this.firstString(block.id, block.call_id, block.callId) || `tool_call_${Date.now()}`;
    const name = this.firstString(block.name, block.tool_name, block.toolName);
    if (!name) return false;
    progress.report(new vscode.LanguageModelToolCallPart(id, name, this.parseToolCallInput(block.input || {})));
    return true;
  }

  private flushToolCallAccumulators(
    toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }>,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>
  ): boolean {
    let emitted = false;
    for (const [index, toolCall] of toolCallAccumulators) {
      if (!toolCall.name) continue;
      const id = toolCall.id || `tool_call_${index + 1}`;
      const input = this.parseToolCallInput(toolCall.arguments || "{}");
      progress.report(new vscode.LanguageModelToolCallPart(id, toolCall.name, input));
      emitted = true;
    }
    if (emitted) {
      toolCallAccumulators.clear();
    }
    return emitted;
  }

  private isKnownEmptyStreamChunk(parsed: unknown): boolean {
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as Record<string, any>;
    if (Array.isArray(record.choices)) {
      return record.choices.some((choice: any) => {
        const delta = choice?.delta || choice?.message || {};
        return delta?.role === "assistant"
          || delta?.content === ""
          || delta?.text === ""
          || choice?.finish_reason === "stop"
          || choice?.finish_reason === "tool_calls";
      });
    }
    return false;
  }

  private extractResponseText(parsed: any, isAnthropic: boolean): string {
    if (!parsed) return "";
    if (Array.isArray(parsed)) {
      return parsed.map((item) => this.extractResponseText(item, isAnthropic)).join("");
    }
    this.throwIfApiError(parsed);

    const parts: string[] = [];
    const add = (value: unknown): void => {
      const text = this.extractTextValue(value);
      if (text) parts.push(text);
    };

    if (typeof parsed.output_text === "string") return parsed.output_text;
    if (typeof parsed.text === "string") return parsed.text;
    if (typeof parsed.response === "string") return parsed.response;
    if (typeof parsed.delta === "string") return parsed.delta;
    if (typeof parsed.content === "string") return parsed.content;
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.msg === "string") return parsed.msg;
    if (typeof parsed.reply === "string") return parsed.reply;
    if (typeof parsed.answer === "string") return parsed.answer;
    if (typeof parsed.completion === "string") return parsed.completion;
    if (typeof parsed.generated_text === "string") return parsed.generated_text;
    if (typeof parsed.output === "string") return parsed.output;
    if (typeof parsed.data === "string") return parsed.data;
    if (typeof parsed.value === "string" && this.isTextLikeObject(parsed)) return parsed.value;

    if (parsed.data && typeof parsed.data === "object") {
      add(this.extractResponseText(parsed.data, isAnthropic));
    }

    if (parsed.response && typeof parsed.response === "object") {
      add(this.extractResponseText(parsed.response, isAnthropic));
    }

    add(parsed.item);
    add(parsed.message);
    add(parsed.msg);
    add(parsed.result);
    add(parsed.reply);
    add(parsed.answer);
    add(parsed.completion);
    add(parsed.generated_text);
    add(parsed.value);
    add(parsed.part);
    add(parsed.parts);
    add(parsed.detail);
    add(parsed.description);

    if (Array.isArray(parsed.output)) {
      add(parsed.output
        .flatMap((item: any) => Array.isArray(item.content) ? item.content : [item])
        .map((content: any) => this.extractTextValue(content))
        .join(""));
    }

    add(parsed.output?.content);
    add(parsed.output?.text);
    add(parsed.output?.parts);
    add(parsed.output?.value);

    if (Array.isArray(parsed.candidates)) {
      add(parsed.candidates[0]?.content?.parts);
    }

    if (isAnthropic) {
      const deltaText = parsed.delta?.text || parsed.delta?.partial_json || "";
      if (deltaText) add(deltaText);
      if (Array.isArray(parsed.content)) add(parsed.content);
      if (Array.isArray(parsed.message?.content)) add(parsed.message.content);
    }

    add(parsed.delta?.content);
    add(parsed.delta?.text);
    add(parsed.delta?.output_text);
    add(parsed.delta?.reasoning_content);
    add(parsed.delta?.reasoning);
    add(parsed.delta?.thinking);
    add(parsed.delta?.value);
    add(parsed.delta?.parts);
    add(parsed.delta?.part);
    add(parsed.content);

    if (Array.isArray(parsed.choices)) {
      for (const choice of parsed.choices) {
        add(choice?.delta?.content);
        add(choice?.delta?.text);
        add(choice?.delta?.output_text);
        add(choice?.delta?.reasoning_content);
        add(choice?.delta?.reasoning);
        add(choice?.delta?.thinking);
        add(choice?.delta?.value);
        add(choice?.delta?.parts);
        add(choice?.delta?.message);
        if (choice?.message?.content) {
          add(choice.message.content);
        }
        add(choice?.message?.parts);
        add(choice?.message?.text);
        add(choice?.message?.reasoning_content);
        add(choice?.message?.reasoning);
        add(choice?.message?.msg);
        add(choice?.text);
        add(choice?.content);
      }
    }

    if (parts.length === 0) {
      add(this.extractDeepText(parsed));
    }

    return parts.join("");
  }

  private extractTextValue(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.extractTextValue(item)).join("");
    }
    if (typeof value !== "object") return "";

    const record = value as Record<string, unknown>;
    const fields = [
      "text",
      "output_text",
      "content",
      "delta",
      "msg",
      "reply",
      "part",
      "parts",
      "value",
      "output",
      "generated_text",
      "message",
      "message_text",
      "messageText",
      "response",
      "result",
      "answer",
      "answer_text",
      "answerText",
      "reasoning_content",
      "reasoning",
      "thinking",
      "partial_json",
      "detail",
      "description",
    ];
    for (const field of fields) {
      const text = this.extractTextValue(record[field]);
      if (text) return text;
    }
    return "";
  }

  private extractDeepText(value: unknown, depth = 0): string {
    if (!value || depth > 8) return "";
    if (typeof value === "string") return "";
    if (Array.isArray(value)) {
      return value.map((item) => this.extractDeepText(item, depth + 1)).join("");
    }
    if (typeof value !== "object") return "";

    const record = value as Record<string, unknown>;
    const fragments: string[] = [];
    for (const [key, child] of Object.entries(record)) {
      if (typeof child === "string") {
        if (this.isLikelyTextField(key, record) && child) fragments.push(child);
        continue;
      }
      const nested = this.extractDeepText(child, depth + 1);
      if (nested) fragments.push(nested);
    }
    return fragments.join("");
  }

  private isLikelyTextField(key: string, record: Record<string, unknown>): boolean {
    const normalized = key.toLowerCase();
    if ([
      "text",
      "content",
      "delta",
      "output_text",
      "reasoning_content",
      "reasoning",
      "thinking",
      "answer",
      "completion",
      "generated_text",
      "value",
      "msg",
      "reply",
      "output",
      "message_text",
      "answer_text",
      "detail",
      "description",
    ].includes(normalized)) {
      return true;
    }
    if (normalized === "name" || normalized === "id" || normalized === "model" || normalized === "role") {
      return false;
    }
    const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
    return type.includes("text") && (normalized === "value" || normalized === "content");
  }

  private isTextLikeObject(record: Record<string, unknown>): boolean {
    const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
    return type.includes("text") || type.includes("message") || type.includes("content");
  }

  private throwIfApiError(parsed: unknown): void {
    const message = this.extractApiErrorMessage(parsed);
    if (message) {
      throw new Error(`API Error: ${message}`);
    }
  }

  private extractApiErrorMessage(value: unknown): string {
    if (!value || typeof value !== "object") return "";
    if (Array.isArray(value)) {
      return value.map((item) => this.extractApiErrorMessage(item)).find(Boolean) || "";
    }

    const record = value as Record<string, unknown>;
    const directError = record.error;
    if (directError) {
      if (typeof directError === "string") return directError;
      if (typeof directError === "object") {
        const errorRecord = directError as Record<string, unknown>;
        const message = this.extractFirstText(errorRecord, [
          "message",
          "msg",
          "detail",
          "error_description",
          "errorMessage",
          "error_message",
          "reason",
          "description",
          "type",
        ]);
        return message || this.safeJsonPreview(directError);
      }
    }

    const objectType = typeof record.object === "string" ? record.object.toLowerCase() : "";
    const eventType = typeof record.type === "string" ? record.type.toLowerCase() : "";
    if (objectType === "error" || eventType === "error" || eventType.endsWith(".error")) {
      return this.extractFirstText(record, [
        "message",
        "msg",
        "detail",
        "error_description",
        "errorMessage",
        "error_message",
        "reason",
        "description",
      ]) || this.safeJsonPreview(record);
    }

    const statusCode = this.readNumericField(record, ["status", "status_code", "statusCode"]);
    if (statusCode >= 400) {
      const message = this.extractFirstText(record, [
        "message",
        "msg",
        "detail",
        "error_description",
        "errorMessage",
        "error_message",
        "reason",
        "description",
      ]);
      return message ? `${statusCode}: ${message}` : this.safeJsonPreview(record);
    }

    if (record.success === false || record.ok === false) {
      return this.extractFirstText(record, [
        "message",
        "msg",
        "detail",
        "error_description",
        "errorMessage",
        "error_message",
        "reason",
        "description",
      ]) || this.safeJsonPreview(record);
    }

    const code = this.readNumericField(record, ["code", "errcode", "error_code", "retcode"]);
    if (Number.isFinite(code) && code !== 0 && (code < 200 || code >= 400)) {
      const message = this.extractFirstText(record, [
        "message",
        "msg",
        "detail",
        "error_description",
        "errorMessage",
        "error_message",
        "reason",
        "description",
      ]);
      if (message) return `${code}: ${message}`;
    }

    return "";
  }

  private extractFirstText(record: Record<string, unknown>, fields: string[]): string {
    for (const field of fields) {
      const text = this.extractTextValue(record[field]);
      if (text) return text;
    }
    return "";
  }

  private readNumericField(record: Record<string, unknown>, fields: string[]): number {
    for (const field of fields) {
      const value = record[field];
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  }

  private safeJsonPreview(value: unknown): string {
    try {
      return JSON.stringify(value).slice(0, 300);
    } catch {
      return String(value).slice(0, 300);
    }
  }

  private isPlainTextStreamChunk(chunk: string): boolean {
    if (!chunk || chunk === "[DONE]") return false;
    if (chunk.startsWith("{") || chunk.startsWith("[") || chunk.startsWith(":")) return false;
    if (/^[a-z_]+\s*:/i.test(chunk)) return false;
    return /[\p{L}\p{N}\u4e00-\u9fff]/u.test(chunk);
  }

  private captureUnknownChunkPreview(previews: string[], chunk: string): void {
    if (previews.length >= 5 || !chunk) return;
    previews.push(chunk.slice(0, 300).replace(/\s+/g, " "));
  }

  /**
   * 根据模型的推理配置向请求 body 注入对应参数
   *
   * 支持的推理方案（reasoningProfile）：
   *   off     — 不注入任何推理参数
   *   openai  — reasoning_effort（low/medium/high）
   *   deepseek — thinking:{type} + reasoning_effort
   *   glm     — thinking:{type}
   *   qwen    — enable_thinking + thinking_budget
   *   claude  — thinking:{type,budget_tokens} + output_config.effort
   *   gemini  — generationConfig.thinkingConfig
   *   stepfun — reasoning_effort（同 OpenAI）
   *   minimax — reasoning_split
   *   custom  — 通用参数注入
   */
  private applyReasoningOptions(
    body: Record<string, unknown>,
    model: AIModel,
    provider: Provider,
    isAnthropic: boolean
  ): void {
    const profile = this.resolveReasoningProfile(model, provider);
    const reasoningOptions = model.reasoningEffortOptions?.length
      ? model.reasoningEffortOptions
      : getReasoningEffortOptions(model.modelName, provider.name);
    const thinkingOptions = model.thinkingTypeOptions?.length
      ? model.thinkingTypeOptions
      : getThinkingTypeOptions(model.modelName, provider.name);
    const effort = model.reasoningEffort && model.reasoningEffort !== "default" ? model.reasoningEffort : undefined;
    const thinking = model.thinkingType && model.thinkingType !== "default" ? model.thinkingType : undefined;
    const budget = Number.isFinite(model.thinkingBudget) && model.thinkingBudget && model.thinkingBudget > 0
      ? Math.floor(model.thinkingBudget)
      : undefined;

    if (profile === "off") {
      this.mergeCustomRequestParams(body, model);
      return;
    }

    // OpenAI / 阶跃星辰：reasoning_effort
    if ((profile === "openai" || profile === "stepfun") && effort && this.isAllowedOption(effort, reasoningOptions)) {
      body.reasoning_effort = effort;
    }

    // DeepSeek：thinking.type + reasoning_effort
    if (profile === "deepseek") {
      if (thinking && this.isAllowedOption(thinking, thinkingOptions)) {
        body.thinking = { type: thinking };
      }
      if (effort && this.isAllowedOption(effort, reasoningOptions)) {
        body.reasoning_effort = effort;
      }
    }

    // 智谱 GLM：thinking.type
    if (profile === "glm") {
      if (thinking && this.isAllowedOption(thinking, thinkingOptions)) {
        body.thinking = { type: thinking };
      }
    }

    // 通义千问 Qwen：enable_thinking + thinking_budget
    if (profile === "qwen") {
      if (thinking === "enabled") body.enable_thinking = true;
      if (thinking === "disabled") body.enable_thinking = false;
      if (budget) body.thinking_budget = budget;
    }

    // Claude：thinking（adaptive / enabled+token预算 / disabled）+ output_config
    if (profile === "claude") {
      if (thinking === "adaptive") {
        body.thinking = { type: "adaptive" };
      } else if (thinking === "enabled") {
        body.thinking = budget ? { type: "enabled", budget_tokens: budget } : { type: "enabled" };
      } else if (thinking === "disabled") {
        body.thinking = { type: "disabled" };
      }
      if (effort && this.isAllowedOption(effort, reasoningOptions)) {
        body.output_config = { ...(body.output_config as Record<string, unknown> || {}), effort };
      }
      if (!isAnthropic && body.thinking) {
        body.thinking = body.thinking;
      }
    }

    // Gemini：generationConfig.thinkingConfig
    if (profile === "gemini") {
      const thinkingConfig: Record<string, unknown> = {};
      if (effort && this.isAllowedOption(effort, reasoningOptions)) {
        thinkingConfig.thinkingLevel = effort;
      }
      if (budget || model.thinkingBudget === 0) {
        thinkingConfig.thinkingBudget = Math.floor(model.thinkingBudget || 0);
      }
      if (Object.keys(thinkingConfig).length > 0) {
        body.generationConfig = {
          ...(body.generationConfig as Record<string, unknown> || {}),
          thinkingConfig,
        };
      }
    }

    // 自定义：通用参数注入
    if (profile === "custom") {
      if (effort) body.reasoning_effort = effort;
      if (thinking) body.thinking = { type: thinking };
      if (budget) body.thinking_budget = budget;
    }

    // MiniMax：reasoning_split
    if (profile === "minimax" && thinking === "enabled") {
      body.reasoning_split = true;
    }

    this.mergeCustomRequestParams(body, model);
  }

  /** 根据供应商名称、baseUrl、模型名自动推断推理方案 */
  private resolveReasoningProfile(model: AIModel, provider: Provider): string {
    const explicit = (model.reasoningProfile || "auto").toLowerCase();
    if (explicit !== "auto") return explicit;

    const value = `${provider.name} ${provider.baseUrl} ${model.modelName}`.toLowerCase();
    if (value.includes("deepseek")) return "deepseek";
    if (value.includes("dashscope") || value.includes("qwen") || value.includes("aliyun") || value.includes("alibaba")) return "qwen";
    if (value.includes("bigmodel") || value.includes("zhipu") || value.includes("智谱") || value.includes("glm")) return "glm";
    if (value.includes("stepfun") || value.includes("阶跃") || value.includes("step-")) return "stepfun";
    if (value.includes("anthropic") || value.includes("claude")) return "claude";
    if (value.includes("gemini") || value.includes("googleapis") || value.includes("google")) return "gemini";
    if (value.includes("minimax") || value.includes("minimaxi")) return "minimax";
    if (value.includes("openai") || value.includes("gpt-") || /^o\d/.test(model.modelName.toLowerCase())) return "openai";
    return "custom";
  }

  /** 检查值是否在允许的选项列表中 */
  private isAllowedOption(value: string, options: string[]): boolean {
    return options.length === 0 || options.includes(value);
  }

  /** 合并用户自定义的请求参数（JSON 格式深度合并到 body 中） */
  private mergeCustomRequestParams(body: Record<string, unknown>, model: AIModel): void {
    if (!model.customRequestParams || !model.customRequestParams.trim()) return;
    try {
      const parsed = JSON.parse(model.customRequestParams) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        this.deepMerge(body, parsed);
      }
    } catch (err) {
      log(`Invalid customRequestParams for ${model.modelName}: ${(err as Error).message}`);
    }
  }

  /** 深度合并两个对象 */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        this.deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        target[key] = value;
      }
    }
  }

  /** Token 计数（简易估算：4 字符 ≈ 1 token） */
  async provideTokenCount(
    _modelInfo: vscode.LanguageModelChatInformation,
    text: string,
    _token: vscode.CancellationToken
  ): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
