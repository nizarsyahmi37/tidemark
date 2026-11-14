'use client';
import { useMemo, useState } from 'react';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { AnalysisDoc } from '@/lib/types';
import { useChartTheme } from './chartTheme';
ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
type Mode = 'raw' | 'anomaly' | 'climatology';
export default function MonthlyChart({ doc }: { doc: AnalysisDoc; }) {
  const [mode, setMode] = useState<Mode>('raw');
  const theme = useChartTheme();
  const data = useMemo(() => {
    const climatology = new Map(doc.climatology.map((row) => [row.month, row.mean]));
    const rows = doc.series.map((row) => {
      const [year, month] = row.date.split('-').map(Number);
      const value = mode === 'anomaly' ? row.anomaly : mode === 'climatology' ? climatology.get(month) ?? null : row.value;
      return { x: year + (month - 1) / 12, y: value };
    }).filter((row): row is { x: number; y: number; } => row.y !== null && Number.isFinite(row.y));
    return { datasets: [{ label: mode === 'raw' ? 'Monthly value' : mode === 'anomaly' ? 'Monthly anomaly' : 'Monthly climatology', data: rows, borderColor: theme.teal, backgroundColor: theme.teal, pointRadius: 1.5, borderWidth: 1.4, showLine: mode !== 'climatology' }] };
  }, [doc.climatology, doc.series, mode, theme.teal]);
  return <section>
    <div className="chips" role="group" aria-label="Monthly chart view">{(['raw', 'anomaly', 'climatology'] as const).map((option) => <button className={`btn ${mode === option ? 'primary' : ''}`} key={option} aria-pressed={mode === option} onClick={() => setMode(option)}>{option === 'raw' ? 'Raw values' : option === 'anomaly' ? 'Anomalies' : 'Climatology'}</button>)}</div>
    <div className="chart-container monthly-chart" tabIndex={0} role="img" aria-label={`${doc.variable.name}, ${mode} monthly values across ${doc.period.start.slice(0,4)} to ${doc.period.end.slice(0,4)}`}>
      <Scatter id="monthly-chart" data={data} options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { type: 'linear', title: { display: true, text: 'Year', color: theme.muted }, ticks: { color: theme.muted, maxTicksLimit: 9, callback: (v) => String(v) }, grid: { color: theme.line } }, y: { title: { display: true, text: mode === 'anomaly' ? `${doc.variable.unit_label} anomaly` : doc.variable.unit_label, color: theme.muted }, ticks: { color: theme.muted }, grid: { color: theme.line } } } }} />
    </div>
  </section>;
}
