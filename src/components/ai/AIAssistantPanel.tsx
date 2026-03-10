"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRemotionDraft, sendAIChat } from "@/lib/aiClient";
import type { AIContentBlock, AIMessage } from "@/types/ai";

type AIAssistantPanelProps = {
  problem?: {
    id: string;
    title: string;
    description: string;
    samples?: { input: string; output: string; explanation?: string }[];
  };
  language: string;
  code: string;
  latestResult?: string;
};

type AssistantMessage = AIMessage & {
  blocks?: AIContentBlock[];
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractHighlights(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export default function AIAssistantPanel({
  problem,
  language,
  code,
  latestResult,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [subtitle, setSubtitle] = useState("Ready. Ask me about this problem or your code.");
  const [isSending, setIsSending] = useState(false);
  const [isReservingAnimation, setIsReservingAnimation] = useState(false);

  const subtitleTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const playSubtitle = (segments: { text: string; startedAtMs: number }[]) => {
    if (!segments.length) {
      return;
    }

    if (subtitleTimer.current) {
      window.clearTimeout(subtitleTimer.current);
    }

    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      const current =
        [...segments]
          .reverse()
          .find((segment) => elapsed >= segment.startedAtMs) ?? segments[0];

      setSubtitle(current.text);

      if (elapsed < segments[segments.length - 1].startedAtMs + 1800) {
        subtitleTimer.current = window.setTimeout(tick, 120);
      }
    };

    tick();
  };

  const sendMessage = async () => {
    if (!canSend) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: uid("user"),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendAIChat({
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        metadata: {
          problemId: problem?.id,
          problemTitle: problem?.title,
          language,
          latestResult,
          code,
        },
      });

      const assistantMessage: AssistantMessage = {
        id: uid("assistant"),
        role: "assistant",
        content: response.reply,
        createdAt: Date.now(),
        blocks: response.blocks,
      };

      setMessages((current) => [...current, assistantMessage]);
      playSubtitle(response.subtitleSegments);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: uid("assistant-error"),
          role: "assistant",
          content: "AI request failed. Please check backend API and GEMINI_API_KEY.",
          createdAt: Date.now(),
        },
      ]);
      setSubtitle("AI request failed. Check backend logs.");
    } finally {
      setIsSending(false);
    }
  };

  const reserveAnimation = async () => {
    setIsReservingAnimation(true);
    try {
      const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
      const draft = await createRemotionDraft({
        conversationId: uid("conv"),
        title: problem ? `Explain ${problem.title}` : "OJ assistant walkthrough",
        highlights: extractHighlights(latestAssistant?.content || subtitle),
      });
      setSubtitle(draft.message);
    } finally {
      setIsReservingAnimation(false);
    }
  };

  return (
    <section
      style={{
        width: 360,
        borderLeft: "1px solid #21262d",
        background: "#0f141b",
        display: "flex",
        flexDirection: "column",
        minWidth: 320,
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #21262d", background: "#161b22" }}>
        <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
          AI Subtitle
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "#e6edf3",
            minHeight: 42,
            maxHeight: 84,
            overflow: "auto",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div style={{ padding: "10px 12px", display: "flex", gap: 8, borderBottom: "1px solid #21262d" }}>
        <button
          onClick={reserveAnimation}
          disabled={isReservingAnimation}
          style={{
            border: "1px solid #30363d",
            background: isReservingAnimation ? "#1f2937" : "#111827",
            color: "#e6edf3",
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: isReservingAnimation ? "not-allowed" : "pointer",
          }}
        >
          {isReservingAnimation ? "Preparing..." : "One-click Animation"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>
            Ask for hints, debugging help, complexity analysis, or testcase ideas.
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            const blocks = message.blocks ?? [{ type: "text" as const, content: message.content }];
            return (
              <div
                key={message.id}
                style={{
                  alignSelf: isUser ? "flex-end" : "stretch",
                  width: isUser ? "fit-content" : "100%",
                  maxWidth: "100%",
                }}
              >
                <div
                  style={{
                    background: isUser ? "#1f6feb" : "#161b22",
                    color: isUser ? "#ffffff" : "#e6edf3",
                    border: isUser ? "none" : "1px solid #21262d",
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {blocks.map((block, index) => {
                    if (block.type === "code") {
                      return (
                        <pre
                          key={`${message.id}-code-${index}`}
                          style={{
                            margin: index === 0 ? 0 : "8px 0 0",
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            borderRadius: 8,
                            padding: 10,
                            overflowX: "auto",
                            fontSize: 12,
                          }}
                        >
                          <code>{block.content}</code>
                        </pre>
                      );
                    }

                    return (
                      <div
                        key={`${message.id}-txt-${index}`}
                        style={{ marginTop: index === 0 ? 0 : 8, color: block.type === "example" ? "#86efac" : undefined }}
                      >
                        {block.content}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {isSending && <div style={{ color: "#8b949e", fontSize: 12 }}>AI is thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid #21262d", padding: 12 }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI about your solution..."
          rows={3}
          style={{
            width: "100%",
            resize: "none",
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 8,
            color: "#e6edf3",
            padding: 10,
            fontSize: 13,
            lineHeight: 1.5,
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            marginTop: 8,
            width: "100%",
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 13,
            fontWeight: 700,
            background: canSend ? "#238636" : "#1f2937",
            color: "#fff",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>
    </section>
  );
}

