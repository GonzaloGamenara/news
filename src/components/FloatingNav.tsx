"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { CATEGORIES } from "@/lib/sources";
import type { CategoryId } from "@/lib/types";

type Props = {
  active: CategoryId;
  /** Géneros que el usuario dejó activos, en el orden del catálogo. */
  enabled: CategoryId[];
  onChange: (id: CategoryId) => void;
};

export function FloatingNav({ active, enabled, onChange }: Props) {
  const visible = CATEGORIES.filter((c) => enabled.includes(c.id));
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<CategoryId, HTMLButtonElement>());

  // Al cambiar de categoría (o al volver a la app) centramos el chip activo,
  // porque con 7 categorías siempre hay alguna fuera de pantalla.
  useEffect(() => {
    const el = refs.current.get(active);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        ref={scroller}
        className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-surface/80 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl"
      >
        {visible.map((category) => {
          const isActive = category.id === active;
          return (
            <button
              key={category.id}
              ref={(el) => {
                if (el) refs.current.set(category.id, el);
              }}
              onClick={() => onChange(category.id)}
              aria-current={isActive ? "page" : undefined}
              className="relative shrink-0 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{ color: isActive ? "#fff" : "var(--fg-muted)" }}
            >
              {isActive && (
                <motion.span
                  // layoutId hace que la píldora se deslice entre chips en vez
                  // de aparecer y desaparecer.
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: `hsl(${category.accent})` }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <span aria-hidden>{category.emoji}</span>
                {category.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
