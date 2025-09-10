export type LogLevel = "log" | "info" | "warn" | "error";
export type LogItem = { id: number; level: LogLevel; time: number; text: string };

