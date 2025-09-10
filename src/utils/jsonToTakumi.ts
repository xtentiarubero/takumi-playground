import { container, text, image, percentage } from "@takumi-rs/helpers";

export type JsonNode =
  | ({ type: "container" } & Record<string, any>)
  | ({ type: "text"; text: string } & Record<string, any>)
  | ({ type: "image" } & Record<string, any>);

function toColor(input: any): any {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return input;
  const hex = input.trim();
  if (hex.startsWith("#")) {
    const v = parseInt(hex.slice(1), 16);
    if (!Number.isNaN(v)) return v;
  }
  return input;
}

function mapPercent(v: any) {
  if (typeof v === "string" && v.endsWith("%")) {
    const n = Number(v.slice(0, -1));
    if (!Number.isNaN(n)) return percentage(n);
  }
  return v;
}

function normalizeStyle(obj: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (k.toLowerCase().includes("color")) out[k] = toColor(v);
    else out[k] = mapPercent(v);
  }
  return out;
}

export function jsonToTakumiNode(node: JsonNode): any {
  if (!node || typeof node !== "object") throw new Error("Invalid JSON node");
  switch (node.type) {
    case "container": {
      const { children = [], style, type: _t, ...rest } = node as any;
      const merged = { ...(style ?? {}), ...rest };
      return container({
        ...normalizeStyle(merged),
        children: (children as any[]).map(jsonToTakumiNode),
      });
    }
    case "text": {
      const { text: content, style, type: _t, ...rest } = node as any;
      const finalStyle = normalizeStyle({ ...(style ?? {}), ...rest });
      return text(String(content), finalStyle);
    }
    case "image": {
      const { style, type: _t, ...rest } = node as any;
      const img = { ...(style ? { style: normalizeStyle(style) } : {}), ...rest };
      // color-ish props
      if ("tintColor" in img) img.tintColor = toColor(img.tintColor);
      return image(img as any);
    }
    default:
      throw new Error(`Unsupported node type ${(node as any).type}`);
  }
}
