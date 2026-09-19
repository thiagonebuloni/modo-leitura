"use client";

import { useState } from "react";
import type { ExtractedArticle } from "@/lib/types";
import { formatDate, hostOf } from "./format";

interface Props {
  article: ExtractedArticle;
  fontSize: number;
  showImages: boolean;
  onBack: () => void;
}

export default function ArticleView({ article, fontSize, showImages, onBack }: Props) {
  const host = hostOf(article);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${article.url.replace(/^https?:\/\//i, "")}`
      : article.url;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <article className="pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="theme-chip cursor-pointer rounded-full border px-4 py-1.5 text-[13px] font-medium"
        >
          ← Ler outro link
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="theme-chip rounded-full border px-4 py-1.5 text-[13px] font-medium"
        >
          Original ↗
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="theme-chip cursor-pointer rounded-full border px-4 py-1.5 text-[13px] font-medium"
        >
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
      </div>

      <div
        className="theme-card rounded-3xl border p-6 shadow-sm sm:p-10"
      >
        <p className="text-[13px] font-medium uppercase tracking-widest opacity-70">
          {host ?? "Artigo"}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug tracking-tight sm:text-[32px]">
          {article.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] opacity-70">
          {article.byline && <span>{article.byline}</span>}
          {formatDate(article.publishedTime) && <span>{formatDate(article.publishedTime)}</span>}
          <span>{article.readingTimeMinutes} min de leitura</span>
          <span>{article.wordCount.toLocaleString("pt-BR")} palavras</span>
        </div>

        {article.excerpt && (
          <p
            className="font-reading mt-5 border-l-4 pl-4 text-[1.05em] italic leading-relaxed opacity-80"
            style={{ borderColor: "var(--article-border)" }}
          >
            {article.excerpt}
          </p>
        )}

        <hr className="my-7 border-t" style={{ borderColor: "var(--article-border)" }} />

        <div
          className={`article-body font-reading${showImages ? "" : " hide-images"}`}
          style={{ fontSize }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>

      <p className="mt-6 text-center text-[13px] opacity-70">
        Extraído de{" "}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {host}
        </a>{" "}
        · conteúdo © dos respectivos autores
      </p>
    </article>
  );
}
