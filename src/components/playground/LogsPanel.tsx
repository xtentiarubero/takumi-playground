import type { MutableRefObject } from "react";
import { Bug, Trash2, Copy } from "lucide-react";
import { clsx } from "clsx";
import type { LogItem } from "./types";

type Props = {
  logs: LogItem[];
  autoScroll: boolean;
  onToggleAutoScroll: (v: boolean) => void;
  logsRef: MutableRefObject<HTMLDivElement | null>;
  onCopy: () => void;
  onClear: () => void;
};

export default function LogsPanel({
  logs,
  autoScroll,
  onToggleAutoScroll,
  logsRef,
  onCopy,
  onClear,
}: Props) {
  return (
    <div className="pg-logs">
      <div className="pg-logs-header">
        <div className="pg-logs-title">
          <Bug size={14} /> Debug Logs
        </div>
        <div className="pg-logs-actions">
          <label className="pg-logs-autoscroll">
            <input type="checkbox" checked={autoScroll} onChange={(e) => onToggleAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
          <button className="pg-btn pg-logs-btn" title="Copy logs" onClick={onCopy}>
            <Copy size={14} /> Copy
          </button>
          <button className="pg-btn pg-logs-btn" title="Clear logs" onClick={onClear}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>
      <div className="pg-logs-list" ref={logsRef}>
        {logs.length === 0 ? (
          <div className="pg-logs-empty">No logs yet. Actions will appear here.</div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className={clsx("pg-log-item", `pg-log-${l.level}`)}>
              <span className="pg-log-time">{new Date(l.time).toLocaleTimeString()}</span>
              <span className="pg-log-level">[{l.level}]</span>
              <span className="pg-log-text">{l.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
