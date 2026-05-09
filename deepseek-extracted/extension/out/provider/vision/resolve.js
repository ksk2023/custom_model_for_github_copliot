"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveImageMessages = resolveImageMessages;
const vscode_1 = __importDefault(require("vscode"));
const consts_1 = require("../../consts");
const i18n_1 = require("../../i18n");
const logger_1 = require("../../logger");
const cache_1 = require("./cache");
const model_1 = require("./model");
/**
 * Resolve any image parts in user messages by forwarding them to a vision
 * model and replacing them with text descriptions. This lets text-only models
 * like DeepSeek effectively "see" images.
 */
async function resolveImageMessages(messages, token, getModel) {
    const stats = (0, cache_1.createVisionDescriptionCacheStats)();
    const hasImages = messages.some((m) => m.content.some((p) => isImageDataPart(p)));
    if (!hasImages) {
        return { messages, stats: (0, cache_1.finalizeVisionDescriptionCacheStats)(stats) };
    }
    const visionModel = await getModel();
    if (!visionModel) {
        logger_1.logger.warn((0, i18n_1.t)('vision.unavailable'));
        const resolvedMessages = messages.map((m) => {
            const filtered = m.content.filter((p) => !isImageDataPart(p));
            stats.droppedImageParts += m.content.length - filtered.length;
            return {
                role: m.role,
                content: filtered,
            };
        });
        return { messages: resolvedMessages, stats: (0, cache_1.finalizeVisionDescriptionCacheStats)(stats) };
    }
    const visionPrompt = (0, model_1.getVisionPrompt)();
    const result = [];
    for (const message of messages) {
        const resolvedParts = [];
        let resolvedImageParts = 0;
        for (const part of message.content) {
            if (!isImageDataPart(part)) {
                resolvedParts.push(part);
                continue;
            }
            resolvedImageParts += 1;
            const description = await resolveImageDescription(part, visionModel, visionPrompt, stats, token);
            resolvedParts.push(new vscode_1.default.LanguageModelTextPart(description));
        }
        if (resolvedImageParts === 0) {
            result.push(message);
            continue;
        }
        result.push({
            role: message.role,
            content: resolvedParts,
        });
    }
    return {
        messages: result,
        stats: (0, cache_1.finalizeVisionDescriptionCacheStats)(stats),
        visionModelId: visionModel.id,
    };
}
async function resolveImageDescription(part, visionModel, visionPrompt, stats, token) {
    const cacheKey = (0, cache_1.createVisionDescriptionCacheKey)(part, visionModel.id, visionPrompt);
    const cachedDescription = (0, cache_1.getCachedDescription)(cacheKey);
    if (cachedDescription !== undefined) {
        stats.hits += 1;
        return createImageDescriptionText(cachedDescription);
    }
    // Avoid starting proxy work for requests that were already cancelled.
    if (token.isCancellationRequested) {
        return consts_1.IMAGE_DESCRIPTION_UNAVAILABLE;
    }
    const pendingDescription = (0, cache_1.getPendingDescription)(cacheKey);
    if (pendingDescription) {
        stats.deduplicatedDescriptions += 1;
        const description = await resolvePendingDescription(pendingDescription, stats, false, token);
        return description === undefined
            ? consts_1.IMAGE_DESCRIPTION_UNAVAILABLE
            : createImageDescriptionText(description);
    }
    stats.misses += 1;
    const pendingDescriptionRequest = createPendingDescriptionRequest(cacheKey, part, visionModel, visionPrompt);
    (0, cache_1.rememberPendingDescription)(cacheKey, pendingDescriptionRequest);
    const description = await resolvePendingDescription(pendingDescriptionRequest, stats, true, token);
    if (description !== undefined) {
        return createImageDescriptionText(description);
    }
    return consts_1.IMAGE_DESCRIPTION_UNAVAILABLE;
}
function createPendingDescriptionRequest(cacheKey, part, visionModel, visionPrompt) {
    return describeImagePart(part, visionModel, visionPrompt).then((description) => {
        if (description.length > 0) {
            (0, cache_1.rememberDescription)(cacheKey, description);
        }
        return description;
    }, (err) => {
        logger_1.logger.error((0, i18n_1.t)('vision.proxyError'), err);
        throw err;
    });
}
async function resolvePendingDescription(pending, stats, countProxyResult, token) {
    // Stats are request-local: joiners count de-dupe, while the miss creator
    // records the proxy outcome only if it remains active until that outcome.
    try {
        const result = await waitForDescription(pending, token);
        if (result.cancelled) {
            return undefined;
        }
        if (result.description.length === 0) {
            if (countProxyResult) {
                stats.failedDescriptions += 1;
            }
            return undefined;
        }
        if (countProxyResult) {
            stats.generatedDescriptions += 1;
        }
        return result.description;
    }
    catch {
        if (countProxyResult) {
            stats.failedDescriptions += 1;
        }
        return undefined;
    }
}
function waitForDescription(description, token) {
    if (token.isCancellationRequested) {
        return Promise.resolve({ cancelled: true });
    }
    return new Promise((resolve, reject) => {
        let cancellation;
        const cleanup = () => cancellation?.dispose();
        cancellation = token.onCancellationRequested(() => {
            cleanup();
            resolve({ cancelled: true });
        });
        description.then((value) => {
            cleanup();
            resolve({ cancelled: false, description: value });
        }, (err) => {
            cleanup();
            reject(err);
        });
    });
}
async function describeImagePart(part, visionModel, visionPrompt) {
    const visionMsg = vscode_1.default.LanguageModelChatMessage.User([
        part,
        new vscode_1.default.LanguageModelTextPart(visionPrompt),
    ]);
    // Keep the shared proxy request independent from individual caller cancellation.
    const tokenSource = new vscode_1.default.CancellationTokenSource();
    try {
        const response = await visionModel.sendRequest([visionMsg], {}, tokenSource.token);
        let description = '';
        for await (const chunk of response.stream) {
            if (chunk instanceof vscode_1.default.LanguageModelTextPart) {
                description += chunk.value;
            }
        }
        return description.trim();
    }
    finally {
        tokenSource.dispose();
    }
}
function createImageDescriptionText(description) {
    return `[Image Description: ${description}]`;
}
function isImageDataPart(part) {
    return part instanceof vscode_1.default.LanguageModelDataPart && part.mimeType.startsWith('image/');
}
//# sourceMappingURL=resolve.js.map