import { SOURCES } from "./sources";

/**
 * El lector in-app baja la página de la nota desde el servidor. Sin control,
 * eso es un SSRF abierto: cualquiera podría usar la app para pedir URLs
 * internas. Por eso solo se permiten los dominios de nuestro propio catálogo.
 */

/** Subdominios de publicación de feeds que no aparecen en las URLs de las notas. */
const FEED_PREFIXES = /^(feeds?|rss|api|www)\./;

/**
 * Dominios donde publican fuentes cuyo feed vive en otro host.
 * (BBC Mundo sirve el RSS desde bbci.co.uk pero las notas están en bbc.com.)
 */
const EXTRA_HOSTS = ["bbc.com", "bbc.co.uk"];

function registrable(hostname: string): string {
  return hostname.toLowerCase().replace(FEED_PREFIXES, "");
}

const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  ...SOURCES.map((s) => registrable(new URL(s.url).hostname)),
  ...EXTRA_HOSTS,
]);

/**
 * ¿Podemos abrir esta nota adentro de la app?
 *
 * Hacker News, por ejemplo, enlaza a cualquier sitio de internet: esas notas
 * quedan fuera y se abren en el navegador, que es el comportamiento seguro.
 */
export function isReadable(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  for (const allowed of ALLOWED_HOSTS) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

/** Para debug y tests: qué dominios acepta el lector. */
export const readableHosts = () => [...ALLOWED_HOSTS].sort();
