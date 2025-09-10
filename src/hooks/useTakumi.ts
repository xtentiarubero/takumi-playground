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
      try {
        // Prefer the direct method if available on the WASM renderer
        const rAny = renderer as unknown as {
          renderAsDataUrl?: (
            n: AnyNode,
            w: number,
            h: number,
            f: OutputFormat
          ) => Promise<string>;
        };
        if (typeof rAny.renderAsDataUrl === "function") {
          return await rAny.renderAsDataUrl(
            node as AnyNode,
            width,
            height,
            format
          );
        }

        // Fallback: Render -> blob -> data URL
        const buffer: Uint8Array = await renderer.render(
          node as AnyNode,
          width,
          height,
          format
        );
        const mime = format === "png" ? "image/png" : "image/webp";
        const blob = new Blob([buffer], { type: mime });
        return await blobToDataUrl(blob);
      } catch (e: unknown) {
        console.error("Render failed", e);
        throw e instanceof Error ? e : new Error(String(e));
      }
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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
