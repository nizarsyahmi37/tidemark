'use client';
import type { AnalysisDoc } from '@/lib/types';
import { METHODS, formatNumber } from '@/lib/story';
import { forestScale } from '@/lib/results/layout';
export default function ForestPlot({ doc }: { doc: AnalysisDoc; }) {
  const rows = METHODS.map(([key, label]) => ({ key, label, result: doc.analyses[key] }));
  const scale = forestScale(rows.map((row) => row.result));
  const x = (value: number) => `${Math.max(0, Math.min(100, (value + scale) / (scale * 2) * 100))}%`;
  return <div className="forest-plot" role="img" aria-label="Trend estimates and confidence intervals by analysis method">
    <div className="forest-scale">
      <span>Falling</span>
      <span>No change</span>
      <span>Rising</span>
    </div>
    {rows.map(({ key, label, result }) => <div className="forest-row" key={key}>
      <span className="forest-label">{label}</span>
      <div className="forest-track" aria-hidden="true">
        <i className="forest-zero" />
        <i className="forest-range" style={{ left: x(result.ci_low), width: `${Math.max(0, Math.min(100, (result.ci_high - result.ci_low) / (scale * 2) * 100))}%` }} />
        <i className={`forest-dot ${result.significant ? 'is-significant' : ''}`} style={{ left: x(result.slope_per_decade) }} />
      </div>
      <span className={result.significant ? 'forest-status positive' : 'forest-status caution'}>
        <b aria-hidden="true">{result.significant ? '✓' : '!'}</b> {result.significant ? 'Evidence' : 'Unclear'}</span>
      <small>{formatNumber(result.slope_per_decade, doc.variable, { signed: true })} {doc.variable.units} / decade</small>
    </div>)}
    <p className="muted">Each dot is the estimated change per decade; the bar is its 95% confidence interval. The vertical line marks no change.</p>
  </div>;
}
