import * as vscode from "vscode";
import { AIModel, getModels } from "./config.js";
import { log } from "./logger.js";

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
        if (e.affectsConfiguration("customai.models")) {
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

    const models = getModels();
    log(`getModels returned ${models.length} models`);
    for (const m of models) {
      log(`  Model: id=${m.id}, name=${m.name}, provider=${m.provider}, hasApiKey=${!!m.apiKey}`);
    }
    const result = models.map((model) => this.toChatInfo(model));
    log(`Returning ${result.length} LanguageModelChatInformation items`);
    return result;
  }

  private toChatInfo(model: AIModel): vscode.LanguageModelChatInformation {
    const hasApiKey = !!model.apiKey && model.apiKey.length > 0;

    return {
      id: model.id,
      name: model.name,
      family: model.provider,
      version: model.modelName,
      maxInputTokens: 128000,
      maxOutputTokens: 8192,
      isUserSelectable: true,
      capabilities: {
        imageInput: false,
        toolCalling: true,
      },
      detail: hasApiKey
        ? `${model.provider} - ${model.baseUrl}`
        : `${model.provider} - API Key 未设置`,
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
    const models = getModels();
    const model = models.find((m) => m.id === modelInfo.id);

    if (!model) {
      throw new Error(`Model not found: ${modelInfo.id}`);
    }

    log(`provideLanguageModelChatResponse called for model: ${model.name}`);

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

    const isAnthropic = model.provider === "anthropic";

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

    let endpoint = model.baseUrl.replace(/\/$/, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (model.apiKey) {
      if (isAnthropic) {
        headers["x-api-key"] = model.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        endpoint += "/messages";
        delete body.model;
        delete body.temperature;
        (body as Record<string, unknown>).model = model.modelName;
        (body as Record<string, unknown>).max_tokens = maxTokens;
      } else {
        headers["Authorization"] = `Bearer ${model.apiKey}`;
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

  async provideTokenCount(
    _modelInfo: vscode.LanguageModelChatInformation,
    text: string,
    _token: vscode.CancellationToken
  ): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
