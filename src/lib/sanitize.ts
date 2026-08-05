import { parseHTML } from "linkedom";
import { thumb } from "./images";

/**
 * Limpia el HTML que devuelve Readability antes de inyectarlo en la app.
 *
 * Aunque las fuentes son medios conocidos, el HTML viene de páginas de terceros
 * y termina en un dangerouslySetInnerHTML: si algún sitio queda comprometido,
 * esto es lo único que separa una nota de un XSS. Por eso la lista es de
 * permitidos (allowlist), no de prohibidos: lo que no reconocemos, no pasa.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "small", "mark",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "q", "cite",
  "pre", "code", "kbd", "samp",
  "figure", "figcaption", "img", "picture", "source",
  "a",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
]);

/** Se borran con todo su contenido adentro. */
const DROP_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input", "button",
  "select", "textarea", "noscript", "svg", "math", "link", "meta", "video",
  "audio", "canvas", "template", "base",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "width", "height"]),
  source: new Set(["srcset", "type"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

function safeUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Traduce el texto visible de un HTML ya saneado, conservando el marcado.
 *
 * Se recorren los nodos de texto en vez del HTML crudo: así los enlaces, las
 * negritas y los pies de foto siguen en su lugar después de traducir.
 */
export async function translateHtml(
  html: string,
  translate: (texts: string[]) => Promise<string[]>,
): Promise<string> {
  const { document } = parseHTML(`<div id="root">${html}</div>`);
  const root = document.getElementById("root");
  if (!root) return html;

  const nodes: { node: { textContent: string | null }; text: string }[] = [];

  const walk = (element: { childNodes: ArrayLike<unknown> }) => {
    for (const child of Array.from(element.childNodes) as {
      nodeType: number;
      textContent: string | null;
      childNodes?: ArrayLike<unknown>;
    }[]) {
      if (child.nodeType === 3) {
        const text = child.textContent ?? "";
        // Los fragmentos de una o dos letras (espacios, comas sueltas entre
        // etiquetas) no se mandan a traducir: gastan lote y vuelven igual.
        if (text.trim().length > 2) nodes.push({ node: child, text });
      } else if (child.childNodes) {
        walk(child as { childNodes: ArrayLike<unknown> });
      }
    }
  };

  walk(root);
  if (nodes.length === 0) return html;

  const translated = await translate(nodes.map((n) => n.text));
  nodes.forEach((n, i) => {
    n.node.textContent = translated[i] ?? n.text;
  });

  return root.innerHTML;
}

export function sanitize(html: string, baseUrl: string): string {
  const { document } = parseHTML(`<div id="root">${html}</div>`);
  const root = document.getElementById("root");
  if (!root) return "";

  // Snapshot de los elementos: vamos a mutar el árbol mientras lo recorremos.
  for (const el of [...root.querySelectorAll("*")]) {
    const tag = el.tagName?.toLowerCase();
    if (!tag) continue;

    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Etiqueta desconocida pero inofensiva: conservamos el contenido y
      // tiramos la etiqueta, para no perder texto de la nota.
      el.replaceWith(...el.childNodes);
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (!allowed.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }

      // href/src pueden traer javascript: o data:; los resolvemos contra la
      // URL de la nota y solo dejamos pasar http(s).
      if (name === "href" || name === "src") {
        const resolved = safeUrl(attr.value, baseUrl);
        if (resolved) el.setAttribute(name, resolved);
        else el.removeAttribute(attr.name);
      }
    }

    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer nofollow");
    }

    if (tag === "img") {
      const src = el.getAttribute("src");
      if (!src) el.remove();
      else {
        // Las imágenes de una nota pesan tanto como las del feed: van por el
        // mismo redimensionador.
        el.setAttribute("src", thumb(src, 700));
        el.setAttribute("loading", "lazy");
        el.setAttribute("referrerpolicy", "no-referrer");
      }
    }
  }

  return root.innerHTML;
}
