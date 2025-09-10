import { container, text, image, percentage } from "@takumi-rs/helpers";

export type JsonNode =
  | ({ type: "container" } & Record<string, unknown>)
  | ({ type: "text"; text: string } & Record<string, unknown>)
  | ({ type: "image" } & Record<string, unknown>);

function toColor(input: unknown): unknown {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return input;
  const hex = input.trim();
  if (hex.startsWith("#")) {
    const v = parseInt(hex.slice(1), 16);
    if (!Number.isNaN(v)) return v;
  }
  return input;
}

function mapPercent(v: unknown): unknown {
  if (typeof v === "string" && v.endsWith("%")) {
    const n = Number(v.slice(0, -1));
    if (!Number.isNaN(n)) return percentage(n);
  }
  return v;
}

function normalizeStyle(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (k.toLowerCase().includes("color")) out[k] = toColor(v);
    else out[k] = mapPercent(v);
  }
  return out;
}

function omitProps(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const set = new Set(keys);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!set.has(k)) out[k] = v;
  }
  return out;
}

export function jsonToTakumiNode(node: JsonNode): unknown {
  if (!node || typeof node !== "object") throw new Error("Invalid JSON node");
  switch (node.type) {
    case "container": {
      const base = node as Record<string, unknown>;
      const children = (base.children as unknown[]) ?? [];
      const style = base.style as Record<string, unknown> | undefined;
      const rest = omitProps(base, ["type", "children", "style"]);
      const merged = { ...(style ?? {}), ...rest };
      return container({
        ...normalizeStyle(merged),
        children: children.map(jsonToTakumiNode),
      });
    }
    case "text": {
      const base = node as Record<string, unknown>;
      const content = String(base.text);
      const style = base.style as Record<string, unknown> | undefined;
      const rest = omitProps(base, ["type", "text", "style"]);
      const finalStyle = normalizeStyle({ ...(style ?? {}), ...rest });
      return text(String(content), finalStyle);
    }
    case "image": {
      const base = node as Record<string, unknown>;
      const style = base.style as Record<string, unknown> | undefined;
      const rest = omitProps(base, ["type", "style"]);
      const img: Record<string, unknown> = { ...(style ? { style: normalizeStyle(style) } : {}), ...rest };
      // color-ish props
      if ("tintColor" in img) img.tintColor = toColor((img as Record<string, unknown>).tintColor);
      return image(img as unknown);
    }
    default:
      throw new Error(`Unsupported node type ${(node as Record<string, unknown>).type}`);
  }
}
