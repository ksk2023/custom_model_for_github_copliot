"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToolReasoningKey = createToolReasoningKey;
exports.createPostToolReasoningKey = createPostToolReasoningKey;
exports.pruneReasoningCache = pruneReasoningCache;
const consts_1 = require("../consts");
function createToolReasoningKey(toolCallId) {
    return `tool:${toolCallId}`;
}
function createPostToolReasoningKey(toolCallIds) {
    return `post-tool:${JSON.stringify(toolCallIds)}`;
}
function pruneReasoningCache(cache, clearAll) {
    if (clearAll) {
        cache.clear();
        return;
    }
    if (cache.size <= consts_1.MAX_CACHE_SIZE) {
        return;
    }
    // Evict oldest entries
    const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, sorted.length - consts_1.MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
        cache.delete(key);
    }
}
//# sourceMappingURL=cache.js.map