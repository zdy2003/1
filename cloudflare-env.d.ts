declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    FILES?: R2Bucket;
    APP_ENCRYPTION_KEY?: string;
  }
}
