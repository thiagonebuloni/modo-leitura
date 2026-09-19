import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O jsdom deve rodar como módulo Node nativo dentro da function (ele faz
  // require() de módulos opcionais e tem resolução interna própria). O Next já
  // o lista em server-external-packages, mas mantemos explícito por clareza.
  //
  // IMPORTANTE (bug de deploy na Vercel): a Vercel DESABILITA por padrão o
  // require() de ES Modules (--no-experimental-require-module). O jsdom 27+
  // depende de pacotes ESM-only (@exodus/bytes, css-tree, parse5, ...), então
  // require("jsdom") estoura ERR_REQUIRE_ESM e a function morre no load —
  // derrubando /api/ler e qualquer rota que importe lib/extract (a catch-all
  // /[...slug] e o generateMetadata). Por isso o package.json fixa
  // jsdom@^26.1.0, cuja árvore de dependências é 100% CommonJS.
  serverExternalPackages: ["jsdom"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Sem sniffing de MIME (impede que HTML sanitizado vire "script")
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sem embed em iframe externo (anti-clickjacking)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Referer mínimo ao sair para o "Original" / links externos
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Bloqueia plugins/Flash e afins
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default nextConfig;
