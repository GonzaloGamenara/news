"use client";

import { AnimatePresence, motion } from "framer-motion";
import { topTopics, type Profile } from "@/lib/ranking";

type Props = {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onReset: () => void;
};

export function ProfileSheet({ open, profile, onClose, onReset }: Props) {
  const { liked, disliked } = topTopics(profile);
  const confidence = Math.min(1, profile.votes / 25);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-label="Tu perfil"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="sticky top-0 flex justify-center bg-surface pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="space-y-6 px-5 pt-3">
              <header className="space-y-1">
                <h2 className="text-xl font-semibold">Tu perfil</h2>
                <p className="text-sm text-fg-muted">
                  Todo se calcula y se guarda en este dispositivo. Nada viaja a
                  ningún servidor.
                </p>
              </header>

              <section className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-fg-muted">Qué tanto te conoce</span>
                  <span className="font-semibold tabular-nums">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                <p className="text-xs text-fg-muted">
                  {profile.votes} {profile.votes === 1 ? "voto" : "votos"}
                  {confidence < 1
                    ? ` — con ${25 - profile.votes} más el feed se personaliza del todo.`
                    : " — el feed ya está ordenado a tu medida."}
                </p>
              </section>

              <TopicList
                title="Te interesa"
                empty="Todavía no votaste nada que te guste."
                topics={liked}
                tone="positive"
              />
              <TopicList
                title="Preferís evitar"
                empty="Todavía no descartaste nada."
                topics={disliked}
                tone="negative"
              />

              <button
                onClick={() => {
                  onReset();
                  onClose();
                }}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
              >
                Empezar de cero
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TopicList({
  title,
  empty,
  topics,
  tone,
}: {
  title: string;
  empty: string;
  topics: Array<{ feature: string; label: string; weight: number }>;
  tone: "positive" | "negative";
}) {
  const max = Math.max(...topics.map((t) => Math.abs(t.weight)), 0.001);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {topics.length === 0 ? (
        <p className="text-sm text-fg-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, i) => (
            <motion.span
              key={topic.feature}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              // El tamaño del chip refleja el peso: se ve de un vistazo qué pesa más.
              style={{ fontSize: `${0.75 + (Math.abs(topic.weight) / max) * 0.35}rem` }}
              className={`rounded-full px-3 py-1 font-medium ${
                tone === "positive"
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/12 text-rose-700 dark:text-rose-400"
              }`}
            >
              {topic.label}
            </motion.span>
          ))}
        </div>
      )}
    </section>
  );
}
