// app/src/components/animated-number.tsx
"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

// Count-up on mount. Writes textContent directly to avoid re-renders.
export default function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  // SSR fallback renders the final value so no-JS users see real data.
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
