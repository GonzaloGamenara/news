"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloatingNav } from "./FloatingNav";
import { NewsCard } from "./NewsCard";
import { ProfileSheet } from "./ProfileSheet";
import { PullToRefresh } from "./PullToRefresh";
import { score, visible, type ScoredArticle } from "@/lib/ranking";
import { CATEGORY_MAP } from "@/lib/sources";
import { useProfile } from "@/lib/useProfile";
import type { Article, CategoryId, FeedResponse } from "@/lib/types";

const PAGE = 15;
/** Si volvés a la app y el feed tiene más de esto, se refresca solo. */
const STALE_AFTER = 15 * 60 * 1000;

type CacheEntry = { articles: Article[]; fetchedAt: number; failed: string[] };

export function Feed({ initial }: { initial: FeedResponse }) {
  const [category, setCategory] = useState<CategoryId>("para-vos");
  // El feed de "Para vos" ya viene resuelto desde el servidor; el resto de las
  // categorías se van cacheando acá a medida que las visitás.
  const [cache, setCache] = useState<Partial<Record<CategoryId, CacheEntry>>>({
    "para-vos": {
      articles: initial.articles,
      fetchedAt: initial.fetchedAt,
      failed: initial.failed,
    },
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [profileOpen, setProfileOpen] = useState(false);

  const { profile, react, markSeen, reset } = useProfile();

  // Semilla de exploración. Arranca derivada del timestamp del servidor para
  // que el orden del primer render coincida con el HTML (si acá usáramos
  // Math.random se rompería la hidratación), y se re-tira en cada refresh.
  const [salt, setSalt] = useState(initial.fetchedAt);

  const sentinel = useRef<HTMLDivElement>(null);
  const inFlight = useRef<AbortController | null>(null);

  // Espejo del cache en un ref para que `load` pueda consultarlo sin listarlo
  // como dependencia (si no, cada fetch recrearía `load` y re-dispararía el
  // efecto de carga). Se sincroniza en un efecto, no durante el render.
  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  const load = useCallback(async (target: CategoryId, force = false) => {
    const cached = cacheRef.current[target];
    if (!force && cached && Date.now() - cached.fetchedAt < STALE_AFTER) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const res = await fetch(`/api/feed?category=${target}`, {
        signal: controller.signal,
        cache: force ? "reload" : "default",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: FeedResponse = await res.json();
      setError(null);
      setCache((c) => ({
        ...c,
        [target]: {
          articles: data.articles,
          fetchedAt: data.fetchedAt,
          failed: data.failed,
        },
      }));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("No se pudieron cargar las noticias. ¿Hay señal?");
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, []);

  /** Recarga pedida por el usuario: la única que muestra el spinner explícito. */
  const refresh = useCallback(
    (target: CategoryId) => {
      setRefreshing(true);
      // Nueva semilla: la exploración rota, así refrescar trae otra mezcla
      // aunque las noticias sean casi las mismas.
      setSalt(Math.floor(Math.random() * 1e9));
      void load(target, true);
    },
    [load],
  );

  // Volver a la app después de un rato refresca sin que tengas que pedirlo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const current = cacheRef.current[category];
      if (!current || Date.now() - current.fetchedAt > STALE_AFTER) {
        void load(category, true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [category, load]);

  const entry = cache[category];
  // `loading` es derivado, no un estado más: no hay nada que sincronizar.
  const loading = !entry || refreshing;

  const ranked: ScoredArticle[] = useMemo(() => {
    if (!entry) return [];
    // La frescura se mide contra el momento del fetch, no contra "ahora": el
    // ranking queda determinístico y estable mientras no recargues.
    return score(visible(entry.articles, profile), profile, salt, entry.fetchedAt);
  }, [entry, profile, salt]);

  const shown = ranked.slice(0, limit);

  // Scroll infinito.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || shown.length >= ranked.length) return;

    const observer = new IntersectionObserver(
      ([e]) => e.isIntersecting && setLimit((l) => l + PAGE),
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown.length, ranked.length]);

  const changeCategory = useCallback(
    (id: CategoryId) => {
      setCategory(id);
      setLimit(PAGE);
      window.scrollTo({ top: 0, behavior: "smooth" });
      // La carga se dispara desde el evento, no desde un efecto: evita el
      // render en cascada y deja explícito quién pidió los datos.
      void load(id);
    },
    [load],
  );

  const handleOpen = useCallback(
    (article: ScoredArticle) => {
      markSeen(article);
      window.open(article.url, "_blank", "noopener,noreferrer");
    },
    [markSeen],
  );

  const handleReact = useCallback(
    (article: ScoredArticle, liked: boolean) => {
      react(article, liked);
      // Vibración corta: confirma el gesto sin mirar la pantalla.
      navigator.vibrate?.(liked ? 12 : [8, 30, 8]);
    },
    [react],
  );

  const current = CATEGORY_MAP.get(category)!;
  const isEmpty = !loading && ranked.length === 0 && !error;

  return (
    <>
      {/* El header y el nav quedan FUERA de PullToRefresh: ese componente aplica
          un transform, y un transform en un ancestro rompe el position:fixed. */}
      <header
        className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <h1 className="text-lg font-bold tracking-tight">
            Titular
            <AnimatePresence mode="wait">
              <motion.span
                key={category}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.16 }}
                className="ml-2 text-sm font-medium text-fg-muted"
              >
                {current.label}
              </motion.span>
            </AnimatePresence>
          </h1>

          <button
            onClick={() => refresh(category)}
            aria-label="Actualizar"
            className="ml-auto rounded-full p-2 text-fg-muted transition-colors hover:bg-surface-2"
          >
            <motion.span
              className="block text-base"
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={
                loading
                  ? { repeat: Infinity, duration: 0.9, ease: "linear" }
                  : { duration: 0.2 }
              }
            >
              ↻
            </motion.span>
          </button>

          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Tu perfil"
            className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium"
          >
            ✦ {profile.votes}
          </button>
        </div>
      </header>

      <PullToRefresh onRefresh={() => refresh(category)}>
        <main className="pt-header pb-nav mx-auto w-full max-w-2xl px-3">
          {error && (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-5 text-center">
              <p className="text-sm text-fg-muted">{error}</p>
              <button
                onClick={() => refresh(category)}
                className="mt-3 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading && ranked.length === 0 && <Skeletons />}

          {isEmpty && (
            <div className="mt-10 text-center">
              <p className="text-4xl">{current.emoji}</p>
              <p className="mt-3 text-sm text-fg-muted">
                No hay nada nuevo acá por ahora.
              </p>
            </div>
          )}

          <div className="mt-3 space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((article, i) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  reaction={profile.reactions[article.id]}
                  hero={i === 0}
                  onReact={handleReact}
                  onOpen={handleOpen}
                />
              ))}
            </AnimatePresence>
          </div>

          <div ref={sentinel} className="h-8" />

          {entry && shown.length >= ranked.length && ranked.length > 0 && (
            <p className="py-4 text-center text-xs text-fg-muted" suppressHydrationWarning>
              Llegaste al final · {entry.failed.length > 0 && `${entry.failed.length} fuentes sin responder · `}
              actualizado {new Date(entry.fetchedAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </main>
      </PullToRefresh>

      <FloatingNav active={category} onChange={changeCategory} />

      <ProfileSheet
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onReset={reset}
      />
    </>
  );
}

function Skeletons() {
  return (
    <div className="mt-3 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className={`skeleton w-full ${i === 0 ? "aspect-[16/10]" : "aspect-[2/1]"}`} />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton h-4 w-full rounded-full" />
            <div className="skeleton h-4 w-4/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
