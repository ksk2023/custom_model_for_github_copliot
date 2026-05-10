import * as vscode from "vscode";

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface AIModel {
  id: string;
  providerId: string;
  modelName: string;
  displayName: string;
  maxInputTokens: number;
  visible: boolean;
  reasoningProfile?: string;
  reasoningEffort?: string;
  reasoningEffortOptions?: string[];
  thinkingType?: string;
  thinkingTypeOptions?: string[];
  thinkingBudget?: number;
  customRequestParams?: string;
}

function getConfig() {
  return vscode.workspace.getConfiguration("customai");
}

// ── Providers ───────────────────────────────────

export function getProviders(): Provider[] {
  return getConfig().get<Provider[]>("providers", []) || [];
}

export async function saveProvider(provider: Provider): Promise<void> {
  const config = getConfig();
  const providers = getProviders();
  const idx = providers.findIndex((p) => p.id === provider.id);
  if (idx !== -1) {
    providers[idx] = provider;
  } else {
    provider.id = provider.id || Date.now().toString();
    providers.push(provider);
  }
  await config.update("providers", providers, vscode.ConfigurationTarget.Global);
}

export async function deleteProvider(id: string): Promise<void> {
  const config = getConfig();
  const providers = getProviders().filter((p) => p.id !== id);
  const models = getModels().filter((m) => m.providerId !== id);
  await config.update("providers", providers, vscode.ConfigurationTarget.Global);
  await config.update("models", models, vscode.ConfigurationTarget.Global);
}

// ── Models ──────────────────────────────────────

export function getModels(): AIModel[] {
  return getConfig().get<AIModel[]>("models", []) || [];
}

export async function saveModels(models: AIModel[]): Promise<void> {
  await getConfig().update("models", models, vscode.ConfigurationTarget.Global);
}

export async function saveModel(model: AIModel): Promise<void> {
  const models = getModels();
  const idx = models.findIndex((m) => m.id === model.id);
  if (idx !== -1) {
    models[idx] = model;
  } else {
    model.id = model.id || Date.now().toString();
    models.push(model);
  }
  await saveModels(models);
}

export async function deleteModel(id: string): Promise<void> {
  await saveModels(getModels().filter((m) => m.id !== id));
}

export async function toggleModelVisibility(id: string, visible: boolean): Promise<void> {
  const models = getModels();
  const model = models.find((m) => m.id === id);
  if (model) {
    model.visible = visible;
    await saveModels(models);
  }
}

export function getVisibleModels(): AIModel[] {
  return getModels().filter((m) => m.visible);
}

// ── Migration ───────────────────────────────────

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  "openai": "OpenAI",
  "anthropic": "Anthropic",
  "deepseek": "DeepSeek",
  "ollama": "Ollama",
  "step": "阶跃星辰",
  "zhipu": "智谱AI",
  "moonshot": "月之暗面",
  "baichuan": "百川",
  "yi": "零一万物",
  "lmstudio": "LM Studio",
  "custom": "自定义",
};

function inferProviderName(om: any): string {
  const provider = (om.provider || "").toLowerCase();
  if (PROVIDER_DISPLAY_NAMES[provider]) return PROVIDER_DISPLAY_NAMES[provider];

  const baseUrl = om.baseUrl || "";
  if (baseUrl.includes("stepfun")) return "阶跃星辰";
  if (baseUrl.includes("bigmodel")) return "智谱AI";
  if (baseUrl.includes("moonshot")) return "月之暗面";
  if (baseUrl.includes("deepseek")) return "DeepSeek";
  if (baseUrl.includes("baichuan")) return "百川";
  if (baseUrl.includes("lingyiwanwu") || baseUrl.includes("yi-api")) return "零一万物";
  if (baseUrl.includes("openai")) return "OpenAI";
  if (baseUrl.includes("anthropic")) return "Anthropic";
  if (baseUrl.includes("ollama") || baseUrl.includes("11434")) return "Ollama";

  return provider || "Custom";
}

export function migrateOldConfigIfNeeded(): boolean {
  const config = getConfig();
  const oldModels = config.get<any[]>("models", []);
  if (!oldModels || oldModels.length === 0) return false;

  const first = oldModels[0];
  if (first.baseUrl === undefined) return false;

  const providerMap = new Map<string, Provider>();
  const newModels: AIModel[] = [];

  for (const om of oldModels) {
    const key = `${om.provider || "custom"}|${om.baseUrl || ""}|${om.apiKey || ""}`;
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        id: "migrated_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: inferProviderName(om),
        baseUrl: om.baseUrl || "",
        apiKey: om.apiKey || "",
      });
    }
    const prov = providerMap.get(key)!;
    newModels.push({
      id: om.id || "migrated_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      providerId: prov.id,
      modelName: om.modelName || "",
      displayName: `${prov.name} - ${om.modelName}`,
      maxInputTokens: om.maxInputTokens || 128000,
      visible: om.enabled !== undefined ? om.enabled : true,
    });
  }

  const providers = Array.from(providerMap.values());
  config.update("providers", providers, vscode.ConfigurationTarget.Global);
  config.update("models", newModels, vscode.ConfigurationTarget.Global);

  return true;
}
