"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type SparklineAccent = "cyan" | "violet" | "emerald" | "amber";

const strokeColors: Record<SparklineAccent, string> = {
  cyan: "hsl(187 85% 53%)",
  violet: "hsl(262 70% 58%)",
  emerald: "hsl(160 84% 39%)",
  amber: "hsl(38 92% 50%)",
};

const WIDTH = 128;
const HEIGHT = 40;
const PAD = 2;

function normalizeSeries(data: number[]): { x: number; y: number }[] {
  if (data.length === 0) {
    return Array.from({ length: 7 }, (_, i) => ({
      x: (i / 6) * WIDTH,
      y: HEIGHT / 2,
    }));
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  return data.map((value, i) => ({
    x: data.length === 1 ? WIDTH / 2 : (i / (data.length - 1)) * WIDTH,
    y: PAD + (HEIGHT - PAD * 2) * (1 - (value - min) / range),
  }));
}

function buildLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M 0 ${p.y} L ${WIDTH} ${p.y}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx.toFixed(2)} ${prev.y.toFixed(2)}, ${cx.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }
  return d;
}

function buildAreaPath(linePath: string, points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath} L ${last.x.toFixed(2)} ${HEIGHT} L ${first.x.toFixed(2)} ${HEIGHT} Z`;
}

type MetricSparklineProps = {
  data: number[];
  accent?: SparklineAccent;
  className?: string;
};

export function MetricSparkline({ data, accent = "cyan", className }: MetricSparklineProps) {
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const points = useMemo(() => normalizeSeries(data), [data]);
  const linePath = useMemo(() => buildLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(linePath, points), [linePath, points]);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    const frame = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(frame);
  }, [linePath]);

  const stroke = strokeColors[accent];
  const gradId = `spark-fill-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("h-10 w-full max-w-[128px]", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} className="opacity-80" />
      <path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={stroke}
          className="animate-pulse-glow"
        />
      )}
    </svg>
  );
}
