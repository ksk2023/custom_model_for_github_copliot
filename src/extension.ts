import * as vscode from "vscode";
import { CustomAIProvider } from "./provider.js";

let provider: CustomAIProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  provider = new CustomAIProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.openConfig", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "customai");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("customai.addModel", () => {
      vscode.commands.executeCommand("workbench.action.openSettings", "customai.models");
    })
  );

  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider("customai", provider)
  );

  provider.refreshModelPicker();
}

export function deactivate(): void {
  provider?.prepareForDeactivate();
}
