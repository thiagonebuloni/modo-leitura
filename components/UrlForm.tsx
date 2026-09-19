"use client";

import { useRef } from "react";

interface Props {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onExample: (url: string) => void;
}

const EXAMPLES = [
  { label: "📖 Artigo Wikipedia", url: "https://pt.wikipedia.org/wiki/Machado_de_Assis" },
  { label: "🧪 Página simples", url: "https://example.com" },
];

export default function UrlForm({ value, loading, onChange, onSubmit, onExample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Lê direto do DOM no submit: imune a estado desatualizado / autofill / extensão.
  const submitFromDom = () => {
    const domValue = inputRef.current?.value ?? value;
    if (domValue.trim() && domValue.trim() !== value) onChange(domValue);
    onSubmit(domValue);
  };
  return (
    <>
      <div className="mx-auto mt-8 max-w-xl">
        <div className="theme-card flex flex-col gap-2 rounded-2xl border p-2 shadow-sm sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitFromDom();
              }
            }}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://exemplo.com/meu-artigo"
            className="theme-input h-12 flex-1 rounded-xl bg-transparent px-4 text-[15px] outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={submitFromDom}
            disabled={loading}
            className="theme-btn-primary h-12 shrink-0 cursor-pointer rounded-xl px-6 text-[15px] font-semibold transition disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Lendo…" : "Ler agora →"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px]">
          <span className="opacity-60">Experimente:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              onClick={() => onExample(ex.url)}
              className="theme-chip cursor-pointer rounded-full border px-3 py-1"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mx-auto mt-12 max-w-xl animate-pulse space-y-3">
          <div className="theme-skeleton h-8 w-3/4 rounded" />
          <div className="theme-skeleton h-4 w-full rounded" />
          <div className="theme-skeleton h-4 w-full rounded" />
          <div className="theme-skeleton h-4 w-5/6 rounded" />
          <p className="pt-2 text-center text-sm opacity-70">
            Baixando a página e extraindo o texto principal…
          </p>
        </div>
      )}
    </>
  );
}
