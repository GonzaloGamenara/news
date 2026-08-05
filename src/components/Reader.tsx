"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import { CATEGORY_MAP } from "@/lib/sources";
import type { ScoredArticle } from "@/lib/ranking";
import type { ArticleFailure, ReaderState } from "@/lib/types";

type Props = {
  article: ScoredArticle | null;
  /** La carga la dispara el Feed desde el click; acá solo se muestra. */
  state: ReaderState;
  reaction: 1 | -1 | undefined;
  onClose: () => void;
  onReact: (article: ScoredArticle, liked: boolean) => void;
};

const MESSAGES: Record<ArticleFailure, string> = {
  unsupported: "Esta fuente no se puede leer acá adentro.",
  "too-short": "La nota completa no se pudo extraer (puede tener muro de pago).",
  failed: "No se pudo cargar la nota.",
  invalid: "No se pudo cargar la nota.",
};

export function Reader({ article, state, reaction, onClose, onReact }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  // Cuánto te queda de la nota. En una lista infinita, saber que estás por
  // terminar cambia si seguís leyendo o no.
  const { scrollYProgress } = useScroll({ container: scroller });
  const progress = useSpring(scrollYProgress, { stiffness: 300, damping: 40 });

  useEffect(() => {
    if (!article) return;

    // Con el lector abierto, el feed de atrás no debe scrollear.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [article, onClose]);

  const accent = article ? (CATEGORY_MAP.get(article.category)?.accent ?? "265 85% 60%") : "";

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          role="dialog"
          aria-label={article.title}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-0 z-50 flex flex-col bg-bg"
        >
          <header
            className="relative flex items-center gap-2 border-b border-border bg-bg/90 px-3 backdrop-blur-xl"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={onClose}
              aria-label="Volver"
              className="rounded-full px-3 py-3 text-base text-fg-muted transition-colors hover:bg-surface-2"
            >
              ←
            </button>
            <span
              className="truncate rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: `hsl(${accent} / 0.14)`, color: `hsl(${accent})` }}
            >
              {article.sourceName}
            </span>
            {state.phase === "ready" && (
              <span className="ml-auto shrink-0 pr-1 text-xs text-fg-muted">
                {state.content.minutes} min de lectura
              </span>
            )}
            <motion.div
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-violet-500"
              style={{ scaleX: progress }}
            />
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-2xl px-4 pt-5 pb-40">
              {/* Si vino traducida, el título traducido llega con el contenido. */}
              <h1 className="text-2xl leading-tight font-bold">
                {state.phase === "ready" && state.content.title
                  ? state.content.title
                  : article.title}
              </h1>

              {state.phase === "ready" && state.content.byline && (
                <p className="mt-2 text-sm text-fg-muted">{state.content.byline}</p>
              )}

              {state.phase === "loading" && <ReaderSkeleton />}

              {state.phase === "error" && (
                <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center">
                  <p className="text-sm text-fg-muted">{MESSAGES[state.reason]}</p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-full bg-surface-2 px-5 py-2.5 text-sm font-medium"
                  >
                    Abrir en {article.sourceName} ↗
                  </a>
                </div>
              )}

              {state.phase === "ready" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="article-body mt-5"
                  // Saneado en el servidor con allowlist de etiquetas y atributos
                  // (ver src/lib/sanitize.ts).
                  dangerouslySetInnerHTML={{ __html: state.content.html }}
                />
              )}

              {state.phase === "ready" && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-block text-sm text-fg-muted underline underline-offset-4"
                >
                  Ver original en {article.sourceName} ↗
                </a>
              )}
            </div>
          </div>

          {/* Votar sin tener que cerrar y buscar la tarjeta. */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur-xl"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onReact(article, true)}
              aria-label="Me gusta"
              aria-pressed={reaction === 1}
              className={`rounded-full px-4 py-2 text-lg transition-colors ${
                reaction === 1 ? "bg-emerald-500/15" : "hover:bg-surface-2"
              }`}
            >
              <span className={reaction === 1 ? "" : "opacity-55"}>👍</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                onReact(article, false);
                onClose();
              }}
              aria-label="No me interesa"
              aria-pressed={reaction === -1}
              className={`rounded-full px-4 py-2 text-lg transition-colors ${
                reaction === -1 ? "bg-rose-500/15" : "hover:bg-surface-2"
              }`}
            >
              <span className={reaction === -1 ? "" : "opacity-55"}>👎</span>
            </motion.button>

            <button
              onClick={onClose}
              className="ml-auto rounded-full bg-surface-2 px-5 py-2 text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      {[100, 96, 88, 100, 92, 70, 100, 84].map((width, i) => (
        <div key={i} className="skeleton h-4 rounded-full" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
