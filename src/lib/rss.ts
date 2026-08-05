import { XMLParser } from "fast-xml-parser";
import type { Article, Source } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  trimValues: true,
  // Varios feeds publican HTML escapado dentro de <description>; lo dejamos crudo
  // y lo limpiamos nosotros para poder rescatar la primera <img>.
  processEntities: true,
  htmlEntities: true,
});

/** Hash determinístico (djb2) — mismo artículo ⇒ mismo id entre sesiones. */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** fast-xml-parser devuelve string | {"#text": string} | array según el feed. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if ("#text" in o) return text(o["#text"]);
    if ("@href" in o) return String(o["@href"]);
  }
  return "";
}

function attr(node: unknown, name: string): string {
  if (node == null) return "";
  if (Array.isArray(node)) {
    for (const n of node) {
      const v = attr(n, name);
      if (v) return v;
    }
    return "";
  }
  if (typeof node === "object") {
    const v = (node as Record<string, unknown>)[name];
    if (typeof v === "string") return v;
  }
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca imagen en los seis lugares donde los feeds la esconden. */
function extractImage(item: Record<string, unknown>, rawHtml: string): string | null {
  const candidates = [
    attr(item["media:content"], "@url"),
    attr(item["media:thumbnail"], "@url"),
    attr(item["enclosure"], "@url"),
    text((item["media:group"] as Record<string, unknown>)?.["media:content"]),
    attr((item["media:group"] as Record<string, unknown>)?.["media:content"], "@url"),
    attr(item["image"], "@href"),
    text(item["image"]),
    rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "",
  ];

  for (const c of candidates) {
    if (!c) continue;
    const url = c.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    // Descartamos tracking pixels y logos de 1x1 que algunos feeds meten.
    if (/\/(1x1|pixel|spacer|blank)\.(gif|png)/i.test(url)) continue;
    return url;
  }
  return null;
}

function parseDate(...values: unknown[]): number {
  for (const v of values) {
    const s = text(v);
    if (!s) continue;
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

/** Normaliza un <item> (RSS) o <entry> (Atom) al shape de Article. */
function toArticle(raw: Record<string, unknown>, source: Source): Article | null {
  const title = stripHtml(text(raw.title));
  if (!title) return null;

  // Atom usa <link href="..."/>, a veces con varios rel. Preferimos rel="alternate".
  let url = "";
  const link = raw.link;
  if (Array.isArray(link)) {
    const alt = link.find((l) => attr(l, "@rel") === "alternate" || !attr(l, "@rel"));
    url = attr(alt, "@href") || text(alt);
  } else {
    url = attr(link, "@href") || text(link);
  }
  url = url || text(raw.guid) || text(raw.id);
  if (!/^https?:\/\//i.test(url)) return null;

  const rawSummary =
    text(raw["content:encoded"]) ||
    text(raw.description) ||
    text(raw.summary) ||
    text(raw.content);

  const summary = stripHtml(rawSummary).slice(0, 320);

  if (source.match && !source.match.test(`${title} ${summary}`)) return null;

  return {
    id: hashId(url),
    title,
    summary,
    url,
    image: extractImage(raw, rawSummary),
    publishedAt: parseDate(raw.pubDate, raw.published, raw.updated, raw["dc:date"]),
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    lang: source.lang,
  };
}

export async function fetchSource(
  source: Source,
  timeoutMs = 8000,
): Promise<Article[]> {
  const res = await fetch(source.url, {
    headers: {
      "user-agent": UA,
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`${source.id}: HTTP ${res.status}`);

  const xml = await res.text();
  const doc = parser.parse(xml);

  const channel = doc?.rss?.channel ?? doc?.["rdf:RDF"] ?? doc?.feed ?? {};
  const rawItems = channel.item ?? channel.entry ?? doc?.feed?.entry ?? [];
  const items: Record<string, unknown>[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
      ? [rawItems]
      : [];

  return items
    .map((i) => toArticle(i, source))
    .filter((a): a is Article => a !== null)
    .slice(0, 30);
}

/**
 * Trae todas las fuentes en paralelo. Una fuente caída nunca tumba el feed:
 * se acumula en `failed` y la app sigue mostrando el resto.
 */
export async function fetchAll(
  sources: Source[],
): Promise<{ articles: Article[]; failed: string[]; fetchedAt: number }> {
  const settled = await Promise.allSettled(sources.map((s) => fetchSource(s)));

  const articles: Article[] = [];
  const failed: string[] = [];

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") articles.push(...r.value);
    else failed.push(sources[i].id);
  });

  return { articles: dedupe(articles), failed, fetchedAt: Date.now() };
}

/**
 * Deduplica por URL y por título casi-idéntico: las agencias replican la misma
 * nota en varios medios y sin esto el feed queda lleno de repetidos.
 */
function dedupe(articles: Article[]): Article[] {
  const byUrl = new Set<string>();
  const byTitle = new Set<string>();
  const out: Article[] = [];

  for (const a of articles.sort((x, y) => y.publishedAt - x.publishedAt)) {
    const urlKey = a.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    const titleKey = a.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .slice(0, 8)
      .join(" ");

    if (byUrl.has(urlKey) || byTitle.has(titleKey)) continue;
    byUrl.add(urlKey);
    byTitle.add(titleKey);
    out.push(a);
  }

  return out;
}
