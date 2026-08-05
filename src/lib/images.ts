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
 * @param width ancho de destino en píxeles CSS. Se pide el doble para pantallas
 *   retina, que es lo que tiene cualquier teléfono.
 */
export function thumb(url: string, width: number): string {
  // Los data: URIs y lo que no sea http(s) no se pueden proxear.
  if (!/^https?:\/\//i.test(url)) return url;

  const params = new URLSearchParams({
    url,
    w: String(width * 2),
    output: "webp",
    q: "72",
    // `we` = "without enlargement": si el original es más chico, no lo agranda
    // (varias fuentes publican miniaturas de 200 px).
    we: "1",
  });

  return `${PROXY}?${params.toString()}`;
}
