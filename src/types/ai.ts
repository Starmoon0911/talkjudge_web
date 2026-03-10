export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: number;
};

export type AIBlockType = "text" | "code" | "example";

export type AIContentBlock = {
  type: AIBlockType;
  content: string;
  language?: string;
};

export type AISubtitleSegment = {
  text: string;
  startedAtMs: number;
};

export type AIChatResponse = {
  provider: string;
  model: string;
  reply: string;
  subtitleSegments: AISubtitleSegment[];
  blocks: AIContentBlock[];
};

export type AILiveSessionResponse = {
  provider: string;
  model: string;
  ephemeralToken: string;
  expiresAt: string;
  websocketUrl: string;
  setup: {
    setup: {
      model: string;
      systemInstruction: {
        parts: { text: string }[];
      };
      generationConfig?: {
        responseModalities?: string[];
      };
    };
  };
};

export type AIAnimationDraftResponse = {
  status: "reserved";
  message: string;
  job: {
    type: "remotion";
    conversationId?: string;
    title?: string;
    highlights?: string[];
  };
};
