// app/src/components/journey-ladder.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

export type LadderStage = { stageCode: string; name: string };

// Animated lifecycle ladder: progress bar fills to the current stage,
// chips stagger in, current chip pulses once.
export default function JourneyLadder({
  stages,
  currentCode,
}: {
  stages: LadderStage[];
  currentCode: string | null;
}) {
  const reduced = useReducedMotion();
  const currentIndex = stages.findIndex((s) => s.stageCode === currentCode);
  const progress =
    stages.length <= 1 || currentIndex < 0
      ? 0
      : currentIndex / (stages.length - 1);

  return (
    <div className="space-y-4">
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--bg-inset)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--lime)" }}
          initial={reduced ? { width: `${progress * 100}%` } : { width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </div>
      <ol className="flex flex-wrap items-center gap-2">
        {stages.map((s, i) => {
          const isCurrent = i === currentIndex;
          const passed = currentIndex >= 0 && i < currentIndex;
          return (
            <motion.li
              key={s.stageCode}
              className="flex items-center gap-2"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.4 }}
            >
              {i > 0 && <span style={{ color: "var(--text-muted)" }}>→</span>}
              <motion.span
                className="rounded-full px-3 py-1 text-xs font-medium"
                animate={
                  isCurrent && !reduced
                    ? { scale: [1, 1.12, 1], transition: { delay: 1, duration: 0.5 } }
                    : undefined
                }
                style={
                  isCurrent
                    ? { background: "var(--lime)", color: "#1C2018", fontWeight: 700 }
                    : passed
                      ? { background: "var(--lime-soft)", color: "var(--text-primary)" }
                      : { background: "var(--bg-inset)", color: "var(--text-muted)" }
                }
              >
                {s.name}
              </motion.span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
