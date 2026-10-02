/**
 * Restricted CORS for browser-facing edge functions.
 *
 * Do NOT use this for server-to-server webhooks (Jèko) — those
 * are called by external servers, not browsers, and rely on token/HMAC
 * validation for security, not on the CORS layer.
 *
 * Allowed origins can be extended via the ALLOWED_ORIGINS env var
 * (comma-separated). The production domain is always allowed.
 */

const DEFAULT_ALLOWED = [
  "https://monjeton.app",
  "https://www.monjeton.app",
  "https://jetonclair.com",
  "https://www.jetonclair.com",
  "https://monjeton.lovable.app",
];

function getAllowlist(): string[] {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const list = getAllowlist();
  if (list.includes(origin)) return true;
  // Allow any Lovable preview subdomain (staging / branch previews).
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".lovable.dev")) {
      return true;
    }
    // Allow localhost for dev
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

/**
 * Build CORS headers for a request. Echoes the request Origin only when
 * it belongs to the allowlist. Otherwise omits the Allow-Origin header
 * so the browser blocks the response.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers = { ...BASE_HEADERS };
  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
