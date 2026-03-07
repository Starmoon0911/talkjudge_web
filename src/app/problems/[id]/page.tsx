"use client";

import React, { useState, useEffect } from "react";
import CodeEditor from "@/components/editor/CodeEditor";
import useProblems from "@/hooks/useProblems";
import { useRouter, useParams } from "next/navigation";

const difficultyConfig: Record<string, { label: string; color: string; bg: string }> = {
    easy: { label: "Easy", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    hard: { label: "Hard", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const STARTER: Record<string, string> = {
    python: `class Solution:\n    def solve(self):\n        pass\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        \n    }\n};\n`,
};

export default function ProblemEditorPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.slug as string;

    const { data, loading } = useProblems({ id });

    const [language, setLanguage] = useState("python");
    const [code, setCode] = useState(STARTER.python);
    const [activeTab, setActiveTab] = useState<"description" | "samples">("description");
    const [result, setResult] = useState<{ status: "idle" | "running" | "accepted" | "wrong" | "error"; output?: string; expected?: string; time?: number }>({ status: "idle" });
    const [copied, setCopied] = useState(false);

    const problem = data?.[0];
    const diff = problem ? difficultyConfig[problem.difficulty] ?? difficultyConfig.easy : null;

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        setCode(STARTER[lang] ?? "");
    };

    const handleRun = async () => {
        setResult({ status: "running" });
        // Simulate execution — replace with real API call
        await new Promise((r) => setTimeout(r, 1200));
        setResult({ status: "accepted", output: problem?.samples?.[0]?.output ?? "—", expected: problem?.samples?.[0]?.output ?? "—", time: 42 });
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const statusBar = {
        idle: { text: "Ready", color: "#6b7280" },
        running: { text: "Running…", color: "#f59e0b" },
        accepted: { text: "Accepted", color: "#22c55e" },
        wrong: { text: "Wrong Answer", color: "#ef4444" },
        error: { text: "Runtime Error", color: "#ef4444" },
    }[result.status];

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

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .page { display:flex; flex-direction:column; height:100vh; background:#0d1117; font-family:'DM Sans',sans-serif; color:#e6edf3; }

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
        .left { width:42%; min-width:320px; display:flex; flex-direction:column; border-right:1px solid #21262d; overflow:hidden; background:#0d1117; }

        .tabs { display:flex; gap:0; border-bottom:1px solid #21262d; flex-shrink:0; }
        .tab { padding:10px 18px; font-size:13px; font-weight:500; color:#8b949e; cursor:pointer; border-bottom:2px solid transparent; transition:all .15s; background:none; border-top:none; border-left:none; border-right:none; }
        .tab:hover { color:#e6edf3; }
        .tab.active { color:#58a6ff; border-bottom-color:#58a6ff; }

        .left-scroll { flex:1; overflow-y:auto; padding:24px; animation:fadeIn .3s ease; }

        .problem-num { font-family:'JetBrains Mono',monospace; font-size:12px; color:#8b949e; margin-bottom:6px; }
        .problem-title { font-size:22px; font-weight:700; color:#e6edf3; line-height:1.2; margin-bottom:14px; letter-spacing:-.3px; }

        .tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px; }
        .tag { font-size:11px; font-weight:600; padding:3px 9px; border-radius:99px; background:#21262d; color:#8b949e; letter-spacing:.5px; text-transform:uppercase; }

        .section-label { font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#6b7280; margin-bottom:8px; margin-top:20px; }
        .description { font-size:14px; line-height:1.75; color:#c9d1d9; white-space:pre-wrap; }

        .sample-card { background:#161b22; border:1px solid #21262d; border-radius:10px; padding:16px; margin-bottom:12px; }
        .sample-row { display:flex; gap:6px; margin-bottom:8px; align-items:flex-start; }
        .sample-row:last-child { margin-bottom:0; }
        .sample-key { font-size:11px; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:.8px; min-width:70px; padding-top:2px; }
        .sample-val { font-family:'JetBrains Mono',monospace; font-size:13px; color:#e6edf3; background:#0d1117; padding:6px 10px; border-radius:6px; flex:1; white-space:pre-wrap; line-height:1.5; }
        .sample-explanation { font-size:13px; color:#8b949e; margin-top:8px; padding-top:8px; border-top:1px solid #21262d; }

        .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px; }
        .meta-card { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:12px; }
        .meta-card-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; font-weight:700; margin-bottom:4px; }
        .meta-card-val { font-size:14px; font-weight:600; color:#c9d1d9; font-family:'JetBrains Mono',monospace; }

        .constraints-box { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:14px; margin-top:12px; font-family:'JetBrains Mono',monospace; font-size:12.5px; color:#8b949e; white-space:pre-wrap; line-height:1.8; }

        /* ── RIGHT PANEL ── */
        .right { flex:1; display:flex; flex-direction:column; overflow:hidden; }

        .toolbar { display:flex; align-items:center; gap:10px; padding:8px 12px; background:#161b22; border-bottom:1px solid #21262d; flex-shrink:0; }
        .lang-select { background:#21262d; border:1px solid #30363d; color:#e6edf3; font-family:'JetBrains Mono',monospace; font-size:13px; padding:5px 10px; border-radius:6px; cursor:pointer; outline:none; transition:border .15s; }
        .lang-select:hover, .lang-select:focus { border-color:#58a6ff; }
        .toolbar-spacer { flex:1; }
        .btn { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:7px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .15s; font-family:'DM Sans',sans-serif; }
        .btn-ghost { background:#21262d; color:#8b949e; }
        .btn-ghost:hover { background:#30363d; color:#e6edf3; }
        .btn-run { background:#238636; color:#fff; }
        .btn-run:hover { background:#2ea043; }
        .btn-run:disabled { background:#1a3a25; color:#3d6b4a; cursor:not-allowed; }
        .btn-submit { background:#1f6feb; color:#fff; }
        .btn-submit:hover { background:#388bfd; }

        .editor-wrap { flex:1; overflow:hidden; position:relative; }

        /* ── RESULT PANEL ── */
        .result-panel { height:160px; border-top:1px solid #21262d; background:#161b22; display:flex; flex-direction:column; flex-shrink:0; }
        .result-header { display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid #21262d; }
        .result-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6b7280; }
        .status-dot { width:7px; height:7px; border-radius:50%; }
        .result-body { flex:1; overflow-y:auto; padding:12px 14px; }

        .result-idle { color:#6b7280; font-size:13px; font-style:italic; }
        .result-running { display:flex; align-items:center; gap:10px; color:#f59e0b; font-size:13px; }
        .spinner { width:14px; height:14px; border:2px solid #f59e0b44; border-top-color:#f59e0b; border-radius:50%; animation:spin .7s linear infinite; }
        .result-grid { display:grid; grid-template-columns:repeat(3,auto) 1fr; gap:8px 20px; align-items:center; animation:fadeIn .25s; }
        .result-label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#6b7280; font-weight:700; }
        .result-value { font-family:'JetBrains Mono',monospace; font-size:13px; color:#c9d1d9; }
        .result-status-text { font-size:14px; font-weight:700; }

        /* ── STATUS BAR ── */
        .statusbar { display:flex; align-items:center; gap:16px; padding:0 14px; height:24px; background:#0d1117; border-top:1px solid #21262d; flex-shrink:0; }
        .statusbar-item { font-family:'JetBrains Mono',monospace; font-size:11px; color:#6b7280; }
      `}</style>

            <div className="page">
                {/* NAV */}
                <nav className="nav">
                    <button className="nav-back" onClick={() => router.back()}>
                        ← Back
                    </button>
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
                    <div className="left">
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

                    {/* RIGHT: Editor */}
                    <div className="right">
                        {/* Toolbar */}
                        <div className="toolbar">
                            <select
                                className="lang-select"
                                value={language}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                            >
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
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

                            <button className="btn btn-submit">Submit</button>
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

                        {/* Result */}
                        <div className="result-panel">
                            <div className="result-header">
                                <div
                                    className="status-dot"
                                    style={{ background: statusBar.color }}
                                />
                                <span className="result-title">Output</span>
                                <span style={{ fontSize: 12, color: statusBar.color, fontWeight: 600, marginLeft: 4 }}>
                                    {statusBar.text}
                                </span>
                            </div>
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
                                {(result.status === "accepted" || result.status === "wrong") && (
                                    <div className="result-grid">
                                        <span className="result-label">Status</span>
                                        <span
                                            className="result-status-text"
                                            style={{ color: result.status === "accepted" ? "#22c55e" : "#ef4444" }}
                                        >
                                            {result.status === "accepted" ? "✓ Accepted" : "✗ Wrong Answer"}
                                        </span>

                                        <span className="result-label">Runtime</span>
                                        <span className="result-value">{result.time} ms</span>

                                        <span className="result-label">Output</span>
                                        <span className="result-value">{result.output}</span>

                                        <span className="result-label">Expected</span>
                                        <span className="result-value">{result.expected}</span>
                                    </div>
                                )}
                                {result.status === "error" && (
                                    <div style={{ color: "#ef4444", fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                                        {result.output ?? "An error occurred."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* STATUS BAR */}
                <div className="statusbar">
                    <span className="statusbar-item">{language === "python" ? "Python 3.11" : "C++17"}</span>
                    {problem && <span className="statusbar-item">{problem.slug}</span>}
                    <span style={{ flex: 1 }} />
                    <span className="statusbar-item">{new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </>
    );
}
