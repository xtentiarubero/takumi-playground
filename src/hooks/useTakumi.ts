import { useCallback, useEffect, useRef, useState } from "react";
import init, { Renderer } from "@takumi-rs/wasm";
import wasmUrl from "@takumi-rs/wasm/takumi_wasm_bg.wasm?url";
import type { AnyNode } from "@takumi-rs/helpers";

export type OutputFormat = "png" | "webp";

export function useTakumi() {
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ready = !!renderer && !initializing && !error;
  const hasLoadedFontsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializing(true);
        await init(wasmUrl as unknown as string);
        if (cancelled) return;
        const r = new Renderer();
        if (cancelled) return;
        setRenderer(r);
        setError(null);
      } catch (e: unknown) {
        console.error("Takumi init error", e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDefaultFonts = useCallback(async () => {
    if (!renderer) return;
    try {
      const fontUrls = [
        "https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/latin-wght-normal.woff2",
      ];
      for (const url of fontUrls) {
        const res = await fetch(url);
        const buf = new Uint8Array(await res.arrayBuffer());
        renderer.loadFont(buf);
      }
      hasLoadedFontsRef.current = true;
    } catch (e) {
      console.warn("Failed to load fonts", e);
    }
  }, [renderer]);

  const renderAsDataUrl = useCallback(
    async (
      node: AnyNode,
      width: number,
      height: number,
      format: OutputFormat = "png"
    ): Promise<string> => {
      if (!renderer) throw new Error("Renderer not ready");
      // Directly use WASM's data URL renderer
      return renderer.renderAsDataUrl(node as AnyNode, width, height, format);
    },
    [renderer]
  );

  return {
    renderer,
    initializing,
    ready,
    error,
    loadDefaultFonts,
    hasLoadedFontsRef,
    renderAsDataUrl,
  };
}

