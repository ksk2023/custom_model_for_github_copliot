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

export function getModels(): AIModel[] {
  const config = vscode.workspace.getConfiguration("customai");
  return config.get<AIModel[]>("models", []);
}

export async function saveModels(models: AIModel[]): Promise<void> {
  const config = vscode.workspace.getConfiguration("customai");
  await config.update("models", models, vscode.ConfigurationTarget.Workspace);
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
