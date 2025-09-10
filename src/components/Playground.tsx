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
import { Play, Download, RefreshCw, Bug, Trash2, Copy, Moon, Sun } from "lucide-react";
import "../playground.css";
import { twj } from "tw-to-css";

// Pretty-print a React element as JSX-like string for logging
function toJsxString(node: any, depth = 0): string {
  const indent = (n: number) => "  ".repeat(n);
  const maxLen = 4000;

  const formatString = (s: string): string => {
    // Compact long data URIs and very long strings to keep logs readable
    if (/^data:[^;]+;base64,/.test(s)) {
      const head = s.slice(0, 64);
      return `"${head}… (data uri, ${s.length} chars)"`;
    }
    const esc = s.replace(/"/g, '\\"');
    if (esc.length > 160) return `"${esc.slice(0, 160)}… (${esc.length} chars)"`;
    return `"${esc}"`;
  };

  const formatStyle = (style: any): string => {
    try {
      return JSON.stringify(style);
    } catch {
      return '{/* style */}';
    }
  };

  const formatProp = (key: string, value: any): string => {
    if (key === "children" || key === "key" || key === "ref") return "";
    if (value == null || typeof value === "boolean") {
      return value ? key : "";
    }
    if (typeof value === "string") {
      return `${key}=${formatString(value)}`;
    }
    if (key === "style" && typeof value === "object") {
      return `${key}={${formatStyle(value)}}`;
    }
    if (typeof value === "number") {
      return `${key}={${value}}`;
    }
    if (Array.isArray(value)) {
      return `${key}={[…]}`;
    }
    if (typeof value === "object") {
      return `${key}={…}`;
    }
    if (typeof value === "function") {
      return `${key}={fn}`;
    }
    return `${key}={…}`;
  };

  const formatProps = (props: any): string => {
    const parts: string[] = [];
    for (const k in props) {
      const s = formatProp(k, (props as any)[k]);
      if (s) parts.push(s);
    }
    return parts.length ? " " + parts.join(" ") : "";
  };

  const formatChildren = (children: any, d: number): string => {
    if (children == null || children === false) return "";
    if (typeof children === "string") return formatString(children);
    if (typeof children === "number") return String(children);
    if (Array.isArray(children)) {
      const inner = children
        .map((c) => toJsxString(c, d + 1))
        .filter(Boolean)
        .join("\n");
      return `\n${inner}\n${indent(d)}`;
    }
    return `\n${toJsxString(children, d + 1)}\n${indent(d)}`;
  };

  if (node == null || typeof node !== "object" || !React.isValidElement(node)) {
    if (typeof node === "string") return indent(depth) + formatString(node);
    if (typeof node === "number") return indent(depth) + String(node);
    return indent(depth) + String(node ?? "");
  }

  const el = node as React.ReactElement;
  const type = typeof el.type === "string" ? el.type : (el.type as any)?.name || "Component";
  const open = `<${type}${formatProps(el.props)}>`;
  const close = `</${type}>`;
  const children = formatChildren(el.props?.children, depth + 1);
  const singleLine = children === "";
  const out = singleLine
    ? `${indent(depth)}${open}${close}`
    : `${indent(depth)}${open}${children}${close}`;
  return out.length > maxLen ? out.slice(0, maxLen) + "\n/* … trimmed … */" : out;
}

// Create a Data URI from a Blob by base64-encoding its bytes
async function createObjectURL(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000; // encode in chunks to avoid large arg lists
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

// Walk a React element tree and inline <img src> URLs as Data URIs
async function inlineImageSources(
  element: React.ReactElement,
  opts?: { log?: (level: "info" | "warn" | "error" | "log", ...args: unknown[]) => void }
): Promise<React.ReactElement> {
  const log = opts?.log ?? (() => {});
  const isDataUri = (s: string) => /^data:/i.test(s);
  const cache = new Map<string, Promise<string>>();

  const fetchAsDataUrl = async (url: string): Promise<string> => {
    if (cache.has(url)) return cache.get(url)!;
    const p = (async () => {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const blob = await res.blob();
      return await createObjectURL(blob);
    })();
    cache.set(url, p);
    return p;
  };

  let replaced = 0;
  let failed = 0;

  const processNode = async (node: any): Promise<any> => {
    if (node == null || typeof node !== "object") return node;
    if (!React.isValidElement(node)) return node;
    const type = (node as React.ReactElement).type as any;
    const props: any = { ...(node as React.ReactElement).props };

    if (props.children !== undefined) {
      props.children = await processChildren(props.children);
    }

    if (typeof type === "string" && type.toLowerCase() === "img") {
      const src: unknown = props.src;
      if (typeof src === "string" && src && !isDataUri(src)) {
        try {
          props.src = await fetchAsDataUrl(src);
          replaced += 1;
        } catch (e) {
          failed += 1;
          log(
            "warn",
            "[IMG] Failed to inline",
            String(src),
            "=>",
            e instanceof Error ? e.message : String(e)
          );
        }
      }
    }

    return React.cloneElement(node as React.ReactElement, props);
  };

  const processChildren = async (children: any): Promise<any> => {
    if (Array.isArray(children)) return Promise.all(children.map((c) => processNode(c)));
    return processNode(children);
  };

  const out = await processNode(element);
  if (replaced || failed) {
    log("info", `[PG][IMG] Inlined ${replaced} image(s)` + (failed ? `, ${failed} failed` : ""));
  }
  return out;
}

const DEFAULT_JSX = `<div style={twj("h-full w-full flex items-start justify-start bg-white")}>
  <div style={twj("flex items-start justify-start h-full w-full relative")}>
    <img
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ objectFit: "cover" } }}
      src="https://picsum.photos/seed/picsum/1200/630"
    />
    <div
      style={{ ...twj("absolute inset-0 w-full h-full"), ...{ backgroundColor: "rgba(0,0,0,0.6)" } }}
    ></div>
    <div style={twj("flex items-center justify-center w-full h-full absolute inset-0")}>
      <div style={twj("text-[80px] text-white font-black text-center mx-20")}>
        Takumi Playground
      </div>
    </div>
  </div>
</div>`;

export default function Playground() {
  const [jsxCode, setJsxCode] = useState<string>(DEFAULT_JSX);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
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
    const entry: LogItem = { id, level, time: Date.now(), text };
    setLogs((prev) => [...prev, entry]);
  }, []);

  // Patch console methods to mirror into logs panel
  useEffect(() => {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    console.log = (...args: unknown[]) => {
      appendLog("log", ...args);
      original.log.apply(console, args as any);
    };
    console.info = (...args: unknown[]) => {
      appendLog("info", ...args);
      original.info.apply(console, args as any);
    };
    console.warn = (...args: unknown[]) => {
      appendLog("warn", ...args);
      original.warn.apply(console, args as any);
    };
    console.error = (...args: unknown[]) => {
      appendLog("error", ...args);
      original.error.apply(console, args as any);
    };

    return () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
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
    // Start a fresh log set for this render
    setLogs([]);
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
      const rawElement = new Function(
        "React",
        "twj",
        `${compiled}; return __expr__;`
      )(React, twj) as React.ReactElement;
      // Inline image URLs to data URIs before converting to Takumi node
      const element = await inlineImageSources(rawElement, { log: appendLog });
      // Log final JSX-like output after twj and inlining
      appendLog("info", "[PG][JSX] Final JSX:", "\n" + toJsxString(element));
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

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  return (
    <div className="pg-root" data-theme={theme}>
      <header className="pg-header">
        <div className="pg-title">Takumi Playground</div>
        <div className="pg-controls">
          <div className="pg-status">{headerStatus}</div>
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
            className="pg-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle theme"
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />} {theme === "dark" ? "Dark" : "Light"}
          </button>
          <button
            className={clsx("pg-btn", { disabled: !imgUrl })}
            disabled={!imgUrl}
            onClick={downloadCurrent}
          >
            <Download size={16} /> Download
          </button>
        </div>
      </header>

      <PanelGroup direction="horizontal" className="pg-panels">
        <Panel defaultSize={50} minSize={25} className="pg-left">
          <div className="pg-editor">
            <Editor
              height="100%"
              value={jsxCode}
              theme={editorTheme}
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
