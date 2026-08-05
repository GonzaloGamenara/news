import { tokenize } from "./text";
import type { Article } from "./types";

/**
 * TRENDING
 * ========
 * No hay API de "lo más visto": no sabemos qué lee el resto del mundo. Pero sí
 * tenemos algo mejor para noticias — **cuántos medios distintos cubren la misma
 * historia ahora mismo**. Si Variety, Deadline y The Guardian publican sobre lo
 * mismo en dos horas, eso es exactamente lo que "está estallando" significa.
 *
 * Es la misma idea detrás de Google News: agrupar por evento y ordenar por
 * cobertura, no por popularidad individual.
 */

/** Ventana de tiempo. Más allá no es "ahora". */
const WINDOW_HOURS = 30;
/** Qué tan parecidos tienen que ser dos títulos para ser la misma historia. */
const SIMILARITY = 0.28;
/** Mínimo de medios distintos para considerarlo tendencia. */
const MIN_SOURCES = 2;

export type Cluster = {
  /** La nota que representa a la historia. */
  lead: Article;
  /** Medios distintos que la cubren. */
  sources: string[];
  /** Todas las notas del grupo, la principal incluida. */
  articles: Article[];
};

/** Jaccard sobre los tokens del título. Barato y suficiente para titulares. */
function similarity(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Agrupa notas que hablan del mismo hecho y devuelve los grupos ordenados por
 * cobertura. `now` se pasa para que la función sea pura (mismo orden en el
 * servidor y en el cliente).
 */
export function cluster(articles: Article[], now: number): Cluster[] {
  const recent = articles.filter(
    (a) => now - a.publishedAt < WINDOW_HOURS * 3_600_000,
  );

  const tokens = new Map<string, Set<string>>();
  for (const a of recent) {
    tokens.set(a.id, new Set(tokenize(a.title, 10)));
  }

  // Índice invertido: solo comparamos notas que comparten alguna palabra, en
  // vez de todas contra todas.
  const index = new Map<string, Article[]>();
  for (const a of recent) {
    for (const token of tokens.get(a.id)!) {
      const bucket = index.get(token);
      if (bucket) bucket.push(a);
      else index.set(token, [a]);
    }
  }

  const clusterOf = new Map<string, Cluster>();
  const clusters: Cluster[] = [];

  for (const article of recent) {
    if (clusterOf.has(article.id)) continue;

    const mine = tokens.get(article.id)!;
    const group: Article[] = [article];

    // Candidatos: los que comparten al menos una palabra significativa.
    const candidates = new Set<Article>();
    for (const token of mine) {
      for (const other of index.get(token) ?? []) {
        if (other.id !== article.id && !clusterOf.has(other.id)) {
          candidates.add(other);
        }
      }
    }

    for (const other of candidates) {
      if (similarity(mine, tokens.get(other.id)!) >= SIMILARITY) {
        group.push(other);
      }
    }

    // El "lead" es el más reciente del grupo: si la historia se actualizó,
    // querés la versión de ahora, no la de hace ocho horas.
    group.sort((x, y) => y.publishedAt - x.publishedAt);

    const entry: Cluster = {
      lead: group[0],
      sources: [...new Set(group.map((a) => a.sourceId))],
      articles: group,
    };

    for (const a of group) clusterOf.set(a.id, entry);
    clusters.push(entry);
  }

  return clusters
    .filter((c) => c.sources.length >= MIN_SOURCES)
    .sort((a, b) => {
      // Primero cobertura; a igual cobertura, lo más fresco.
      if (b.sources.length !== a.sources.length) {
        return b.sources.length - a.sources.length;
      }
      return b.lead.publishedAt - a.lead.publishedAt;
    });
}

/** Cuántos medios cubren cada nota, para poder mostrarlo en la tarjeta. */
export function coverageMap(clusters: Cluster[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of clusters) {
    if (c.sources.length < MIN_SOURCES) continue;
    for (const a of c.articles) map.set(a.id, c.sources.length);
  }
  return map;
}
