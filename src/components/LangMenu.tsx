"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { LangFilter } from "@/lib/types";

const OPTIONS: Array<{ id: LangFilter; label: string; hint: string }> = [
  { id: "todo", label: "Todo", hint: "Español e inglés" },
  { id: "es", label: "Español", hint: "Solo fuentes en español" },
  { id: "en", label: "Inglés", hint: "Solo fuentes en inglés" },
];

const LABEL: Record<LangFilter, string> = { todo: "ES/EN", es: "ES", en: "EN" };

type Props = {
  lang: LangFilter;
  translate: boolean;
  saveData: boolean;
  onLang: (lang: LangFilter) => void;
  onTranslate: (enabled: boolean) => void;
  onSaveData: (enabled: boolean) => void;
};

export function LangMenu({
  lang,
  translate,
  saveData,
  onLang,
  onTranslate,
  onSaveData,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Idioma"
        aria-expanded={open}
        className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold tabular-nums"
      >
        {LABEL[lang]}
        {translate && <span className="ml-1 text-violet-500">↻</span>}
        {saveData && <span className="ml-1 text-emerald-500">◔</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            >
              <div className="p-1.5">
                {OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onLang(option.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      lang === option.id ? "bg-surface-2" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="w-4 text-violet-500">{lang === option.id ? "✓" : ""}</span>
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-fg-muted">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-border p-1.5">
                <button
                  onClick={() => onTranslate(!translate)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="w-4 pt-0.5 text-violet-500">{translate ? "✓" : ""}</span>
                  <span>
                    <span className="block text-sm font-medium">Traducir al español</span>
                    <span className="block text-xs text-fg-muted">
                      Traduce los títulos y resúmenes en inglés.
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => onSaveData(!saveData)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="w-4 pt-0.5 text-violet-500">{saveData ? "✓" : ""}</span>
                  <span>
                    <span className="block text-sm font-medium">Ahorrar datos</span>
                    <span className="block text-xs text-fg-muted">
                      Sin imágenes. Son el 95% del tráfico.
                    </span>
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
