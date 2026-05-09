"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareChatRequest = prepareChatRequest;
const client_1 = require("../client");
const config_1 = require("../config");
const consts_1 = require("../consts");
const i18n_1 = require("../i18n");
const cache_1 = require("./cache");
const convert_1 = require("./convert");
const models_1 = require("./models");
const index_1 = require("./vision/index");
async function prepareChatRequest({ authManager, modelInfo, messages, options, token, reasoningCache, cacheDiagnostics, getVisionModel, }) {
    const apiKey = await authManager.getApiKey();
    if (!apiKey) {
        throw new Error((0, i18n_1.t)('auth.notConfigured'));
    }
    const client = new client_1.DeepSeekClient((0, config_1.getBaseUrl)(), apiKey);
    const modelDef = consts_1.MODELS.find((m) => m.id === modelInfo.id);
    const isThinkingModel = modelDef?.capabilities.thinking ?? false;
    const thinkingEffort = (0, models_1.getConfiguredThinkingEffort)(options);
    const maxTokens = (0, config_1.getMaxTokens)();
    clearStaleReasoningCache(messages, reasoningCache, cacheDiagnostics);
    const reasoningCacheSize = reasoningCache.size;
    const visionResolution = await (0, index_1.resolveImageMessages)(messages, token, getVisionModel);
    const resolvedMessages = visionResolution.messages;
    const deepseekMessages = (0, convert_1.convertMessages)(resolvedMessages, isThinkingModel, reasoningCache);
    const tools = modelDef?.capabilities.toolCalling ? (0, convert_1.convertTools)(options.tools) : undefined;
    const totalRequestChars = (0, convert_1.countMessageChars)(deepseekMessages);
    const request = {
        model: (0, config_1.getApiModelId)(modelInfo.id),
        messages: deepseekMessages,
        stream: true,
        tools,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        max_tokens: maxTokens,
        ...(isThinkingModel
            ? {
                thinking: {
                    type: thinkingEffort === 'none' ? 'disabled' : 'enabled',
                },
                ...(thinkingEffort === 'none' ? {} : { reasoning_effort: thinkingEffort }),
            }
            : {}),
    };
    const diagnosticsRun = cacheDiagnostics.beginRequest({
        request,
        vscodeModelId: modelInfo.id,
        isThinkingModel,
        thinkingEffort,
        maxTokens,
        reasoningCacheSize,
        inputMessages: messages,
        resolvedMessages,
        visionModelId: visionResolution.visionModelId,
        visionCacheStats: visionResolution.stats,
    });
    return {
        client,
        request,
        isThinkingModel,
        totalRequestChars,
        trailingToolResultIds: collectTrailingToolResultIds(deepseekMessages),
        cacheDiagnostics: diagnosticsRun,
    };
}
function collectTrailingToolResultIds(messages) {
    const trailingToolResultIds = [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== 'tool' || !message.tool_call_id) {
            break;
        }
        trailingToolResultIds.push(message.tool_call_id);
    }
    return trailingToolResultIds.reverse();
}
function clearStaleReasoningCache(messages, reasoningCache, cacheDiagnostics) {
    if (messages.length <= 2) {
        const removed = reasoningCache.size;
        (0, cache_1.pruneReasoningCache)(reasoningCache, true);
        cacheDiagnostics.logReasoningCacheCleared(removed);
    }
}
//# sourceMappingURL=request.js.map