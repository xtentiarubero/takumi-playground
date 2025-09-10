import React from "react";

// Pretty-print a React element as JSX-like string for logging
export function toJsxString(node: unknown, depth = 0): string {
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

  const formatStyle = (style: unknown): string => {
    try {
      return JSON.stringify(style);
    } catch {
      return '{/* style */}';
    }
  };

  const formatProp = (key: string, value: unknown): string => {
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

  const formatProps = (props: Record<string, unknown>): string => {
    const parts: string[] = [];
    for (const k in props) {
      const s = formatProp(k, (props as Record<string, unknown>)[k]);
      if (s) parts.push(s);
    }
    return parts.length ? " " + parts.join(" ") : "";
  };

  const formatChildren = (children: unknown, d: number): string => {
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
  const type = typeof el.type === "string" ? el.type : (el.type as { name?: string })?.name || "Component";
  const open = `<${type}${formatProps(el.props as Record<string, unknown>)}>`;
  const close = `</${type}>`;
  const children = formatChildren((el.props as Record<string, unknown>)?.children, depth + 1);
  const singleLine = children === "";
  const out = singleLine
    ? `${indent(depth)}${open}${close}`
    : `${indent(depth)}${open}${children}${close}`;
  return out.length > maxLen ? out.slice(0, maxLen) + "\n/* … trimmed … */" : out;
}
