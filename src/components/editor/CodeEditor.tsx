"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface Props {
  language?: string;
  value?: string;
  onChange?: (v: string) => void;
  theme?: "vs-dark" | "light";
  readOnly?: boolean;
}

declare global {
  interface Window {
    monaco: any;
    require: any;
    MonacoEnvironment: any;
    _monacoLoading: boolean;
  }
}

const CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs";

// Fetch worker script content and wrap in Blob to bypass CORS
async function createWorker(url: string): Promise<Worker> {
  const res = await fetch(url);
  const text = await res.text();
  const blob = new Blob([text], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

function loadMonaco(): Promise<void> {
  return new Promise((resolve) => {
    if (window.monaco) return resolve();

    // Prevent duplicate script injection (React StrictMode runs effects twice)
    if (window._monacoLoading) {
      const interval = setInterval(() => {
        if (window.monaco) { clearInterval(interval); resolve(); }
      }, 50);
      return;
    }

    window._monacoLoading = true;

    window.MonacoEnvironment = {
      getWorker: async (_moduleId: string, label: string) => {
        const workerMap: Record<string, string> = {
          json: `${CDN}/language/json/json.worker.js`,
          css: `${CDN}/language/css/css.worker.js`,
          scss: `${CDN}/language/css/css.worker.js`,
          less: `${CDN}/language/css/css.worker.js`,
          html: `${CDN}/language/html/html.worker.js`,
          typescript: `${CDN}/language/typescript/ts.worker.js`,
          javascript: `${CDN}/language/typescript/ts.worker.js`,
        };
        return createWorker(workerMap[label] ?? `${CDN}/editor/editor.worker.js`);
      },
    };

    const script = document.createElement("script");
    script.src = `${CDN}/loader.min.js`;
    script.onload = () => {
      window.require.config({ paths: { vs: CDN } });
      window.require(["vs/editor/editor.main"], resolve);
    };
    document.head.appendChild(script);
  });
}

export default function CodeEditor({
  language = "python",
  value = "",
  onChange,
  theme = "vs-dark",
  readOnly = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const subscriptionRef = useRef<any>(null);

  const initEditor = useCallback(() => {
    if (!containerRef.current || editorRef.current) return;

    editorRef.current = window.monaco.editor.create(containerRef.current, {
      value,
      language,
      theme,
      readOnly,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      lineNumbers: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 4,
      wordWrap: "off",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      padding: { top: 12, bottom: 12 },
      bracketPairColorization: { enabled: true },
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "on",
      tabCompletion: "on",
      wordBasedSuggestions: "currentDocument",
      parameterHints: { enabled: true },
    });

    subscriptionRef.current = editorRef.current.onDidChangeModelContent(() => {
      onChange?.(editorRef.current.getValue());
    });
    editorRef.current.typescript.javascriptDefaults.setEagerModelSync(true);
    editorRef.current.typescript.typescriptDefaults.setEagerModelSync(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMonaco().then(() => {
      if (!cancelled) initEditor();
    });
    return () => {
      cancelled = true;
      subscriptionRef.current?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model) window.monaco?.editor.setModelLanguage(model, language);
  }, [language]);

  useEffect(() => {
    window.monaco?.editor.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return <div ref={containerRef} className="w-full h-full" />;
}