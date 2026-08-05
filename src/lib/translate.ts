"use client";

import { useSyncExternalStore } from "react";

/**
 * Traducción inglés → español en el dispositivo, con la Translator API de
 * Chrome (138+). No hay API key, no hay costo y el texto no sale del teléfono.
 *
 * Es una mejora progresiva: donde el navegador no la soporta, la app funciona
 * igual y la opción no se ofrece. La primera vez Chrome baja un paquete de
 * idioma (~30 MB), y por eso `create()` exige un gesto del usuario: se llama
 * desde el click del toggle, nunca sola.
 */

type TranslatorInstance = {
  translate: (input: string) => Promise<string>;
};

type TranslatorFactory = {
  availability: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }) => Promise<TranslatorInstance>;
};

export type TranslateStatus =
  | "unsupported"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "ready";

function factory(): TranslatorFactory | null {
  if (typeof self === "undefined") return null;
  const t = (self as unknown as { Translator?: TranslatorFactory }).Translator;
  return t && typeof t.create === "function" ? t : null;
}

export function isSupported(): boolean {
  return factory() !== null;
}

export async function status(): Promise<TranslateStatus> {
  const t = factory();
  if (!t) return "unsupported";
  try {
    const availability = await t.availability({ sourceLanguage: "en", targetLanguage: "es" });
    return availability === "available" ? "ready" : availability;
  } catch {
    return "unavailable";
  }
}

let instance: Promise<TranslatorInstance | null> | null = null;

/** Se crea una sola vez y se reusa: instanciar el modelo es caro. */
function translator(): Promise<TranslatorInstance | null> {
  const t = factory();
  if (!t) return Promise.resolve(null);

  instance ??= t
    .create({ sourceLanguage: "en", targetLanguage: "es" })
    .catch(() => null);

  return instance;
}

// Cache global: el mismo título aparece al re-rankear, al paginar y al volver
// de otra categoría. Traducir dos veces lo mismo es puro gasto de batería.
const cache = new Map<string, string>();

// Las traducciones llegan de a poco y de forma asíncrona. En vez de mantener
// estado en cada tarjeta, publicamos un contador: cuando sube, React repinta
// y cada tarjeta lee del cache lo que haya.
let version = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Se suscribe a las traducciones nuevas. Devuelve un número que solo crece. */
export function useTranslationVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

function publish() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Traducción ya disponible para este texto, si la hay. */
export function cached(text: string): string | undefined {
  return cache.get(text);
}

// Cola de trabajo. El modelo corre en el dispositivo: mandarle 200 títulos en
// paralelo traba la interfaz, así que hay un solo worker que va drenando.
const queue = new Set<string>();
let running = false;

/** Encola los textos que falten y arranca el worker si no está corriendo. */
export function translateAll(texts: string[]): void {
  for (const text of texts) {
    if (text.trim() !== "" && !cache.has(text)) queue.add(text);
  }
  if (queue.size > 0 && !running) void drain();
}

async function drain(): Promise<void> {
  const engine = await translator();
  if (!engine) {
    queue.clear();
    return;
  }

  running = true;
  try {
    let sinceLastPublish = 0;

    // Se relee la cola en cada vuelta: si mientras traducimos scrolleás y
    // entran títulos nuevos, entran acá sin arrancar un segundo worker.
    while (queue.size > 0) {
      const text = queue.values().next().value as string;
      queue.delete(text);
      if (cache.has(text)) continue;

      try {
        cache.set(text, await engine.translate(text));
      } catch {
        // Un texto que falla no debe frenar al resto: lo dejamos en su idioma.
        cache.set(text, text);
      }

      // Repintar en cada texto haría 200 renders; de a 6 se ve fluido igual.
      if (++sinceLastPublish >= 6) {
        sinceLastPublish = 0;
        publish();
      }
    }
  } finally {
    running = false;
    publish();
  }
}

export function clearCache(): void {
  cache.clear();
  queue.clear();
  publish();
}
