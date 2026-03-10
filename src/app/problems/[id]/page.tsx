"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CodeEditor from "@/components/editor/CodeEditor";
import useProblems from "@/hooks/useProblems";
import api from "@/lib/api";

const LANGUAGE_ID: Record<string, number> = {
  cpp: 54,
  python: 71,
};

const difficultyConfig: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: "Easy", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
  medium: { label: "Medium", color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  hard: { label: "Hard", color: "#f87171", bg: "rgba(248,113,113,0.08)" },
};

const STARTER: Record<string, string> = {
  python: "",
  cpp: "",
};

type AILiveSessionResponse = {
  provider: string;
  model: string;
  setup?: unknown;
};

type LiveStatus = "idle" | "connecting" | "live" | "error";

type SubmitResult = {
  accepted: boolean;
  total: number;
  passed: number;
  results: {
    testcase: number;
    status: { id: number; description: string };
    stdout?: string;
    expected?: string;
    stderr?: string;
    compile_output?: string;
    time?: string;
  }[];
};

// ── Inline AI Assistant Panel ────────────────────────────────────────────────
function AIAssistantPanel({
  problem,
  language,
  code,
  latestResult,
}: {
  problem?: { id: string; title: string; description: string; samples?: unknown };
  language: string;
  code: string;
  latestResult: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const subtitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Live session state ──
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [liveSession, setLiveSession] = useState<AILiveSessionResponse | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null); // 放在 component 裡的 refs

  // 以下放在 component 外
  function base64ToArrayBuffer(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }

  function pcmToWav(pcm: ArrayBuffer, sampleRate = 24000): ArrayBuffer {
    const data = new Uint8Array(pcm);
    const wav = new ArrayBuffer(44 + data.byteLength);
    const v = new DataView(wav);
    const s = (o: number, str: string) =>
      [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, "RIFF"); v.setUint32(4, 36 + data.byteLength, true);
    s(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); s(36, "data");
    v.setUint32(40, data.byteLength, true);
    new Uint8Array(wav, 44).set(data);
    return wav;
  }
  const playPcm = async (buffer: ArrayBuffer) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    try {
      const wav = pcmToWav(buffer);
      const decoded = await ctx.decodeAudioData(wav);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
    } catch (e) {
      console.warn("[Audio] decode failed", e);
    }
  };
  const startLiveSession = async () => {
    if (liveStatus === "connecting" || liveStatus === "live") return;
    setLiveStatus("connecting");
    setLiveError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
      }

      const model = "gemini-2.5-flash-native-audio-preview-12-2025";
      const session: AILiveSessionResponse = {
        provider: "gemini",
        model,
        setup: {
          setup: {
            model: `models/${model}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: {
              parts: [
                {
                  text: "You are an AI teaching assistant inside an Online Judge. Give concise, practical help for debugging and algorithm understanding.",
                },
              ],
            },
          },
        },
      };
      setLiveSession(session);

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

      const ws = new WebSocket(wsUrl);
      console.log("[LiveSession] connecting to:", wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // 移除 setTimeout，直接送 setup
        if (session.setup) {
          const inner =
            session.setup &&
              typeof session.setup === "object" &&
              "setup" in (session.setup as object)
              ? (session.setup as { setup: unknown }).setup
              : session.setup;
          ws.send(JSON.stringify({ setup: inner }));
          console.log("[LiveSession] setup sent");
        }
      };

      ws.onmessage = async (event) => {
        // ── Binary frame = raw PCM audio from Gemini ──
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          await playPcm(arrayBuffer);
          return;
        }
        if (typeof event.data !== "string") return;

        try {
          const data = JSON.parse(event.data);
          console.log("[LiveSession] received:", JSON.stringify(data).slice(0, 300));

          if (data.setupComplete !== undefined) {
            console.log("[LiveSession] setupComplete ✓");
            setLiveStatus("live");
            setMessages(prev => [
              ...prev,
              { role: "assistant", text: "🎙 Live session ready. Speak now." },
            ]);
            return;
          }

          // TEXT transcript（native-audio 有時也會附帶）
          const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
            data?.serverContent?.modelTurn?.parts ?? [];

          for (const part of parts) {
            // base64 PCM（JSON 包裝的音頻）
            if (part.inlineData?.mimeType?.startsWith("audio/pcm")) {
              await playPcm(base64ToArrayBuffer(part.inlineData.data));
            }
            if (part.text) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !data?.serverContent?.turnComplete) {
                  return [...prev.slice(0, -1), { role: "assistant", text: last.text + part.text! }];
                }
                return [...prev, { role: "assistant", text: part.text! }];
              });
              showSubtitle(part.text.length > 80 ? part.text.slice(0, 77) + "…" : part.text);
            }
          }
        } catch { }
      };

      ws.onerror = () => {
        setLiveStatus("error");
        setLiveError("WebSocket error. Please try again.");
      };

      ws.onclose = (ev) => {
        setLiveStatus("idle");
        if (ev.code !== 1000) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Session closed (code ${ev.code}).` },
          ]);
        }
        wsRef.current = null;
      };
    } catch (err) {
      setLiveStatus("error");
      setLiveError(err instanceof Error ? err.message : "Failed to create live session.");
    }
  };

  const endLiveSession = () => {
    wsRef.current?.close(1000, "User ended session");
    wsRef.current = null;
    setLiveStatus("idle");
    setLiveSession(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "Session ended." },
    ]);
  };

  // Show a floating subtitle bubble for 4s
  const showSubtitle = (text: string) => {
    setSubtitle(text);
    if (subtitleTimer.current) clearTimeout(subtitleTimer.current);
    subtitleTimer.current = setTimeout(() => setSubtitle(null), 4000);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user" as const, text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // ── Live session: use Gemini BidiGenerateContent clientContent format ──
    if (liveStatus === "live" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: trimmed }] }],
            turnComplete: true,
          },
        }),
      );
      return;
    }

    // ── Fallback: regular HTTP chat ──
    setLoading(true);

    try {
      const res = await api.post("/ai/chat", {
        problem,
        language,
        code,
        latestResult,
        message: trimmed,
        history: messages,
      });
      const reply = res.data?.reply ?? "...";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      // Show first ~80 chars as subtitle bubble
      showSubtitle(reply.length > 80 ? reply.slice(0, 77) + "…" : reply);
    } catch {
      const errText = "Failed to reach AI assistant.";
      setMessages((prev) => [...prev, { role: "assistant", text: errText }]);
      showSubtitle(errText);
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating subtitle bubble ── */}
      <div
        style={{
          position: "fixed",
          bottom: 52,
          left: "50%",
          transform: `translateX(-50%) translateY(${subtitle ? "0" : "12px"})`,
          opacity: subtitle ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          zIndex: 9999,
          maxWidth: 460,
          width: "90vw",
        }}
      >
        <div
          style={{
            background: "rgba(15,20,30,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(88,166,255,0.25)",
            borderRadius: 20,
            padding: "10px 16px",
            fontSize: 13,
            color: "#c9d1d9",
            lineHeight: 1.55,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(88,166,255,0.08)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {/* Sparkle icon */}
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>✦</span>
          <span>{subtitle}</span>
          {/* Bubble tail */}
          <span
            style={{
              position: "absolute",
              bottom: -7,
              left: "50%",
              transform: "translateX(-50%)",
              width: 12,
              height: 12,
              background: "rgba(15,20,30,0.92)",
              border: "1px solid rgba(88,166,255,0.25)",
              borderTop: "none",
              borderLeft: "none",
              rotate: "45deg",
              borderRadius: "0 0 3px 0",
            }}
          />
        </div>
      </div>

      {/* ── Side panel ── */}
      <aside
        style={{
          width: 300,
          minWidth: 240,
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid #1e2530",
          background: "#0b0f18",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 12px 10px",
            borderBottom: "1px solid #1e2530",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Top row: icon + title + thinking indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              ✦
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: 0.5 }}>
              AI Assistant
            </span>
            {loading && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "#60a5fa",
                  animation: "pulse 1.2s infinite",
                }}
              >
                thinking…
              </span>
            )}
          </div>

          {/* Live session button row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {liveStatus === "idle" || liveStatus === "error" ? (
              <button
                onClick={startLiveSession}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #0f3d2e, #14532d)",
                  border: "1px solid #16a34a44",
                  borderRadius: 8,
                  color: "#86efac",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  letterSpacing: 0.4,
                  transition: "background 0.2s",
                }}
              >
                {/* Play / microphone icon */}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                    stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <path
                    d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
                    stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                Start Lesson
              </button>
            ) : liveStatus === "connecting" ? (
              <div
                style={{
                  flex: 1,
                  background: "#0d1420",
                  border: "1px solid #1e2d3d",
                  borderRadius: 8,
                  color: "#60a5fa",
                  fontSize: 11,
                  padding: "6px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  animation: "pulse 1.2s infinite",
                }}
              >
                {/* Spinner */}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#1e2d3d" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Connecting…
              </div>
            ) : (
              /* live */
              <>
                <div
                  style={{
                    flex: 1,
                    background: "#0d1420",
                    border: "1px solid #16a34a55",
                    borderRadius: 8,
                    color: "#4ade80",
                    fontSize: 11,
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {/* Pulsing dot */}
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#4ade80",
                      boxShadow: "0 0 8px #4ade8099",
                      animation: "pulse 1.5s infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 700 }}>Live</span>
                  {liveSession && (
                    <span style={{ color: "#334155", fontSize: 10, marginLeft: 2 }}>
                      {liveSession.model}
                    </span>
                  )}
                </div>
                <button
                  onClick={endLiveSession}
                  title="End session"
                  style={{
                    background: "#2d1111",
                    border: "1px solid #7f1d1d55",
                    borderRadius: 8,
                    color: "#f87171",
                    fontSize: 11,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 700,
                  }}
                >
                  End
                </button>
              </>
            )}
          </div>

          {/* Error message */}
          {liveStatus === "error" && liveError && (
            <div
              style={{
                fontSize: 10,
                color: "#f87171",
                background: "#2d1111",
                border: "1px solid #7f1d1d55",
                borderRadius: 6,
                padding: "4px 8px",
                lineHeight: 1.5,
              }}
            >
              {liveError}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                marginTop: 24,
                textAlign: "center",
                color: "#334155",
                fontSize: 12,
                lineHeight: 1.8,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
              Ask anything about
              <br />
              this problem or your code.
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}
            >
              <div
                style={{
                  padding: "8px 11px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  fontSize: 12,
                  lineHeight: 1.6,
                  background:
                    m.role === "user"
                      ? "linear-gradient(135deg, #1d4ed8, #1e40af)"
                      : "#131a27",
                  color: m.role === "user" ? "#e0f2fe" : "#94a3b8",
                  border:
                    m.role === "assistant" ? "1px solid #1e2d3d" : "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: "flex-start" }}>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: "14px 14px 14px 4px",
                  background: "#131a27",
                  border: "1px solid #1e2d3d",
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      display: "inline-block",
                      animation: `bounce 1s ${d * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div
          style={{
            padding: "8px 10px 10px",
            borderTop: "1px solid #1e2530",
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI…"
            style={{
              flex: 1,
              background: "#0d1420",
              border: "1px solid #1e2d3d",
              borderRadius: 10,
              color: "#c9d1d9",
              fontSize: 12,
              padding: "7px 10px",
              resize: "none",
              fontFamily: "inherit",
              outline: "none",
              lineHeight: 1.5,
            }}
          />
          {/* ✈ Send button */}
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            title="Send (Enter)"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background:
                loading || !input.trim()
                  ? "#1e2530"
                  : "linear-gradient(135deg, #2563eb, #7c3aed)",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.2s, transform 0.1s",
              transform: "none",
            }}
            onMouseDown={(e) => {
              if (!loading && input.trim()) {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)";
              }
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            {/* Paper plane SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: "rotate(45deg)", marginTop: -1 }}
            >
              <path
                d="M22 2L11 13"
                stroke={loading || !input.trim() ? "#334155" : "#e0f2fe"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 2L15 22L11 13L2 9L22 2Z"
                stroke={loading || !input.trim() ? "#334155" : "#e0f2fe"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params.id ?? params.slug) as string;
  const { data, loading } = useProblems({ id });

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER.python);
  const [activeTab, setActiveTab] = useState<"description" | "samples">("description");
  const [copied, setCopied] = useState(false);

  const [leftWidth, setLeftWidth] = useState(38);
  const [resultHeight, setResultHeight] = useState(180);
  const [resultCollapsed, setResultCollapsed] = useState(false);

  const isDraggingH = useRef(false);
  const isDraggingV = useRef(false);

  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [result, setResult] = useState<{
    status: "idle" | "accepted" | "wrong_answer" | "running" | "error";
    output?: string;
    expected?: string;
    time?: number;
    stderr?: string;
    compile_output?: string;
  }>({ status: "idle" });

  const problem = data?.[0];
  const diff = problem ? difficultyConfig[problem.difficulty] ?? difficultyConfig.easy : null;

  const aiStatusSummary = submitResult
    ? `${submitResult.passed}/${submitResult.total} testcases passed`
    : result.status;

  const statusBar = useMemo(
    () =>
      ({
        idle: { text: "Ready", color: "#475569" },
        running: { text: "Running…", color: "#fb923c" },
        accepted: { text: "Accepted", color: "#4ade80" },
        wrong_answer: { text: "Wrong Answer", color: "#f87171" },
        error: { text: "Runtime Error", color: "#f87171" },
      } as const)[result.status] ?? { text: "Ready", color: "#475569" },
    [result.status],
  );

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(STARTER[lang] ?? "");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleRun = async () => {
    if (!problem) return;
    setResult({ status: "running" });
    setSubmitResult(null);
    try {
      const response = await api.post("/run", {
        problem_id: problem.id,
        source_code: code,
        language_id: LANGUAGE_ID[language],
      });
      const payload = response.data;
      setResult({
        status: payload.status.id === 3 ? "accepted" : "wrong_answer",
        output: payload.stdout ?? "",
        expected: payload.expected ?? "",
        stderr: payload.stderr,
        compile_output: payload.compile_output,
        time: payload.time,
      });
    } catch {
      setResult({ status: "error", stderr: "Failed to run code." });
    }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setResult({ status: "running" });
    setSubmitResult(null);
    try {
      const response = await api.post("/submit", {
        problem_id: problem.id,
        source_code: code,
        language_id: LANGUAGE_ID[language],
      });
      const payload = response.data as SubmitResult;
      setSubmitResult(payload);
      setResult({ status: payload.accepted ? "accepted" : "wrong_answer" });
    } catch {
      setResult({ status: "error", stderr: "Failed to submit code." });
    }
  };

  const handleHMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isDraggingH.current = true;
    const startX = event.clientX;
    const startWidth = leftWidth;
    const totalWidth = document.body.clientWidth;
    const onMove = (e: MouseEvent) => {
      if (!isDraggingH.current) return;
      const delta = e.clientX - startX;
      setLeftWidth(Math.min(58, Math.max(20, startWidth + (delta / totalWidth) * 100)));
    };
    const onUp = () => {
      isDraggingH.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleVMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    isDraggingV.current = true;
    const startY = event.clientY;
    const startHeight = resultHeight;
    const onMove = (e: MouseEvent) => {
      if (!isDraggingV.current) return;
      setResultHeight(Math.min(420, Math.max(100, startHeight + (startY - e.clientY))));
    };
    const onUp = () => {
      isDraggingV.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#080c14",
          color: "#334155",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#080c14",
        color: "#e2e8f0",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          height: 44,
          background: "#0b0f18",
          borderBottom: "1px solid #1e2530",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "1px solid #1e2d3d",
            borderRadius: 7,
            color: "#64748b",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Back
        </button>

        {problem && (
          <>
            <span style={{ color: "#1e2d3d", fontSize: 16 }}>|</span>
            <strong style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
              {problem.title}
            </strong>
            <span style={{ color: "#334155", fontSize: 11 }}>{problem.slug}</span>
          </>
        )}

        <span style={{ marginLeft: "auto" }} />

        {diff && (
          <span
            style={{
              color: diff.color,
              background: diff.bg,
              border: `1px solid ${diff.color}33`,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            {diff.label}
          </span>
        )}
      </nav>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: problem description */}
        <aside
          style={{
            width: `${leftWidth}%`,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #1e2530",
            minWidth: 260,
            background: "#0b0f18",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #1e2530",
              flexShrink: 0,
            }}
          >
            {(["description", "samples"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab ? "#3b82f6" : "transparent"}`,
                  color: activeTab === tab ? "#60a5fa" : "#475569",
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  textTransform: "capitalize",
                  letterSpacing: 0.3,
                  transition: "color 0.15s",
                }}
              >
                {tab === "description" ? "Description" : "Examples"}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{ padding: 18, overflow: "auto", flex: 1 }}>
            {problem && activeTab === "description" && (
              <>
                <div style={{ fontSize: 10, color: "#334155", marginBottom: 6, letterSpacing: 1 }}>
                  #{problem.id.slice(-4).toUpperCase()}
                </div>
                <h2 style={{ fontSize: 20, marginBottom: 12, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>
                  {problem.title}
                </h2>

                {!!problem.tags?.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                    {problem.tags.map((tag: string) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#0f172a",
                          color: "#475569",
                          border: "1px solid #1e2d3d",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <Label>Problem</Label>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, color: "#94a3b8", fontSize: 13 }}>
                  {problem.description}
                </p>

                {problem.input_format && (
                  <>
                    <Label>Input Format</Label>
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, color: "#94a3b8", fontSize: 13 }}>
                      {problem.input_format}
                    </p>
                  </>
                )}

                {problem.output_format && (
                  <>
                    <Label>Output Format</Label>
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, color: "#94a3b8", fontSize: 13 }}>
                      {problem.output_format}
                    </p>
                  </>
                )}

                {problem.constraints && (
                  <>
                    <Label>Constraints</Label>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #1e2d3d",
                        background: "#080c14",
                        color: "#64748b",
                        fontFamily: "inherit",
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.7,
                      }}
                    >
                      {problem.constraints}
                    </pre>
                  </>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
                  <InfoCard label="Time Limit" value={`${problem.time_limit} ms`} />
                  <InfoCard label="Memory" value={`${problem.memory_limit} MB`} />
                </div>
              </>
            )}

            {problem && activeTab === "samples" && (
              <>
                {(problem.samples || []).map((sample: { input: string; output: string; explanation?: string }, index: number) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #1e2d3d",
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 10,
                      background: "#080c14",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "#0b0f18",
                        borderBottom: "1px solid #1e2d3d",
                        color: "#475569",
                        fontSize: 11,
                        letterSpacing: 0.5,
                      }}
                    >
                      Example {index + 1}
                    </div>
                    <div style={{ padding: 12, fontSize: 12, lineHeight: 1.7 }}>
                      <div style={{ color: "#64748b", marginBottom: 4 }}>
                        <span style={{ color: "#475569" }}>Input: </span>
                        <span style={{ color: "#94a3b8" }}>{sample.input}</span>
                      </div>
                      <div style={{ color: "#64748b", marginBottom: sample.explanation ? 8 : 0 }}>
                        <span style={{ color: "#475569" }}>Output: </span>
                        <span style={{ color: "#94a3b8" }}>{sample.output}</span>
                      </div>
                      {sample.explanation && (
                        <div
                          style={{
                            color: "#475569",
                            fontSize: 12,
                            borderTop: "1px solid #1e2d3d",
                            paddingTop: 8,
                            lineHeight: 1.6,
                          }}
                        >
                          {sample.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Horizontal resizer */}
        <div
          onMouseDown={handleHMouseDown}
          style={{
            width: 4,
            cursor: "col-resize",
            background: "transparent",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#2563eb55")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
        />

        {/* Right: editor + output */}
        <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "#0b0f18",
              borderBottom: "1px solid #1e2530",
              flexShrink: 0,
            }}
          >
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                background: "#0d1420",
                border: "1px solid #1e2d3d",
                borderRadius: 6,
                color: "#64748b",
                padding: "4px 8px",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
              }}
            >
              <option value="python">Python 3.8.1</option>
              <option value="cpp">C++ GCC 9.2.0</option>
            </select>

            <span style={{ marginLeft: "auto" }} />

            <GhostBtn onClick={handleCopy}>{copied ? "✓ Copied" : "Copy"}</GhostBtn>
            <button
              onClick={handleRun}
              disabled={result.status === "running"}
              style={{
                background: "#166534",
                color: "#86efac",
                border: "1px solid #15803d33",
                borderRadius: 7,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: result.status === "running" ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: result.status === "running" ? 0.5 : 1,
              }}
            >
              ▶ Run
            </button>
            <button
              onClick={handleSubmit}
              disabled={result.status === "running"}
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                color: "#bfdbfe",
                border: "none",
                borderRadius: 7,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: result.status === "running" ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: result.status === "running" ? 0.5 : 1,
              }}
            >
              Submit
            </button>
          </div>

          {/* Code editor */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <CodeEditor language={language} value={code} onChange={setCode} theme="vs-dark" />
          </div>

          {/* Result panel */}
          <div
            style={{
              borderTop: "1px solid #1e2530",
              background: "#0b0f18",
              flexShrink: 0,
              height: resultCollapsed ? 38 : resultHeight,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {!resultCollapsed && (
              <div
                onMouseDown={handleVMouseDown}
                style={{
                  height: 4,
                  cursor: "row-resize",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#2563eb55")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              />
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 12px",
                height: 34,
                borderBottom: resultCollapsed ? "none" : "1px solid #1e2530",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: statusBar.color,
                  boxShadow: `0 0 6px ${statusBar.color}88`,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#334155", fontSize: 11 }}>Output</span>
              <span style={{ color: statusBar.color, fontSize: 11, fontWeight: 700 }}>
                {statusBar.text}
              </span>
              <span style={{ marginLeft: "auto" }} />
              <GhostBtn onClick={() => setResultCollapsed((x) => !x)}>
                {resultCollapsed ? "↑ Expand" : "↓ Collapse"}
              </GhostBtn>
            </div>

            {!resultCollapsed && (
              <div style={{ flex: 1, overflow: "auto", padding: "10px 14px", fontSize: 12, lineHeight: 1.7 }}>
                {result.status === "idle" && (
                  <span style={{ color: "#334155" }}>Run your code to see output.</span>
                )}
                {result.status === "running" && (
                  <span style={{ color: "#fb923c" }}>Executing…</span>
                )}
                {(result.status === "accepted" || result.status === "wrong_answer") && !submitResult && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, color: "#64748b" }}>
                    <Row label="Status" value={result.status === "accepted" ? "Accepted ✓" : "Wrong Answer ✗"} color={statusBar.color} />
                    <Row label="Runtime" value={result.time ? `${result.time}s` : "N/A"} />
                    <Row label="Output" value={result.output || "(empty)"} mono />
                    <Row label="Expected" value={result.expected || "(empty)"} mono />
                  </div>
                )}
                {submitResult && (
                  <div>
                    <div style={{ marginBottom: 10, color: submitResult.accepted ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                      {submitResult.passed}/{submitResult.total} test cases passed
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {submitResult.results.map((item) => (
                        <div
                          key={item.testcase}
                          style={{
                            border: "1px solid #1e2d3d",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 11,
                            color: item.status.id === 3 ? "#4ade80" : "#f87171",
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span style={{ color: "#334155" }}>Case {item.testcase}</span>
                          <span>{item.status.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.status === "error" && (
                  <div style={{ color: "#f87171" }}>{result.stderr || "Execution failed."}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* AI Assistant */}
        <AIAssistantPanel
          problem={
            problem
              ? {
                id: problem.id,
                title: problem.title,
                description: problem.description,
                samples: problem.samples,
              }
              : undefined
          }
          language={language}
          code={code}
          latestResult={aiStatusSummary}
        />
      </div>

      {/* Status bar */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 24,
          padding: "0 12px",
          borderTop: "1px solid #1e2530",
          background: "#080c14",
          color: "#1e2d3d",
          fontSize: 10,
          letterSpacing: 0.5,
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#334155" }}>{language === "python" ? "Python 3.8.1" : "C++ GCC 9.2.0"}</span>
        {problem && <span>{problem.slug}</span>}
        <span style={{ marginLeft: "auto" }}>{new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "#334155",
        margin: "16px 0 5px",
        textTransform: "uppercase",
        letterSpacing: 1.2,
      }}
    >
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #1e2d3d",
        borderRadius: 8,
        background: "#080c14",
        padding: "8px 12px",
      }}
    >
      <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontFamily: "inherit", marginTop: 4, color: "#64748b", fontSize: 12 }}>{value}</div>
    </div>
  );
}

function GhostBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "1px solid #1e2d3d",
        borderRadius: 6,
        color: "#475569",
        padding: "4px 10px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  color,
  mono,
}: {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ color: "#334155", minWidth: 60 }}>{label}</span>
      <span
        style={{
          color: color ?? "#94a3b8",
          fontFamily: mono ? "inherit" : undefined,
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

