import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as ReactJSXRuntime from "react/jsx-runtime";
import * as ReactJSXDevRuntime from "react/jsx-dev-runtime";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTakumi } from "../hooks/useTakumi";
import "../playground.css";
import { toJsxString } from "../utils/jsxDebug";
import { inlineImageSources } from "../utils/inlineImages";
import PlaygroundHeader from "./playground/Header";
import CodeEditor from "./playground/CodeEditor";
import Preview from "./playground/Preview";
import LogsPanel from "./playground/LogsPanel";
import { DEFAULT_JSX } from "./playground/defaultJsx";
import { DEFAULT_JS } from "./playground/defaultJs";
import type { LogItem, LogLevel } from "./playground/types";
import type { AnyNode } from "@takumi-rs/helpers";
import { container, text, image, percentage } from "@takumi-rs/helpers";
import { inlineImagesForNodes } from "../utils/inlineImagesForNodes";

const width = 1200;
const height = 630;

export default function Playground() {
  const [mode, setMode] = useState<"jsx" | "js">("jsx");
  const [jsxCode, setJsxCode] = useState<string>(DEFAULT_JSX);
  const [jsCode, setJsCode] = useState<string>(DEFAULT_JS);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [format, setFormat] = useState<"png" | "webp">("png");
  const [autoRender, setAutoRender] = useState<boolean>(true);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState<boolean>(false);
  const [debounceMs, setDebounceMs] = useState<number>(400);

  // Debug logs state
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
        const stack =
          typeof a.stack === "string"
            ? a.stack.split("\n").slice(1, 3).join("\n")
            : "";
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
      original.log(...(args as Parameters<typeof console.log>));
    };
    console.info = (...args: unknown[]) => {
      appendLog("info", ...args);
      original.info(...(args as Parameters<typeof console.info>));
    };
    console.warn = (...args: unknown[]) => {
      appendLog("warn", ...args);
      original.warn(...(args as Parameters<typeof console.warn>));
    };
    console.error = (...args: unknown[]) => {
      appendLog("error", ...args);
      original.error(...(args as Parameters<typeof console.error>));
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
      if (mode === "jsx") {
        const wrapped = `const __expr__ = ${jsxCode}`;
        // First, try to transform JSX. If this fails, it's a parse error.
        let compiled: string;
        // Lazy-load sucrase to keep initial bundle light
        try {
          const { transform: sucraseTransform } = await import("sucrase");
          compiled = sucraseTransform(wrapped, {
            transforms: ["jsx", "typescript"],
            jsxRuntime: "automatic",
            production: import.meta.env.PROD,
          }).code;
          // remove injected runtime imports
          compiled = compiled.replace(
            /\bimport\s*\{[^}]*\}\s*from\s*["']react\/jsx(?:-dev)?-runtime["'];?/g,
            ""
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          let line: number | null = null;
          let column: number | null = null;
          const m = typeof msg === "string" ? msg.match(/(\d+):(\d+)/) : null;
          if (m) {
            line = Number(m[1]);
            column = Number(m[2]);
          }
          const prefix = "const __expr__ = ";
          const adjustedColumn =
            line === 1 && column != null
              ? Math.max(1, column - prefix.length)
              : column ?? null;
          const loc =
            line && adjustedColumn ? ` at ${line}:${adjustedColumn}` : "";
          const friendly = `JSX parse error${loc}: ${msg}`;
          appendLog("error", friendly);
          setError(friendly);
          return;
        }
        const { twj } = await import("tw-to-css");
        const argNames: string[] = ["React", "twj"];
        const argValues: unknown[] = [React, twj];
        if (import.meta.env.PROD) {
          argNames.push("_jsx", "_jsxs", "_Fragment");
          argValues.push(
            ReactJSXRuntime.jsx,
            ReactJSXRuntime.jsxs,
            React.Fragment
          );
        } else {
          argNames.push("_jsxDEV", "_Fragment");
          argValues.push(ReactJSXDevRuntime.jsxDEV, React.Fragment);
        }
        const rawElement = new Function(
          ...argNames,
          `${compiled}; return __expr__;`
        )(...argValues) as React.ReactElement;
        const element = await inlineImageSources(rawElement, {
          log: appendLog,
        });
        appendLog("info", "[PG][JSX] Final JSX:", "\n" + toJsxString(element));
        const { fromJsx } = await import("@takumi-rs/helpers/jsx");
        const node = await fromJsx(element);
        // appendLog("info", "[CJ][Node]", "\n", JSON.stringify(node));
        const url = await renderAsDataUrl(node, w, h, format);
        setImgUrl(url);
      } else {
        // JS helpers mode: evaluate code that returns a node
        const { twj } = await import("tw-to-css");
        const argNames: string[] = [
          // helpers
          "container",
          "text",
          "image",
          "percentage",
          // util
          "twj",
          // size shortcuts for convenience
          "width",
          "height",
        ];
        const argValues: unknown[] = [
          container,
          text,
          image,
          percentage,
          twj,
          w,
          h,
        ];

        // Wrap to force returning the last expression
        const wrapped = `const __node__ = (async ()=>{ return (${jsCode}); })(); return __node__;`;
        let result: unknown;
        try {
          result = await new Function(...argNames, wrapped)(...argValues);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          appendLog("error", `JS eval error: ${msg}`);
          setError(`JS eval error: ${msg}`);
          return;
        }
        // Result could be a node or a promise resolved above
        let node = result as AnyNode;
        // Inline image URLs in helpers tree as data URIs
        node = await inlineImagesForNodes(node);
        const url = await renderAsDataUrl(node, w, h, format);
        setImgUrl(url);
      }
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
    jsCode,
    format,
    renderAsDataUrl,
    hasLoadedFontsRef,
    loadDefaultFonts,
    appendLog,
    mode,
  ]);

  // Debounced auto render
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRender || !ready) return;
    // Only re-render when input signature changes
    const sig = `${mode}|${width}x${height}|${format}|${
      mode === "jsx" ? jsxCode : jsCode
    }`;
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void doRender();
    }, debounceMs);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoRender, ready, doRender, jsxCode, jsCode, format, debounceMs, mode]);

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

  const copyLogs = useCallback(() => {
    const text = logs
      .map(
        (l) => `${new Date(l.time).toLocaleTimeString()} [${l.level}] ${l.text}`
      )
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }, [logs]);

  return (
    <div className="pg-root" data-theme={theme}>
      <PlaygroundHeader
        status={headerStatus}
        canRender={canRender}
        rendering={rendering}
        autoRender={autoRender}
        onToggleAutoRender={() => setAutoRender((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        format={format}
        onFormatChange={setFormat}
        debounceMs={debounceMs}
        onDebounceChange={setDebounceMs}
        onRender={doRender}
        onDownload={downloadCurrent}
        hasImage={!!imgUrl}
        mode={mode}
        onModeChange={(m) => setMode(m)}
      />

      <PanelGroup direction="horizontal" className="pg-panels">
        <Panel defaultSize={50} minSize={25} className="pg-left">
          <div className="pg-editor">
            <CodeEditor
              value={mode === "jsx" ? jsxCode : jsCode}
              onChange={mode === "jsx" ? setJsxCode : setJsCode}
              theme={editorTheme}
            />
          </div>
        </Panel>
        <PanelResizeHandle className="pg-resize" />
        <Panel defaultSize={50} minSize={25} className="pg-right">
          <PanelGroup direction="vertical" className="pg-right-split">
            <Panel defaultSize={70} minSize={40}>
              <Preview error={error} imgUrl={imgUrl} />
            </Panel>
            <PanelResizeHandle className="pg-resize-vertical" />
            <Panel defaultSize={30} minSize={20}>
              <LogsPanel
                logs={logs}
                autoScroll={autoScrollLogs}
                onToggleAutoScroll={setAutoScrollLogs}
                logsRef={logsRef}
                onCopy={copyLogs}
                onClear={() => setLogs([])}
              />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
