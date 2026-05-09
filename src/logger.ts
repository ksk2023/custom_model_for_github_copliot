import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function initLogger(name: string = "Custom AI"): vscode.OutputChannel {
  channel = vscode.window.createOutputChannel(name);
  channel.show();
  return channel;
}

export function log(message: string): void {
  if (channel) {
    channel.appendLine(`[${new Date().toISOString()}] ${message}`);
  } else {
    console.log(`[CustomAI] ${message}`);
  }
}