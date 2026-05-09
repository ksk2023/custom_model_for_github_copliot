"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODELS = exports.MAX_CACHE_SIZE = exports.IMAGE_DESCRIPTION_UNAVAILABLE = exports.IMAGE_DESCRIPTION_PROMPT = exports.DEFAULT_VISION_MODEL_ID = exports.WALKTHROUGH_ID = exports.WELCOME_SHOWN_KEY = exports.API_KEY_SECRET = exports.CONFIG_SECTION = void 0;
/**
 * Compile-time constants shared across the extension.
 *
 * These do NOT depend on the VS Code runtime (no workspace configuration,
 * no secrets API). For run-time settings reads see `config.ts`.
 */
/** VS Code configuration section prefix for all extension settings. */
exports.CONFIG_SECTION = 'deepseek-copilot';
// ---- Secret keys ----
/** SecretStorage key for the DeepSeek API key. */
exports.API_KEY_SECRET = 'deepseek-copilot.apiKey';
/** memento key tracking whether the welcome walkthrough has been shown. */
exports.WELCOME_SHOWN_KEY = 'deepseek-copilot.welcomeShown';
// ---- Walkthrough ----
/** Walkthrough contribution ID. */
exports.WALKTHROUGH_ID = 'Vizards.deepseek-v4-for-copilot#deepseekGettingStarted';
// ---- Vision proxy ----
/** Default model ID used for the vision proxy when auto-detection is enabled. */
exports.DEFAULT_VISION_MODEL_ID = 'oswe-vscode-prime';
/**
 * Prompt sent to the vision proxy model when describing image attachments
 * before forwarding them to text-only DeepSeek models.
 */
exports.IMAGE_DESCRIPTION_PROMPT = 'Describe the visual contents of this image in detail, including any text, objects, people, or context that would be relevant for understanding it. Focus on factual visual elements.';
/**
 * Stable fallback marker inserted into the chat prompt when the vision proxy
 * fails to describe an image. Keep this in English and out of i18n so prompt
 * shape and cache behaviour do not vary by VS Code display language.
 */
exports.IMAGE_DESCRIPTION_UNAVAILABLE = '[Image Description unavailable]';
// ---- Cache ----
/** Max entries in the reasoning-content cache before eviction kicks in. */
exports.MAX_CACHE_SIZE = 200;
// ---- Model registry ----
/** Available DeepSeek models exposed through the language model provider. */
exports.MODELS = [
    {
        id: 'deepseek-v4-flash',
        name: 'DeepSeek V4 Flash',
        family: 'deepseek',
        version: 'v4',
        detail: 'Fast, general-purpose model',
        maxInputTokens: 1048576,
        maxOutputTokens: 393216,
        capabilities: {
            toolCalling: true,
            imageInput: true,
            thinking: true,
        },
        requiresThinkingParam: true,
    },
    {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        family: 'deepseek',
        version: 'v4',
        detail: 'Most capable reasoning model',
        maxInputTokens: 1048576,
        maxOutputTokens: 393216,
        capabilities: {
            toolCalling: true,
            imageInput: true,
            thinking: true,
        },
        requiresThinkingParam: true,
    },
];
//# sourceMappingURL=consts.js.map