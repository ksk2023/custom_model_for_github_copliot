/**
 * logger.ts — 日志输出工具
 *
 * 使用 VS Code OutputChannel 记录扩展运行日志
 * 查看方式：Output 面板 → 下拉选择 "Custom AI"
 */

import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

/** 初始化 OutputChannel 并显示 */
export function initLogger(name: string = "Custom AI"): vscode.OutputChannel {
  channel = vscode.window.createOutputChannel(name);
  channel.show();
  return channel;
}

/** 写入一条带时间戳的日志 */
export function log(message: string): void {
  if (channel) {
    channel.appendLine(`[${new Date().toISOString()}] ${message}`);
  } else {
    console.log(`[CustomAI] ${message}`);
  }
}