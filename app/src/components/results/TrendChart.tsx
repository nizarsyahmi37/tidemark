'use client';
import { useMemo } from 'react';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend, Title } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { AnalysisDoc, TrendResult } from '@/lib/types';
import { useChartTheme } from './chartTheme';
ChartJS.register(LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend, Title);

export default function TrendChart({ doc, trend, selected, chartId = 'yearly-chart' }: { doc: AnalysisDoc; trend?: TrendResult; selected?: [number, number]; chartId?: string; }) {
  const theme = useChartTheme();
  const points = doc.annual_season_series;
  const view = selected ? points.filter((row) => row.year >= selected[0] && row.year <= selected[1]) : points;
  const averageYear = view.reduce((sum, row) => sum + row.year, 0) / Math.max(view.length, 1);
  const averageValue = view.reduce((sum, row) => sum + row.value, 0) / Math.max(view.length, 1);
  const data = useMemo(() => {
    const first = view[0]?.year ?? 0;
    const last = view.at(-1)?.year ?? first;
    const lower = (trend?.ci_low ?? 0) / 10;
    const upper = (trend?.ci_high ?? 0) / 10;
    const fitted = (trend?.slope_per_decade ?? 0) / 10;
    const series = (slope: number) => [first, last].map((year) => ({ x: year, y: averageValue + (year - averageYear) * slope }));
    const extremes = points.length ? [
      points.reduce((a, b) => a.value < b.value ? a : b),
      points.reduce((a, b) => a.value > b.value ? a : b),
    ] : [];
    const datasets = [
      ...(trend ? [
        { label: 'Lower plausible range', data: series(lower), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label: 'Plausible range', data: series(upper), borderColor: 'transparent', backgroundColor: 'rgba(225,139,56,.17)', pointRadius: 0, fill: '-1' as const },
        { label: 'Sen trend', data: series(fitted), borderColor: theme.amber, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false },
      ] : []),
      { label: `${doc.season.label} value`, data: points.map((row) => ({ x: row.year, y: row.value })), borderColor: theme.teal, backgroundColor: 'transparent', pointBackgroundColor: points.map((row) => selected && row.year >= selected[0] && row.year <= selected[1] ? theme.amber : theme.teal), pointRadius: points.map((row) => extremes.some((extreme) => extreme.year === row.year) ? 4 : 2), pointHoverRadius: 6, tension: .2, fill: false },
      { label: 'Highest / lowest year', data: extremes.map((row) => ({ x: row.year, y: row.value })), showLine: false, pointStyle: 'rectRot' as const, pointRadius: 6, pointBackgroundColor: theme.amber },
    ];
    return { datasets };
  }, [averageValue, averageYear, doc.season.label, points, selected, theme, trend, view]);
  const unit = doc.variable.unit_label || doc.variable.units;
  const chartDescription = `${doc.variable.name}, ${doc.season.label} yearly values from ${points[0]?.year} to ${points.at(-1)?.year}.${trend ? ` Estimated change ${trend.slope_per_decade} ${unit} per decade.` : ''}`;
  return <div className="chart-container trend-chart" tabIndex={0} role="img" aria-label={chartDescription}>
    <Line id={chartId} data={data} options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { color: theme.muted, usePointStyle: true, filter: (item) => !item.text.includes('Lower plausible') } }, tooltip: { callbacks: { title: (items) => String(items[0]?.parsed.x ?? '') } } }, scales: { x: { type: 'linear', title: { display: true, text: 'Year', color: theme.muted }, min: points[0]?.year, max: points.at(-1)?.year, ticks: { color: theme.muted, maxTicksLimit: 9, precision: 0, callback: (value) => String(value) }, grid: { color: theme.line } }, y: { title: { display: true, text: unit, color: theme.muted }, ticks: { color: theme.muted }, grid: { color: theme.line } } } }} />
  </div>;
}
