import { NextRequest, NextResponse } from "next/server";
import { extractArticle, isValidHttpUrl } from "@/lib/extract";

export const runtime = "nodejs";
// Vercel Hobby (gratuito): máximo permitido é 60s.
export const maxDuration = 60;

// Rate limit simples em memória (por IP): 30 req/min. Acima disso, 429.
// (Em serverless multi-instância é aproximado — suficiente p/ conter abuso.)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateHits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateHits.set(ip, hits);
  if (rateHits.size > 5000) {
    const oldest = [...rateHits.keys()].slice(0, 1000);
    for (const k of oldest) rateHits.delete(k);
  }
  return hits.length > RATE_MAX;
}

export async function GET(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "Muitas requisições. Aguarde um minuto e tente de novo." },
      { status: 429 }
    );
  }

  const raw = req.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!raw) {
    return NextResponse.json(
      { error: "Informe o parâmetro ?url=https://..." },
      { status: 400 }
    );
  }

  if (raw.length > 2048) {
    return NextResponse.json(
      { error: "URL muito longa (máx. 2048 caracteres)." },
      { status: 400 }
    );
  }

  if (!isValidHttpUrl(raw)) {
    return NextResponse.json(
      { error: "URL inválida ou não permitida. Use um endereço http(s) público." },
      { status: 400 }
    );
  }

  try {
    const article = await extractArticle(raw);
    const res = NextResponse.json({ ok: true, article }, { status: 200 });
    // Conteúdo extraído de terceiros: nunca cachear no browser/CDN como nosso.
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao extrair o conteúdo.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

