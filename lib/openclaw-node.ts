export type OpenClawConfig = {
  baseUrl: string;
  token: string;
  agentId: string;
};

export function readConfig(): OpenClawConfig | null {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const apiToken = process.env.OPENCLAW_API_TOKEN;
  const agentId = process.env.OPENCLAW_AGENT_ID || "default";

  if (gatewayUrl && apiToken) {
    const baseUrl = gatewayUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
    return { baseUrl, token: apiToken, agentId };
  }
  return null;
}

export function extractOpenClawText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}) {
  if (data.output_text) return data.output_text;
  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" || part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n") ?? ""
  );
}

export function parseJsonResult(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("OpenClaw 未返回可解析的 JSON 审核结果");
  }
}
