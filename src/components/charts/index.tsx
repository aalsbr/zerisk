"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Card } from "@/components/ui/card";

export const CHART_COLORS = {
  coral: "#ff6b35",
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
  slate: "#64748b",
};

export const PIE_PALETTE = ["#ff6b35", "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

// Titled card chrome. Pass a self-contained *Series/DonutChart/etc. as children.
export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const axis = { tick: { fontSize: 11 }, tickLine: false, axisLine: false } as const;

interface Series {
  key: string;
  name: string;
  color: string;
}

export function BarSeries<T extends object>({
  data,
  series,
  stacked = false,
  vertical = false,
  height = 260,
}: {
  data: T[];
  series: Series[];
  stacked?: boolean;
  vertical?: boolean;
  height?: number;
}) {
  return (
    <ResponsiveContainerWrap height={height}>
      <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        {vertical ? (
          <>
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="label" width={90} {...axis} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} />
          </>
        )}
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[6, 6, 0, 0]}
            stackId={stacked ? "a" : undefined}
            maxBarSize={46}
          />
        ))}
      </BarChart>
    </ResponsiveContainerWrap>
  );
}

export function LineSeries<T extends object>({
  data,
  series,
  height = 260,
}: {
  data: T[];
  series: Series[];
  height?: number;
}) {
  return (
    <ResponsiveContainerWrap height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        <Tooltip />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainerWrap>
  );
}

export function AreaSeries<T extends object>({
  data,
  series,
  height = 260,
}: {
  data: T[];
  series: Series[];
  height?: number;
}) {
  return (
    <ResponsiveContainerWrap height={height}>
      <AreaChart data={data}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        <Tooltip />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#grad-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainerWrap>
  );
}

export function DonutChart({
  data,
  height = 260,
  innerRadius = 58,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  innerRadius?: number;
}) {
  return (
    <ResponsiveContainerWrap height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={innerRadius + 30}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainerWrap>
  );
}

export function ParetoChart({
  data,
  barKey,
  barName,
  height = 280,
}: {
  data: { label: string; [k: string]: string | number }[];
  barKey: string;
  barName: string;
  height?: number;
}) {
  const total = data.reduce((a, d) => a + (d[barKey] as number), 0) || 1;
  const withCum = data.map((d, i) => {
    const run = data.slice(0, i + 1).reduce((a, r) => a + (r[barKey] as number), 0);
    return { ...d, cumulative: +((run / total) * 100).toFixed(1) };
  });
  return (
    <ResponsiveContainerWrap height={height}>
      <ComposedChart data={withCum}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="left" {...axis} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" {...axis} />
        <Tooltip />
        <Bar yAxisId="left" dataKey={barKey} name={barName} fill={CHART_COLORS.coral} radius={[6, 6, 0, 0]} maxBarSize={46} />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" name="التراكمي %" stroke={CHART_COLORS.amber} strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainerWrap>
  );
}

export function RadialScore({
  value,
  color = CHART_COLORS.coral,
  height = 200,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  return (
    <ResponsiveContainerWrap height={height}>
      <RadialBarChart
        innerRadius="72%"
        outerRadius="100%"
        data={[{ name: label ?? "", value }]}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar background={{ fill: "#e8edf6" }} dataKey="value" cornerRadius={12} fill={color} />
      </RadialBarChart>
    </ResponsiveContainerWrap>
  );
}

function ResponsiveContainerWrap({ height, children }: { height: number; children: React.ReactElement }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
