"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode_1 = __importDefault(require("vscode"));
const config_1 = require("./config");
const consts_1 = require("./consts");
const i18n_1 = require("./i18n");
const logger_1 = require("./logger");
const provider_1 = require("./provider");
let activeProvider;
function activate(context) {
    logger_1.logger.info(`Activating extension version=${context.extension.packageJSON.version}` +
        ` debug=${(0, config_1.getDebugLoggingEnabled)()}`);
    context.subscriptions.push(vscode_1.default.commands.registerCommand('deepseek-copilot.showLogs', () => logger_1.logger.show()), vscode_1.default.commands.registerCommand('deepseek-copilot.getApiKey', () => vscode_1.default.env.openExternal(vscode_1.default.Uri.parse('https://platform.deepseek.com/api_keys'))), vscode_1.default.commands.registerCommand('deepseek-copilot.openSettings', () => vscode_1.default.commands.executeCommand('workbench.action.openSettings', 'deepseek-copilot')));
    try {
        const provider = new provider_1.DeepSeekChatProvider(context);
        activeProvider = provider;
        context.subscriptions.push(vscode_1.default.commands.registerCommand('deepseek-copilot.setApiKey', () => provider.configureApiKey()), vscode_1.default.commands.registerCommand('deepseek-copilot.clearApiKey', () => provider.clearApiKey()), vscode_1.default.commands.registerCommand('deepseek-copilot.setVisionModel', () => provider.setVisionProxyModel()), vscode_1.default.lm.registerLanguageModelChatProvider('deepseek', provider));
        // Fix(#12): configurationSchema (Thinking Effort dropdown) is a non-public
        // field that Copilot Chat does not persist in its chatLanguageModels.json
        // cache. On startup, Copilot Chat initialises the model picker from cache
        // and silently drops configurationSchema, so the per-model config menu
        // never appears on first launch.
        //
        // Re-firing onDidChangeLanguageModelChatInformation here forces Copilot
        // Chat to re-query our provider through the full (non-cached) path, which
        // correctly picks up configurationSchema.
        //
        // This works because registerLanguageModelChatProvider() is synchronous,
        // so the provider is fully registered before we fire the refresh and the
        // host has already subscribed to receive the change. Copilot Chat can then
        // re-query complete model information through the non-cached path. The
        // extensionDependencies on github.copilot-chat in package.json
        // additionally guarantees Copilot Chat is fully activated before this
        // extension's activate() runs, eliminating any activation ordering race.
        provider.refreshModelPicker();
        void showWelcomeIfNeeded(context, provider).catch((error) => {
            logger_1.logger.warn((0, i18n_1.t)('extension.welcomeFailed'), error);
        });
        logger_1.logger.info(`Extension activated version=${context.extension.packageJSON.version}`);
    }
    catch (error) {
        activeProvider = undefined;
        logger_1.logger.error('Failed to activate DeepSeek extension', error);
        void vscode_1.default.window.showErrorMessage((0, i18n_1.t)('extension.activateFailed'));
        throw error;
    }
}
async function showWelcomeIfNeeded(context, provider) {
    if (context.globalState.get(consts_1.WELCOME_SHOWN_KEY)) {
        return;
    }
    if (await provider.hasApiKey()) {
        await context.globalState.update(consts_1.WELCOME_SHOWN_KEY, true);
        return;
    }
    await vscode_1.default.commands.executeCommand('workbench.action.openWalkthrough', consts_1.WALKTHROUGH_ID, false);
    await context.globalState.update(consts_1.WELCOME_SHOWN_KEY, true);
}
async function deactivate() {
    try {
        await activeProvider?.prepareForDeactivate();
    }
    catch (error) {
        logger_1.logger.warn((0, i18n_1.t)('extension.deactivateFailed'), error);
    }
    finally {
        activeProvider = undefined;
        logger_1.logger.info('Extension deactivated');
        logger_1.logger.dispose();
    }
}
//# sourceMappingURL=extension.js.map