"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  BROWSERS,
  detectBrowser,
  detectPlatform,
  stepsFor,
  warningFor,
  type BrowserId,
} from "@/lib/install";

type Props = { open: boolean; onClose: () => void };

/**
 * Tutorial de instalación. Se muestra solo si la app NO está corriendo ya como
 * PWA — quien la abre desde el ícono no necesita que le expliquen cómo hacerlo.
 */
export function InstallGuide({ open, onClose }: Props) {
  const [browser, setBrowser] = useState<BrowserId | null>(null);
  const [step, setStep] = useState(0);

  const platform = detectPlatform();
  const suggested = detectBrowser();
  const steps = browser ? stepsFor(platform, browser) : [];
  const warning = browser ? warningFor(platform, browser) : null;

  const reset = () => {
    setBrowser(null);
    setStep(0);
  };

  return (
    <AnimatePresence onExitComplete={reset}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-label="Instalar la app"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 330, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[88vh] flex-col rounded-t-3xl border-t border-border bg-surface"
          >
            <div className="shrink-0 pt-3 pb-1">
              <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            </div>

            <div
              className="overflow-y-auto overscroll-contain px-5 pt-4"
              style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              {/* Sin AnimatePresence acá: `mode="wait"` no monta el paso nuevo
                  hasta que termina la salida del anterior, y si las animaciones
                  están frenadas (app en segundo plano) te deja trabado. */}
              <div>
                {/* -------- Paso 1: elegir navegador -------- */}
                {!browser ? (
                  <motion.div
                    key="picker"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <h2 className="text-2xl font-bold">Bienvenido 👋</h2>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                      Instalá Titular en tu teléfono y se abre como una app: sin barras
                      del navegador, a pantalla completa y funcionando sin señal.
                    </p>
                    <p className="mt-5 text-sm font-medium">¿Desde qué navegador entrás?</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {BROWSERS.map((b) => (
                        <motion.button
                          key={b.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setBrowser(b.id)}
                          className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                            b.id === suggested
                              ? "border-violet-500 bg-violet-500/8"
                              : "border-border hover:bg-surface-2"
                          }`}
                        >
                          <span className="text-xl" aria-hidden>
                            {b.emoji}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {b.label}
                            </span>
                            {b.id === suggested && (
                              <span className="block text-[11px] text-violet-500">
                                parece este
                              </span>
                            )}
                          </span>
                        </motion.button>
                      ))}
                    </div>

                    <button
                      onClick={onClose}
                      className="mt-5 w-full py-2 text-sm text-fg-muted"
                    >
                      Ahora no, seguir en el navegador
                    </button>
                  </motion.div>
                ) : (
                  /* -------- Paso 2: los pasos -------- */
                  <motion.div
                    key="steps"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <button
                      onClick={reset}
                      className="mb-3 text-sm text-fg-muted transition-colors hover:text-fg"
                    >
                      ← Cambiar navegador
                    </button>

                    <h2 className="text-xl font-bold">
                      {BROWSERS.find((b) => b.id === browser)?.label} en{" "}
                      {platform === "ios"
                        ? "iPhone"
                        : platform === "android"
                          ? "Android"
                          : "escritorio"}
                    </h2>

                    {warning && (
                      <p className="mt-3 rounded-xl bg-amber-500/12 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                        {warning}
                      </p>
                    )}

                    {/* Un paso por vez, para no abrumar en una pantalla chica. */}
                    <div className="relative mt-5 min-h-[8.5rem]">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={step}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -24 }}
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                          className="flex gap-4"
                        >
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl"
                            aria-hidden
                          >
                            {steps[step].icon}
                          </span>
                          <span>
                            <span className="block text-xs font-semibold text-violet-500">
                              Paso {step + 1} de {steps.length}
                            </span>
                            <span className="mt-1 block text-base font-semibold">
                              {steps[step].title}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-fg-muted">
                              {steps[step].detail}
                            </span>
                          </span>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {steps.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setStep(i)}
                            aria-label={`Paso ${i + 1}`}
                            className="p-1"
                          >
                            <motion.span
                              animate={{
                                width: i === step ? 20 : 6,
                                opacity: i === step ? 1 : 0.35,
                              }}
                              className="block h-1.5 rounded-full bg-violet-500"
                            />
                          </button>
                        ))}
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() =>
                          step < steps.length - 1 ? setStep(step + 1) : onClose()
                        }
                        className="ml-auto rounded-full bg-violet-600 px-6 py-2.5 text-sm font-medium text-white"
                      >
                        {step < steps.length - 1 ? "Siguiente" : "Listo"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
