"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Profile } from "./ranking";
import { currentProfile, onProfileChange, replaceProfile } from "./useProfile";
import { currentPrefs, onPrefsChange, replacePrefs, type Prefs } from "./usePrefs";
import type { SyncPayload } from "./types";

/**
 * Sincroniza perfil y preferencias con Supabase.
 *
 * Es offline-first: localStorage manda mientras usás la app, y esto es una
 * capa de respaldo que corre por atrás. Si no hay red, si Supabase se cae o si
 * no está configurado, la app funciona exactamente igual.
 *
 * No hay login. El dispositivo se identifica con un UUID aleatorio que funciona
 * como credencial; pegándolo en otro teléfono, ese teléfono adopta el perfil.
 */

const DEVICE_KEY = "news.device.v1";
const PUSH_DEBOUNCE = 4000;

export type SyncState = "idle" | "syncing" | "synced" | "error" | "off";

let state: SyncState = "idle";
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function setState(next: SyncState) {
  if (state === next) return;
  state = next;
  for (const l of listeners) l();
}

/** UUID del dispositivo. Se crea la primera vez y no cambia más. */
export function deviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Sin storage no hay sync posible, pero la app sigue.
    return "";
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  // Se agrupa: votar diez veces seguidas escribe una sola vez.
  pushTimer = setTimeout(() => void push(), PUSH_DEBOUNCE);
}

async function push(): Promise<void> {
  const device = deviceId();
  if (!device) return;

  const payload: SyncPayload = {
    profile: currentProfile(),
    prefs: currentPrefs(),
    updatedAt: Date.now(),
  };

  setState("syncing");
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device, data: payload }),
      keepalive: true,
    });
    setState(res.ok ? "synced" : "error");
  } catch {
    // Sin señal: se reintenta en el próximo cambio, no en un bucle.
    setState("error");
  }
}

/** Trae el perfil remoto y lo adopta si es más nuevo que el local. */
async function pull(): Promise<void> {
  const device = deviceId();
  if (!device) return;

  setState("syncing");
  try {
    const res = await fetch(`/api/sync?device=${device}`);
    if (!res.ok) throw new Error("http");

    const { data } = (await res.json()) as { data: SyncPayload | null };
    setState("synced");
    if (!data) return;

    const local = currentProfile().updatedAt ?? 0;
    // Gana el más nuevo. Sin merge por campo: el perfil es un todo coherente y
    // mezclar pesos de dos dispositivos daría un modelo que no entrenó nadie.
    if (data.updatedAt > local) {
      if (data.profile) replaceProfile(data.profile as Profile);
      if (data.prefs) replacePrefs(data.prefs as Prefs);
    }
  } catch {
    setState("error");
  }
}

/**
 * Arranca la sincronización. Se llama desde un evento (no desde un efecto):
 * el primer pull sale del montaje del cliente vía `start`.
 */
export function startSync(): void {
  if (started) return;
  started = true;

  void pull();
  onProfileChange(schedulePush);
  onPrefsChange(schedulePush);

  // Al irte de la app, empujamos lo pendiente sin esperar el debounce.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      void push();
    }
  });
}

/** Adopta el perfil de otro dispositivo a partir de su código. */
export async function adoptDevice(code: string): Promise<boolean> {
  const id = code.trim().toLowerCase();
  try {
    const res = await fetch(`/api/sync?device=${encodeURIComponent(id)}`);
    if (!res.ok) return false;

    const { data } = (await res.json()) as { data: SyncPayload | null };
    if (!data) return false;

    window.localStorage.setItem(DEVICE_KEY, id);
    if (data.profile) replaceProfile(data.profile as Profile);
    if (data.prefs) replacePrefs(data.prefs as Prefs);
    return true;
  } catch {
    return false;
  }
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => "idle" as SyncState,
  );
}

export function useSync() {
  const status = useSyncState();
  const start = useCallback(() => startSync(), []);
  return { status, start, deviceId, adoptDevice };
}
