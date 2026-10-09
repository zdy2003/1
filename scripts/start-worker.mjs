import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(projectRoot, ".dev.vars");
const logsDirectory = path.join(projectRoot, "logs");
mkdirSync(logsDirectory, { recursive: true });
const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
const logPath = path.join(logsDirectory, `runtime-${date}.log`);
const logStream = createWriteStream(logPath, { flags: "a" });
const args = [
  "--import", path.join(projectRoot, "scripts/sites-env.mjs"),
  path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
  "dev",
  "--config", path.join(projectRoot, "dist/server/wrangler.json"),
  ...(existsSync(envFile) ? ["--env-file", envFile] : []),
  "--local",
  "--persist-to", path.join(projectRoot, ".wrangler/state"),
  "--ip", "127.0.0.1",
  "--inspector-port", "0",
  ...process.argv.slice(2),
];

const child = spawn(process.execPath, args, { cwd: projectRoot, env: process.env, stdio: ["inherit", "pipe", "pipe"] });
const startedLine = `\n[${new Date().toISOString()}] bidwise runtime starting (pid=${child.pid ?? "unknown"})\n`;
process.stdout.write(`运行日志：${logPath}\n`);
logStream.write(startedLine);
child.stdout?.on("data", (chunk) => { process.stdout.write(chunk); logStream.write(chunk); });
child.stderr?.on("data", (chunk) => { process.stderr.write(chunk); logStream.write(chunk); });
child.on("exit", (code, signal) => {
  logStream.end(`[${new Date().toISOString()}] bidwise runtime stopped (code=${code ?? "none"}, signal=${signal ?? "none"})\n`);
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
