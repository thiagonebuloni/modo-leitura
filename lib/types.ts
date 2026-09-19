export interface ExtractedArticle {
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string;
  content: string;
  textContent: string;
  length: number;
  wordCount: number;
  readingTimeMinutes: number;
  url: string;
  publishedTime: string | null;
  image: string | null;
}

export type Theme = "light" | "sepia" | "dark";

export const FONT_STEPS = [17, 19, 21, 23, 26];

/** "example.com/post" -> "https://example.com/post". Aceita com ou sem protocolo. */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/*/i.test(t)) return t.replace(/^https?:\/*/, (m) => (/^https/i.test(m) ? "https://" : "http://"));
  return `https://${t}`;
}

/** "https://example.com/post" -> "example.com/post" (formato da barra de endereços). */
export function toCleanPath(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "");
}

/**
 * Reconstrói a URL alvo a partir dos segmentos da path.
 * Ex: ["example.com"] -> "https://example.com"
 *     ["https:", "example.com", "post"] ou ["https:/", "example.com"] -> "https://example.com/post"
 * O browser colapsa "//" em "/", então toleramos "https:/" e "https:".
 * Retorna null para qualquer coisa que não seja http(s) público
 * (bloqueia javascript:, data:, file:, IPs internos, credenciais...).
 */
export function urlFromSlug(slug: string[] | undefined): string | null {
  if (!slug || slug.length === 0) return null;
  if (slug.length > 20) return null; // path absurda = abuso
  const decoded = slug.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  let raw = decoded.join("/");
  if (raw.length > 2048) return null;
  raw = raw.replace(/^(https?:)\/([^/])/i, "$1//$2");
  const url = normalizeUrl(raw);
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    if (isPrivateHost(u.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Mesma lista de bloqueio do server (duplicada p/ não importar código Node no client). */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || h === "0.0.0.0") return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const p = v4.slice(1).map(Number);
    if (p.some((n) => n > 255)) return true;
    const [a, b] = p;
    return (
      a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      a === 127 || (a === 169 && b === 254) || a === 0 || a >= 224
    );
  }
  if (h.includes(":")) return true; // IPv6: default-deny no slug
  return (
    h === "metadata.google.internal" || h.endsWith(".internal") ||
    h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".corp")
  );
}

