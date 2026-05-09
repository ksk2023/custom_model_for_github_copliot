"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisionDescriptionCacheStats = createVisionDescriptionCacheStats;
exports.finalizeVisionDescriptionCacheStats = finalizeVisionDescriptionCacheStats;
exports.createVisionDescriptionCacheKey = createVisionDescriptionCacheKey;
exports.getCachedDescription = getCachedDescription;
exports.rememberDescription = rememberDescription;
exports.getPendingDescription = getPendingDescription;
exports.rememberPendingDescription = rememberPendingDescription;
const crypto_1 = require("crypto");
const MAX_VISION_DESCRIPTION_CACHE_ENTRIES = 100;
const visionDescriptionCache = new Map();
// Promise-only single-flight: caller cancellation does not abort shared vision work.
const pendingVisionDescriptions = new Map();
function createVisionDescriptionCacheStats() {
    return {
        enabled: true,
        hits: 0,
        misses: 0,
        deduplicatedDescriptions: 0,
        entries: visionDescriptionCache.size,
        generatedDescriptions: 0,
        failedDescriptions: 0,
        droppedImageParts: 0,
    };
}
function finalizeVisionDescriptionCacheStats(stats) {
    stats.entries = visionDescriptionCache.size;
    return stats;
}
function createVisionDescriptionCacheKey(part, visionModelId, visionPrompt) {
    return hashString(['v1', part.mimeType, hashBytes(part.data), visionModelId, hashString(visionPrompt)].join('\0'));
}
function getCachedDescription(key) {
    const entry = visionDescriptionCache.get(key);
    if (!entry) {
        return undefined;
    }
    visionDescriptionCache.delete(key);
    visionDescriptionCache.set(key, entry);
    return entry.description;
}
function rememberDescription(key, description) {
    visionDescriptionCache.set(key, {
        description,
    });
    while (visionDescriptionCache.size > MAX_VISION_DESCRIPTION_CACHE_ENTRIES) {
        const oldestKey = visionDescriptionCache.keys().next().value;
        if (!oldestKey) {
            break;
        }
        visionDescriptionCache.delete(oldestKey);
    }
}
function getPendingDescription(key) {
    return pendingVisionDescriptions.get(key);
}
function rememberPendingDescription(key, description) {
    pendingVisionDescriptions.set(key, description);
    void description
        .finally(() => {
        if (pendingVisionDescriptions.get(key) === description) {
            pendingVisionDescriptions.delete(key);
        }
    })
        .catch(() => undefined);
}
function hashBytes(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
function hashString(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
//# sourceMappingURL=cache.js.map