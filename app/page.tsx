import { redirect } from "next/navigation";
import Reader from "@/components/Reader";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>;
}) {
  // Compat: /?url=... antigo redireciona para a rota limpa /dominio/caminho
  const sp = await searchParams;
  const legacy = Array.isArray(sp.url) ? sp.url[0] : sp.url;
  if (legacy?.trim()) {
    const clean = legacy.trim().replace(/^https?:\/\//i, "");
    if (clean) redirect(`/${clean}`);
  }
  return <Reader initialUrl={null} legacyUrl={null} />;
}
