"use client";

/** Detección de plataforma y navegador para el tutorial de instalación. */

export type BrowserId = "safari" | "chrome" | "edge" | "firefox" | "opera" | "samsung";
export type Platform = "ios" | "android" | "escritorio";

export type Step = { title: string; detail: string; icon: string };

/**
 * ¿Ya está corriendo como app instalada?
 *
 * `display-mode: standalone` cubre Android y escritorio; `navigator.standalone`
 * es el modo viejo de iOS, que sigue siendo el único fiable ahí.
 */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "escritorio";
  const ua = navigator.userAgent;
  // iPadOS 13+ miente y dice "Macintosh": se lo delata el touch.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "escritorio";
}

/** Se usa solo para preseleccionar: la última palabra la tiene el usuario. */
export function detectBrowser(): BrowserId {
  if (typeof navigator === "undefined") return "chrome";
  const ua = navigator.userAgent;

  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Edg\//.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Firefox\/|FxiOS/.test(ua)) return "firefox";
  // En iOS todos usan WebKit, así que "Chrome" ahí es CriOS.
  if (/CriOS|Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "chrome";
}

export const BROWSERS: Array<{ id: BrowserId; label: string; emoji: string }> = [
  { id: "safari", label: "Safari", emoji: "🧭" },
  { id: "chrome", label: "Chrome", emoji: "🔵" },
  { id: "edge", label: "Edge", emoji: "🌊" },
  { id: "firefox", label: "Firefox", emoji: "🦊" },
  { id: "opera", label: "Opera", emoji: "🔴" },
  { id: "samsung", label: "Samsung Internet", emoji: "🌐" },
];

const IOS_SAFARI: Step[] = [
  { icon: "⬆️", title: "Tocá Compartir", detail: "El cuadradito con la flecha hacia arriba, abajo en el centro de la pantalla." },
  { icon: "➕", title: "«Agregar a inicio»", detail: "Deslizá la lista hacia abajo hasta encontrar «Agregar a pantalla de inicio»." },
  { icon: "✅", title: "Confirmá", detail: "Tocá «Agregar» arriba a la derecha. Titular queda como una app más." },
];

/**
 * En iOS ningún navegador puede instalar PWAs: todos son WebKit por dentro y
 * solo Safari expone «Agregar a pantalla de inicio». Es una limitación de
 * Apple, no algo que podamos resolver desde acá.
 */
const IOS_OTRO: Step[] = [
  { icon: "🧭", title: "Abrila en Safari", detail: "En iPhone, solo Safari puede instalar aplicaciones web. Copiá la dirección y pegala ahí." },
  { icon: "⬆️", title: "Tocá Compartir", detail: "El cuadradito con la flecha hacia arriba, abajo en el centro." },
  { icon: "➕", title: "«Agregar a inicio»", detail: "Buscá «Agregar a pantalla de inicio» y confirmá." },
];

const ANDROID_CHROME: Step[] = [
  { icon: "⋮", title: "Abrí el menú", detail: "Los tres puntitos, arriba a la derecha." },
  { icon: "📲", title: "«Instalar aplicación»", detail: "Puede aparecer como «Agregar a pantalla principal»." },
  { icon: "✅", title: "Confirmá", detail: "Tocá «Instalar». Queda en el cajón de apps como cualquier otra." },
];

const ANDROID_SAMSUNG: Step[] = [
  { icon: "☰", title: "Abrí el menú", detail: "Las tres rayitas, abajo a la derecha." },
  { icon: "➕", title: "«Agregar página a»", detail: "Elegí «Pantalla de inicio»." },
  { icon: "✅", title: "Confirmá", detail: "Listo, queda como una app más." },
];

const ANDROID_FIREFOX: Step[] = [
  { icon: "⋮", title: "Abrí el menú", detail: "Los tres puntitos, arriba a la derecha." },
  { icon: "📲", title: "«Instalar»", detail: "Firefox lo muestra como «Instalar» o «Agregar a pantalla de inicio»." },
  { icon: "✅", title: "Confirmá", detail: "Listo." },
];

const ESCRITORIO: Step[] = [
  { icon: "🔎", title: "Mirá la barra de direcciones", detail: "A la derecha de la URL aparece un ícono de instalar (una pantallita con una flecha)." },
  { icon: "📥", title: "Tocá instalar", detail: "Si no lo ves, está en el menú del navegador como «Instalar Titular»." },
  { icon: "✅", title: "Confirmá", detail: "Se abre en su propia ventana, sin barras del navegador." },
];

const ESCRITORIO_SAFARI: Step[] = [
  { icon: "📤", title: "Menú Compartir", detail: "En la barra de Safari, el ícono de compartir." },
  { icon: "📥", title: "«Agregar al Dock»", detail: "Disponible desde macOS Sonoma. En versiones anteriores no se puede instalar." },
  { icon: "✅", title: "Confirmá", detail: "Queda en el Dock como una app." },
];

/** Pasos para la combinación de plataforma y navegador. */
export function stepsFor(platform: Platform, browser: BrowserId): Step[] {
  if (platform === "ios") return browser === "safari" ? IOS_SAFARI : IOS_OTRO;

  if (platform === "android") {
    if (browser === "samsung") return ANDROID_SAMSUNG;
    if (browser === "firefox") return ANDROID_FIREFOX;
    return ANDROID_CHROME;
  }

  return browser === "safari" ? ESCRITORIO_SAFARI : ESCRITORIO;
}

/** Aviso cuando el navegador elegido no puede instalar nada. */
export function warningFor(platform: Platform, browser: BrowserId): string | null {
  if (platform === "ios" && browser !== "safari") {
    return "En iPhone y iPad, Apple solo permite instalar aplicaciones web desde Safari. Los demás navegadores usan el mismo motor pero no ofrecen la opción.";
  }
  if (platform === "escritorio" && browser === "firefox") {
    return "Firefox de escritorio no instala aplicaciones web. Podés usarla igual desde el navegador, o probar con Chrome o Edge.";
  }
  return null;
}
