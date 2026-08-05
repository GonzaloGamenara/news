"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { topTopics, type Profile } from "@/lib/ranking";
import { adoptDevice, deviceId, type SyncState } from "@/lib/useSync";
import type { Prefs } from "@/lib/usePrefs";
import type { LangFilter } from "@/lib/types";

type Props = {
  open: boolean;
  profile: Profile;
  prefs: Prefs;
  syncState: SyncState;
  onClose: () => void;
  onPrefs: (patch: Partial<Prefs>) => void;
  onReset: () => void;
};

const LANGS: Array<{ id: LangFilter; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "es", label: "Español" },
  { id: "en", label: "Inglés" },
];

const SYNC_LABEL: Record<SyncState, string> = {
  idle: "Sin sincronizar todavía",
  syncing: "Sincronizando…",
  synced: "Guardado en la nube",
  error: "Sin conexión — se guarda igual en el teléfono",
  off: "Solo en este teléfono",
};

export function SettingsSheet({
  open,
  profile,
  prefs,
  syncState,
  onClose,
  onPrefs,
  onReset,
}: Props) {
  const { liked, disliked } = topTopics(profile);
  const confidence = Math.min(1, profile.votes / 25);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-label="Ajustes"
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
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-border bg-surface"
          >
            <div className="shrink-0 cursor-grab pt-3 pb-1 active:cursor-grabbing">
              <div className="mx-auto h-1 w-10 rounded-full bg-border" />
            </div>

            <div
              className="space-y-7 overflow-y-auto overscroll-contain px-5 pt-3"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
            >
              {/* ---------------- Perfil ---------------- */}
              <Section title="Tu perfil">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-fg-muted">Qué tanto te conoce</span>
                  <span className="font-semibold tabular-nums">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    transition={{ type: "spring", stiffness: 110, damping: 20 }}
                  />
                </div>
                <p className="mt-2 text-xs text-fg-muted">
                  {profile.votes} {profile.votes === 1 ? "voto" : "votos"}
                  {confidence < 1
                    ? ` — con ${25 - profile.votes} más el feed se personaliza del todo.`
                    : " — el feed ya está ordenado a tu medida."}
                </p>

                <Topics title="Te interesa" topics={liked} tone="positive" />
                <Topics title="Preferís evitar" topics={disliked} tone="negative" />
              </Section>

              {/* ---------------- Idioma ---------------- */}
              <Section title="Idioma">
                <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                  {LANGS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onPrefs({ lang: option.id })}
                      className="relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                      style={{ color: prefs.lang === option.id ? "#fff" : "var(--fg-muted)" }}
                    >
                      {prefs.lang === option.id && (
                        <motion.span
                          layoutId="lang-pill"
                          className="absolute inset-0 rounded-lg bg-violet-600"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative">{option.label}</span>
                    </button>
                  ))}
                </div>

                <Toggle
                  checked={prefs.translate}
                  onChange={(v) => onPrefs({ translate: v })}
                  label="Traducir al español"
                  hint="Los títulos y resúmenes que están en inglés."
                />
              </Section>

              {/* ---------------- Datos ---------------- */}
              <Section title="Datos">
                <Toggle
                  checked={prefs.saveData}
                  onChange={(v) => onPrefs({ saveData: v })}
                  label="Ahorrar datos"
                  hint="Sin imágenes. Son el 95% del tráfico: ~2,5 MB por viaje bajan a ~300 KB."
                />
              </Section>

              {/* ---------------- Sync ---------------- */}
              <Section title="Sincronización">
                <SyncBlock state={syncState} />
              </Section>

              <button
                onClick={() => {
                  onReset();
                  onClose();
                }}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium text-rose-600 transition-colors active:bg-rose-500/10 dark:text-rose-400"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-fg-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="mt-3 flex w-full items-start gap-3 rounded-xl py-1 text-left"
    >
      <span
        className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-violet-600" : "bg-surface-2"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 34 }}
          className="h-5 w-5 rounded-full bg-white shadow"
          style={{ marginLeft: checked ? "auto" : 0 }}
        />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-relaxed text-fg-muted">{hint}</span>
      </span>
    </button>
  );
}

function Topics({
  title,
  topics,
  tone,
}: {
  title: string;
  topics: Array<{ feature: string; label: string; weight: number }>;
  tone: "positive" | "negative";
}) {
  if (topics.length === 0) return null;
  const max = Math.max(...topics.map((t) => Math.abs(t.weight)), 0.001);

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic, i) => (
          <motion.span
            key={topic.feature}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.025 }}
            // El tamaño refleja el peso: se ve de un vistazo qué pesa más.
            style={{ fontSize: `${0.75 + (Math.abs(topic.weight) / max) * 0.3}rem` }}
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
    </div>
  );
}

function SyncBlock({ state }: { state: SyncState }) {
  const [revealed, setRevealed] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<null | "ok" | "fail">(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            state === "synced"
              ? "bg-emerald-500"
              : state === "error"
                ? "bg-amber-500"
                : state === "syncing"
                  ? "bg-violet-500"
                  : "bg-border"
          }`}
        />
        <span className="text-fg-muted">{SYNC_LABEL[state]}</span>
      </div>

      <p className="text-xs leading-relaxed text-fg-muted">
        Tu perfil se guarda con un código de dispositivo. Pegalo en otro teléfono para
        llevarte tus gustos. Tratalo como una contraseña.
      </p>

      <button
        onClick={() => setRevealed((r) => !r)}
        className="w-full rounded-xl bg-surface-2 px-3 py-2.5 text-left"
      >
        <span className="block text-xs text-fg-muted">Código de este dispositivo</span>
        <span className="block font-mono text-xs break-all">
          {revealed ? deviceId() : "•••••••• — tocá para ver"}
        </span>
      </button>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Pegá un código de otro dispositivo"
          className="min-w-0 flex-1 rounded-xl border border-border bg-transparent px-3 py-2.5 font-mono text-xs outline-none focus:border-violet-500"
        />
        <button
          disabled={busy || code.trim() === ""}
          onClick={async () => {
            setBusy(true);
            setResult((await adoptDevice(code)) ? "ok" : "fail");
            setBusy(false);
          }}
          className="shrink-0 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "…" : "Usar"}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xs ${result === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {result === "ok"
              ? "Listo, se adoptó el perfil de ese dispositivo."
              : "No se encontró ningún perfil con ese código."}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
