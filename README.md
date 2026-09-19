# Modo Leitura

Cole o link de qualquer artigo e leia **só o texto principal** — sem anúncios, menus, pop-ups, vídeos, scripts ou trackers.

## Como usar

- Acesse a home, cole a URL e clique em **Ler agora**
- Ou digite direto na barra de endereços: `https://SEU-DOMINIO.vercel.app/example.com`
- Links dentro do texto abrem **dentro do app**, na mesma aba

## Recursos

- Extração com Mozilla Readability (engine do Firefox Reader View)
- Temas claro / sépia / escuro (página inteira, salvos no `localStorage`)
- Tamanho de fonte ajustável (A-/A+), toggle de imagens, tempo de leitura
- Fallback automático via Jina Reader quando o site bloqueia robôs (403)
- Proteções: anti-SSRF (bloqueia rede interna), rate limit (30 req/min/IP), limite de 5MB, HTML sanitizado, security headers

## Deploy (Vercel, plano gratuito)

1. Suba este repo para o GitHub
2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repo
3. Aceite os padrões (`npm run build`) e clique em **Deploy**
4. Opcional: em **Settings → Environment Variables**, adicione `JINA_API_KEY` (cota maior no leitor reserva)

Sem variáveis obrigatórias — funciona no plano Hobby.

## Rodar local

```bash
npm install
npm run dev
# http://localhost:3000
```
