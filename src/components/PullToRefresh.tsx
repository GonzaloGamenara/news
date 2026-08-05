"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

const TRIGGER = 72;
/** Resistencia: hay que arrastrar ~2.2px por cada px que baja el contenido. */
const DRAG_RATIO = 0.45;

type Props = {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
};

export function PullToRefresh({ onRefresh, children }: Props) {
  const pull = useMotionValue(0);
  const y = useSpring(pull, { stiffness: 500, damping: 42 });
  const spinnerOpacity = useTransform(pull, [10, TRIGGER], [0, 1]);
  const spinnerRotate = useTransform(pull, [0, TRIGGER * 1.6], [0, 320]);

  const [armed, setArmed] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Solo capturamos el gesto si ya estamos arriba de todo; si no, es scroll.
      start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const delta = (e.touches[0].clientY - start.current) * DRAG_RATIO;
      if (delta <= 0) {
        pull.set(0);
        setArmed(false);
        return;
      }
      // Techo elástico para que no se pueda arrastrar media pantalla.
      pull.set(Math.min(delta, TRIGGER * 1.6));
      setArmed(delta >= TRIGGER);
    };

    const onTouchEnd = () => {
      if (start.current !== null && pull.get() >= TRIGGER) void onRefresh();
      start.current = null;
      pull.set(0);
      setArmed(false);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, pull]);

  return (
    <>
      <motion.div
        style={{ y, opacity: spinnerOpacity }}
        className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center pt-16"
      >
        <motion.div
          style={{ rotate: spinnerRotate }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
            armed
              ? "border-transparent bg-violet-600 text-white"
              : "border-border bg-surface text-fg-muted"
          }`}
        >
          ↻
        </motion.div>
      </motion.div>

      <motion.div style={{ y }}>{children}</motion.div>
    </>
  );
}
