"use client";

import React, { useState, useRef } from "react";
import CodeEditor from "@/components/editor/CodeEditor";
import useProblems from "@/hooks/useProblems";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

const LANGUAGE_ID: Record<string, number> = {
    cpp: 54,
    python: 71,
};

const difficultyConfig: Record<string, { label: string; color: string; bg: string }> = {
    easy: { label: "Easy", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    hard: { label: "Hard", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const STARTER: Record<string, string> = {
    python: ``,
    cpp: ``,
};

export default function ProblemEditorPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.slug as string;

    const { data, loading } = useProblems({ id });

    const [language, setLanguage] = useState("python");
    const [code, setCode] = useState(STARTER.python);
    const [activeTab, setActiveTab] = useState<"description" | "samples">("description");
    const [copied, setCopied] = useState(false);

    // Panel layout state
    const [leftWidth, setLeftWidth] = useState(42);
    const [resultHeight, setResultHeight] = useState(160);
    const [resultCollapsed, setResultCollapsed] = useState(false);
    const [leftCollapsed, setLeftCollapsed] = useState(false);

    // Drag refs
    const isDraggingH = useRef(false);
    const isDraggingV = useRef(false);

    // Result state
    const [submitResult, setSubmitResult] = useState<{
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
    } | null>(null);

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

    // ── Resize handlers ──────────────────────────────────────────
    const handleHMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingH.current = true;
        const startX = e.clientX;
        const startWidth = leftWidth;
        const totalWidth = document.body.clientWidth;

        const onMove = (e: MouseEvent) => {
            if (!isDraggingH.current) return;
            const delta = e.clientX - startX;
            const newWidth = Math.min(65, Math.max(15, startWidth + (delta / totalWidth) * 100));
            setLeftWidth(newWidth);
        };
        const onUp = () => {
            isDraggingH.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const handleVMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingV.current = true;
        const startY = e.clientY;
        const startHeight = resultHeight;

        const onMove = (e: MouseEvent) => {
            if (!isDraggingV.current) return;
            const delta = startY - e.clientY;
            setResultHeight(Math.min(420, Math.max(80, startHeight + delta)));
        };
        const onUp = () => {
            isDraggingV.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };
    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        setCode(STARTER[lang] ?? "");
    };

    const handleRun = async () => {
        setResult({ status: "running" });
        setSubmitResult(null);
        try {
            const response = await api.post("/run", {
                problem_id: problem.id,
                source_code: code,
                language_id: LANGUAGE_ID[language],
            });
            const data = response.data;
            setResult({
                status: data.status.id === 3 ? "accepted" : "wrong_answer",
                output: data.stdout ?? "",
                expected: data.expected ?? "",
                stderr: data.stderr,
                compile_output: data.compile_output,
                time: data.time,
            });
        } catch {
            setResult({ status: "error" });
        }
    };

    const handleSubmit = async () => {
        setResult({ status: "running" });
        setSubmitResult(null);
        try {
            const response = await api.post("/submit", {
                problem_id: problem.id,
                source_code: code,
                language_id: LANGUAGE_ID[language],
            });
            const data = response.data;
            setSubmitResult(data);
            setResult({ status: data.accepted ? "accepted" : "wrong_answer" });
        } catch {
            setResult({ status: "error" });
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const statusBar = ({
        idle:         { text: "Ready",         color: "#6b7280" },
        running:      { text: "Running…",       color: "#f59e0b" },
        accepted:     { text: "Accepted",       color: "#22c55e" },
        wrong_answer: { text: "Wrong Answer",   color: "#ef4444" },
        error:        { text: "Runtime Error",  color: "#ef4444" },
    } as const)[result.status] ?? { text: "Ready", color: "#6b7280" };

    if (loading) return (
        <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0d1117", color: "#6b7280", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
            <span style={{ animation: "pulse 1.4s ease-in-out infinite" }}>Loading problem…</span>
        </div>
    );

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #484f58; }

        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .page  { display:flex; flex-direction:column; height:100vh; background:#0d1117; font-family:'DM Sans',sans-serif; color:#e6edf3; overflow:hidden; }

        /* ── TOP NAV ── */
        .nav { display:flex; align-items:center; gap:12px; padding:0 16px; height:44px; background:#161b22; border-bottom:1px solid #21262d; flex-shrink:0; }
        .nav-back { display:flex; align-items:center; gap:6px; background:none; border:none; color:#8b949e; font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; padding:4px 8px; border-radius:6px; transition:all .15s; }
        .nav-back:hover { background:#21262d; color:#e6edf3; }
        .nav-title { color:#e6edf3; font-size:14px; font-weight:600; }
        .nav-sep { color:#30363d; }
        .nav-slug { color:#8b949e; font-size:13px; font-family:'JetBrains Mono',monospace; }
        .nav-spacer { flex:1; }
        .nav-diff { font-size:12px; font-weight:600; padding:3px 10px; border-radius:99px; }

        /* ── MAIN BODY ── */
        .body { display:flex; flex:1; overflow:hidden; }

        /* ── LEFT PANEL ── */
        .left { display:flex; flex-direction:column; border-right:1px solid #21262d; overflow:hidden; background:#0d1117; flex-shrink:0; }

        .tabs { display:flex; gap:0; border-bottom:1px solid #21262d; flex-shrink:0; }
        .tab { padding:10px 18px; font-size:13px; font-weight:500; color:#8b949e; cursor:pointer; border-bottom:2px solid transparent; transition:all .15s; background:none; border-top:none; border-left:none; border-right:none; white-space:nowrap; }
        .tab:hover { color:#e6edf3; }
        .tab.active { color:#58a6ff; border-bottom-color:#58a6ff; }

        .left-scroll { flex:1; overflow-y:auto; padding:24px; animation:fadeIn .3s ease; }

        .problem-num   { font-family:'JetBrains Mono',monospace; font-size:12px; color:#8b949e; margin-bottom:6px; }
        .problem-title { font-size:22px; font-weight:700; color:#e6edf3; line-height:1.2; margin-bottom:14px; letter-spacing:-.3px; }

        .tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px; }
        .tag  { font-size:11px; font-weight:600; padding:3px 9px; border-radius:99px; background:#21262d; color:#8b949e; letter-spacing:.5px; text-transform:uppercase; }

        .section-label { font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#6b7280; margin-bottom:8px; margin-top:20px; }
        .description   { font-size:14px; line-height:1.75; color:#c9d1d9; white-space:pre-wrap; }

        .sample-card { background:#161b22; border:1px solid #21262d; border-radius:10px; padding:16px; margin-bottom:12px; }
        .sample-row  { display:flex; gap:6px; margin-bottom:8px; align-items:flex-start; }
        .sample-row:last-child { margin-bottom:0; }
        .sample-key  { font-size:11px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:.8px; min-width:70px; padding-top:2px; }
        .sample-val  { font-family:'JetBrains Mono',monospace; font-size:13px; color:#e6edf3; background:#0d1117; padding:6px 10px; border-radius:6px; flex:1; white-space:pre-wrap; line-height:1.5; }
        .sample-explanation { font-size:13px; color:#8b949e; margin-top:8px; padding-top:8px; border-top:1px solid #21262d; }

        .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px; }
        .meta-card  { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:12px; }
        .meta-card-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; font-weight:700; margin-bottom:4px; }
        .meta-card-val   { font-size:14px; font-weight:600; color:#c9d1d9; font-family:'JetBrains Mono',monospace; }

        .constraints-box { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:14px; margin-top:12px; font-family:'JetBrains Mono',monospace; font-size:12.5px; color:#8b949e; white-space:pre-wrap; line-height:1.8; }

        /* ── RESIZERS ── */
        .resizer-h { width:4px; background:transparent; cursor:col-resize; flex-shrink:0; transition:background .15s; position:relative; z-index:10; user-select:none; }
        .resizer-h::after { content:''; position:absolute; inset:-3px 0; }
        .resizer-h:hover, .resizer-h:active { background:#58a6ff66; }
        .resizer-v { height:4px; background:transparent; cursor:row-resize; flex-shrink:0; transition:background .15s; user-select:none; }
        .resizer-v:hover, .resizer-v:active { background:#58a6ff66; }

        /* ── COLLAPSE BUTTON ── */
        .collapse-btn { background:none; border:none; color:#6b7280; cursor:pointer; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600; transition:all .15s; line-height:1; }
        .collapse-btn:hover { color:#e6edf3; background:#21262d; }

        /* ── RIGHT PANEL ── */
        .right { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

        .toolbar { display:flex; align-items:center; gap:8px; padding:6px 12px; background:#161b22; border-bottom:1px solid #21262d; flex-shrink:0; }
        .lang-select { background:#21262d; border:1px solid #30363d; color:#e6edf3; font-family:'JetBrains Mono',monospace; font-size:13px; padding:5px 10px; border-radius:6px; cursor:pointer; outline:none; transition:border .15s; }
        .lang-select:hover, .lang-select:focus { border-color:#58a6ff; }
        .toolbar-spacer { flex:1; }
        .btn { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:7px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .15s; font-family:'DM Sans',sans-serif; white-space:nowrap; }
        .btn-ghost  { background:#21262d; color:#8b949e; }
        .btn-ghost:hover { background:#30363d; color:#e6edf3; }
        .btn-run    { background:#238636; color:#fff; }
        .btn-run:hover { background:#2ea043; }
        .btn-run:disabled, .btn-submit:disabled { opacity:.5; cursor:not-allowed; }
        .btn-submit { background:#1f6feb; color:#fff; }
        .btn-submit:hover:not(:disabled) { background:#388bfd; }

        .editor-wrap { flex:1; overflow:hidden; position:relative; }

        /* ── RESULT PANEL ── */
        .result-panel  { border-top:1px solid #21262d; background:#161b22; display:flex; flex-direction:column; flex-shrink:0; overflow:hidden; transition:height .1s; }
        .result-header { display:flex; align-items:center; gap:8px; padding:6px 14px; border-bottom:1px solid #21262d; flex-shrink:0; height:32px; }
        .result-title  { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b7280; }
        .status-dot    { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .result-body   { flex:1; overflow-y:auto; padding:12px 14px; }

        .result-idle    { color:#6b7280; font-size:13px; font-style:italic; }
        .result-running { display:flex; align-items:center; gap:10px; color:#f59e0b; font-size:13px; }
        .spinner { width:14px; height:14px; border:2px solid rgba(245,158,11,.3); border-top-color:#f59e0b; border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }
        .spinner-white { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }

        .result-grid   { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; align-items:start; animation:fadeIn .25s; }
        .result-label  { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280; font-weight:700; padding-top:2px; white-space:nowrap; }
        .result-value  { font-family:'JetBrains Mono',monospace; font-size:13px; color:#c9d1d9; word-break:break-all; }
        .result-status-text { font-size:14px; font-weight:700; }

        .tc-row { display:flex; align-items:center; gap:8px; background:#0d1117; border-radius:6px; padding:6px 10px; }

        /* ── STATUS BAR ── */
        .statusbar      { display:flex; align-items:center; gap:16px; padding:0 14px; height:24px; background:#0d1117; border-top:1px solid #21262d; flex-shrink:0; }
        .statusbar-item { font-family:'JetBrains Mono',monospace; font-size:11px; color:#6b7280; }
      `}</style>

            <div className="page">
                {/* NAV */}
                <nav className="nav">
                    <button className="nav-back" onClick={() => router.back()}>← Back</button>
                    <span className="nav-sep">›</span>
                    {problem && <>
                        <span className="nav-title">{problem.title}</span>
                        <span className="nav-sep">·</span>
                        <span className="nav-slug">{problem.slug}</span>
                    </>}
                    <span className="nav-spacer" />
                    {diff && (
                        <span className="nav-diff" style={{ color: diff.color, background: diff.bg }}>
                            {diff.label}
                        </span>
                    )}
                </nav>

                {/* BODY */}
                <div className="body">

                    {/* LEFT: Problem Info */}
                    {!leftCollapsed && (
                        <div className="left" style={{ width: `${leftWidth}%` }}>
                            <div className="tabs">
                                <button className={`tab${activeTab === "description" ? " active" : ""}`} onClick={() => setActiveTab("description")}>Description</button>
                                <button className={`tab${activeTab === "samples" ? " active" : ""}`} onClick={() => setActiveTab("samples")}>Examples</button>
                            </div>

                            <div className="left-scroll">
                                {problem && activeTab === "description" && (
                                    <>
                                        <div className="problem-num">#{problem.id.slice(-4).toUpperCase()}</div>
                                        <div className="problem-title">{problem.title}</div>

                                        <div className="tags">
                                            {problem.tags?.map((t: string) => (
                                                <span key={t} className="tag">{t}</span>
                                            ))}
                                        </div>

                                        <div className="section-label">Problem</div>
                                        <div className="description">{problem.description}</div>

                                        {problem.input_format && <>
                                            <div className="section-label">Input Format</div>
                                            <div className="description">{problem.input_format}</div>
                                        </>}

                                        {problem.output_format && <>
                                            <div className="section-label">Output Format</div>
                                            <div className="description">{problem.output_format}</div>
                                        </>}

                                        {problem.constraints && <>
                                            <div className="section-label">Constraints</div>
                                            <div className="constraints-box">{problem.constraints}</div>
                                        </>}

                                        <div className="meta-grid">
                                            <div className="meta-card">
                                                <div className="meta-card-label">Time Limit</div>
                                                <div className="meta-card-val">{problem.time_limit} ms</div>
                                            </div>
                                            <div className="meta-card">
                                                <div className="meta-card-label">Memory</div>
                                                <div className="meta-card-val">{problem.memory_limit} MB</div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {problem && activeTab === "samples" && (
                                    <>
                                        <div className="problem-title" style={{ fontSize: 16, marginBottom: 16 }}>Examples</div>
                                        {problem.samples?.map((s: any, i: number) => (
                                            <div key={s._id ?? i} className="sample-card">
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 12 }}>
                                                    Example {i + 1}
                                                </div>
                                                <div className="sample-row">
                                                    <span className="sample-key">Input</span>
                                                    <span className="sample-val">{s.input}</span>
                                                </div>
                                                <div className="sample-row">
                                                    <span className="sample-key">Output</span>
                                                    <span className="sample-val">{s.output}</span>
                                                </div>
                                                {s.explanation && (
                                                    <div className="sample-explanation">💡 {s.explanation}</div>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Horizontal Resizer */}
                    <div className="resizer-h" onMouseDown={handleHMouseDown} />

                    {/* RIGHT: Editor */}
                    <div className="right">
                        {/* Toolbar */}
                        <div className="toolbar">
                            {/* Left panel toggle */}
                            <button
                                className="collapse-btn"
                                onClick={() => setLeftCollapsed(v => !v)}
                                title={leftCollapsed ? "Show problem panel" : "Hide problem panel"}
                            >
                                {leftCollapsed ? "▶ Problem" : "◀"}
                            </button>

                            <div style={{ width: 1, height: 16, background: "#30363d" }} />

                            <select className="lang-select" value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
                                <option value="python">Python (3.8.1)</option>
                                <option value="cpp">C++ (GCC 9.2.0)</option>
                            </select>

                            <div className="toolbar-spacer" />

                            <button className="btn btn-ghost" onClick={handleCopy}>
                                {copied ? "✓ Copied" : "Copy"}
                            </button>

                            <button
                                className="btn btn-run"
                                onClick={handleRun}
                                disabled={result.status === "running"}
                            >
                                {result.status === "running"
                                    ? <><div className="spinner" /> Running</>
                                    : "▶ Run"}
                            </button>

                            <button
                                className="btn btn-submit"
                                onClick={handleSubmit}
                                disabled={result.status === "running"}
                            >
                                {result.status === "running"
                                    ? <><div className="spinner-white" /> Judging</>
                                    : "Submit"}
                            </button>
                        </div>

                        {/* Editor */}
                        <div className="editor-wrap">
                            <CodeEditor
                                language={language}
                                value={code}
                                onChange={(v) => setCode(v)}
                                theme="vs-dark"
                            />
                        </div>

                        {/* Result Panel */}
                        <div
                            className="result-panel"
                            style={{ height: resultCollapsed ? 32 : resultHeight }}
                        >
                            {/* Vertical resizer — only when expanded */}
                            {!resultCollapsed && (
                                <div className="resizer-v" onMouseDown={handleVMouseDown} />
                            )}

                            {/* Header */}
                            <div className="result-header">
                                <div className="status-dot" style={{ background: statusBar.color }} />
                                <span className="result-title">Output</span>
                                <span style={{ fontSize: 12, color: statusBar.color, fontWeight: 600, marginLeft: 4 }}>
                                    {statusBar.text}
                                </span>
                                <span style={{ flex: 1 }} />
                                <button
                                    className="collapse-btn"
                                    onClick={() => setResultCollapsed(v => !v)}
                                    title={resultCollapsed ? "Expand output" : "Collapse output"}
                                >
                                    {resultCollapsed ? "▲" : "▼"}
                                </button>
                            </div>

                            {/* Body — hidden when collapsed */}
                            {!resultCollapsed && (
                                <div className="result-body">
                                    {result.status === "idle" && (
                                        <div className="result-idle">Run your code to see output here.</div>
                                    )}

                                    {result.status === "running" && (
                                        <div className="result-running">
                                            <div className="spinner" />
                                            Executing…
                                        </div>
                                    )}

                                    {/* Run 結果 */}
                                    {(result.status === "accepted" || result.status === "wrong_answer") && !submitResult && (
                                        <div className="result-grid">
                                            <span className="result-label">Status</span>
                                            <span className="result-status-text" style={{ color: result.status === "accepted" ? "#22c55e" : "#ef4444" }}>
                                                {result.status === "accepted" ? "✓ Accepted" : "✗ Wrong Answer"}
                                            </span>

                                            <span className="result-label">Runtime</span>
                                            <span className="result-value">{result.time ?? "—"} s</span>

                                            <span className="result-label">Output</span>
                                            <span className="result-value">{result.output || "—"}</span>

                                            <span className="result-label">Expected</span>
                                            <span className="result-value">{result.expected || "—"}</span>

                                            {result.stderr && <>
                                                <span className="result-label">Stderr</span>
                                                <span className="result-value" style={{ color: "#f87171" }}>{result.stderr}</span>
                                            </>}
                                            {result.compile_output && <>
                                                <span className="result-label">Compile</span>
                                                <span className="result-value" style={{ color: "#f87171" }}>{result.compile_output}</span>
                                            </>}
                                        </div>
                                    )}

                                    {/* Submit 結果 */}
                                    {submitResult && (result.status === "accepted" || result.status === "wrong_answer") && (
                                        <div style={{ animation: "fadeIn .25s" }}>
                                            {/* 總覽 */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                                <span className="result-status-text" style={{ color: result.status === "accepted" ? "#22c55e" : "#ef4444" }}>
                                                    {result.status === "accepted" ? "✓ Accepted" : "✗ Wrong Answer"}
                                                </span>
                                                <span style={{ fontSize: 12, color: "#8b949e", fontFamily: "'JetBrains Mono',monospace" }}>
                                                    {submitResult.passed} / {submitResult.total} passed
                                                </span>
                                            </div>

                                            {/* 每個 testcase */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                                {submitResult.results.map((r) => {
                                                    const passed = r.status.id === 3;
                                                    return (
                                                        <div
                                                            key={r.testcase}
                                                            className="tc-row"
                                                            style={{ border: `1px solid ${passed ? "#1e4620" : "#4a1515"}` }}
                                                        >
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: passed ? "#22c55e" : "#ef4444", fontFamily: "'JetBrains Mono',monospace", minWidth: 14 }}>
                                                                {passed ? "✓" : "✗"}
                                                            </span>
                                                            <span style={{ fontSize: 12, color: "#8b949e" }}>Case {r.testcase}</span>
                                                            <span style={{ fontSize: 12, color: passed ? "#22c55e" : "#ef4444" }}>
                                                                {r.status.description}
                                                            </span>
                                                            {r.time && (
                                                                <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace" }}>
                                                                    {r.time}s
                                                                </span>
                                                            )}
                                                            {!passed && r.stdout && (
                                                                <span style={{ fontSize: 11, color: "#8b949e", fontFamily: "'JetBrains Mono',monospace", marginLeft: r.time ? 0 : "auto" }}>
                                                                    got: {r.stdout.trim()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {result.status === "error" && (
                                        <div style={{ color: "#ef4444", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
                                            {result.stderr || result.compile_output || result.output || "An error occurred."}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* STATUS BAR */}
                <div className="statusbar">
                    <span className="statusbar-item">{language === "python" ? "Python 3.8.1" : "C++ GCC 9.2.0"}</span>
                    {problem && <span className="statusbar-item">{problem.slug}</span>}
                    <span style={{ flex: 1 }} />
                    <span className="statusbar-item">{new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </>
    );
}