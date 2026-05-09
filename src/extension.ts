import * as vscode from "vscode";
import { ConfigViewProvider } from "./configView.js";
import { ChatHandler } from "./chatHandler.js";

let configViewProvider: ConfigViewProvider | undefined;
let chatHandler: ChatHandler | undefined;

export function activate(context: vscode.ExtensionContext): void {
  chatHandler = new ChatHandler(context);

  configViewProvider = new ConfigViewProvider(context, chatHandler);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "custom-copilot-config-view",
      configViewProvider
    )
  );

  context.subscriptions.push(
    vscode.chat.createChatParticipant("custom-copilot", chatHandler.getHandler())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("custom-copilot.addModel", () => {
      configViewProvider?.showAddModelDialog();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("custom-copilot.openConfig", () => {
      vscode.commands.executeCommand("custom-copilot-config-view.focus");
    })
  );
}

export function deactivate(): void {
  configViewProvider?.dispose();
  chatHandler?.dispose();
}
