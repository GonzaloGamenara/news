"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LangFilter } from "./types";

const KEY = "news.prefs.v1";

export type Prefs = {
  /** Qué idiomas mostrar en el feed. */
  lang: LangFilter;
  /** Traducir al español las notas en inglés (si el navegador puede). */
  translate: boolean;
};

const DEFAULTS: Prefs = { lang: "todo", translate: false };

// Mismo patrón que el perfil: store externo para que el snapshot del servidor
// y el del cliente puedan diferir sin romper la hidratación.
const SERVER_SNAPSHOT: Prefs = DEFAULTS;

let snapshot: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      lang: parsed.lang === "es" || parsed.lang === "en" ? parsed.lang : "todo",
      translate: parsed.translate === true,
    };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): Prefs {
  snapshot ??= read();
  return snapshot;
}

const getServerSnapshot = (): Prefs => SERVER_SNAPSHOT;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback((patch: Partial<Prefs>) => {
    snapshot = { ...getSnapshot(), ...patch };
    for (const listener of listeners) listener();
    try {
      window.localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      // Modo privado: las preferencias duran lo que dure la pestaña.
    }
  }, []);

  return { prefs, set };
}
