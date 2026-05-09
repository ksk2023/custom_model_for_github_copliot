import * as vscode from "vscode";
import { AIModel, getModels } from "./config.js";

export class CustomAIProvider {
  private context: vscode.ExtensionContext;
  isActive = true;
  onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
  onDidChangeLanguageModelChatInformation = this.onDidChangeLanguageModelChatInformationEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    context.subscriptions.push(
      this.onDidChangeLanguageModelChatInformationEmitter,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("customai.models")) {
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
    if (!this.isActive) {
      return [];
    }

    const models = getModels();
    console.log(`[CustomAI] provideLanguageModelChatInformation called, returning ${models.length} models`);
    return models.map((model) => this.toChatInfo(model));
  }

  private toChatInfo(model: AIModel): vscode.LanguageModelChatInformation {
    const hasApiKey = !!model.apiKey && model.apiKey.length > 0;

    return {
      id: model.id,
      name: model.name,
      family: model.modelName,
      version: model.modelName,
      maxInputTokens: 128000,
      maxOutputTokens: 8192,
      capabilities: {
        imageInput: false,
        toolCalling: false,
      },
      detail: `${model.provider} - ${model.baseUrl}`,
    };
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

    const apiMessages: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === vscode.LanguageModelChatMessageRole.User) {
        const textContent = this.extractTextContent(msg.content);
        if (!textContent && msg.content.length > 0) {
          throw new Error(`抱歉，"${model.name}" 不支持图片输入。请只发送文本内容。\n\nSorry, "${model.name}" does not support image input. Please send text only.`);
        }
        if (textContent) {
          apiMessages.push({ role: "user", content: textContent });
        }
      } else if (msg.role === vscode.LanguageModelChatMessageRole.Assistant) {
        const textContent = this.extractTextContent(msg.content);
        if (textContent) {
          apiMessages.push({ role: "assistant", content: textContent });
        }
      }
    }

    const systemMessage = apiMessages.find((m) => m.role === "system");
    const chatMessages = apiMessages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: model.modelName,
      messages: chatMessages,
      stream: true,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    let endpoint = model.baseUrl.replace(/\/$/, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (model.apiKey) {
      if (model.provider === "anthropic") {
        headers["x-api-key"] = model.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        endpoint += "/messages";
        delete body.model;
        (body as Record<string, unknown>).model = model.modelName;
        (body as Record<string, unknown>).max_tokens = 4096;
      } else {
        headers["Authorization"] = `Bearer ${model.apiKey}`;
        endpoint += "/chat/completions";
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

            if (model.provider === "anthropic") {
              const text = parsed.delta?.text || parsed.content?.[0]?.text || "";
              if (text) {
                progress.report(new vscode.LanguageModelTextPart(text));
              }
            } else {
              const text = parsed.choices?.[0]?.delta?.content || "";
              if (text) {
                progress.report(new vscode.LanguageModelTextPart(text));
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

  private extractTextContent(content: ReadonlyArray<vscode.LanguageModelInputPart | unknown>): string {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === "object" && part !== null && "content" in part) {
        const p = part as { content: string };
        if (typeof p.content === "string") {
          parts.push(p.content);
        }
      }
    }
    return parts.join("");
  }

  async provideTokenCount(
    _modelInfo: vscode.LanguageModelChatInformation,
    text: string,
    _token: vscode.CancellationToken
  ): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
