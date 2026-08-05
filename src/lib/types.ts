export type CategoryId =
  | "para-vos"
  | "cine"
  | "videojuegos"
  | "teatro"
  | "libros"
  | "tecnologia"
  | "ciencia";

export type Lang = "es" | "en";

/** Qué idiomas mostrar en el feed. */
export type LangFilter = "todo" | "es" | "en";

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
  lang: Lang;
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
  lang: Lang;
};

/**
 * `unsupported`: el dominio no está en la allowlist del lector.
 * `too-short`:   la extracción trajo un teaser o hay muro de pago.
 * `failed`:      el sitio no respondió o no se pudo parsear.
 * `invalid`:     falta la URL o está mal formada.
 */
export type ArticleFailure = "unsupported" | "too-short" | "failed" | "invalid";

/** Respuesta del lector in-app. */
export type ArticleContent =
  | {
      ok: true;
      title: string;
      byline: string | null;
      siteName: string | null;
      /** HTML ya saneado: seguro para dangerouslySetInnerHTML. */
      html: string;
      minutes: number;
    }
  | { ok: false; reason: ArticleFailure };

/** Estado del lector para una nota. */
export type ReaderState =
  | { phase: "loading" }
  | { phase: "ready"; content: Extract<ArticleContent, { ok: true }> }
  | { phase: "error"; reason: ArticleFailure };

/** Lo que se guarda en Supabase por dispositivo. */
export type SyncPayload = {
  profile: unknown;
  prefs: unknown;
  /** Reloj del cliente: gana la escritura más nueva. */
  updatedAt: number;
};

export type FeedResponse = {
  articles: Article[];
  fetchedAt: number;
  /** Fuentes que fallaron en este fetch, para poder mostrarlo sin romper la app. */
  failed: string[];
};
