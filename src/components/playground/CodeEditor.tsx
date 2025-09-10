import { lazy, Suspense } from "react";

const LazyEditor = lazy(async () => {
  const mod = await import("@monaco-editor/react");
  return { default: mod.default };
});

type Props = {
  value: string;
  onChange: (val: string) => void;
  theme: "vs" | "vs-dark" | string;
};

export default function CodeEditor({ value, onChange, theme }: Props) {
  return (
    <Suspense fallback={<div className="pg-editor-loading">Loading editor…</div>}>
      <LazyEditor
        height="100%"
        value={value}
        theme={theme}
        defaultLanguage="javascript"
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          wordWrap: "on",
        }}
        keepCurrentModel
      />
    </Suspense>
  );
}
