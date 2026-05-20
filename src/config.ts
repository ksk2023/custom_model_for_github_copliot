/**
 * config.ts — 数据层：供应商与模型配置读写
 *
 * 存储架构（两层）：
 *   customai.providers[]  — 供应商（名称、Base URL、API Key）
 *   customai.models[]     — 模型（关联 providerId，控制可见性）
 *
 * 启动时自动迁移旧格式的扁平 models → 新格式的 providers + models
 */

import * as vscode from "vscode";

/** 供应商 — 用户自定义的 API 端点 */
export interface ProviderFingerprint {
  id: string;          // 唯一标识
  name: string;        // 指纹显示名
  value: string;       // 指纹值；也可填写 JSON 对象来批量注入请求头
  headerName?: string; // 请求头名称，默认 X-Fingerprint
}

export interface Provider {
  id: string;       // 唯一标识
  name: string;     // 用户自定义名称，如"我的阶跃星辰"
  baseUrl: string;  // API 端点地址，如 https://api.stepfun.com/v1
  apiKey: string;   // 鉴权密钥
  fingerprints?: ProviderFingerprint[]; // 可选：中转站/反代指纹
  activeFingerprintId?: string;          // 当前启用的指纹 ID
}

/** 模型 — 从属于某个供应商 */
export interface AIModel {
  id: string;                     // 唯一标识
  providerId: string;             // 关联的供应商 ID
  modelName: string;              // API 中的模型名称，如 "glm-4.5"
  displayName: string;            // Copilot Chat 选择器中显示的名称
  maxInputTokens: number;         // 上下文窗口大小
  visible: boolean;               // 是否在 Copilot Chat 模型选择器中可见
  reasoningProfile?: string;      // 推理配置方案：auto | off | deepseek | openai | glm | claude | qwen | gemini | custom
  reasoningEffort?: string;       // 推理强度：default | low | medium | high | max | xhigh | minimal | none
  reasoningEffortOptions?: string[];  // API 返回的可选推理强度列表
  thinkingType?: string;          // 思维链类型：default | enabled | disabled | adaptive
  thinkingTypeOptions?: string[];     // API 返回的可选思维链类型列表
  thinkingBudget?: number;        // 思维链 token 预算（Claude/Qwen 使用）
  customRequestParams?: string;   // 自定义请求参数（JSON 字符串），会深度合并到请求 body
}

/** 获取 VS Code 配置节的快捷方法 */
function getConfig() {
  return vscode.workspace.getConfiguration("customai");
}

// ── 供应商 CRUD ──────────────────────────────────

/** 获取所有供应商列表 */
export function getProviders(): Provider[] {
  return getConfig().get<Provider[]>("providers", []) || [];
}

/** 保存供应商（新增或更新） */
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

/** 删除供应商及其所有模型 */
export async function deleteProvider(id: string): Promise<void> {
  const config = getConfig();
  const providers = getProviders().filter((p) => p.id !== id);
  const models = getModels().filter((m) => m.providerId !== id);
  await config.update("providers", providers, vscode.ConfigurationTarget.Global);
  await config.update("models", models, vscode.ConfigurationTarget.Global);
}

// ── 模型 CRUD ────────────────────────────────────

/** 获取所有模型列表 */
export function getModels(): AIModel[] {
  return getConfig().get<AIModel[]>("models", []) || [];
}

/** 批量保存模型 */
export async function saveModels(models: AIModel[]): Promise<void> {
  await getConfig().update("models", models, vscode.ConfigurationTarget.Global);
}

/** 保存单个模型（新增或更新） */
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

/** 删除单个模型 */
export async function deleteModel(id: string): Promise<void> {
  await saveModels(getModels().filter((m) => m.id !== id));
}

/** 切换模型在 Copilot Chat 选择器中的可见性 */
export async function toggleModelVisibility(id: string, visible: boolean): Promise<void> {
  const models = getModels();
  const model = models.find((m) => m.id === id);
  if (model) {
    model.visible = visible;
    await saveModels(models);
  }
}

/** 获取所有可见的模型（用于注册到 Copilot Chat） */
export function getVisibleModels(): AIModel[] {
  return getModels().filter((m) => m.visible);
}

// ── 旧格式迁移 ───────────────────────────────────

/** 供应商名称映射表：根据 provider 字段或 baseUrl 推断中文/英文显示名 */
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

/** 从旧格式模型的 provider 字段或 baseUrl 推断供应商名称 */
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

/**
 * 迁移旧格式配置到新格式（仅在激活时调用一次）
 *
 * 旧格式：customai.models = [{ id, name, provider, baseUrl, apiKey, modelName, enabled }]
 * 新格式：customai.providers + customai.models（不含 baseUrl/apiKey）
 *
 * 按 baseUrl + apiKey 分组生成供应商，模型关联 providerId
 */
export function migrateOldConfigIfNeeded(): boolean {
  const config = getConfig();
  const oldModels = config.get<any[]>("models", []);
  if (!oldModels || oldModels.length === 0) return false;

  const first = oldModels[0];
  if (first.baseUrl === undefined) return false;  // 已经是新格式，跳过

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
