// app/src/components/motion-card.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

// Entrance fade-up + optional spring hover lift. Children render
// server-side; only the wrapper animates.
export default function MotionCard({
  children,
  delay = 0,
  lift = true,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  lift?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        lift && !reduced
          ? { y: -3, transition: { type: "spring", stiffness: 300, damping: 20 } }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}
