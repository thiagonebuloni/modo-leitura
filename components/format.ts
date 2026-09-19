import type { ExtractedArticle } from "@/lib/types";

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function hostOf(article: ExtractedArticle): string | null {
  try {
    return new URL(article.url).hostname.replace(/^www\./, "");
  } catch {
    return article.siteName;
  }
}
