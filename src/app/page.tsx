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
    articles: articles.slice(0, 400),
    fetchedAt,
    failed,
  };

  return <Feed initial={initial} />;
}
