import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reader from "@/components/Reader";
import { urlFromSlug } from "@/lib/types";
import { extractArticle } from "@/lib/extract";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const target = urlFromSlug(slug);
  if (!target) return { title: "Modo Leitura" };
  try {
    const article = await extractArticle(target);
    return {
      title: `${article.title} — Modo Leitura`,
      description: article.excerpt || undefined,
    };
  } catch {
    return { title: "Modo Leitura" };
  }
}

export default async function SlugPage({ params }: Props) {
  const { slug } = await params;
  const target = urlFromSlug(slug);
  if (!target) notFound();
  // initialUrl hidrata o Reader (client) que busca /api/ler e renderiza.
  return <Reader initialUrl={target} legacyUrl={null} />;
}
