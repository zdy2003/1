import { env } from "cloudflare:workers";

export function database() {
  if (!env.DB) throw new Error("数据库尚未绑定");
  return env.DB;
}

export function filesBucket() {
  if (!env.FILES) throw new Error("文件存储尚未绑定");
  return env.FILES;
}

export function jsonError(error: unknown, status = 500) {
  return Response.json({ error: error instanceof Error ? error.message : "服务暂时不可用" }, { status });
}
