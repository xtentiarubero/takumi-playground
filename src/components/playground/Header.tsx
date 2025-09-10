import { clsx } from "clsx";
import { Play, Download, RefreshCw, Moon, Sun } from "lucide-react";

type Props = {
  status: string;
  canRender: boolean;
  rendering: boolean;
  autoRender: boolean;
  onToggleAutoRender: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  format: "png" | "webp";
  onFormatChange: (fmt: "png" | "webp") => void;
  debounceMs: number;
  onDebounceChange: (ms: number) => void;
  onRender: () => void;
  onDownload: () => void;
  hasImage: boolean;
};

export default function PlaygroundHeader({
  status,
  canRender,
  rendering,
  autoRender,
  onToggleAutoRender,
  theme,
  onToggleTheme,
  format,
  onFormatChange,
  debounceMs,
  onDebounceChange,
  onRender,
  onDownload,
  hasImage,
}: Props) {
  const editorThemeLabel = theme === "dark" ? "Dark" : "Light";

  return (
    <header className="pg-header">
      <div className="pg-title">Takumi Playground</div>
      <div className="pg-controls">
        <div className="pg-status">{status}</div>
        <div className="pg-field">
          <label>Format</label>
          <select
            value={format}
            onChange={(e) => onFormatChange((e.target as HTMLSelectElement).value as "png" | "webp")}
          >
            <option value="png">PNG</option>
            <option value="webp">WEBP</option>
          </select>
        </div>
        <div className="pg-field">
          <label>Delay (ms)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={debounceMs}
            onChange={(e) => onDebounceChange(Math.max(0, Number(e.target.value) || 0))}
            title="Auto render debounce delay in milliseconds"
          />
        </div>
        <button
          className={clsx("pg-btn", { disabled: !canRender })}
          disabled={!canRender}
          onClick={onRender}
          title="Render"
        >
          <Play size={16} /> {rendering ? "Rendering..." : "Render"}
        </button>
        <button className="pg-btn" onClick={onToggleAutoRender} title="Toggle auto render">
          <RefreshCw size={16} /> {autoRender ? "Auto" : "Manual"}
        </button>
        <button className="pg-btn" onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />} {editorThemeLabel}
        </button>
        <button className={clsx("pg-btn", { disabled: !hasImage })} disabled={!hasImage} onClick={onDownload}>
          <Download size={16} /> Download
        </button>
      </div>
    </header>
  );
}
