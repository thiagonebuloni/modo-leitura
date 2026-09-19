import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import sanitizeHtml from "sanitize-html";
import type { ExtractedArticle } from "./types";

export type { ExtractedArticle } from "./types";

// ---- Limites anti-DoS ----
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB: aborta download maior que isso
const MAX_REDIRECTS_FOLLOWED = 5;

// Hosts/IPs internos: o fetch server-side JAMAIS deve alcançar a rede privada
// (SSRF -> metadata de cloud, admin local, varredura de portas).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "[::]") return true;
  // IPv4 literal?
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const p = v4.slice(1).map(Number);
    if (p.some((n) => n > 255)) return true;
    const [a, b] = p;
    if (a === 10) return true; // 10/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (cloud metadata!)
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // multicast + reservada
    return false;
  }
  // IPv6 literal (com ou sem colchetes)?
  const unbracketed = h.replace(/^\[|\]$/g, "");
  if (unbracketed.includes(":")) {
    const low = unbracketed.toLowerCase();
    if (low === "::1" || low === "::" || low === "::ffff:127.0.0.1") return true;
    if (/^::ffff:(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.)/.test(low)) return true;
    if (/^(fc|fd)/.test(low)) return true; // unique-local
    if (/^fe[89ab]/.test(low)) return true; // link-local
    return low !== "0:0:0:0:0:0:0:1" ? true : true; // default-deny p/ IPv6 não listado
  }
  // Nomes internos comuns
  if (
    h === "metadata.google.internal" ||
    h === "metadata.google" ||
    h === "instance-data" ||
    h === "rancher" ||
    h === "kubernetes" ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    h.endsWith(".lan") ||
    h.endsWith(".corp") ||
    h.endsWith(".svc") ||
    h.endsWith(".cluster.local")
  ) {
    return true;
  }
  return false;
}

function assertPublicHttpUrl(value: string): URL {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error("URL inválida. Use http:// ou https://.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("URL inválida. Use http:// ou https://.");
  }
  if (u.username || u.password) {
    throw new Error("URL com credenciais não é permitida.");
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error("Endereços internos/privados não são permitidos.");
  }
  return u;
}

/**
 * Fetch com limite de tamanho + guarda de redirects contra SSRF.
 * - Aborta se o corpo passar de MAX_HTML_BYTES (anti-DoS).
 * - Segue no máx. MAX_REDIRECTS_FOLLOWED redirects, revalidando cada destino
 *   com assertPublicHttpUrl (site público -> 169.254.169.254 é bloqueado).
 */
async function fetchWithRedirectGuard(
  url: string,
  init: { signal?: AbortSignal; headers?: HeadersInit; maxBytes?: number } = {}
): Promise<Response> {
  const maxBytes = init.maxBytes ?? MAX_HTML_BYTES;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS_FOLLOWED; hop++) {
    assertPublicHttpUrl(current);
    const res = await fetch(current, {
      signal: init.signal,
      redirect: "manual",
      headers: init.headers,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.has("location")) {
      if (hop === MAX_REDIRECTS_FOLLOWED) {
        throw new Error("Muitos redirecionamentos. Desista desse link.");
      }
      const next = res.headers.get("location")!;
      try {
        current = new URL(next, current).toString();
      } catch {
        throw new Error("Redirecionamento inválido.");
      }
      continue;
    }
    // Checa Content-Length declarado antes de baixar (quando presente)
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      try {
        await res.arrayBuffer().catch(() => null);
      } catch {}
      throw new Error("Página muito grande para processar (limite de 5MB).");
    }
    return res;
  }
  throw new Error("Muitos redirecionamentos. Desista desse link.");
}

/** Lê o corpo com teto de bytes — aborta no meio se estourar (anti-DoS). */
async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (text.length > maxBytes) throw new Error("Página muito grande para processar (limite de 5MB).");
    return text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {}
      throw new Error("Página muito grande para processar (limite de 5MB).");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "a", "ul", "ol", "li",
  "blockquote", "pre", "code",
  "strong", "em", "b", "i", "u", "s",
  "hr", "br", "figure", "figcaption",
  "img", "table", "thead", "tbody", "tr", "th", "td",
  "dl", "dt", "dd", "sub", "sup",
];

