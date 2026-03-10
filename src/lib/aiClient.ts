import api from "@/lib/api";
import type {
  AIAnimationDraftResponse,
  AIChatResponse,
  AILiveSessionResponse,
} from "@/types/ai";

type SendChatInput = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  model?: string;
  metadata?: Record<string, unknown>;
};

export async function sendAIChat(input: SendChatInput): Promise<AIChatResponse> {
  const { data } = await api.post<AIChatResponse>("/ai/chat", {
    provider: "gemini",
    model: input.model,
    messages: input.messages,
    metadata: input.metadata,
  });
  return data;
}

export async function createLiveSession(model?: string): Promise<AILiveSessionResponse> {
  const { data } = await api.post<AILiveSessionResponse>("/ai/live/session", {
    provider: "gemini",
    model,
  });
  return data;
}

export async function createRemotionDraft(payload: {
  conversationId?: string;
  title?: string;
  highlights?: string[];
}): Promise<AIAnimationDraftResponse> {
  const { data } = await api.post<AIAnimationDraftResponse>("/ai/remotion/draft", payload);
  return data;
}
