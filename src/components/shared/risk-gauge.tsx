"use client";

import { motion } from "framer-motion";

export function riskColor(score: number): string {
  if (score <= 34) return "#34d399";
  if (score <= 59) return "#38bdf8";
  if (score <= 79) return "#fbbf24";
  return "#fb7185";
}

export function RiskGauge({
  score,
  size = 132,
  label,
  suffix = "",
}: {
  score: number;
  size?: number;
  label?: string;
  suffix?: string;
}) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = riskColor(score);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf6" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {Math.round(score)}
          {suffix}
        </span>
        {label && <span className="text-[11px] text-muted">{label}</span>}
      </div>
    </div>
  );
}
