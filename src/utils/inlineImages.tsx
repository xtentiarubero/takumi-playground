import React from "react";
import { blobToDataURL } from "./blob";

type Logger = (level: "info" | "warn" | "error" | "log", ...args: unknown[]) => void;

// Walk a React element tree and inline <img src> URLs as Data URIs
export async function inlineImageSources(
  element: React.ReactElement,
  opts?: { log?: Logger }
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
      return await blobToDataURL(blob);
    })();
    cache.set(url, p);
    return p;
  };

  let replaced = 0;
  let failed = 0;

  const processNode = async (node: any): Promise<any> => {
    if (node == null || typeof node !== "object") return node;
    if (!React.isValidElement(node)) return node;
    const el = node as React.ReactElement<any, any>;
    const type = el.type as any;
    const props: Record<string, any> = { ...((el as any).props as Record<string, any>) };

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

    return React.cloneElement(el, props);
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
