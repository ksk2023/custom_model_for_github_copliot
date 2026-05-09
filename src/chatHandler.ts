import * as vscode from "vscode";
import { AIModel, ExtensionConfig } from "./configView.js";

export class ChatHandler {
  private readonly context: vscode.ExtensionContext;
  private models: AIModel[] = [];
  private chatHistory: Map<string, Array<{ role: string; content: string }>> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadModels();
  }

  private loadModels(): void {
    const config = vscode.workspace.getConfiguration("customCopilot");
    this.models = config.get<AIModel[]>("models", []);
  }

  public updateModels(models: AIModel[]): void {
    this.models = models;
  }

  public getHandler(): vscode.ChatRequestHandler {
    return async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
      const prompt = request.prompt;
      const modelId = request.command;

      const model = modelId
        ? this.models.find(m => m.id === modelId && m.enabled)
        : this.models.find(m => m.enabled);

      if (!model) {
        stream.markdown(`## No Model Configured

Please configure a custom AI model first:
1. Click **"Custom AI Config"** in the sidebar
2. Click **"+ Add Model"**
3. Configure your API endpoint and key

**Supported Providers:**
- OpenAI Compatible APIs
- Anthropic (Claude)
- Ollama
- LM Studio
- Custom REST APIs

---
*Need help? Check the configuration panel for setup instructions.*`);
        return;
      }

      stream.markdown(`## ${model.name}\n`);

      try {
        const messages = this.getChatHistory("default");
        messages.push({ role: "user", content: prompt });

        stream.progress(`Thinking with ${model.name}...`);

        const response = await this.callAI(model, messages);

        messages.push({ role: "assistant", content: response });

        stream.markdown(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stream.markdown(`**Error:** ${errorMessage}

Please check:
1. Your API key is correct
2. The base URL is accessible
3. The model name exists`);
      }
    };
  }

  private getChatHistory(sessionId: string): Array<{ role: string; content: string }> {
    if (!this.chatHistory.has(sessionId)) {
      this.chatHistory.set(sessionId, []);
    }
    return this.chatHistory.get(sessionId)!;
  }

  private async callAI(model: AIModel, messages: Array<{ role: string; content: string }>): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (model.apiKey) {
      if (model.provider === "anthropic") {
        headers["x-api-key"] = model.apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${model.apiKey}`;
      }
    }

    let body: Record<string, unknown>;
    let endpoint = model.baseUrl.replace(/\/$/, "");

    if (model.provider === "anthropic") {
      const lastMessage = messages[messages.length - 1];
      body = {
        model: model.modelName,
        max_tokens: 4096,
        messages: messages.filter(m => m.role !== "system"),
        system: messages.find(m => m.role === "system")?.content
      };
      endpoint += "/messages";
    } else {
      body = {
        model: model.modelName,
        messages: messages.filter(m => m.role !== "system"),
        stream: false
      };
      if (messages.find(m => m.role === "system")) {
        (body as Record<string, unknown>).system = messages.find(m => m.role === "system")?.content;
      }
      endpoint += "/chat/completions";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;

    if (model.provider === "anthropic") {
      return (data as { content: Array<{ text: string }> }).content[0]?.text || "";
    } else {
      const choices = (data as { choices: Array<{ message: { content: string } }> }).choices;
      return choices?.[0]?.message?.content || "";
    }
  }

  public async handleChatRequest(prompt: string, modelId?: string): Promise<string> {
    const model = modelId
      ? this.models.find(m => m.id === modelId && m.enabled)
      : this.models.find(m => m.enabled);

    if (!model) {
      throw new Error("No model configured");
    }

    const messages = [{ role: "user", content: prompt }];
    return await this.callAI(model, messages);
  }

  dispose(): void {
    this.chatHistory.clear();
  }
}
