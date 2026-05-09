"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekClient = void 0;
const json_1 = require("./json");
const logger_1 = require("./logger");
/**
 * Lightweight SSE-streaming DeepSeek API client.
 * No external dependencies — uses Node's built-in fetch.
 */
class DeepSeekClient {
    baseUrl;
    apiKey;
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    /**
     * Stream a chat completion from the DeepSeek API.
     * Parses SSE chunks and dispatches callbacks for content, thinking, and tool calls.
     */
    async streamChatCompletion(request, callbacks, cancellationToken) {
        const controller = new AbortController();
        const cancelListener = cancellationToken?.onCancellationRequested(() => {
            controller.abort();
        });
        if (cancellationToken?.isCancellationRequested) {
            controller.abort();
        }
        try {
            // Request usage stats in streaming responses so we can calibrate token counting.
            const requestBody = {
                ...request,
                stream_options: { include_usage: true },
            };
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: (0, json_1.safeStringify)(requestBody),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error?.message || errorJson.message || errorText;
                }
                catch {
                    errorMessage = errorText;
                }
                throw new Error(`DeepSeek API error (${response.status}): ${errorMessage}`);
            }
            if (!response.body) {
                throw new Error('No response body received');
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // Accumulate tool call deltas by index, then emit on finish_reason=stop/tool_calls
            const pendingToolCalls = new Map();
            while (true) {
                if (cancellationToken?.isCancellationRequested) {
                    controller.abort();
                    return;
                }
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) {
                        continue;
                    }
                    if (trimmed === 'data: [DONE]') {
                        // Flush any remaining tool calls
                        for (const tc of pendingToolCalls.values()) {
                            callbacks.onToolCall(tc);
                        }
                        pendingToolCalls.clear();
                        callbacks.onDone();
                        return;
                    }
                    if (!trimmed.startsWith('data: ')) {
                        continue;
                    }
                    const jsonStr = trimmed.slice(6);
                    try {
                        const chunk = JSON.parse(jsonStr);
                        const choice = chunk.choices?.[0];
                        // Capture usage stats from the API for token-count calibration.
                        if (chunk.usage && callbacks.onUsage) {
                            callbacks.onUsage(chunk.usage);
                        }
                        if (!choice) {
                            continue;
                        }
                        // Thinking content → report with correct field name so VS Code renders collapsible blocks
                        const reasoning = choice.delta.reasoning_content;
                        if (reasoning) {
                            callbacks.onThinking(reasoning);
                        }
                        // Regular content
                        if (choice.delta.content) {
                            callbacks.onContent(choice.delta.content);
                        }
                        // Tool calls — accumulate deltas by index
                        if (choice.delta.tool_calls) {
                            for (const tc of choice.delta.tool_calls) {
                                let pending = pendingToolCalls.get(tc.index);
                                if (!pending && tc.id) {
                                    pending = {
                                        id: tc.id,
                                        type: 'function',
                                        function: { name: '', arguments: '' },
                                    };
                                    pendingToolCalls.set(tc.index, pending);
                                }
                                if (pending) {
                                    if (tc.function?.name) {
                                        pending.function.name += tc.function.name;
                                    }
                                    if (tc.function?.arguments) {
                                        pending.function.arguments += tc.function.arguments;
                                    }
                                }
                            }
                        }
                        // Flush pending tool calls on finish
                        if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
                            for (const tc of pendingToolCalls.values()) {
                                callbacks.onToolCall(tc);
                            }
                            pendingToolCalls.clear();
                        }
                    }
                    catch (e) {
                        logger_1.logger.error('Failed to parse SSE chunk:', jsonStr.slice(0, 200), e);
                    }
                }
            }
            callbacks.onDone();
        }
        catch (error) {
            if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
                return;
            }
            callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
        finally {
            cancelListener?.dispose();
        }
    }
}
exports.DeepSeekClient = DeepSeekClient;
function isAbortError(error) {
    return error instanceof Error && error.name === 'AbortError';
}
//# sourceMappingURL=client.js.map