"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LangFilter } from "./types";

const KEY = "news.prefs.v1";

export type Prefs = {
  /** Qué idiomas mostrar en el feed. */
  lang: LangFilter;
  /** Traducir al español las notas en inglés. */
  translate: boolean;
  /** Sin imágenes. Las imágenes son ~95% del tráfico del feed. */
  saveData: boolean;
};

const DEFAULTS: Prefs = { lang: "todo", translate: false, saveData: false };

/** ¿El sistema pidió ahorrar datos? (Android/Chrome; en iOS no existe.) */
function systemSaveData(): boolean {
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

// Mismo patrón que el perfil: store externo para que el snapshot del servidor
// y el del cliente puedan diferir sin romper la hidratación.
const SERVER_SNAPSHOT: Prefs = DEFAULTS;

let snapshot: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, saveData: systemSaveData() };

    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      lang: parsed.lang === "es" || parsed.lang === "en" ? parsed.lang : "todo",
      translate: parsed.translate === true,
      // Si nunca lo tocaste, seguimos lo que pide el sistema. Una vez que
      // elegís, manda tu elección.
      saveData:
        typeof parsed.saveData === "boolean" ? parsed.saveData : systemSaveData(),
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

export const currentPrefs = getSnapshot;

export const onPrefsChange = subscribe;

/** Reemplaza las preferencias (lo usa la sincronización). */
export function replacePrefs(next: Prefs): void {
  snapshot = next;
  for (const listener of listeners) listener();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Modo privado: duran lo que dure la pestaña.
  }
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
