"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.observeCancellationToken = observeCancellationToken;
exports.createCacheDiagnosticsRecorder = createCacheDiagnosticsRecorder;
exports.createCacheTraceSnapshot = createCacheTraceSnapshot;
exports.compareCacheTraceSnapshots = compareCacheTraceSnapshots;
exports.formatCacheTraceSnapshot = formatCacheTraceSnapshot;
exports.formatCacheTraceDetailLines = formatCacheTraceDetailLines;
exports.formatCacheTraceComparison = formatCacheTraceComparison;
exports.formatCacheTraceConversationChangeComparison = formatCacheTraceConversationChangeComparison;
exports.formatCacheTraceComparisonDetailLines = formatCacheTraceComparisonDetailLines;
exports.getCacheTraceWarnings = getCacheTraceWarnings;
exports.getCacheTraceComparisonWarnings = getCacheTraceComparisonWarnings;
const crypto_1 = require("crypto");
const vscode_1 = __importDefault(require("vscode"));
const config_1 = require("../config");
const consts_1 = require("../consts");
const logger_1 = require("../logger");
const LARGE_MESSAGE_CHARS = 10_000;
const HASH_WINDOW_CHARS = 2_048;
function observeCancellationToken(token, diagnosticsRun, onCancellationRequested) {
    let notified = false;
    const notifyCancellationRequested = () => {
        if (notified) {
            return;
        }
        notified = true;
        diagnosticsRun.onCancellationTokenRequested();
        onCancellationRequested?.();
    };
    const listener = token.onCancellationRequested(notifyCancellationRequested);
    if (token.isCancellationRequested) {
        notifyCancellationRequested();
    }
    return listener;
}
function createCacheDiagnosticsRecorder() {
    return new DefaultCacheDiagnosticsRecorder();
}
class DefaultCacheDiagnosticsRecorder {
    previousCacheTraces = new Map();
    lastCacheTrace;
    requestId = 0;
    isEnabled() {
        return (0, config_1.getDebugLoggingEnabled)();
    }
    logReasoningCacheCleared(removed) {
        if (removed > 0 && this.isEnabled()) {
            logger_1.logger.info(`reasoning-cache cleared entries=${removed} reason=conversation-start`);
        }
    }
    beginRequest(options) {
        if (!this.isEnabled()) {
            this.clearCacheTraces();
            return new NoopCacheDiagnosticsRun();
        }
        const requestId = (this.requestId += 1);
        const cacheTrace = createCacheTraceSnapshot(options.request);
        const previousCacheTrace = this.previousCacheTraces.get(cacheTrace.conversationKey);
        const previousImmediateCacheTrace = this.lastCacheTrace;
        const cacheTraceComparison = compareCacheTraceSnapshots(previousCacheTrace, cacheTrace);
        const conversationChangeComparison = previousImmediateCacheTrace &&
            previousImmediateCacheTrace.conversationKey !== cacheTrace.conversationKey
            ? compareCacheTraceSnapshots(previousImmediateCacheTrace, cacheTrace)
            : undefined;
        const visionResolution = summarizeVisionResolution(options.inputMessages, options.resolvedMessages, options.visionModelId);
        logger_1.logger.info(`[cache-trace #${requestId}] ${formatCacheTraceSnapshot(cacheTrace)}`);
        logger_1.logger.info(`[cache-trace #${requestId}] request vscodeModel=${options.vscodeModelId}` +
            ` apiModel=${options.request.model}` +
            ` thinking=${options.isThinkingModel}` +
            ` thinkingEffort=${options.thinkingEffort}` +
            ` maxTokens=${options.maxTokens ?? 'api-default'}` +
            ` reasoningCache(size=${options.reasoningCacheSize},max=${consts_1.MAX_CACHE_SIZE})` +
            ` inputMessages=${options.inputMessages.length}` +
            ` deepseekMessages=${options.request.messages.length}`);
        const vscodeMessageTrace = formatVscodeMessageTrace(options.inputMessages);
        if (vscodeMessageTrace) {
            logger_1.logger.info(`[cache-trace #${requestId}] vscodeMsgs ${vscodeMessageTrace}`);
        }
        for (const detailLine of formatCacheTraceDetailLines(cacheTrace)) {
            logger_1.logger.info(`[cache-trace #${requestId}] ${detailLine}`);
        }
        const visionTrace = formatVisionTrace(visionResolution, options.visionCacheStats);
        if (visionTrace) {
            logger_1.logger.info(`[cache-trace #${requestId}] ${visionTrace}`);
        }
        if (cacheTraceComparison) {
            logger_1.logger.info(`[cache-trace #${requestId}] ${formatCacheTraceComparison(cacheTraceComparison)}`);
            for (const detailLine of formatCacheTraceComparisonDetailLines(cacheTraceComparison)) {
                logger_1.logger.info(`[cache-trace #${requestId}] ${detailLine}`);
            }
            for (const warning of getCacheTraceComparisonWarnings(cacheTraceComparison)) {
                logger_1.logger.warn(`[cache-trace #${requestId}] ${warning}`);
            }
        }
        if (conversationChangeComparison && previousImmediateCacheTrace) {
            logger_1.logger.info(`[cache-trace #${requestId}] ${formatCacheTraceConversationChangeComparison(previousImmediateCacheTrace.conversationKey, cacheTrace.conversationKey, conversationChangeComparison)}`);
            for (const detailLine of formatCacheTraceComparisonDetailLines(conversationChangeComparison)) {
                logger_1.logger.info(`[cache-trace #${requestId}] conversationChanged ${detailLine}`);
            }
            for (const warning of getCacheTraceComparisonWarnings(conversationChangeComparison)) {
                logger_1.logger.warn(`[cache-trace #${requestId}] conversationChanged fallback diff: ${warning}`);
            }
        }
        for (const warning of getCacheTraceWarnings(cacheTrace, visionResolution.historyDescriptionMessages)) {
            logger_1.logger.warn(`[cache-trace #${requestId}] ${warning}`);
        }
        return new ActiveCacheDiagnosticsRun(this, requestId, cacheTrace, cacheTraceComparison ?? conversationChangeComparison, cacheTraceComparison ? 'summaryPrefixVsPrevious' : 'fallbackSummaryPrefixVsPrevious');
    }
    clearCacheTraces() {
        this.lastCacheTrace = undefined;
        this.previousCacheTraces.clear();
    }
    rememberCacheTrace(snapshot) {
        this.lastCacheTrace = snapshot;
        this.previousCacheTraces.delete(snapshot.conversationKey);
        this.previousCacheTraces.set(snapshot.conversationKey, snapshot);
        while (this.previousCacheTraces.size > 50) {
            const oldestKey = this.previousCacheTraces.keys().next().value;
            if (!oldestKey) {
                break;
            }
            this.previousCacheTraces.delete(oldestKey);
        }
    }
}
class ActiveCacheDiagnosticsRun {
    recorder;
    requestId;
    snapshot;
    resultComparison;
    prefixLabel;
    cancellationLogged = false;
    constructor(recorder, requestId, snapshot, resultComparison, prefixLabel) {
        this.recorder = recorder;
        this.requestId = requestId;
        this.snapshot = snapshot;
        this.resultComparison = resultComparison;
        this.prefixLabel = prefixLabel;
    }
    onDone(info) {
        logger_1.logger.info(`[cache-trace #${this.requestId}] reasoningCache afterDone size=${info.reasoningCacheSize}` +
            ` max=${consts_1.MAX_CACHE_SIZE}` +
            ` evicted=${info.evictedReasoningEntries}` +
            ` emittedToolCalls=${info.emittedToolCalls}` +
            ` trailingToolResults=${info.trailingToolResults}`);
        this.recorder.rememberCacheTrace(this.snapshot);
    }
    onUsage(usage, charsPerToken) {
        logUsage(usage, charsPerToken, this.requestId);
        if (this.resultComparison) {
            const hitRate = getCacheHitRate(usage);
            logger_1.logger.info(`[cache-trace #${this.requestId}] result cacheRate=${hitRate}%` +
                ` ${this.prefixLabel}=${this.resultComparison.commonPrefixSummaryChars}` +
                ` chars (${this.resultComparison.commonPrefixSummaryPercent.toFixed(1)}%)`);
        }
    }
    onCancellationTokenRequested() {
        if (this.cancellationLogged) {
            return;
        }
        this.cancellationLogged = true;
        logger_1.logger.info(`[cache-trace #${this.requestId}] cancellation token requested; aborting stream`);
    }
}
class NoopCacheDiagnosticsRun {
    onDone(_info) { }
    onCancellationTokenRequested() { }
    onUsage(usage, charsPerToken) {
        logUsage(usage, charsPerToken);
    }
}
function logUsage(usage, charsPerToken, requestId) {
    const cacheHit = usage.prompt_cache_hit_tokens ?? 0;
    const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
    logger_1.logger.info(`tokens${requestId ? ` #${requestId}` : ''}: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}` +
        ` | cache: hit=${cacheHit} miss=${cacheMiss} rate=${getCacheHitRate(usage)}%` +
        ` | chars/tok=${charsPerToken.toFixed(2)}`);
}
function getCacheHitRate(usage) {
    const cacheHit = usage.prompt_cache_hit_tokens ?? 0;
    const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
    const cacheTotal = cacheHit + cacheMiss;
    return cacheTotal > 0 ? ((cacheHit / cacheTotal) * 100).toFixed(0) : 'n/a';
}
function summarizeVisionResolution(inputMessages, resolvedMessages, visionModelId) {
    const stats = {
        inputImageParts: 0,
        inputImageMessages: 0,
        describedImageMessages: 0,
        failedImageMessages: 0,
        droppedImageParts: 0,
        historyDescriptionMessages: 0,
        visionModelId,
    };
    for (const [index, message] of inputMessages.entries()) {
        const imageParts = countImageDataParts(message);
        const inputText = getMessageText(message);
        if (countLiteral(inputText, '[Image Description:') > 0) {
            stats.historyDescriptionMessages += 1;
        }
        if (imageParts > 0) {
            stats.inputImageMessages += 1;
            stats.inputImageParts += imageParts;
            const resolvedMessage = resolvedMessages[index];
            const resolvedImageParts = resolvedMessage ? countImageDataParts(resolvedMessage) : 0;
            const resolvedText = resolvedMessage ? getMessageText(resolvedMessage) : '';
            const newDescriptions = Math.max(0, countLiteral(resolvedText, '[Image Description:') -
                countLiteral(inputText, '[Image Description:'));
            const newFailures = Math.max(0, countLiteral(resolvedText, consts_1.IMAGE_DESCRIPTION_UNAVAILABLE) -
                countLiteral(inputText, consts_1.IMAGE_DESCRIPTION_UNAVAILABLE));
            if (newDescriptions > 0) {
                stats.describedImageMessages += 1;
            }
            if (newFailures > 0) {
                stats.failedImageMessages += 1;
            }
            if (resolvedImageParts < imageParts && newDescriptions === 0 && newFailures === 0) {
                stats.droppedImageParts += imageParts - resolvedImageParts;
            }
        }
    }
    return stats;
}
function countImageDataParts(message) {
    return message.content.filter((part) => isImageDataPart(part)).length;
}
function isImageDataPart(part) {
    return part instanceof vscode_1.default.LanguageModelDataPart && part.mimeType.startsWith('image/');
}
function getMessageText(message) {
    let text = '';
    for (const part of message.content) {
        if (part instanceof vscode_1.default.LanguageModelTextPart) {
            text += part.value;
        }
    }
    return text;
}
function formatVisionTrace(stats, cacheStats) {
    if (stats.inputImageParts === 0 && stats.historyDescriptionMessages === 0) {
        return undefined;
    }
    const note = stats.inputImageParts === 0 && stats.historyDescriptionMessages > 0 ? ' note=history-only' : '';
    const visionModel = formatVisionModel(stats);
    const cacheTrace = formatVisionCacheStats(stats, cacheStats);
    return (`vision rawImageParts=${stats.inputImageParts}` +
        ` rawImageMessages=${stats.inputImageMessages}` +
        ` newDescriptionMessages=${stats.describedImageMessages}` +
        ` failedDescriptionMessages=${stats.failedImageMessages}` +
        ` droppedImageParts=${stats.droppedImageParts}` +
        ` visionModel=${visionModel}` +
        ` historyDescriptionMessages=${stats.historyDescriptionMessages}` +
        cacheTrace +
        note);
}
function formatVisionCacheStats(resolutionStats, cacheStats) {
    if (!cacheStats) {
        return '';
    }
    const hasCacheActivity = cacheStats.hits > 0 ||
        cacheStats.misses > 0 ||
        cacheStats.deduplicatedDescriptions > 0 ||
        cacheStats.generatedDescriptions > 0 ||
        cacheStats.failedDescriptions > 0 ||
        cacheStats.droppedImageParts > 0;
    if (!hasCacheActivity && resolutionStats.inputImageParts === 0) {
        return '';
    }
    return (` cache(enabled=${cacheStats.enabled}` +
        `,hits=${cacheStats.hits}` +
        `,misses=${cacheStats.misses}` +
        `,deduped=${cacheStats.deduplicatedDescriptions}` +
        `,entries=${cacheStats.entries}` +
        `,generated=${cacheStats.generatedDescriptions}` +
        `,failed=${cacheStats.failedDescriptions})`);
}
function formatVisionModel(stats) {
    if (stats.visionModelId) {
        return stats.visionModelId;
    }
    if (stats.inputImageParts === 0) {
        return 'none';
    }
    if (stats.droppedImageParts > 0 &&
        stats.describedImageMessages === 0 &&
        stats.failedImageMessages === 0) {
        return 'none';
    }
    return 'unknown';
}
function formatVscodeMessageTrace(messages) {
    if (messages.length === 0) {
        return undefined;
    }
    return messages
        .map((msg, index) => {
        const role = msg.role === vscode_1.default.LanguageModelChatMessageRole.User
            ? 'user'
            : msg.role === vscode_1.default.LanguageModelChatMessageRole.Assistant
                ? 'assistant'
                : 'unknown';
        let textChars = 0;
        let imageParts = 0;
        let toolCallParts = 0;
        let toolResultParts = 0;
        let thinkingParts = 0;
        let thinkingChars = 0;
        const thinkingValueTypes = new Set();
        const thinkingHashes = [];
        const unknownPartConstructors = new Map();
        for (const part of msg.content) {
            if (part instanceof vscode_1.default.LanguageModelTextPart) {
                textChars += part.value.length;
            }
            else if (part instanceof vscode_1.default.LanguageModelDataPart &&
                part.mimeType.startsWith('image/')) {
                imageParts += 1;
            }
            else if (part instanceof vscode_1.default.LanguageModelToolCallPart) {
                toolCallParts += 1;
            }
            else if (part instanceof vscode_1.default.LanguageModelToolResultPart) {
                toolResultParts += 1;
            }
            else if (isLanguageModelThinkingPart(part)) {
                const value = normalizeThinkingPartValue(part.value);
                thinkingParts += 1;
                thinkingChars += value.text.length;
                thinkingValueTypes.add(value.type);
                thinkingHashes.push(hashString(value.text));
            }
            else {
                const constructorName = getPartConstructorName(part);
                unknownPartConstructors.set(constructorName, (unknownPartConstructors.get(constructorName) ?? 0) + 1);
            }
        }
        const parts = [];
        if (imageParts) {
            parts.push(`image=${imageParts}`);
        }
        if (toolCallParts) {
            parts.push(`toolCalls=${toolCallParts}`);
        }
        if (toolResultParts) {
            parts.push(`toolResults=${toolResultParts}`);
        }
        if (thinkingParts) {
            parts.push(`thinking=${thinkingParts}:chars=${thinkingChars}:types=${[...thinkingValueTypes].join('+')}:hashes=${thinkingHashes.join(',')}`);
        }
        for (const [constructorName, count] of unknownPartConstructors) {
            parts.push(`unknown=${constructorName}:${count}`);
        }
        const suffix = parts.length > 0 ? ` (${parts.join(',')})` : '';
        return `${role}#${index}:chars=${textChars}${suffix}`;
    })
        .join(' | ');
}
function isLanguageModelThinkingPart(part) {
    return (typeof vscode_1.default.LanguageModelThinkingPart === 'function' &&
        part instanceof vscode_1.default.LanguageModelThinkingPart);
}
function normalizeThinkingPartValue(value) {
    if (Array.isArray(value)) {
        return { text: value.join(''), type: 'string[]' };
    }
    return { text: value, type: 'string' };
}
function getPartConstructorName(part) {
    if (!part || typeof part !== 'object') {
        return typeof part;
    }
    return part.constructor?.name ?? 'object';
}
function createCacheTraceSnapshot(request) {
    const toolsSerialized = stableStringify(request.tools ?? []);
    const messageSummaries = summarizeMessages(request.messages);
    const toolSummaries = summarizeTools(request.tools ?? []);
    const firstMessage = messageSummaries[0];
    const redactedComparisonInput = createRedactedComparisonInput(request, messageSummaries, toolSummaries);
    return {
        fingerprint: hashString(redactedComparisonInput),
        conversationKey: hashString(`${request.model}:${firstMessage?.hash ?? 'empty'}`),
        redactedComparisonInput,
        toolsHash: hashString(toolsSerialized),
        toolNames: request.tools?.map((tool) => tool.function.name) ?? [],
        toolSummaries,
        messageSummaries,
        stats: summarizeStats(request.messages, request.tools?.length ?? 0),
    };
}
function createRedactedComparisonInput(request, messageSummaries, toolSummaries) {
    return stableStringify({
        model: request.model,
        tool_choice: request.tool_choice ?? null,
        thinking: request.thinking ?? null,
        reasoning_effort: request.reasoning_effort ?? null,
        tools: toolSummaries,
        messages: messageSummaries,
    });
}
function compareCacheTraceSnapshots(previous, current) {
    if (!previous) {
        return undefined;
    }
    const commonPrefixSummaryChars = countCommonPrefixChars(previous.redactedComparisonInput, current.redactedComparisonInput);
    const firstChangedMessageIndex = findFirstChangedMessageIndex(previous.messageSummaries, current.messageSummaries);
    const firstChangedToolIndex = findFirstChangedToolIndex(previous.toolSummaries, current.toolSummaries);
    return {
        commonPrefixSummaryChars,
        commonPrefixSummaryPercent: current.redactedComparisonInput.length > 0
            ? (commonPrefixSummaryChars / current.redactedComparisonInput.length) * 100
            : 100,
        previousMessageCount: previous.messageSummaries.length,
        currentMessageCount: current.messageSummaries.length,
        firstChangedMessageIndex,
        previousMessage: firstChangedMessageIndex === undefined
            ? undefined
            : previous.messageSummaries[firstChangedMessageIndex],
        currentMessage: firstChangedMessageIndex === undefined
            ? undefined
            : current.messageSummaries[firstChangedMessageIndex],
        toolsChanged: previous.toolsHash !== current.toolsHash,
        previousToolsHash: previous.toolsHash,
        currentToolsHash: current.toolsHash,
        firstChangedToolIndex,
        previousTool: firstChangedToolIndex === undefined
            ? undefined
            : previous.toolSummaries[firstChangedToolIndex],
        currentTool: firstChangedToolIndex === undefined
            ? undefined
            : current.toolSummaries[firstChangedToolIndex],
    };
}
function formatCacheTraceSnapshot(snapshot) {
    const stats = snapshot.stats;
    return (`fingerprint=${snapshot.fingerprint} conversation=${snapshot.conversationKey}` +
        ` messages=${stats.messageCount} tools=${stats.toolCount}` +
        ` chars(content=${stats.totalContentChars},toolArgs=${stats.toolCallArgumentChars},reasoning=${stats.reasoningChars})` +
        ` assistantToolMessages=${stats.assistantToolCallMessages}` +
        ` toolReasoning(nonEmpty=${stats.nonEmptyToolReasoningMessages},empty=${stats.emptyToolReasoningMessages},missing=${stats.missingToolReasoningMessages})` +
        ` missingToolReasoning=${stats.missingToolReasoningMessages}` +
        ` assistantAfterToolResult=${stats.assistantAfterToolResultMessages}` +
        ` afterToolResult(toolCall=${stats.assistantAfterToolResultToolCallMessages},final=${stats.assistantAfterToolResultFinalMessages})` +
        ` postToolReasoning(nonEmpty=${stats.nonEmptyPostToolReasoningMessages},empty=${stats.emptyPostToolReasoningMessages},missing=${stats.missingPostToolReasoningMessages})` +
        ` postToolCallReasoning(nonEmpty=${stats.nonEmptyPostToolCallReasoningMessages},empty=${stats.emptyPostToolCallReasoningMessages},missing=${stats.missingPostToolCallReasoningMessages})` +
        ` postToolFinalReasoning(nonEmpty=${stats.nonEmptyPostToolFinalReasoningMessages},empty=${stats.emptyPostToolFinalReasoningMessages},missing=${stats.missingPostToolFinalReasoningMessages})` +
        ` missingPostToolReasoning=${stats.missingPostToolReasoningMessages}` +
        ` imageDescriptions=${stats.imageDescriptionMessages}` +
        ` toolNames=${formatToolNames(snapshot.toolNames)}`);
}
function formatCacheTraceDetailLines(snapshot) {
    const stats = snapshot.stats;
    return [
        `roles user=${stats.userMessages} assistant=${stats.assistantMessages} tool=${stats.toolMessages} system=${stats.systemMessages}` +
            ` largeMessages>${LARGE_MESSAGE_CHARS}=${stats.largeMessages}` +
            ` largest=${formatLargestMessages(snapshot.messageSummaries)}`,
        `markers imageDescMsgs=${stats.imageDescriptionMessages}` +
            ` imageDescParts=${stats.imageDescriptionParts}` +
            ` unableImageMsgs=${stats.unableImageMessages}` +
            ` urlMsgs=${stats.urlMessages}` +
            ` urlCount=${stats.urlCount}` +
            ` codeFenceMsgs=${stats.codeFenceMessages}` +
            ` codeFenceCount=${stats.codeFenceCount}` +
            ` likelyPathMsgs=${stats.likelyPathMessages}` +
            ` likelyPathCount=${stats.likelyPathCount}`,
    ];
}
function formatCacheTraceComparison(comparison) {
    const changedMessage = comparison.firstChangedMessageIndex === undefined
        ? 'none'
        : `${comparison.firstChangedMessageIndex} prev=${formatMessageSummary(comparison.previousMessage)} curr=${formatMessageSummary(comparison.currentMessage)}`;
    const changedTool = comparison.toolsChanged
        ? ` firstChangedTool=${formatChangedTool(comparison)}`
        : '';
    return (`summaryPrefixVsPrevious chars=${comparison.commonPrefixSummaryChars}` +
        ` percent=${comparison.commonPrefixSummaryPercent.toFixed(1)}%` +
        ` toolsChanged=${comparison.toolsChanged}` +
        ` toolsHash=${comparison.previousToolsHash}->${comparison.currentToolsHash}` +
        changedTool +
        ` firstChangedMessage=${changedMessage}`);
}
function formatCacheTraceConversationChangeComparison(previousConversationKey, currentConversationKey, comparison) {
    const changedMessage = comparison.firstChangedMessageIndex === undefined
        ? 'none'
        : `${comparison.firstChangedMessageIndex} prev=${formatMessageSummary(comparison.previousMessage)} curr=${formatMessageSummary(comparison.currentMessage)}`;
    const changedTool = comparison.toolsChanged
        ? ` firstChangedTool=${formatChangedTool(comparison)}`
        : '';
    return (`conversationChanged=true prev=${previousConversationKey} curr=${currentConversationKey}` +
        ` fallbackSummaryPrefixVsPrevious chars=${comparison.commonPrefixSummaryChars}` +
        ` percent=${comparison.commonPrefixSummaryPercent.toFixed(1)}%` +
        ` toolsChanged=${comparison.toolsChanged}` +
        ` toolsHash=${comparison.previousToolsHash}->${comparison.currentToolsHash}` +
        changedTool +
        ` firstChangedMessage=${changedMessage}`);
}
function formatCacheTraceComparisonDetailLines(comparison) {
    if (comparison.firstChangedMessageIndex === undefined ||
        !comparison.previousMessage ||
        !comparison.currentMessage) {
        return [];
    }
    const previous = comparison.previousMessage;
    const current = comparison.currentMessage;
    return [
        `changedMessage position=index${comparison.firstChangedMessageIndex}` +
            ` fromEndPrev=${comparison.previousMessageCount - comparison.firstChangedMessageIndex - 1}` +
            ` fromEndCurr=${comparison.currentMessageCount - comparison.firstChangedMessageIndex - 1}` +
            ` delta(chars=${current.contentChars - previous.contentChars}` +
            `,lines=${current.contentLines - previous.contentLines}` +
            `,toolArgs=${current.toolCallArgumentChars - previous.toolCallArgumentChars}` +
            `,reasoning=${current.reasoningChars - previous.reasoningChars})`,
        `changedMessage hashes content=${previous.contentHash}->${current.contentHash}` +
            ` head=${previous.contentHeadHash}->${current.contentHeadHash}` +
            ` tail=${previous.contentTailHash}->${current.contentTailHash}`,
        `changedMessage markers prev=${formatMarkerSummary(previous)}` +
            ` curr=${formatMarkerSummary(current)}`,
    ];
}
function getCacheTraceWarnings(snapshot, historyDescriptionMessages = snapshot.stats.imageDescriptionMessages) {
    const warnings = [];
    if (snapshot.stats.missingToolReasoningMessages > 0) {
        warnings.push(`${snapshot.stats.missingToolReasoningMessages} assistant tool-call message(s) are missing cached reasoning_content; DeepSeek requires this in thinking tool-call histories and cache prefixes may drift.`);
    }
    if (snapshot.stats.missingPostToolCallReasoningMessages > 0) {
        warnings.push(`${snapshot.stats.missingPostToolCallReasoningMessages} assistant tool-call message(s) after tool results are missing cached reasoning_content; these should replay via tool:<id> keys.`);
    }
    if (snapshot.stats.missingPostToolFinalReasoningMessages > 0) {
        warnings.push(`${snapshot.stats.missingPostToolFinalReasoningMessages} final assistant message(s) after tool results are missing cached reasoning_content; these should replay via post-tool:<ids> keys.`);
    }
    const emptyReasoningMessages = snapshot.stats.emptyToolReasoningMessages + snapshot.stats.emptyPostToolFinalReasoningMessages;
    if (emptyReasoningMessages > 0) {
        warnings.push(`${emptyReasoningMessages} reasoning-required assistant message reference(s) have empty reasoning_content fallback; this is protocol-safe but may indicate the original reasoning cache was unavailable after extension restart/reload.`);
    }
    if (historyDescriptionMessages > 0) {
        warnings.push(`${historyDescriptionMessages} message(s) already contain generated image-description text in request history; check the vision trace rawImageParts field to see whether this request actually processed image data.`);
    }
    return warnings;
}
function getCacheTraceComparisonWarnings(comparison) {
    const warnings = [];
    if (comparison.firstChangedMessageIndex !== undefined &&
        comparison.previousMessage &&
        comparison.currentMessage) {
        const previousMessagesAfterChange = comparison.previousMessageCount - comparison.firstChangedMessageIndex - 1;
        if (previousMessagesAfterChange > 2) {
            warnings.push(`retained history changed before the append boundary at message #${comparison.firstChangedMessageIndex}; ${previousMessagesAfterChange} previous message(s) after it cannot share an identical request prefix.`);
        }
        if (comparison.previousMessage.imageDescriptionCount > 0 ||
            comparison.currentMessage.imageDescriptionCount > 0) {
            warnings.push(`first changed message contains generated image-description marker(s); if rawImageParts is also non-zero, repeated vision re-description is likely.`);
        }
    }
    if (comparison.toolsChanged) {
        warnings.push(`tool schema changed; firstChangedTool=${formatChangedTool(comparison)}. A changed tool list rebuilds the cache prefix before messages.`);
    }
    if (comparison.currentMessageCount < comparison.previousMessageCount) {
        warnings.push(`message count decreased ${comparison.previousMessageCount}->${comparison.currentMessageCount}; host-side history truncation or compaction may have occurred.`);
    }
    return warnings;
}
function summarizeMessages(messages) {
    const summaries = [];
    let followsToolResult = false;
    for (const [index, message] of messages.entries()) {
        summaries.push(summarizeMessage(message, index, followsToolResult));
        if (message.role === 'tool') {
            followsToolResult = true;
        }
        else {
            followsToolResult = false;
        }
    }
    return summaries;
}
function summarizeMessage(message, index, followsToolResult) {
    const toolCallArgumentChars = message.tool_calls?.reduce((sum, toolCall) => sum + toolCall.function.arguments.length, 0) ?? 0;
    const reasoningChars = message.reasoning_content?.length ?? 0;
    const toolCalls = message.tool_calls?.length ?? 0;
    const assistantAfterToolResult = message.role === 'assistant' && followsToolResult;
    const afterToolResultKind = assistantAfterToolResult
        ? toolCalls > 0
            ? 'tool-call'
            : 'final'
        : 'none';
    const hasReasoningContent = message.reasoning_content !== undefined;
    const hasEmptyReasoningContent = hasReasoningContent && reasoningChars === 0;
    const imageDescriptionCount = countLiteral(message.content, '[Image Description:');
    const unableImageCount = countLiteral(message.content, consts_1.IMAGE_DESCRIPTION_UNAVAILABLE);
    const urlCount = countRegex(message.content, /https?:\/\//g);
    const codeFenceCount = countLiteral(message.content, '```');
    const likelyPathCount = countLikelyPaths(message.content);
    return {
        index,
        role: message.role,
        hash: hashString(stableStringify(message)),
        contentHash: hashString(message.content),
        contentHeadHash: hashString(message.content.slice(0, HASH_WINDOW_CHARS)),
        contentTailHash: hashString(message.content.slice(-HASH_WINDOW_CHARS)),
        contentChars: message.content.length,
        contentLines: countLines(message.content),
        imageDescriptionCount,
        unableImageCount,
        urlCount,
        codeFenceCount,
        likelyPathCount,
        toolCalls,
        toolCallArgumentChars,
        reasoningChars,
        emptyReasoning: hasEmptyReasoningContent,
        missingToolReasoning: message.role === 'assistant' && toolCalls > 0 && !hasReasoningContent,
        followsToolResult: assistantAfterToolResult,
        afterToolResultKind,
        missingPostToolReasoning: assistantAfterToolResult && !hasReasoningContent,
        missingPostToolCallReasoning: afterToolResultKind === 'tool-call' && !hasReasoningContent,
        missingPostToolFinalReasoning: afterToolResultKind === 'final' && !hasReasoningContent,
    };
}
function summarizeTools(tools) {
    return tools.map((tool, index) => ({
        index,
        name: tool.function.name,
        hash: hashString(stableStringify(tool)),
        descriptionHash: hashString(tool.function.description ?? ''),
        parametersHash: hashString(stableStringify(tool.function.parameters ?? null)),
    }));
}
function summarizeStats(messages, toolCount) {
    let userMessages = 0;
    let assistantMessages = 0;
    let toolMessages = 0;
    let systemMessages = 0;
    let totalContentChars = 0;
    let toolCallArgumentChars = 0;
    let reasoningChars = 0;
    let largeMessages = 0;
    let assistantToolCallMessages = 0;
    let nonEmptyToolReasoningMessages = 0;
    let emptyToolReasoningMessages = 0;
    let missingToolReasoningMessages = 0;
    let assistantAfterToolResultMessages = 0;
    let assistantAfterToolResultToolCallMessages = 0;
    let assistantAfterToolResultFinalMessages = 0;
    let nonEmptyPostToolReasoningMessages = 0;
    let emptyPostToolReasoningMessages = 0;
    let missingPostToolReasoningMessages = 0;
    let nonEmptyPostToolCallReasoningMessages = 0;
    let emptyPostToolCallReasoningMessages = 0;
    let missingPostToolCallReasoningMessages = 0;
    let nonEmptyPostToolFinalReasoningMessages = 0;
    let emptyPostToolFinalReasoningMessages = 0;
    let missingPostToolFinalReasoningMessages = 0;
    let imageDescriptionMessages = 0;
    let imageDescriptionParts = 0;
    let unableImageMessages = 0;
    let urlMessages = 0;
    let urlCount = 0;
    let codeFenceMessages = 0;
    let codeFenceCount = 0;
    let likelyPathMessages = 0;
    let likelyPathCount = 0;
    let followsToolResult = false;
    for (const message of messages) {
        if (message.role === 'user') {
            userMessages += 1;
        }
        else if (message.role === 'assistant') {
            assistantMessages += 1;
        }
        else if (message.role === 'tool') {
            toolMessages += 1;
        }
        else if (message.role === 'system') {
            systemMessages += 1;
        }
        totalContentChars += message.content.length;
        if (message.content.length > LARGE_MESSAGE_CHARS) {
            largeMessages += 1;
        }
        const imageDescriptions = countLiteral(message.content, '[Image Description:');
        if (imageDescriptions > 0) {
            imageDescriptionMessages += 1;
            imageDescriptionParts += imageDescriptions;
        }
        if (message.content.includes(consts_1.IMAGE_DESCRIPTION_UNAVAILABLE)) {
            unableImageMessages += 1;
        }
        const messageUrlCount = countRegex(message.content, /https?:\/\//g);
        if (messageUrlCount > 0) {
            urlMessages += 1;
            urlCount += messageUrlCount;
        }
        const messageCodeFenceCount = countLiteral(message.content, '```');
        if (messageCodeFenceCount > 0) {
            codeFenceMessages += 1;
            codeFenceCount += messageCodeFenceCount;
        }
        const messageLikelyPathCount = countLikelyPaths(message.content);
        if (messageLikelyPathCount > 0) {
            likelyPathMessages += 1;
            likelyPathCount += messageLikelyPathCount;
        }
        const toolCalls = message.tool_calls?.length ?? 0;
        const messageReasoningChars = message.reasoning_content?.length ?? 0;
        if (message.role === 'assistant' && followsToolResult) {
            assistantAfterToolResultMessages += 1;
            const isToolCallAfterToolResult = toolCalls > 0;
            if (isToolCallAfterToolResult) {
                assistantAfterToolResultToolCallMessages += 1;
            }
            else {
                assistantAfterToolResultFinalMessages += 1;
            }
            if (message.reasoning_content === undefined) {
                missingPostToolReasoningMessages += 1;
                if (isToolCallAfterToolResult) {
                    missingPostToolCallReasoningMessages += 1;
                }
                else {
                    missingPostToolFinalReasoningMessages += 1;
                }
            }
            else if (messageReasoningChars === 0) {
                emptyPostToolReasoningMessages += 1;
                if (isToolCallAfterToolResult) {
                    emptyPostToolCallReasoningMessages += 1;
                }
                else {
                    emptyPostToolFinalReasoningMessages += 1;
                }
            }
            else {
                nonEmptyPostToolReasoningMessages += 1;
                if (isToolCallAfterToolResult) {
                    nonEmptyPostToolCallReasoningMessages += 1;
                }
                else {
                    nonEmptyPostToolFinalReasoningMessages += 1;
                }
            }
        }
        if (toolCalls > 0) {
            assistantToolCallMessages += 1;
            if (message.reasoning_content === undefined) {
                missingToolReasoningMessages += 1;
            }
            else if (messageReasoningChars === 0) {
                emptyToolReasoningMessages += 1;
            }
            else {
                nonEmptyToolReasoningMessages += 1;
            }
            for (const toolCall of message.tool_calls ?? []) {
                toolCallArgumentChars += toolCall.function.arguments.length;
            }
        }
        reasoningChars += messageReasoningChars;
        if (message.role === 'tool') {
            followsToolResult = true;
        }
        else {
            followsToolResult = false;
        }
    }
    return {
        messageCount: messages.length,
        userMessages,
        assistantMessages,
        toolMessages,
        systemMessages,
        toolCount,
        totalContentChars,
        toolCallArgumentChars,
        reasoningChars,
        largeMessages,
        assistantToolCallMessages,
        nonEmptyToolReasoningMessages,
        emptyToolReasoningMessages,
        missingToolReasoningMessages,
        assistantAfterToolResultMessages,
        assistantAfterToolResultToolCallMessages,
        assistantAfterToolResultFinalMessages,
        nonEmptyPostToolReasoningMessages,
        emptyPostToolReasoningMessages,
        missingPostToolReasoningMessages,
        nonEmptyPostToolCallReasoningMessages,
        emptyPostToolCallReasoningMessages,
        missingPostToolCallReasoningMessages,
        nonEmptyPostToolFinalReasoningMessages,
        emptyPostToolFinalReasoningMessages,
        missingPostToolFinalReasoningMessages,
        imageDescriptionMessages,
        imageDescriptionParts,
        unableImageMessages,
        urlMessages,
        urlCount,
        codeFenceMessages,
        codeFenceCount,
        likelyPathMessages,
        likelyPathCount,
    };
}
function formatMessageSummary(summary) {
    if (!summary) {
        return 'missing';
    }
    return (`${summary.role}#${summary.index}` +
        ` hash=${summary.hash}` +
        ` contentHash=${summary.contentHash}` +
        ` chars=${summary.contentChars}` +
        ` lines=${summary.contentLines}` +
        ` toolCalls=${summary.toolCalls}` +
        ` toolArgs=${summary.toolCallArgumentChars}` +
        ` reasoning=${summary.reasoningChars}` +
        ` emptyReasoning=${summary.emptyReasoning}` +
        ` markers=${formatMarkerSummary(summary)}` +
        ` followsToolResult=${summary.followsToolResult}` +
        ` afterToolResultKind=${summary.afterToolResultKind}`);
}
function formatMarkerSummary(summary) {
    return (`imageDesc=${summary.imageDescriptionCount}` +
        `,unableImage=${summary.unableImageCount}` +
        `,url=${summary.urlCount}` +
        `,codeFence=${summary.codeFenceCount}` +
        `,likelyPath=${summary.likelyPathCount}`);
}
function formatLargestMessages(messageSummaries) {
    const largest = [...messageSummaries]
        .sort((left, right) => right.contentChars - left.contentChars)
        .slice(0, 5)
        .map((summary) => `${summary.role}#${summary.index}:chars=${summary.contentChars},hash=${summary.contentHash},markers=${formatMarkerSummary(summary)}`);
    return largest.length > 0 ? largest.join(';') : 'none';
}
function formatToolNames(toolNames) {
    if (toolNames.length === 0) {
        return 'none';
    }
    const shown = toolNames.slice(0, 10).join(',');
    return toolNames.length > 10 ? `${shown},+${toolNames.length - 10}` : shown;
}
function formatChangedTool(comparison) {
    if (comparison.firstChangedToolIndex === undefined) {
        return 'none';
    }
    return (`${comparison.firstChangedToolIndex}` +
        ` prev=${formatToolSummary(comparison.previousTool)}` +
        ` curr=${formatToolSummary(comparison.currentTool)}`);
}
function formatToolSummary(summary) {
    if (!summary) {
        return 'missing';
    }
    return (`${summary.name}#${summary.index}` +
        ` hash=${summary.hash}` +
        ` desc=${summary.descriptionHash}` +
        ` params=${summary.parametersHash}`);
}
function findFirstChangedMessageIndex(previous, current) {
    const maxLength = Math.max(previous.length, current.length);
    for (let index = 0; index < maxLength; index += 1) {
        if (previous[index]?.hash !== current[index]?.hash) {
            return index;
        }
    }
    return undefined;
}
function findFirstChangedToolIndex(previous, current) {
    const maxLength = Math.max(previous.length, current.length);
    for (let index = 0; index < maxLength; index += 1) {
        if (previous[index]?.hash !== current[index]?.hash) {
            return index;
        }
    }
    return undefined;
}
function countCommonPrefixChars(a, b) {
    const length = Math.min(a.length, b.length);
    let index = 0;
    while (index < length && a.charCodeAt(index) === b.charCodeAt(index)) {
        index += 1;
    }
    return index;
}
function countLiteral(value, needle) {
    if (!needle) {
        return 0;
    }
    let count = 0;
    let index = value.indexOf(needle);
    while (index !== -1) {
        count += 1;
        index = value.indexOf(needle, index + needle.length);
    }
    return count;
}
function countRegex(value, regex) {
    return value.match(regex)?.length ?? 0;
}
function countLikelyPaths(value) {
    return countRegex(value, /(?:^|\s)(?:[\w.-]+\/){1,}[\w.-]+/g);
}
function countLines(value) {
    if (value.length === 0) {
        return 0;
    }
    return countLiteral(value, '\n') + 1;
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
        .join(',')}}`;
}
function hashString(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex').slice(0, 12);
}
//# sourceMappingURL=diagnostics.js.map