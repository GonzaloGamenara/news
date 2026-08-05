"use client";

import { useEffect } from "react";

/** Registra el service worker que hace que la app abra offline en el subte. */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin SW la app sigue funcionando online; no hay nada que avisar.
      });

    // Esperamos al load para no competir con el primer render por ancho de banda.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
