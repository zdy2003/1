import { clearConfigCookie, configCookie, encryptConfig, normalizeGatewayUrl, readConfig, testOpenClaw } from "@/lib/openclaw";
import { env } from "cloudflare:workers";

export const runtime = "edge";

export async function GET(request: Request) {
  const config = await readConfig(request);
  const managed = Boolean(env.OPENCLAW_GATEWAY_URL && env.OPENCLAW_API_TOKEN);
  return Response.json(config ? { connected: true, baseUrl: config.baseUrl, agentId: config.agentId, managed } : { connected: false, managed });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { baseUrl?: string; token?: string; agentId?: string };
    const current = await readConfig(request);
    const managed = Boolean(env.OPENCLAW_GATEWAY_URL && env.OPENCLAW_API_TOKEN);
    if (!managed && (!body.baseUrl || (!body.token && !current?.token))) return Response.json({ error: "请填写网关地址和访问令牌" }, { status: 400 });
    const config = managed ? current! : { baseUrl: normalizeGatewayUrl(body.baseUrl!), token: body.token?.trim() || current!.token, agentId: body.agentId?.trim() || "default" };
    const result = await testOpenClaw(config);
    if (managed) return Response.json({ connected: true, managed: true, baseUrl: config.baseUrl, agentId: config.agentId, models: result.models });
    const encrypted = await encryptConfig(config);
    return Response.json({ connected: true, baseUrl: config.baseUrl, agentId: config.agentId, models: result.models }, { headers: { "Set-Cookie": configCookie(encrypted) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "连接失败" }, { status: 502 });
  }
}

export async function DELETE() {
  const managed = Boolean(env.OPENCLAW_GATEWAY_URL && env.OPENCLAW_API_TOKEN);
  return Response.json({ connected: managed, managed }, { headers: { "Set-Cookie": clearConfigCookie() } });
}
