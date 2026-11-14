'use client';
import type { AnalysisDoc } from '@/lib/types';
export default function DiagnosticsPanel({ doc }: { doc: AnalysisDoc; }) {
  const d = doc.diagnostics;
  if (!d) return <section className="card">
    <h3>Data checks</h3>
    <p>Diagnostics are not available for this analysis.</p>
  </section>;
  const outliers = d.outlier_years.length ? d.outlier_years.map((row) => `${row.year} (z = ${row.z.toFixed(1)})`).join(', ') : 'No years flagged';
  return <section className="card">
    <h3>Data checks</h3>
    <ul className="diagnostic-list">
      <li>
        <b>{d.pct_missing.toFixed(1)}%</b> of requested months are missing.</li>
      <li>
        <b>{d.incomplete_seasons.length}</b> seasons were incomplete and left out.</li>
      <li>Month-to-month anomaly persistence (lag 1): <b>{d.lag1_autocorr_monthly_anomalies?.toFixed(2) ?? 'not available'}</b>.</li>
      <li>Yearly residual persistence (lag 1): <b>{d.lag1_autocorr_yearly_residuals?.toFixed(2) ?? 'not available'}</b>.</li>
      <li>Unusual years compared with the fitted trend: <b>{outliers}</b>.</li>
    </ul>{d.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}</section>;
}
