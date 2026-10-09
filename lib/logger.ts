import { join } from "path";
import { existsSync, mkdirSync, appendFileSync } from "fs";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "docguard.log");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function log(level: string, message: string, data?: unknown): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const dataStr = data ? " " + JSON.stringify(data) : "";
  const line = `[${timestamp}] [${level}] ${message}${dataStr}`;
  appendFileSync(LOG_FILE, line + "\n");
  console.log(line);
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("DEBUG", msg, data),
  info: (msg: string, data?: unknown) => log("INFO", msg, data),
  warn: (msg: string, data?: unknown) => log("WARN", msg, data),
  error: (msg: string, data?: unknown) => log("ERROR", msg, data),
};

export { LOG_FILE, LOG_DIR };
