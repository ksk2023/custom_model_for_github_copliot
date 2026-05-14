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
import { AIModel, Provider, getVisibleModels, getProviders, getModels } from "./config.js";
import { log } from "./logger.js";
import { getReasoningEffortOptions, getThinkingTypeOptions, resolveModelRuntimeMetadata } from "./modelMetadata.js";

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
    const isAnthropic = provider.name.toLowerCase().includes("anthropic") || provider.name.toLowerCase().includes("claude");

    const config = vscode.workspace.getConfiguration("customai");
    const temperature = config.get<number>("defaultTemperature", 0.7);
    const maxTokens = config.get<number>("defaultMaxTokens", 4096);

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream, application/json",
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

    progress.report(new vscode.LanguageModelTextPart(""));

    try {
      const abortController = new AbortController();
      const cancellation = token.onCancellationRequested(() => abortController.abort());
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal,
      });
      cancellation.dispose();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const payload = await response.text();
        const emitted = this.reportJsonResponse(payload, progress, isAnthropic);
        if (!emitted) {
          throw new Error(`API returned no text content: ${payload.slice(0, 500)}`);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }> = new Map();
      let emittedText = false;

      while (true) {
        if (token.isCancellationRequested) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine === "" || trimmedLine.startsWith(":") || trimmedLine.startsWith("event:")) continue;

          const data = trimmedLine.startsWith("data:") ? trimmedLine.slice(5).trim() : trimmedLine;
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const text = this.extractResponseText(parsed, isAnthropic);
            if (text) {
              emittedText = true;
              progress.report(new vscode.LanguageModelTextPart(text));
            }

            if (isAnthropic) {
              // Anthropic text_delta 已由 extractResponseText 处理
            } else {
              // OpenAI 兼容流式解析
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              // 工具调用增量累积（流式 tool_calls 分片到达）
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const existing = toolCallAccumulators.get(tc.index) || { arguments: "" };
                  if (tc.id) { existing.id = tc.id; }
                  if (tc.function?.name) { existing.name = tc.function.name; }
                  if (tc.function?.arguments) { existing.arguments += tc.function.arguments; }
                  toolCallAccumulators.set(tc.index, existing);
                }
              }

              // 流结束时上报完整的工具调用
              if (finishReason === "tool_calls") {
                for (const [, tc] of toolCallAccumulators) {
                  if (tc.name && tc.id) {
                    try {
                      const input = JSON.parse(tc.arguments || "{}");
                      progress.report(new vscode.LanguageModelToolCallPart(tc.id, tc.name, input));
                    } catch {
                      progress.report(new vscode.LanguageModelToolCallPart(tc.id, tc.name, {}));
                    }
                  }
                }
              }
            }
          } catch {
            // 跳过无效 JSON 行
          }
        }
      }
      if (buffer.trim()) {
        const flushed = this.reportJsonResponse(buffer.trim().replace(/^data:\s*/, ""), progress, isAnthropic);
        emittedText = emittedText || flushed;
      }
      if (!emittedText) {
        throw new Error("API response completed without text content; check stream format or disable streaming in reverse proxy.");
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
    return `${trimmed}/chat/completions`;
  }

  private reportJsonResponse(
    payload: string,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    isAnthropic: boolean
  ): boolean {
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
      if (parsed?.error) {
        const message = parsed.error.message || JSON.stringify(parsed.error);
        throw new Error(`API Error: ${message}`);
      }
      const text = this.extractResponseText(parsed, isAnthropic);
      if (text) {
        progress.report(new vscode.LanguageModelTextPart(text));
        emitted = true;
      }
    }
    return emitted;
  }

  private extractResponseText(parsed: any, isAnthropic: boolean): string {
    if (!parsed) return "";
    if (parsed.error) {
      throw new Error(parsed.error.message || JSON.stringify(parsed.error));
    }

    if (typeof parsed.output_text === "string") return parsed.output_text;
    if (typeof parsed.text === "string") return parsed.text;
    if (typeof parsed.response === "string") return parsed.response;

    if (Array.isArray(parsed.output)) {
      return parsed.output
        .flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
        .map((content: any) => content.text || content.output_text || "")
        .join("");
    }

    if (isAnthropic) {
      const deltaText = parsed.delta?.text || parsed.delta?.partial_json || "";
      if (deltaText) return deltaText;
      if (Array.isArray(parsed.content)) {
        return parsed.content.map((item: any) => item.text || "").join("");
      }
      if (Array.isArray(parsed.message?.content)) {
        return parsed.message.content.map((item: any) => item.text || "").join("");
      }
    }

    const choice = parsed.choices?.[0];
    if (choice?.delta?.content) return choice.delta.content;
    if (choice?.message?.content) {
      if (typeof choice.message.content === "string") return choice.message.content;
      if (Array.isArray(choice.message.content)) {
        return choice.message.content.map((item: any) => item.text || item.content || "").join("");
      }
    }
    if (choice?.text) return choice.text;

    return "";
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
