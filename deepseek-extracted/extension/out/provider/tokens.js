"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokenCount = estimateTokenCount;
const vscode_1 = __importDefault(require("vscode"));
function estimateTokenCount(text, charsPerToken) {
    if (typeof text === 'string') {
        return Math.max(1, Math.ceil(text.length / charsPerToken));
    }
    if (!text?.content || !Array.isArray(text.content)) {
        return 1;
    }
    let total = 0;
    for (const part of text.content) {
        if (part instanceof vscode_1.default.LanguageModelTextPart) {
            total += part.value.length;
        }
    }
    return Math.max(1, Math.ceil(total / charsPerToken));
}
//# sourceMappingURL=tokens.js.map