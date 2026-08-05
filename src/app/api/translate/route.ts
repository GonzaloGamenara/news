import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Traducción inglés → español en el servidor.
 *
 * La Translator API de Chrome no sirve acá: en iOS toda PWA corre sobre WebKit
 * (incluso "Chrome"), así que no existe. Traducir del lado del servidor anda en
 * cualquier dispositivo y además comparte el trabajo entre sesiones.
 */

/** Tope por request, para no armar URLs gigantes ni tardar una eternidad. */
const MAX_TEXTS = 24;
const MAX_CHARS = 1200;

export async function POST(request: Request) {
  let texts: string[];
  try {
    const body = (await request.json()) as { texts?: unknown };
    if (!Array.isArray(body.texts)) throw new Error("bad body");
    texts = body.texts
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .slice(0, MAX_TEXTS)
      .map((t) => t.slice(0, MAX_CHARS));
  } catch {
    return NextResponse.json({ translations: [] }, { status: 400 });
  }

  if (texts.length === 0) return NextResponse.json({ translations: [] });

  const url =
    "https://translate.googleapis.com/translate_a/t?client=gtx&sl=en&tl=es&" +
    texts.map((t) => `q=${encodeURIComponent(t)}`).join("&");

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
      // Una traducción no cambia: la cacheamos por una semana.
      next: { revalidate: 604_800 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: unknown = await res.json();
    const translations = Array.isArray(data)
      ? data.map((t, i) => (typeof t === "string" ? t : texts[i]))
      : texts;

    return NextResponse.json(
      { translations },
      { headers: { "cache-control": "public, s-maxage=604800, immutable" } },
    );
  } catch {
    // Si falla, devolvemos los originales: mejor en inglés que en blanco.
    return NextResponse.json({ translations: texts });
  }
}