/**
 * Tabelas largas ganham um bloco próprio com rolagem horizontal, para não
 * estourar a largura da página em telas pequenas (o texto continua legível).
 * Feito DEPOIS do sanitize: o <div> wrapper não precisa estar em ALLOWED_TAGS.
 */
function wrapWideTables(html: string): string {
  return html
    .replace(/<table(\s[^>]*)?>/gi, (match) => `<div class="table-wrap">${match}`)
    .replace(/<\/table>/gi, "</table></div>");
}

/**
 * Sanitiza o HTML do artigo e reescreve links absolutos para o formato interno
 * /dominio/caminho (para abrirem dentro do webapp, na mesma aba).
 * Usado tanto pela extração normal quanto pelos fallbacks de texto.
 */
function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "loading"],
      blockquote: ["cite"],
      code: ["class"],
      pre: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  }).replace(/href="(https?:\/\/[^"]*)"/gi, (_m, absolute: string) => {
    if (/^(#|mailto:|tel:|javascript:)/i.test(absolute)) return `href="${absolute}"`;
    return `href="/${absolute.replace(/^https?:\/\//i, "")}"`;
  });
}

export function isValidHttpUrl(value: string): boolean {
  try {
    assertPublicHttpUrl(value);
    return true;
  } catch {
    return false;
  }
}

function absolutizeUrls(doc: Document, baseUrl: string) {
  const base = new URL(baseUrl);
  doc.querySelectorAll("a[href]").forEach((el) => {
    const raw = el.getAttribute("href")?.trim();
    if (!raw) return;
    // Âncoras internas, mailto:, tel:, javascript: — mantém como está (sem nova aba)
    if (/^(#|mailto:|tel:|javascript:)/i.test(raw)) {
      el.removeAttribute("target");
      el.removeAttribute("rel");
      return;
    }
    try {
      // Absolutiza relativos; absolutos passam intactos (sem duplicar o domínio).
      el.setAttribute("href", new URL(raw, base).toString());
      el.removeAttribute("target");
      el.removeAttribute("rel");
    } catch {
      el.removeAttribute("href");
    }
  });
  doc.querySelectorAll("img[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (!src || src.startsWith("data:")) {
      el.remove();
      return;
    }
    try {
      el.setAttribute("src", new URL(src, base).toString());
      el.setAttribute("loading", "lazy");
      el.removeAttribute("srcset");
    } catch {
      el.remove();
    }
  });
}

