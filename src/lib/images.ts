/**
 * Las imágenes de los feeds vienen al tamaño original del medio: medimos 424 KB
 * de promedio y picos de 1,8 MB, para mostrarse en una tarjeta de 350 px. En
 * datos, eso es ~20 MB por viaje.
 *
 * wsrv.nl (images.weserv.nl) redimensiona y convierte a WebP. Es gratis, no
 * necesita cuenta y no consume la cuota de optimización de imágenes de Vercel.
 */

const PROXY = "https://wsrv.nl/";

/**
 * Calidad 60 y no 72: medido sobre 10 imágenes reales, 49 KB → 27 KB de
 * promedio. A este tamaño en un teléfono la diferencia no se ve, y son 22 KB
 * por tarjeta que no pagás con datos.
 *
 * (Se probó AVIF, que sería ~25% más chico todavía, pero wsrv falló en las 10
 * imágenes: el encoder tarda demasiado y corta. Si algún día responde, es
 * cambiar `output`.)
 */
const QUALITY = "60";

/**
 * @param width ancho real en píxeles CSS al que se muestra la imagen. Se pide
 *   el doble por las pantallas retina; más que eso es tirar datos.
 */
export function thumb(url: string, width: number): string {
  // Los data: URIs y lo que no sea http(s) no se pueden proxear.
  if (!/^https?:\/\//i.test(url)) return url;

  const params = new URLSearchParams({
    url,
    w: String(width * 2),
    output: "webp",
    q: QUALITY,
    // `we` = "without enlargement": si el original es más chico, no lo agranda
    // (varias fuentes publican miniaturas de 200 px).
    we: "1",
  });

  return `${PROXY}?${params.toString()}`;
}
