import { Feed } from "@/components/Feed";
import { fetchAll } from "@/lib/rss";
import { sourcesFor } from "@/lib/sources";
import type { FeedResponse } from "@/lib/types";

// La home se regenera cada 10 minutos (ISR). Así el HTML ya llega con noticias
// adentro: abrís la app en el subte y ves algo antes de que corra un solo fetch.
export const revalidate = 600;

export default async function Home() {
  const { articles, failed, fetchedAt } = await fetchAll(sourcesFor("para-vos"));

  const initial: FeedResponse = {
    // 120 y no 400: van embebidas en el HTML, y 400 lo llevaban a 348 KB. El
    // ranking necesita un pool para elegir, pero nadie scrollea 400 notas.
    articles: articles.slice(0, 120),
    fetchedAt,
    failed,
  };

  return <Feed initial={initial} />;
}
