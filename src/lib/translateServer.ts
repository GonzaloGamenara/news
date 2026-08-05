/**
 * Traducción inglés → español del lado del servidor.
 *
 * Lo usan /api/translate (títulos y resúmenes del feed) y /api/article (el
 * cuerpo completo de una nota en el lector).
 */

/**
 * El endpoint recibe los textos como query params, así que el límite real es el
 * largo de la URL, no la cantidad. Se arman lotes por presupuesto de caracteres.
 */
const BATCH_CHARS = 1500;
const MAX_CHARS_PER_TEXT = 1800;

export async function translateTexts(texts: string[]): Promise<string[]> {
  const out = [...texts];

  // Índices de lo que hay que traducir de verdad.
  const pending = texts
    .map((t, i) => [t, i] as const)
    .filter(([t]) => t.trim() !== "");

  const batches: (readonly [string, number])[][] = [];
  let current: (readonly [string, number])[] = [];
  let chars = 0;

  for (const entry of pending) {
    const length = Math.min(entry[0].length, MAX_CHARS_PER_TEXT);
    if (current.length > 0 && chars + length > BATCH_CHARS) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(entry);
    chars += length;
  }
  if (current.length > 0) batches.push(current);

  // En paralelo y no en serie: una nota larga son 6-8 lotes, y encadenarlos
  // hacía esperar 7 s antes de poder leer. De a 5 baja a ~2 s sin castigar al
  // endpoint con decenas de requests simultáneos.
  const CONCURRENCY = 5;

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map(runBatch));
  }

  async function runBatch(batch: (readonly [string, number])[]) {
    const query = batch
      .map(([t]) => `q=${encodeURIComponent(t.slice(0, MAX_CHARS_PER_TEXT))}`)
      .join("&");

    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/t?client=gtx&sl=en&tl=es&${query}`,
        {
          headers: { "user-agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(12_000),
          next: { revalidate: 604_800 },
        },
      );
      if (!res.ok) return;

      const data: unknown = await res.json();
      if (!Array.isArray(data)) return;

      batch.forEach(([, index], i) => {
        const value = data[i];
        if (typeof value === "string") out[index] = value;
      });
    } catch {
      // Un lote que falla deja esos textos en inglés; el resto igual se traduce.
    }
  }

  return out;
}
