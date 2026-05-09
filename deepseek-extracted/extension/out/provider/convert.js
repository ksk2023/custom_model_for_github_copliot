"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertMessages = convertMessages;
exports.convertTools = convertTools;
exports.countMessageChars = countMessageChars;
const vscode_1 = __importDefault(require("vscode"));
const json_1 = require("../json");
const cache_1 = require("./cache");
/**
 * Convert VS Code chat messages to DeepSeek format.
 * Injects cached reasoning_content for assistant tool-call messages and final
 * assistant messages after tool results.
 */
function convertMessages(messages, isThinkingModel, reasoningCache) {
    const result = [];
    let recentToolResultIds = [];
    for (const message of messages) {
        const role = mapRole(message.role);
        let content = '';
        const toolCalls = [];
        const toolResults = [];
        for (const part of message.content) {
            if (part instanceof vscode_1.default.LanguageModelTextPart) {
                content += part.value;
            }
            else if (part instanceof vscode_1.default.LanguageModelToolCallPart) {
                toolCalls.push({
                    id: part.callId,
                    type: 'function',
                    function: {
                        name: part.name,
                        arguments: (0, json_1.safeStringify)(part.input),
                    },
                });
            }
            else if (part instanceof vscode_1.default.LanguageModelToolResultPart) {
                let toolContent = '';
                for (const item of part.content) {
                    if (item instanceof vscode_1.default.LanguageModelTextPart) {
                        toolContent += item.value;
                    }
                }
                toolResults.push({
                    callId: part.callId,
                    content: toolContent || (0, json_1.safeStringify)(part.content),
                });
            }
        }
        if (role === 'assistant') {
            // Inject reasoning_content from cache for assistant messages
            // that have tool calls (per DeepSeek API requirement).
            let reasoningContent;
            if (isThinkingModel && toolCalls.length > 0) {
                for (const tc of toolCalls) {
                    // Prefer new `tool:<callId>` key; fallback to bare `callId` for entries written
                    // before the stable-key change (read-only compat, no new bare-key writes).
                    const cached = reasoningCache.get((0, cache_1.createToolReasoningKey)(tc.id)) ?? reasoningCache.get(tc.id);
                    if (cached) {
                        reasoningContent = cached.text;
                        break;
                    }
                }
            }
            else if (isThinkingModel && recentToolResultIds.length > 0) {
                reasoningContent = reasoningCache.get((0, cache_1.createPostToolReasoningKey)(recentToolResultIds))?.text;
            }
            if (content || toolCalls.length > 0) {
                const msg = {
                    role: 'assistant',
                    content: content || '',
                };
                if (toolCalls.length > 0) {
                    msg.tool_calls = toolCalls;
                }
                if (isThinkingModel) {
                    msg.reasoning_content = reasoningContent || '';
                }
                result.push(msg);
                recentToolResultIds = [];
            }
        }
        else {
            if (content) {
                recentToolResultIds = [];
                result.push({
                    role: role,
                    content: content,
                });
            }
            else if (toolResults.length === 0) {
                recentToolResultIds = [];
            }
        }
        // Tool result messages follow their associated assistant message
        for (const tr of toolResults) {
            result.push({
                role: 'tool',
                content: tr.content,
                tool_call_id: tr.callId,
            });
            recentToolResultIds.push(tr.callId);
        }
    }
    return result;
}
function mapRole(role) {
    switch (role) {
        case vscode_1.default.LanguageModelChatMessageRole.User:
            return 'user';
        case vscode_1.default.LanguageModelChatMessageRole.Assistant:
            return 'assistant';
        default:
            return 'user';
    }
}
/**
 * Convert VS Code tool definitions to DeepSeek format.
 */
function convertTools(tools) {
    if (!tools || tools.length === 0) {
        return undefined;
    }
    return tools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));
}
/**
 * Count total characters across all messages to calibrate chars-per-token ratio.
 */
function countMessageChars(messages) {
    let total = 0;
    for (const msg of messages) {
        total += msg.content?.length ?? 0;
        if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
                total += tc.function?.name?.length ?? 0;
                total += tc.function?.arguments?.length ?? 0;
            }
        }
    }
    return total;
}
//# sourceMappingURL=convert.js.map