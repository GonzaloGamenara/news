export type CategoryId =
  | "para-vos"
  | "cine"
  | "videojuegos"
  | "teatro"
  | "libros"
  | "tecnologia"
  | "ciencia";

export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
  /** Color de acento, en HSL sin el wrapper (para poder componer con opacidad). */
  accent: string;
};

export type Source = {
  id: string;
  name: string;
  url: string;
  category: Exclude<CategoryId, "para-vos">;
  lang: "es" | "en";
  /**
   * Para feeds generalistas (ej: "Espectáculos" de un diario) que solo deben
   * aportar notas a la categoría si el título/resumen matchea.
   */
  match?: RegExp;
};

export type Article = {
  /** Hash estable de la URL: sobrevive entre refetches y sirve de clave de voto. */
  id: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  publishedAt: number;
  sourceId: string;
  sourceName: string;
  category: Exclude<CategoryId, "para-vos">;
  lang: "es" | "en";
};

export type FeedResponse = {
  articles: Article[];
  fetchedAt: number;
  /** Fuentes que fallaron en este fetch, para poder mostrarlo sin romper la app. */
  failed: string[];
};
