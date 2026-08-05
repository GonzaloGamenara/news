"use client";

import { useSyncExternalStore } from "react";

/**
 * Traducción inglés → español, resuelta por /api/translate.
 *
 * Se hace en el servidor a propósito: en iOS toda PWA corre sobre WebKit
 * (incluso la que instalás "desde Chrome"), así que la Translator API on-device
 * de Chrome no existe ahí. Del lado del servidor anda en cualquier teléfono.
 */

const KEY = "news.translations.v1";
const BATCH = 20;

// Cache: el mismo título aparece al re-rankear, al paginar y al volver de otra
// categoría. Se persiste para que abrir la app dos veces no retraduzca todo.
const cache = new Map<string, string>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, string][]) cache.set(k, v);
  } catch {
    // Storage corrupto: arrancamos sin cache, no es grave.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      // Nos quedamos con las últimas 1500: alcanza de sobra y no infla el storage.
      const entries = [...cache.entries()].slice(-1500);
      window.localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      // Sin persistencia sigue funcionando en memoria.
    }
  }, 1000);
}

// Las traducciones llegan de a tandas. En vez de estado en cada tarjeta,
// publicamos un contador: cuando sube, React repinta y cada tarjeta lee del cache.
let version = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

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
  load();
  return cache.get(text);
}

const queue = new Set<string>();
let running = false;

/** Encola los textos que falten y arranca el worker si no está corriendo. */
export function translateAll(texts: string[]): void {
  load();
  for (const text of texts) {
    if (text.trim() !== "" && !cache.has(text)) queue.add(text);
  }
  if (queue.size > 0 && !running) void drain();
}

async function drain(): Promise<void> {
  running = true;
  try {
    // Se relee la cola en cada vuelta: si scrolleás mientras traduce, los
    // títulos nuevos entran acá sin arrancar un segundo worker.
    while (queue.size > 0) {
      const batch = [...queue].slice(0, BATCH);
      for (const text of batch) queue.delete(text);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ texts: batch }),
        });
        const { translations } = (await res.json()) as { translations: string[] };
        batch.forEach((text, i) => cache.set(text, translations[i] ?? text));
      } catch {
        // Sin red: los dejamos en inglés y no reintentamos en bucle.
        for (const text of batch) cache.set(text, text);
      }

      publish();
    }
  } finally {
    running = false;
    save();
    publish();
  }
}

export function clearCache(): void {
  cache.clear();
  queue.clear();
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada que hacer.
  }
  publish();
}
