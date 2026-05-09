"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseUrl = getBaseUrl;
exports.getApiModelId = getApiModelId;
exports.getMaxTokens = getMaxTokens;
exports.getDebugLoggingEnabled = getDebugLoggingEnabled;
const vscode_1 = __importDefault(require("vscode"));
const consts_1 = require("./consts");
/**
 * Get DeepSeek API base URL from settings.
 * Falls back to the official endpoint when not configured.
 */
function getBaseUrl() {
    const config = vscode_1.default.workspace.getConfiguration(consts_1.CONFIG_SECTION);
    return config.get('baseUrl') || 'https://api.deepseek.com';
}
/**
 * Resolve the API model ID to send to the endpoint.
 *
 * Users can override model IDs via the `modelIdOverrides` setting object
 * (e.g. for third-party API proxies). Falls back to the VS Code model ID
 * when no override is configured.
 */
function getApiModelId(vscodeModelId) {
    const config = vscode_1.default.workspace.getConfiguration(consts_1.CONFIG_SECTION);
    const overrides = config.get('modelIdOverrides');
    const override = overrides?.[vscodeModelId]?.trim();
    return override || vscodeModelId;
}
/**
 * Get the configured max output tokens limit.
 * Returns `undefined` when set to 0 (API default — no limit).
 */
function getMaxTokens() {
    const config = vscode_1.default.workspace.getConfiguration(consts_1.CONFIG_SECTION);
    const value = config.get('maxTokens', 0);
    return value > 0 ? value : undefined;
}
/**
 * Whether to log privacy-preserving diagnostic debug information.
 */
function getDebugLoggingEnabled() {
    const config = vscode_1.default.workspace.getConfiguration(consts_1.CONFIG_SECTION);
    return config.get('debug', false);
}
//# sourceMappingURL=config.js.map