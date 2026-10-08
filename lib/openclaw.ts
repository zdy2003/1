import { env } from "cloudflare:workers";

export type OpenClawConfig = { baseUrl: string; token: string; agentId: string };
const COOKIE = "bidwise_openclaw";

function bytesToBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

function base64ToBytes(value: string) {
  const text = atob(value);
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  const secret = env.APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("站点尚未配置 APP_ENCRYPTION_KEY");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function normalizeGatewayUrl(value: string) {
  const url = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("OpenClaw 网关必须使用 HTTPS 地址");
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/v1$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function encryptConfig(config: OpenClawConfig) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(config)));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function readConfig(request: Request): Promise<OpenClawConfig | null> {
  const pair = request.headers.get("cookie")?.split(/;\s*/).find((item) => item.startsWith(`${COOKIE}=`));
  if (pair) {
    try {
      const [iv, encrypted] = decodeURIComponent(pair.slice(COOKIE.length + 1)).split(".");
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(encrypted));
      return JSON.parse(new TextDecoder().decode(clear)) as OpenClawConfig;
    } catch { /* fall back to a server-managed adapter */ }
  }
  if (env.OPENCLAW_GATEWAY_URL && env.OPENCLAW_API_TOKEN) {
    return {
      baseUrl: normalizeGatewayUrl(env.OPENCLAW_GATEWAY_URL),
      token: env.OPENCLAW_API_TOKEN,
      agentId: env.OPENCLAW_AGENT_ID || "default",
    };
  }
  return null;
}

export function configCookie(value: string) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
}

export function clearConfigCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function testOpenClaw(config: OpenClawConfig) {
  const response = await fetch(`${config.baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${config.token}` } });
  const data = await response.json().catch(() => ({})) as { data?: Array<{ id?: string }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `OpenClaw 连接失败（HTTP ${response.status}）`);
  return { models: (data.data ?? []).map((item) => item.id).filter(Boolean) };
}

export function extractOpenClawText(data: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (data.output_text) return data.output_text;
  return data.output?.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text" || part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

export function parseJsonResult(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); } catch {
    const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("OpenClaw 未返回可解析的 JSON 审核结果");
  }
}
