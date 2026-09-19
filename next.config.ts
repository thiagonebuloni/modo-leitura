import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
