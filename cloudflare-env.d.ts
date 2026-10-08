declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    FILES?: R2Bucket;
    APP_ENCRYPTION_KEY?: string;
    OPENCLAW_GATEWAY_URL?: string;
    OPENCLAW_API_TOKEN?: string;
    OPENCLAW_AGENT_ID?: string;
  }
}
