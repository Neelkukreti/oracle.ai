'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Highlight } from '@/lib/types';

interface ChartOverlayProps {
  highlights?: Highlight[];
  containerWidth: number;
  containerHeight: number;
}

export function ChartOverlay({ highlights = [], containerWidth, containerHeight }: ChartOverlayProps) {
  if (!containerWidth || !containerHeight) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: containerWidth, height: containerHeight }}
    >
      <AnimatePresence>
        {highlights.map((h, i) => {
          const x = h.x * containerWidth;
          const y = h.y * containerHeight;
          const w = h.w * containerWidth;
          const height = h.h * containerHeight;

          return (
            <motion.div
              key={`hl-${i}-${h.label}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="absolute border border-oracle-green/70 bg-oracle-green/10 rounded"
              style={{ left: x, top: y, width: w, height }}
            >
              <div className="absolute -top-6 left-0 bg-oracle-green text-black px-2 py-0.5 rounded text-xs font-bold shadow-lg whitespace-nowrap">
                {h.label}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
