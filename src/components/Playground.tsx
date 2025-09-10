import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import { transform as sucraseTransform } from "sucrase";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import { useTakumi } from "../hooks/useTakumi";
import { clsx } from "clsx";
import { Play, Download, RefreshCw, Bug, Trash2, Copy } from "lucide-react";
import "../playground.css";
import { twj } from "tw-to-css";

const DEFAULT_JSX = `
  <div style={{
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0b1020 0%, #1a213a 100%)",
  }}>
    <div style={{
      padding: 48,
      borderRadius: 24,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    }}>
      <div style={{ fontSize: 64, color: "#fff", fontWeight: 700 }}>Takumi Playground</div>
      <div style={{ fontSize: 24, color: "#B6C1FF", marginTop: 8 }}>Render PNG from JSX</div>
    </div>
  </div>
`;

export default function Playground() {
  const [jsxCode, setJsxCode] = useState<string>(DEFAULT_JSX);
  const width = 1200;
  const height = 630;
  const [format, setFormat] = useState<"png" | "webp">("png");
  const [autoRender, setAutoRender] = useState<boolean>(true);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);
  const [debounceMs, setDebounceMs] = useState<number>(400);

  // Debug logs state
  type LogLevel = "log" | "info" | "warn" | "error";
  type LogItem = { id: number; level: LogLevel; time: number; text: string };
  const [logs, setLogs] = useState<LogItem[]>([]);
  const logIdRef = useRef(0);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  const appendLog = useCallback((level: LogLevel, ...args: unknown[]) => {
    const id = ++logIdRef.current;
    const parts = args.map((a) => {
      if (a instanceof Error) {
        const name = a.name || "Error";
        const msg = a.message || String(a);
        const stack = typeof a.stack === "string" ? a.stack.split("\n").slice(1, 3).join("\n") : "";
        return stack ? `${name}: ${msg}\n${stack}` : `${name}: ${msg}`;
      }
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a, null, 2);
      } catch {
        return String(a);
      }
    });
    const text = parts.join(" ");
    setLogs([{ id, level, time: Date.now(), text }]);
  }, []);

  // Patch console methods to mirror into logs panel
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      appendLog("error", ...args);
      originalError.apply(console, args as any);
    };

    return () => {
      console.error = originalError;
    };
  }, [appendLog]);

  // Auto-scroll logs when new entries arrive
  useEffect(() => {
    if (!autoScrollLogs) return;
    const el = logsRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs, autoScrollLogs]);

  const {
    ready,
    initializing,
    error: initError,
    loadDefaultFonts,
    hasLoadedFontsRef,
    renderAsDataUrl,
  } = useTakumi();

  // Auto-load fonts on first ready
  useEffect(() => {
    if (ready && !hasLoadedFontsRef.current) {
      loadDefaultFonts();
    }
  }, [ready, hasLoadedFontsRef, loadDefaultFonts]);

  const lastSigRef = useRef<string>("");

  const doRender = useCallback(async () => {
    if (!ready) return;
    // Ensure fonts are loaded before any rendering starts
    if (!hasLoadedFontsRef.current) {
      try {
        await loadDefaultFonts();
      } catch (e) {
        // Keep warnings minimal but visible in browser console
        console.warn(
          "[PG] Failed to load fonts before render; proceeding anyway",
          e
        );
      }
    }
    setRendering(true);
    setError(null);
    try {
      const w = width;
      const h = height;
      const wrapped = `const __expr__ = ${jsxCode}`;

      // First, try to transform JSX. If this fails, it's a parse error.
      let compiled: string;
      try {
        compiled = sucraseTransform(wrapped, {
          transforms: ["jsx", "typescript"],
          jsxPragma: "React.createElement",
          jsxFragmentPragma: "React.Fragment",
        }).code;
      } catch (e: unknown) {
        // Attempt to extract line/column and adjust for wrapper prefix
        const msg = e instanceof Error ? e.message : String(e);
        let line: number | null = null;
        let column: number | null = null;
        const m = typeof msg === "string" ? msg.match(/(\d+):(\d+)/) : null;
        if (m) {
          line = Number(m[1]);
          column = Number(m[2]);
        }
        const prefix = "const __expr__ = ";
        const adjustedColumn = line === 1 && column != null ? Math.max(1, column - prefix.length) : column ?? null;
        const loc = line && adjustedColumn ? ` at ${line}:${adjustedColumn}` : "";
        const friendly = `JSX parse error${loc}: ${msg}`;
        appendLog("error", friendly);
        setError(friendly);
        return;
      }
      // Show only the converted (compiled) JSX in the logs panel as an error entry and trim for brevity
      const compiledPreview =
        compiled.length > 2048
          ? compiled.slice(0, 2048) + "\n/* ... trimmed ... */"
          : compiled;
      appendLog("info", "[PG][JSX] Converted JSX:", compiledPreview);
      const element = new Function(
        "React",
        "twj",
        `${compiled}; return __expr__;`
      )(React, twj) as React.ReactElement;
      const node = await fromJsx(element);
      const url = await renderAsDataUrl(node, w, h, format);
      setImgUrl(url);
    } catch (e: unknown) {
      // Log runtime/render errors to the debug panel as well
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      appendLog("error", `Render error: ${msg}`);
      console.error(e);
      setError(msg);
    } finally {
      setRendering(false);
    }
  }, [
    ready,
    jsxCode,
    width,
    height,
    format,
    renderAsDataUrl,
    hasLoadedFontsRef,
    loadDefaultFonts,
    appendLog,
  ]);

  // Debounced auto render
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRender || !ready) return;
    // Only re-render when input signature changes
    const sig = `jsx|${width}x${height}|${format}|${jsxCode}`;
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void doRender();
    }, debounceMs);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoRender, ready, doRender, jsxCode, width, height, format, debounceMs]);

  const canRender = ready && !initializing && !initError;

  const headerStatus = useMemo(() => {
    if (initializing) return "Initializing WASM...";
    if (!ready) return initError ? `Init Error: ${initError}` : "Not ready";
    return "Ready" + (hasLoadedFontsRef.current ? " • Fonts Loaded" : "");
  }, [initializing, ready, initError, hasLoadedFontsRef]);

  function downloadCurrent() {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `takumi-playground.${format}`;
    a.click();
  }

  return (
    <div className="pg-root">
      <header className="pg-header">
        <div className="pg-title">Takumi Playground</div>
        <div className="pg-controls">
          <div className="pg-field">
            <label>Format</label>
            <select
              value={format}
              onChange={(e) =>
                setFormat(
                  (e.target as HTMLSelectElement).value as "png" | "webp"
                )
              }
            >
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
          </div>
          <div className="pg-field">
            <label>Delay (ms)</label>
            <input
              type="number"
              min={0}
              step={50}
              value={debounceMs}
              onChange={(e) =>
                setDebounceMs(Math.max(0, Number(e.target.value) || 0))
              }
              title="Auto render debounce delay in milliseconds"
            />
          </div>
          <button
            className={clsx("pg-btn", { disabled: !canRender })}
            disabled={!canRender}
            onClick={doRender}
            title="Render"
          >
            <Play size={16} /> {rendering ? "Rendering..." : "Render"}
          </button>
          <button
            className="pg-btn"
            onClick={() => setAutoRender((v) => !v)}
            title="Toggle auto render"
          >
            <RefreshCw size={16} /> {autoRender ? "Auto" : "Manual"}
          </button>
          <button
            className={clsx("pg-btn", { disabled: !imgUrl })}
            disabled={!imgUrl}
            onClick={downloadCurrent}
          >
            <Download size={16} /> Download
          </button>
          <div className="pg-status">{headerStatus}</div>
        </div>
      </header>

      <PanelGroup direction="horizontal" className="pg-panels">
        <Panel defaultSize={50} minSize={25} className="pg-left">
          <div className="pg-editor">
            <Editor
              height="100%"
              value={jsxCode}
              theme="vs-dark"
              defaultLanguage="javascript"
              onChange={(v) => setJsxCode(v ?? "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: "on",
              }}
              keepCurrentModel
            />
          </div>
        </Panel>
        <PanelResizeHandle className="pg-resize" />
        <Panel defaultSize={50} minSize={25} className="pg-right">
          <PanelGroup direction="vertical" className="pg-right-split">
            <Panel defaultSize={70} minSize={40}>
              <div className="pg-preview">
                {error ? (
                  <div className="pg-error">{String(error)}</div>
                ) : imgUrl ? (
                  <img src={imgUrl} alt="Preview" />
                ) : (
                  <div className="pg-placeholder">Render to preview</div>
                )}
              </div>
            </Panel>
            <PanelResizeHandle className="pg-resize-vertical" />
            <Panel defaultSize={30} minSize={20}>
              <div className="pg-logs">
                <div className="pg-logs-header">
                  <div className="pg-logs-title">
                    <Bug size={14} /> Debug Logs
                  </div>
                  <div className="pg-logs-actions">
                    <label className="pg-logs-autoscroll">
                      <input
                        type="checkbox"
                        checked={autoScrollLogs}
                        onChange={(e) => setAutoScrollLogs(e.target.checked)}
                      />
                      Auto-scroll
                    </label>
                    <button
                      className="pg-btn pg-logs-btn"
                      title="Copy logs"
                      onClick={() => {
                        const text = logs
                          .map(
                            (l) =>
                              `${new Date(l.time).toLocaleTimeString()} [${
                                l.level
                              }] ${l.text}`
                          )
                          .join("\n");
                        navigator.clipboard?.writeText(text).catch(() => {});
                      }}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      className="pg-btn pg-logs-btn"
                      title="Clear logs"
                      onClick={() => setLogs([])}
                    >
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                </div>
                <div className="pg-logs-list" ref={logsRef}>
                  {logs.length === 0 ? (
                    <div className="pg-logs-empty">
                      No logs yet. Actions will appear here.
                    </div>
                  ) : (
                    logs.map((l) => (
                      <div
                        key={l.id}
                        className={clsx("pg-log-item", `pg-log-${l.level}`)}
                      >
                        <span className="pg-log-time">
                          {new Date(l.time).toLocaleTimeString()}
                        </span>
                        <span className="pg-log-level">[{l.level}]</span>
                        <span className="pg-log-text">{l.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
