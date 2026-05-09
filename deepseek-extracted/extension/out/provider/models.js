"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toChatInfo = toChatInfo;
exports.getConfiguredThinkingEffort = getConfiguredThinkingEffort;
const vscode_1 = __importDefault(require("vscode"));
const i18n_1 = require("../i18n");
function toChatInfo(m, hasApiKey) {
    const detailKey = resolveDetailKey(m);
    const modelDetail = detailKey ? (0, i18n_1.t)(detailKey) : m.detail;
    return {
        id: m.id,
        name: m.name,
        family: m.family,
        version: m.version,
        detail: hasApiKey ? modelDetail : (0, i18n_1.t)('auth.apiKeyRequiredDetail'),
        tooltip: hasApiKey ? undefined : (0, i18n_1.t)('auth.apiKeyRequiredDetail'),
        statusIcon: hasApiKey ? undefined : new vscode_1.default.ThemeIcon('warning'),
        maxInputTokens: m.maxInputTokens,
        maxOutputTokens: m.maxOutputTokens,
        isUserSelectable: true,
        capabilities: {
            toolCalling: m.capabilities.toolCalling,
            imageInput: m.capabilities.imageInput,
        },
        ...(m.capabilities.thinking ? { configurationSchema: buildThinkingEffortSchema() } : {}),
    };
}
function getConfiguredThinkingEffort(options) {
    const configuredEffort = options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
    if (configuredEffort === 'none') {
        return 'none';
    }
    if (configuredEffort === 'high') {
        return 'high';
    }
    return configuredEffort === 'max' ? 'max' : 'high';
}
function buildThinkingEffortSchema() {
    return {
        properties: {
            reasoningEffort: {
                type: 'string',
                title: (0, i18n_1.t)('status.thinking'),
                enum: ['none', 'high', 'max'],
                enumItemLabels: [(0, i18n_1.t)('thinking.none'), (0, i18n_1.t)('thinking.high'), (0, i18n_1.t)('thinking.max')],
                enumDescriptions: [
                    (0, i18n_1.t)('thinking.none.desc'),
                    (0, i18n_1.t)('thinking.high.desc'),
                    (0, i18n_1.t)('thinking.max.desc'),
                ],
                default: 'high',
                group: 'navigation',
            },
        },
    };
}
function resolveDetailKey(m) {
    const suffix = m.id.startsWith('deepseek-v4-') ? m.id.slice('deepseek-v4-'.length) : m.id;
    const key = `model.${suffix}.detail`;
    const translated = (0, i18n_1.t)(key);
    return translated !== key ? key : undefined;
}
//# sourceMappingURL=models.js.map