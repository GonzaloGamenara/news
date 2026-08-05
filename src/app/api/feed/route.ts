import { NextResponse } from "next/server";
import { fetchAll } from "@/lib/rss";
import { CATEGORIES, sourcesFor } from "@/lib/sources";
import type { CategoryId, FeedResponse } from "@/lib/types";

// Node runtime: fast-xml-parser y los timeouts largos van mejor acá que en edge.
export const runtime = "nodejs";
export const revalidate = 600;

const VALID = new Set<CategoryId>(CATEGORIES.map((c) => c.id));

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("category") ?? "para-vos";
  const category = (VALID.has(raw as CategoryId) ? raw : "para-vos") as CategoryId;

  const { articles, failed, fetchedAt } = await fetchAll(sourcesFor(category));

  const body: FeedResponse = {
    // El cliente re-ordena con tu perfil; acá solo mandamos un corte razonable
    // por recencia para no enviar 1500 items por la red del subte.
    articles: articles.slice(0, category === "para-vos" ? 400 : 200),
    fetchedAt,
    failed,
  };

  return NextResponse.json(body, {
    headers: {
      // Cache en el CDN: 10 min fresco, 1 h sirviendo lo viejo mientras revalida.
      "cache-control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
