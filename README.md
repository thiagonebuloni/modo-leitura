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

### ⚠️ Não atualize o jsdom para 27+

A Vercel **desabilita por padrão** o `require()` de ES Modules. O jsdom **27+** passou a
depender de pacotes ESM-only (`@exodus/bytes`, `css-tree`, `parse5`...), então
`require("jsdom")` lança `ERR_REQUIRE_ESM` **no carregamento da function** — isso derruba
`/api/ler` e qualquer rota que importe `lib/extract` (a rota `/[...slug]` e o
`generateMetadata`), devolvendo HTTP 500 até na home.

Por isso o `package.json` fixa **`jsdom@^26.1.0`**, cuja árvore é 100% CommonJS. A extração
produz resultado **idêntico** ao jsdom 30 (validado na Wikipedia — 172.114 caracteres nos
dois —, example.com, GNU e Hacker News); o tempo de execução ficou equivalente, às vezes
um pouco maior, às vezes menor, sem impacto perceptível no uso.

Se quiser usar jsdom 30, a alternativa é habilitar a flag na Vercel em
**Settings → Environment Variables**:

```
NODE_OPTIONS=--experimental-require-module
```

(`engines: { "node": "24.x" }` já está fixado no `package.json` para garantir o runtime certo.)

### Como reproduzir o bug localmente

```bash
npm run build
NODE_OPTIONS=--no-experimental-require-module npx next start -p 3100
# simula exatamente a Vercel; se jsdom for 27+, /api/ler responde 500
```


## Rodar local

```bash
npm install
npm run dev
# http://localhost:3000
```
