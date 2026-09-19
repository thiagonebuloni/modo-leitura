import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom precisa rodar como Node "de verdade" na function (require nativo
  // de 'ws', 'canvas' etc.). Sem isso a Vercel quebra o bundle com
  // ERR_REQUIRE_ESM em /api/ler e até em rotas que o importam (slug, metadata).
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
