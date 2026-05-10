export interface ModelRuntimeMetadata {
  maxInputTokens: number;
  maxOutputTokens: number;
  imageInput: boolean;
  toolCalling: boolean;
  reasoningEffortOptions: string[];
  thinkingTypeOptions: string[];
}

const DEFAULT_MAX_INPUT_TOKENS = 128000;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const DEFAULT_CHAT_METADATA: ModelRuntimeMetadata = {
  maxInputTokens: DEFAULT_MAX_INPUT_TOKENS,
  maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  imageInput: false,
  toolCalling: true,
  reasoningEffortOptions: [],
  thinkingTypeOptions: [],
};

const EXACT_MODEL_METADATA: Record<string, ModelRuntimeMetadata> = {
  "step-3.5-flash": chat(256000),
  "step-3.5-flash-2603": chat(256000, DEFAULT_MAX_OUTPUT_TOKENS, { reasoningEffortOptions: ["low", "high"] }),
  "step-router-v1": chat(384000),
  "step-image-edit-2": nonChat(512),
  "stepaudio-2.5-tts": nonChat(10000),
  "stepaudio-2.5-asr": nonChat(1024),
  "stepaudio-2.5-chat": nonChat(32000, 4096),
  "stepaudio-2.5-realtime": nonChat(32000, 4096),
  "glm-4.6": chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
  "glm-4.7": chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
  "glm-5": chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
  "glm-5-turbo": chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
  "glm-5.1": chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
};

export function resolveModelRuntimeMetadata(
  modelName: string,
  providerName: string,
  configuredMaxInputTokens?: number
): ModelRuntimeMetadata {
  const inferred = inferModelRuntimeMetadata(modelName, providerName);
  const configured = normalizeConfiguredMaxInputTokens(configuredMaxInputTokens);

  if (configured && configured !== DEFAULT_MAX_INPUT_TOKENS) {
    return {
      ...(inferred || DEFAULT_CHAT_METADATA),
      maxInputTokens: configured,
    };
  }

  return inferred || {
    ...DEFAULT_CHAT_METADATA,
    maxInputTokens: configured || DEFAULT_MAX_INPUT_TOKENS,
  };
}

export function inferMaxInputTokens(modelName: string, providerName = ""): number {
  return resolveModelRuntimeMetadata(modelName, providerName).maxInputTokens;
}

export function supportsReasoningEffort(modelName: string, providerName = ""): boolean {
  return getReasoningEffortOptions(modelName, providerName).length > 0;
}

export function supportsThinkingType(modelName: string, providerName = ""): boolean {
  return getThinkingTypeOptions(modelName, providerName).length > 0;
}

export function getReasoningEffortOptions(modelName: string, providerName = ""): string[] {
  return resolveModelRuntimeMetadata(modelName, providerName).reasoningEffortOptions;
}

export function getThinkingTypeOptions(modelName: string, providerName = ""): string[] {
  return resolveModelRuntimeMetadata(modelName, providerName).thinkingTypeOptions;
}

function inferModelRuntimeMetadata(modelName: string, providerName: string): ModelRuntimeMetadata | undefined {
  const normalized = normalizeModelName(modelName);
  const normalizedProvider = normalizeModelName(providerName);

  if (EXACT_MODEL_METADATA[normalized]) {
    return EXACT_MODEL_METADATA[normalized];
  }

  if (normalized.startsWith("gpt-5.5") || normalized.startsWith("gpt-5.4")) {
    return chat(1050000, 128000, { reasoningEffortOptions: ["none", "low", "medium", "high", "xhigh"] });
  }

  if (normalized.startsWith("gpt-5.1")) {
    return chat(400000, 128000, { reasoningEffortOptions: ["none", "low", "medium", "high"] });
  }

  if (normalized.startsWith("gpt-5")) {
    return chat(400000, 128000, { reasoningEffortOptions: ["minimal", "low", "medium", "high"] });
  }

  if (normalized.startsWith("gpt-oss")) {
    return chat(DEFAULT_MAX_INPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, { reasoningEffortOptions: ["low", "medium", "high"] });
  }

  if (/^o\d/.test(normalized) || normalized.startsWith("o-series")) {
    return chat(DEFAULT_MAX_INPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS, { reasoningEffortOptions: ["low", "medium", "high"] });
  }

  if (normalized.includes("deepseek")) {
    return chat(128000, 64000, {
      reasoningEffortOptions: ["high", "max"],
      thinkingTypeOptions: ["enabled", "disabled"],
    });
  }

  if (normalized.startsWith("qwen") || normalized.startsWith("qwq") || normalizedProvider.includes("qwen")) {
    return chat(128000, DEFAULT_MAX_OUTPUT_TOKENS, {
      thinkingTypeOptions: ["enabled", "disabled"],
    });
  }

  if (normalized.startsWith("minimax") || normalized.startsWith("m2") || normalizedProvider.includes("minimax")) {
    return chat(204800, 128000, {
      thinkingTypeOptions: ["enabled", "disabled"],
    });
  }

  if (normalized.startsWith("claude") || normalizedProvider.includes("claude") || normalizedProvider.includes("anthropic")) {
    return chat(200000, 64000, {
      reasoningEffortOptions: ["low", "medium", "high", "max"],
      thinkingTypeOptions: ["adaptive", "enabled", "disabled"],
    });
  }

  if (normalized.startsWith("gemini-3")) {
    return chat(1000000, 64000, {
      reasoningEffortOptions: ["low", "high"],
    });
  }

  if (normalized.startsWith("gemini-2.5") || normalizedProvider.includes("gemini")) {
    return chat(1000000, 64000);
  }

  if (normalized.startsWith("glm-4.5")) {
    return chat(128000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] });
  }

  if (normalized.startsWith("glm-5v")) {
    return {
      ...chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] }),
      imageInput: true,
    };
  }

  if (normalized.startsWith("glm-5")) {
    return chat(200000, DEFAULT_MAX_OUTPUT_TOKENS, { thinkingTypeOptions: ["enabled", "disabled"] });
  }

  if (normalized.includes("step-3.5-flash")) {
    return chat(256000);
  }

  if (normalized.startsWith("stepaudio") || normalizedProvider.includes("audio")) {
    return nonChat(10000);
  }

  if (normalized.includes("image") || normalized.includes("edit") || normalizedProvider.includes("image")) {
    return nonChat(512);
  }

  return undefined;
}

function chat(
  maxInputTokens: number,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  options: Partial<Pick<ModelRuntimeMetadata, "reasoningEffortOptions" | "thinkingTypeOptions">> = {}
): ModelRuntimeMetadata {
  return {
    maxInputTokens,
    maxOutputTokens,
    imageInput: false,
    toolCalling: true,
    reasoningEffortOptions: options.reasoningEffortOptions || [],
    thinkingTypeOptions: options.thinkingTypeOptions || [],
  };
}

function nonChat(maxInputTokens: number, maxOutputTokens = 1): ModelRuntimeMetadata {
  return {
    maxInputTokens,
    maxOutputTokens,
    imageInput: false,
    toolCalling: false,
    reasoningEffortOptions: [],
    thinkingTypeOptions: [],
  };
}

function normalizeModelName(value: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeConfiguredMaxInputTokens(value?: number): number | undefined {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}
