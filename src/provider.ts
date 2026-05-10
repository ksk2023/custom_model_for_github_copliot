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

  refreshModelPicker(): void {
    this.onDidChangeLanguageModelChatInformationEmitter.fire();
  }

  prepareForDeactivate(): void {
    this.isActive = false;
    this.onDidChangeLanguageModelChatInformationEmitter.fire();
  }

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

  private toChatInfo(model: AIModel, provider: Provider): vscode.LanguageModelChatInformation {
    const hasApiKey = !!provider.apiKey && provider.apiKey.length > 0;
    const safeId = model.id.replace(/[^a-zA-Z0-9_-]/g, "_");
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

    const config = vscode.workspace.getConfiguration("customai");
    const temperature = config.get<number>("defaultTemperature", 0.7);
    const maxTokens = config.get<number>("defaultMaxTokens", 4096);

    const body: Record<string, unknown> = {
      model: model.modelName,
      messages: apiMessages,
      stream: true,
      temperature,
    };
    const isAnthropic = provider.name.toLowerCase().includes("anthropic") || provider.name.toLowerCase().includes("claude");
    this.applyReasoningOptions(body, model, provider, isAnthropic);

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

    let endpoint = provider.baseUrl.replace(/\/$/, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (provider.apiKey) {
      if (isAnthropic) {
        headers["x-api-key"] = provider.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        endpoint += "/messages";
        delete body.model;
        delete body.temperature;
        (body as Record<string, unknown>).model = model.modelName;
        (body as Record<string, unknown>).max_tokens = maxTokens;
      } else {
        headers["Authorization"] = `Bearer ${provider.apiKey}`;
        endpoint += "/chat/completions";
        (body as Record<string, unknown>).max_tokens = maxTokens;
      }
    }

    progress.report(new vscode.LanguageModelTextPart(""));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallAccumulators: Map<number, { id?: string; name?: string; arguments: string }> = new Map();

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
          if (line.trim() === "" || !line.startsWith("data: ")) continue;

          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (isAnthropic) {
              const text = parsed.delta?.text || parsed.content?.[0]?.text || "";
              if (text) {
                progress.report(new vscode.LanguageModelTextPart(text));
              }
            } else {
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              if (delta?.content) {
                progress.report(new vscode.LanguageModelTextPart(delta.content));
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const existing = toolCallAccumulators.get(tc.index) || { arguments: "" };
                  if (tc.id) { existing.id = tc.id; }
                  if (tc.function?.name) { existing.name = tc.function.name; }
                  if (tc.function?.arguments) { existing.arguments += tc.function.arguments; }
                  toolCallAccumulators.set(tc.index, existing);
                }
              }

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
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      throw new Error(`Request failed: ${(error as Error).message}`);
    }
  }

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

    if ((profile === "openai" || profile === "stepfun") && effort && this.isAllowedOption(effort, reasoningOptions)) {
      body.reasoning_effort = effort;
    }

    if (profile === "deepseek") {
      if (thinking && this.isAllowedOption(thinking, thinkingOptions)) {
        body.thinking = { type: thinking };
      }
      if (effort && this.isAllowedOption(effort, reasoningOptions)) {
        body.reasoning_effort = effort;
      }
    }

    if (profile === "glm") {
      if (thinking && this.isAllowedOption(thinking, thinkingOptions)) {
        body.thinking = { type: thinking };
      }
    }

    if (profile === "qwen") {
      if (thinking === "enabled") body.enable_thinking = true;
      if (thinking === "disabled") body.enable_thinking = false;
      if (budget) body.thinking_budget = budget;
    }

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

    if (profile === "custom") {
      if (effort) body.reasoning_effort = effort;
      if (thinking) body.thinking = { type: thinking };
      if (budget) body.thinking_budget = budget;
    }

    if (profile === "minimax" && thinking === "enabled") {
      body.reasoning_split = true;
    }

    this.mergeCustomRequestParams(body, model);
  }

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

  private isAllowedOption(value: string, options: string[]): boolean {
    return options.length === 0 || options.includes(value);
  }

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

  async provideTokenCount(
    _modelInfo: vscode.LanguageModelChatInformation,
    text: string,
    _token: vscode.CancellationToken
  ): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
