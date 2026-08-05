"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { memo, useState } from "react";
import { CATEGORY_MAP } from "@/lib/sources";
import type { ScoredArticle } from "@/lib/ranking";

const SWIPE_THRESHOLD = 90;

function relativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(timestamp).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

type Props = {
  article: ScoredArticle;
  /** Texto a mostrar: puede venir traducido, por eso no se lee de `article`. */
  title: string;
  summary: string;
  reaction: 1 | -1 | undefined;
  /** Ya la abriste alguna vez. La marcamos, pero no la escondemos. */
  seen: boolean;
  hero: boolean;
  onReact: (article: ScoredArticle, liked: boolean) => void;
  onOpen: (article: ScoredArticle) => void;
};

function NewsCardImpl({
  article,
  title,
  summary,
  reaction,
  seen,
  hero,
  onReact,
  onOpen,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = CATEGORY_MAP.get(article.category)?.accent ?? "265 85% 60%";

  // Swipe: la tarjeta sigue el dedo y va tiñéndose de verde o rojo.
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-4, 4]);
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const dislikeOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Consideramos la velocidad además del desplazamiento: un flick corto y
    // rápido cuenta como gesto, que es lo que uno hace parado en el colectivo.
    const power = info.offset.x + info.velocity.x * 0.12;
    if (power > SWIPE_THRESHOLD) onReact(article, true);
    else if (power < -SWIPE_THRESHOLD) onReact(article, false);
  };

  const showImage = article.image && !imageFailed;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="relative"
    >
      {/* Pistas de swipe: viven detrás de la tarjeta y se revelan al arrastrar. */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute inset-y-0 left-0 flex w-24 items-center justify-start rounded-2xl bg-emerald-500/15 pl-5 text-2xl"
        aria-hidden
      >
        👍
      </motion.div>
      <motion.div
        style={{ opacity: dislikeOpacity }}
        className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-end rounded-2xl bg-rose-500/15 pr-5 text-2xl"
        aria-hidden
      >
        👎
      </motion.div>

      <motion.div
        drag="x"
        dragSnapToOrigin
        dragElastic={0.35}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        whileTap={{ scale: 0.985 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      >
        <button
          onClick={() => onOpen(article)}
          className="block w-full text-left"
          // Sin esto el navegador intenta seleccionar texto durante el swipe.
          style={{ touchAction: "pan-y" }}
        >
          {showImage && (
            <div className={`relative w-full overflow-hidden ${hero ? "aspect-[16/10]" : "aspect-[2/1]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image!}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                // Algunos feeds (Phys.org, por ejemplo) publican miniaturas de
                // 90px: estiradas al ancho de la tarjeta quedan horribles, así
                // que preferimos mostrar la nota sin imagen.
                onLoad={(e) => {
                  if (e.currentTarget.naturalWidth < 320) setImageFailed(true);
                }}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
            </div>
          )}

          <div className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-xs">
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: `hsl(${accent} / 0.14)`,
                  color: `hsl(${accent})`,
                }}
              >
                {article.sourceName}
              </span>
              {/* "hace 3 min" depende del reloj: entre el render del servidor y
                  la hidratación puede cambiar, y no es un error. */}
              <span className="text-fg-muted" suppressHydrationWarning>
                {relativeTime(article.publishedAt)}
              </span>
              {seen && <span className="text-fg-muted">· leída</span>}
              {article.reasons.length > 0 && (
                <span
                  className="ml-auto text-fg-muted"
                  title={article.reasons
                    .map((r) => `${r.feature.replace(/^[a-z]+:/, "")} ${r.weight > 0 ? "+" : ""}${r.weight.toFixed(2)}`)
                    .join(" · ")}
                >
                  {article.affinity > 0.62 ? "✦" : article.affinity < 0.38 ? "·" : ""}
                </span>
              )}
            </div>

            <h2
              className={`font-semibold leading-snug ${hero ? "text-xl" : "text-base"} ${
                seen ? "text-fg-muted" : ""
              }`}
            >
              {title}
            </h2>

            {summary && (
              <p className="line-clamp-3-safe text-sm leading-relaxed text-fg-muted">
                {summary}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          <ReactionButton
            active={reaction === 1}
            activeClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            label="Me gusta"
            onClick={() => onReact(article, true)}
          >
            👍
          </ReactionButton>
          <ReactionButton
            active={reaction === -1}
            activeClass="bg-rose-500/15 text-rose-600 dark:text-rose-400"
            label="No me interesa"
            onClick={() => onReact(article, false)}
          >
            👎
          </ReactionButton>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(article)}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Leer ↗
          </a>
        </div>
      </motion.div>
    </motion.article>
  );
}

function ReactionButton({
  active,
  activeClass,
  label,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-base transition-colors ${
        active ? activeClass : "text-fg-muted hover:bg-surface-2"
      }`}
    >
      <span className={active ? "" : "opacity-55"}>{children}</span>
    </motion.button>
  );
}

// El feed re-renderiza en cada voto; sin memo se repintan las 200 tarjetas.
export const NewsCard = memo(NewsCardImpl);
