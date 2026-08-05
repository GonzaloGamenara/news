"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addImpressions,
  decay,
  emptyProfile,
  learn,
  prune,
  unlearn,
  type Profile,
} from "./ranking";
import type { Article } from "./types";

// v2: las reacciones pasaron de `1 | -1` a `{ vote, at }` para poder distinguir
// lo que votaste recién de lo que votaste en una sesión anterior.
const KEY = "news.profile.v2";

/**
 * El perfil vive en un store externo (no en useState) por dos razones:
 *  - localStorage no existe en el servidor, así que necesitamos un snapshot
 *    distinto para SSR y para cliente sin romper la hidratación;
 *  - useSyncExternalStore resuelve eso sin un `setState` dentro de un efecto.
 */

const SERVER_SNAPSHOT: Profile = emptyProfile();

let snapshot: Profile | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function read(): Profile {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyProfile();

    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed || typeof parsed.weights !== "object") return emptyProfile();

    // El olvido por tiempo se aplica una sola vez, al leer.
    return decay({
      weights: parsed.weights ?? {},
      votes: parsed.votes ?? 0,
      reactions: parsed.reactions ?? {},
      seen: parsed.seen ?? {},
      impressions: parsed.impressions ?? {},
      updatedAt: parsed.updatedAt ?? Date.now(),
    });
  } catch {
    // Storage corrupto o bloqueado (modo privado): arrancamos limpio.
    return emptyProfile();
  }
}

function getSnapshot(): Profile {
  // Cacheado: useSyncExternalStore exige que devuelva la MISMA referencia
  // mientras no haya cambios, o entra en loop de renders.
  snapshot ??= read();
  return snapshot;
}

const getServerSnapshot = (): Profile => SERVER_SNAPSHOT;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(profile: Profile): void {
  const next = prune(profile);
  snapshot = next;
  for (const listener of listeners) listener();

  // Debounce: votar rápido varias veces no debe escribir 5 veces en disco.
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Sin persistencia la app sigue andando en memoria hasta cerrar la pestaña.
    }
  }, 300);
}

/**
 * Impresiones de la sesión en curso.
 *
 * Viven acá y no en el perfil a propósito: si cada tarjeta que aparece en
 * pantalla modificara el perfil, el feed se reordenaría bajo tus pies mientras
 * scrolleás. Se vuelcan cuando cambia el feed (refresh, categoría, salir).
 */
const pending = new Set<string>();

export function noteImpression(id: string): void {
  pending.add(id);
}

/** Vuelca las impresiones acumuladas al perfil. */
export function flushImpressions(): void {
  if (pending.size === 0) return;
  const ids = [...pending];
  pending.clear();
  update(addImpressions(getSnapshot(), ids));
}

/** Perfil actual, para que la capa de sync lo lea sin montar un componente. */
export const currentProfile = getSnapshot;

/** Reemplaza el perfil entero (lo usa la sincronización al traer uno más nuevo). */
export function replaceProfile(next: Profile): void {
  update(next);
}

/** Se notifica cuando el perfil cambia, para empujarlo a Supabase. */
export const onProfileChange = subscribe;

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const react = useCallback((article: Article, liked: boolean) => {
    const current = getSnapshot();
    // Tocar el mismo botón dos veces deshace el voto y revierte el aprendizaje.
    update(
      current.reactions[article.id]?.vote === (liked ? 1 : -1)
        ? unlearn(current, article)
        : learn(current, article, liked),
    );
  }, []);

  const markSeen = useCallback((article: Article) => {
    const current = getSnapshot();
    if (current.seen[article.id]) return;
    update({ ...current, seen: { ...current.seen, [article.id]: Date.now() } });
  }, []);

  const reset = useCallback(() => update(emptyProfile()), []);

  return { profile, react, markSeen, reset };
}
