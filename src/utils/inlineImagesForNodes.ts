import type { AnyNode } from "@takumi-rs/helpers";

// Inline external image URLs in a helpers-built node tree (not JSX)
export async function inlineImagesForNodes<T extends AnyNode>(
  node: T
): Promise<T> {
  const isDataUri = (s: string) => typeof s === "string" && /^data:/i.test(s);
  const cache = new Map<string, Promise<string>>();

  const fetchAsDataUrl = async (url: string): Promise<string> => {
    if (cache.has(url)) return cache.get(url)!;
    const p = (async () => {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const blob = await res.blob();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk)
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      return `data:${blob.type};base64,${btoa(binary)}`;
    })();
    cache.set(url, p);
    return p;
  };

  const visit = async (n: AnyNode): Promise<AnyNode> => {
    if (!n || typeof n !== "object") return n;
    const t = (n as Record<string, unknown>).type as string | undefined;
    if (t === "image") {
      const src = (n as Record<string, unknown>).src as unknown;
      if (typeof src === "string" && src && !isDataUri(src)) {
        try {
          const data = await fetchAsDataUrl(src);
          (n as Record<string, unknown>).src = data;
        } catch {
          // ignore failures; renderer may still handle it if allowed
        }
      }
    }
    const children = (n as Record<string, unknown>).children as
      | unknown[]
      | undefined;
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        children[i] = (await visit(children[i] as AnyNode)) as unknown;
      }
    }
    return n;
  };

  return (await visit(structuredClone(node))) as T;
}