function pickMeta(doc: Document, names: string[]): string | null {
  for (const name of names) {
    const el =
      doc.querySelector(`meta[property="${name}"]`) ||
      doc.querySelector(`meta[name="${name}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return null;
}

function buildArticleFromHtml(
  rawHtml: string,
  finalUrl: string,
  opts: { sourceNote?: string; titleFallback?: string } = {}
): ExtractedArticle | null {
  // VirtualConsole silencioso: páginas reais costumam ter CSS inválido/
  // incompleto e o JSDOM loga "Could not parse CSS stylesheet" como jsdomError.
  // Isso não afeta a extração — só polui o console / overlay de dev.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", () => {});

  const dom = new JSDOM(rawHtml, { url: finalUrl, virtualConsole });
  const doc = dom.window.document;

  // Remove tudo que é distração ANTES do Readability (scripts já são inertes no JSDOM,
  // mas removemos para garantir: iframes, videos, forms, nav, etc.)
  doc.querySelectorAll(
    "script, style, noscript, iframe, canvas, video, audio, embed, object, form, button, input, select, textarea, nav, aside, footer, header, [role='banner'], [role='navigation'], [role='complementary'], .sidebar, .menu, .nav, .popup, .modal, .overlay, .cookie, .newsletter, .share, .social, .comments, .advertisement, .ads, .ad"
  ).forEach((el: Element) => el.remove());

  const metaImage = pickMeta(doc, ["og:image", "twitter:image"]);
  const metaPublished = pickMeta(doc, [
    "article:published_time",
    "og:published_time",
    "datePublished",
    "publish_date",
  ]);
  const metaSite = pickMeta(doc, ["og:site_name"]);

  absolutizeUrls(doc, finalUrl);

  const reader = new Readability(doc, {
    charThreshold: 100,
    nbTopCandidates: 10,
  });
  const parsed = reader.parse();

  if (!parsed || !parsed.content || (parsed.textContent?.trim().length ?? 0) < 100) {
    return null;
  }

  // O Readability resolve URIs relativas contra o baseURI do documento ao
  // serializar o artigo — então reescrevemos os hrefs http(s) para o formato
  // interno /dominio/caminho DEPOIS do parse, para abrir dentro do webapp.
  const clean = sanitizeHtml(parsed.content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "loading"],
      blockquote: ["cite"],
      code: ["class"],
      pre: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  }).replace(/href="(https?:\/\/[^"]*)"/gi, (_m, absolute: string) => {
    if (/^(#|mailto:|tel:|javascript:)/i.test(absolute)) return `href="${absolute}"`;
    return `href="/${absolute.replace(/^https?:\/\//i, "")}"`;
  });

  const textContent = (parsed.textContent ?? "").replace(/\s+\n/g, "\n").trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    title:
      (parsed.title?.trim() || opts.titleFallback?.trim() || "Sem título") +
      (opts.sourceNote ? ` ${opts.sourceNote}` : ""),
    byline: parsed.byline?.trim() || null,
    siteName: parsed.siteName?.trim() || metaSite,
    excerpt: parsed.excerpt?.trim() || "",
    content: wrapWideTables(clean),
    textContent,
    length: parsed.length ?? textContent.length,
    wordCount,
    readingTimeMinutes,
    url: finalUrl,
    publishedTime: metaPublished,
    image: metaImage ? new URL(metaImage, new URL(finalUrl).origin).toString() : null,
  };
}

/** Escapa texto para injeção segura em HTML (usado nos fallbacks de texto). */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * No formato texto/markdown o Jina devolve um preâmbulo com metadados:
 *   Title: ...
 *   URL Source: ...
 *   Markdown Content:
 *     <conteúdo de verdade>
 * Aqui separamos o título do conteúdo, para não despejar o preâmbulo na tela.
 */
function stripJinaPreamble(body: string): { title: string | null; text: string } {
  const titleMatch = body.match(/^\s*Title:\s*(.+)$/m);
  const contentMatch = body.match(/^\s*(?:Markdown Content|Content):\s*$/m);
  const text =
    contentMatch && contentMatch.index !== undefined
      ? body.slice(contentMatch.index + contentMatch[0].length)
      : body;
  return { title: titleMatch ? titleMatch[1].trim() : null, text: text.trim() };
}

/**
 * Fallback via Jina Reader: busca https://r.jina.ai/<url> que renderiza a
 * página num browser real e retorna o HTML/texto. Retorna null se falhar.
 * (Alvo revalidado: nunca pede ao Jina um endereço interno.)
 */
async function tryJinaReader(targetUrl: string): Promise<ExtractedArticle | null> {
  try {
    assertPublicHttpUrl(targetUrl);
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        // Sem este header o Jina responde MARKDOWN (com o preâmbulo
        // "Title: / URL Source: / Markdown Content:") em vez do HTML real.
        "X-Return-Format": "html",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        ...(process.env.JINA_API_KEY
          ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
          : {}),
      },
    });
    if (!res.ok) return null;
    const body = await readBodyCapped(res, MAX_HTML_BYTES);
    if (!body || body.length < 500) return null;

    // Caminho 1 — o Jina devolveu o HTML real da página: roda a mesma pipeline
    // da extração normal (Readability + sanitize), preservando título e imagens.
    if (/<html[\s>]|<body[\s>]|<article[\s>]|<p[\s>]/i.test(body)) {
      const fromHtml = buildArticleFromHtml(body, targetUrl, {
        sourceNote: "(via leitor reserva)",
      });
      if (fromHtml) return fromHtml;
    }

    // Caminho 2 — veio markdown/texto puro: descarta o preâmbulo do Jina.
    const { title: jinaTitle, text: plain } = stripJinaPreamble(body);
    if (!plain) return null;
    const article = buildArticleFromHtml(
      `<html><head><title>${escapeHtml(jinaTitle ?? "")}</title></head><body><article><pre>${escapeHtml(plain)}</pre></article></body></html>`,
      targetUrl,
      { titleFallback: jinaTitle ?? undefined, sourceNote: "(via leitor reserva)" }
    );
    if (article) return article;
    // Último recurso: o texto cru do Jina virou parágrafos.
    const paragraphs = plain
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40)
      .slice(0, 200)
      .map((p) => `<p>${sanitizeHtml(p, { allowedTags: [], allowedAttributes: {} })}</p>`)
      .join("\n");
    if (!paragraphs) return null;
    const textContent = plain;
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;
    return {
      title: jinaTitle?.trim() || "Artigo (via leitor reserva)",
      byline: null,
      siteName: new URL(targetUrl).hostname.replace(/^www\./, ""),
      excerpt: "",
      content: paragraphs,
      textContent,
      length: textContent.length,
      wordCount,
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      url: targetUrl,
      publishedTime: null,
      image: null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractArticle(targetUrl: string): Promise<ExtractedArticle> {
  // Valida ANTES de qualquer fetch — incluindo redirect, que é revalidado abaixo.
  assertPublicHttpUrl(targetUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  // UA de browser real: muitos portais (UOL, Globo, Folha...) bloqueiam bots
  // pelo User-Agent ("compatible; bot") com 403. O popup de assinatura/paywall
  // é client-side (JS) — como não executamos JS, ele nunca aparece no texto.
  const BROWSER_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
  };

  let res: Response;
  try {
    // redirect: "manual" para revalidar cada destino contra SSRF
    // (um site público pode redirecionar para http://169.254.169.254/).
    res = await fetchWithRedirectGuard(targetUrl, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao carregar a página (20s).");
    }
    throw err instanceof Error
      ? err
      : new Error("Não foi possível carregar a URL. Verifique o endereço e tente de novo.");
  } finally {
    clearTimeout(timeout);
  }

  // Retry com Referer: alguns WAFs barram o 1º request e liberam o 2º. Só em 403.
  if (res.status === 403) {
    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), 20000);
    try {
      const retry = await fetchWithRedirectGuard(targetUrl, {
        signal: retryController.signal,
        headers: { ...BROWSER_HEADERS, Referer: "https://www.google.com/" },
      });
      if (retry.ok) res = retry;
    } catch {
      // mantém a resposta original; o erro amigável abaixo explica
    } finally {
      clearTimeout(retryTimeout);
    }
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      // Fallback: Jina Reader (https://r.jina.ai/URL) renderiza a página
      // com um browser real e devolve o conteúdo. Sem chave, o plano
      // gratuito permite poucas requisições — se estourar, avisa.
      const fallback = await tryJinaReader(targetUrl);
      if (fallback) return fallback;
      if (res.status === 429) {
        throw new Error(
          "O site recusou por excesso de acessos (erro 429). Aguarde um minuto e tente de novo."
        );
      }
      throw new Error(
        "Esse site bloqueou a leitura automática (erro 403) e o leitor reserva também não conseguiu. É uma proteção anti-robô do portal — comum em UOL, Globo e Folha. O conteúdo pode exigir assinatura."
      );
    }
    if (res.status === 404) {
      throw new Error("Página não encontrada (erro 404). Confira se o link está correto.");
    }
    throw new Error(`A página respondeu com status ${res.status}.`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/html/i.test(contentType)) {
    throw new Error("Essa URL não parece ser uma página HTML.");
  }

  const rawHtml = await readBodyCapped(res, MAX_HTML_BYTES);
  const finalUrl = res.url || targetUrl;

  const article = buildArticleFromHtml(rawHtml, finalUrl);
  if (!article) {
    throw new Error(
      "Não consegui identificar o texto principal dessa página. Ela pode exigir login, ser só imagens/vídeo ou bloquear leitores."
    );
  }
  return article;
}
