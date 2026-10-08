import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const envFile = path.join(projectRoot, ".dev.vars");
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

const child = spawn(process.execPath, args, { cwd: projectRoot, env: process.env, stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
