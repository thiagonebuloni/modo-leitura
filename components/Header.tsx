"use client";

import type { Theme } from "@/lib/types";

interface Props {
  theme: Theme;
  onTheme: (t: Theme) => void;
  onSmaller: () => void;
  onBigger: () => void;
  canSmaller: boolean;
  canBigger: boolean;
  onHome: () => void;
  showImages: boolean;
  onToggleImages: () => void;
}

export default function Header(p: Props) {
  return (
    <header className="theme-header sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4">
        <button type="button" onClick={p.onHome} className="flex cursor-pointer items-center gap-2 text-left">
          <span className="theme-logo grid h-9 w-9 place-items-center rounded-xl text-lg">
            📰
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">Modo Leitura</span>
            <span className="block text-xs opacity-70">leia sem distrações</span>
          </span>
        </button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <div className="theme-card flex items-center rounded-full border p-1">
            {(["light", "sepia", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                type="button"
                title={t === "light" ? "Claro" : t === "sepia" ? "Sépia" : "Escuro"}
                aria-pressed={p.theme === t}
                onClick={() => p.onTheme(t)}
                className={`h-7 w-7 cursor-pointer rounded-full border transition ${
                  p.theme === t ? "theme-swatch-active" : "border-transparent hover:border-[var(--page-border)]"
                } ${t === "light" ? "bg-[#eff1f5]" : t === "sepia" ? "bg-[#c3a961]" : "bg-stone-900"}`}
              >
                <span className="sr-only">{t}</span>
              </button>
            ))}
          </div>
          <div className="theme-card flex items-center rounded-full border px-1 py-1">
            <button
              type="button"
              onClick={p.onSmaller}
              disabled={!p.canSmaller}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-sm font-bold opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              title="Diminuir fonte"
            >
              A−
            </button>
            <button
              type="button"
              onClick={p.onBigger}
              disabled={!p.canBigger}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-sm font-bold opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              title="Aumentar fonte"
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={p.onToggleImages}
            aria-pressed={p.showImages}
            title={p.showImages ? "Ocultar imagens do artigo" : "Mostrar imagens do artigo"}
            className="theme-chip h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition"
          >
            {p.showImages ? "Imagens: on" : "Imagens: off"}
          </button>
        </div>
      </div>
    </header>
  );
}
