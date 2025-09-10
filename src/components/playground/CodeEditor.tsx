import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  onChange: (val: string) => void;
  theme: "vs" | "vs-dark" | string;
};

export default function CodeEditor({ value, onChange, theme }: Props) {
  return (
    <Editor
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
  );
}
