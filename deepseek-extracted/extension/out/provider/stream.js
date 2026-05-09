"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamChatCompletion = streamChatCompletion;
const vscode_1 = __importDefault(require("vscode"));
const cache_1 = require("./cache");
const diagnostics_1 = require("./diagnostics");
function streamChatCompletion({ prepared, progress, token, reasoningCache, getCharsPerToken, setCharsPerToken, }) {
    const state = {
        accumulatedReasoning: '',
        emittedToolCallIds: [],
    };
    const cancelListener = (0, diagnostics_1.observeCancellationToken)(token, prepared.cacheDiagnostics, () => {
        cacheEmittedToolCallReasoningOnCancellation(prepared.isThinkingModel, state, reasoningCache);
    });
    return prepared.client
        .streamChatCompletion(prepared.request, {
        onContent: (content) => {
            progress.report(new vscode_1.default.LanguageModelTextPart(content));
        },
        onThinking: (text) => {
            handleThinking(text, state, progress);
        },
        onToolCall: (toolCall) => {
            handleToolCall(toolCall, state, progress);
        },
        onError: (error) => {
            throw error;
        },
        onDone: () => {
            finalizeReasoningCache(prepared.isThinkingModel, prepared.trailingToolResultIds, state, reasoningCache, prepared.cacheDiagnostics);
        },
        onUsage: (usage) => {
            const charsPerToken = updateCharsPerToken(prepared.totalRequestChars, usage, getCharsPerToken());
            setCharsPerToken(charsPerToken);
            prepared.cacheDiagnostics.onUsage(usage, charsPerToken);
        },
    }, token)
        .finally(() => {
        cancelListener.dispose();
    });
}
function handleThinking(text, state, progress) {
    state.accumulatedReasoning += text;
    // LanguageModelThinkingPart is a proposed API; the project root augmentation provides types.
    progress.report(new vscode_1.default.LanguageModelThinkingPart(text));
}
function handleToolCall(toolCall, state, progress) {
    state.emittedToolCallIds.push(toolCall.id);
    try {
        const args = JSON.parse(toolCall.function.arguments);
        progress.report(new vscode_1.default.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, args));
    }
    catch {
        progress.report(new vscode_1.default.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, {}));
    }
}
function finalizeReasoningCache(isThinkingModel, trailingToolResultIds, state, reasoningCache, cacheDiagnostics) {
    if (isThinkingModel && state.accumulatedReasoning) {
        const entry = {
            text: state.accumulatedReasoning,
            timestamp: Date.now(),
        };
        if (state.emittedToolCallIds.length > 0) {
            for (const toolCallId of state.emittedToolCallIds) {
                reasoningCache.set((0, cache_1.createToolReasoningKey)(toolCallId), entry);
            }
        }
        else if (trailingToolResultIds.length > 0) {
            reasoningCache.set((0, cache_1.createPostToolReasoningKey)(trailingToolResultIds), entry);
        }
    }
    const cacheSizeBeforePrune = reasoningCache.size;
    (0, cache_1.pruneReasoningCache)(reasoningCache, false);
    const evictedReasoningEntries = Math.max(0, cacheSizeBeforePrune - reasoningCache.size);
    cacheDiagnostics.onDone({
        reasoningCacheSize: reasoningCache.size,
        evictedReasoningEntries,
        emittedToolCalls: state.emittedToolCallIds.length,
        trailingToolResults: trailingToolResultIds.length,
    });
}
function cacheEmittedToolCallReasoningOnCancellation(isThinkingModel, state, reasoningCache) {
    if (!isThinkingModel || !state.accumulatedReasoning || state.emittedToolCallIds.length === 0) {
        return;
    }
    const entry = {
        text: state.accumulatedReasoning,
        timestamp: Date.now(),
    };
    for (const toolCallId of state.emittedToolCallIds) {
        reasoningCache.set((0, cache_1.createToolReasoningKey)(toolCallId), entry);
    }
    (0, cache_1.pruneReasoningCache)(reasoningCache, false);
}
function updateCharsPerToken(totalRequestChars, usage, charsPerToken) {
    if (totalRequestChars > 0 && usage.prompt_tokens > 0) {
        const observedRatio = totalRequestChars / usage.prompt_tokens;
        return charsPerToken * 0.7 + observedRatio * 0.3;
    }
    return charsPerToken;
}
//# sourceMappingURL=stream.js.map