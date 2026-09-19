"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExtractedArticle, Theme } from "@/lib/types";
import { FONT_STEPS, normalizeUrl, toCleanPath } from "@/lib/types";
import Header from "@/components/Header";
import UrlForm from "@/components/UrlForm";
import ArticleView from "@/components/ArticleView";

export type Status = "idle" | "loading" | "done" | "error";

const LS_KEYS = {
  theme: "modo-leitura:theme",
  fontIndex: "modo-leitura:fontIndex",
  showImages: "modo-leitura:showImages",
} as const;

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(LS_KEYS.theme);
    return v === "dark" || v === "sepia" || v === "light" ? v : "light";
  } catch {
    return "light";
  }
}

function readFontIndex(): number {
  try {
    const v = Number(localStorage.getItem(LS_KEYS.fontIndex));
    return Number.isInteger(v) && v >= 0 && v < FONT_STEPS.length ? v : 1;
  } catch {
    return 1;
  }
}

function readShowImages(): boolean {
  try {
    return localStorage.getItem(LS_KEYS.showImages) !== "off";
  } catch {
    return true;
  }
}

interface ReaderProps {
  /** URL inicial vinda da rota /[...slug] (ex: /example.com/post). */
  initialUrl?: string | null;
  /** Query legada ?url= (redireciona para a rota limpa). */
  legacyUrl?: string | null;
}

export default function Reader({ initialUrl, legacyUrl }: ReaderProps) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [article, setArticle] = useState<ExtractedArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [fontIndex, setFontIndex] = useState<number>(1);
  const [progress, setProgress] = useState(0);
  const [showImages, setShowImages] = useState<boolean>(true);
  // Só aplica o localStorage DEPOIS da hidratação (primeiro render usa os
  // padrões, iguais ao SSR). Sem isso dá hydration mismatch e o React
  // descarta a árvore do cliente — inclusive perdendo o tema ao navegar.
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => {
    setTheme(readTheme());
    setFontIndex(readFontIndex());
    setShowImages(readShowImages());
    setPrefsReady(true);
  }, []);

  // Persiste preferências no localStorage a cada mudança (após hidratação).
  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem(LS_KEYS.theme, theme);
    } catch {}
  }, [theme, prefsReady]);
  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem(LS_KEYS.fontIndex, String(fontIndex));
    } catch {}
  }, [fontIndex, prefsReady]);
  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem(LS_KEYS.showImages, showImages ? "on" : "off");
    } catch {}
  }, [showImages, prefsReady]);

  useEffect(() => {
    if (status !== "done") return;
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [status]);

  const load = useCallback(async (rawUrl: string, push = true) => {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    setStatus("loading");
    setError(null);
    setArticle(null);
    setProgress(0);
    window.scrollTo({ top: 0 });
    try {
      const res = await fetch(`/api/ler?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao extrair.");
      const art = data.article as ExtractedArticle;
      setArticle(art);
      setStatus("done");
      if (push) {
        // Barra de endereços limpa: /example.com/post em vez de /?url=...
        window.history.replaceState(null, "", `/${toCleanPath(art.url)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setStatus("error");
    }
  }, []);

  // Carregamento inicial: /[...slug] ou ?url= legado (redireciona p/ rota limpa).
  useEffect(() => {
    if (initialUrl) {
      setInput(initialUrl);
      load(initialUrl, false);
    } else if (legacyUrl) {
      setInput(legacyUrl);
      load(legacyUrl, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = useCallback(() => {
    setArticle(null);
    setStatus("idle");
    setInput("");
    setError(null);
    window.history.replaceState(null, "", "/");
  }, []);

  const done = status === "done" && article;

  return (
    <div className="page-theme flex min-h-full flex-1 flex-col" data-theme={theme}>
      {done ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1">
          <div
            className="theme-progress h-full transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}

      <Header
        theme={theme}
        onTheme={setTheme}
        onSmaller={() => setFontIndex((i) => Math.max(0, i - 1))}
        onBigger={() => setFontIndex((i) => Math.min(FONT_STEPS.length - 1, i + 1))}
        canSmaller={fontIndex > 0}
        canBigger={fontIndex < FONT_STEPS.length - 1}
        onHome={goHome}
        showImages={showImages}
        onToggleImages={() => setShowImages((v) => !v)}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24">
        {!done && (
          <section className="pt-14 sm:pt-20">
            <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              Cole o link. <span className="opacity-60">Leia em paz.</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed opacity-80">
              Removemos anúncios, menus, pop-ups, vídeos, scripts e camadas
              sobre o texto — sobra só o conteúdo principal do artigo.
            </p>

            <UrlForm
              value={input}
              loading={status === "loading"}
              onChange={setInput}
              onSubmit={(v) => load(v)}
              onExample={(url) => {
                setInput(url);
                load(url);
              }}
            />

            {status === "idle" && !error && (
              <p className="mx-auto mt-3 max-w-xl text-center text-[12px] opacity-60">
                Funciona com ou sem https:// — pode colar só o domínio também.
              </p>
            )}

            {status === "error" && error && (
              <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-[14px] leading-relaxed text-red-900">
                <p className="font-semibold">Não foi possível ler essa página</p>
                <p className="mt-1">{error}</p>
                <p className="mt-2 text-red-700/80">
                  Dica: funciona melhor com posts de blog, notícias e artigos.
                </p>
              </div>
            )}

            <div className="mx-auto mt-14 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { title: "Zero distração", desc: "Sem anúncios, menus, pop-ups ou autoplay." },
                { title: "Sem JavaScript", desc: "Scripts, trackers e overlays removidos." },
                { title: "Só o essencial", desc: "Texto, títulos, imagens e links do artigo." },
              ].map((c) => (
                <div key={c.title} className="theme-card rounded-2xl border p-4 text-center">
                  <p className="mt-2 text-sm font-bold">{c.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed opacity-70">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {done && (
          <ArticleView
            article={article}
            fontSize={FONT_STEPS[fontIndex]}
            showImages={showImages}
            onBack={goHome}
          />
        )}
      </main>

      <footer className="theme-header border-t py-6 text-center text-[13px] opacity-60">
        Modo Leitura — feito para ler sem distrações · sem JS · sem trackers
      </footer>
    </div>
  );
}