import * as vscode from "vscode";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  enabled: boolean;
}

const DEFAULT_MODELS: AIModel[] = [
  {
    id: "default-openai",
    name: "OpenAI (请配置)",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    modelName: "gpt-4-turbo-preview",
    enabled: true,
  },
  {
    id: "default-anthropic",
    name: "Claude (请配置)",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    modelName: "claude-3-sonnet-20240229",
    enabled: true,
  },
  {
    id: "default-ollama",
    name: "Ollama (请配置)",
    provider: "ollama",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    modelName: "llama2",
    enabled: true,
  },
];

export function getModels(): AIModel[] {
  const config = vscode.workspace.getConfiguration("customai");
  const storedModels = config.get<AIModel[]>("models", []) || [];

  if (storedModels.length === 0) {
    return DEFAULT_MODELS;
  }

  return storedModels;
}

export async function saveModels(models: AIModel[]): Promise<void> {
  const config = vscode.workspace.getConfiguration("customai");
  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("models", models, target);
}

export async function addModel(model: AIModel): Promise<void> {
  const models = getModels();
  model.id = Date.now().toString();
  models.push(model);
  await saveModels(models);
}

export async function updateModel(model: AIModel): Promise<void> {
  const models = getModels();
  const index = models.findIndex((m) => m.id === model.id);
  if (index !== -1) {
    models[index] = model;
    await saveModels(models);
  }
}

export async function deleteModel(id: string): Promise<void> {
  const models = getModels();
  const filtered = models.filter((m) => m.id !== id);
  await saveModels(filtered);
}

export async function toggleModel(id: string, enabled: boolean): Promise<void> {
  const models = getModels();
  const model = models.find((m) => m.id === id);
  if (model) {
    model.enabled = enabled;
    await saveModels(models);
  }
}
