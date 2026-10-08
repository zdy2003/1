import { clearConfigCookie, configCookie, encryptConfig, normalizeGatewayUrl, readConfig, testOpenClaw } from "@/lib/openclaw";

export const runtime = "edge";

export async function GET(request: Request) {
  const config = await readConfig(request);
  return Response.json(config ? { connected: true, baseUrl: config.baseUrl, agentId: config.agentId } : { connected: false });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { baseUrl?: string; token?: string; agentId?: string };
    const current = await readConfig(request);
    if (!body.baseUrl || (!body.token && !current?.token)) return Response.json({ error: "请填写网关地址和访问令牌" }, { status: 400 });
    const config = { baseUrl: normalizeGatewayUrl(body.baseUrl), token: body.token?.trim() || current!.token, agentId: body.agentId?.trim() || "default" };
    const result = await testOpenClaw(config);
    const encrypted = await encryptConfig(config);
    return Response.json({ connected: true, baseUrl: config.baseUrl, agentId: config.agentId, models: result.models }, { headers: { "Set-Cookie": configCookie(encrypted) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "连接失败" }, { status: 502 });
  }
}

export async function DELETE() {
  return Response.json({ connected: false }, { headers: { "Set-Cookie": clearConfigCookie() } });
}
