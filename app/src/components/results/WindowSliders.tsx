'use client';
import type { AnalysisDoc, HeatCell } from '@/lib/types';
import { presets, windowSentence } from '@/lib/story';
import { normalizeWindow } from '@/lib/results/layout';
import WindowHeatmap from './WindowHeatmap';
export default function WindowSliders({ doc, window, onWindow }: { doc: AnalysisDoc; window: [number, number]; onWindow: (window: [number, number]) => void; }) {
  const first = doc.annual_season_series[0]?.year ?? 0;
  const last = doc.annual_season_series.at(-1)?.year ?? first;
  const minYears = doc.heatmap.min_years;
  const selected = doc.heatmap.cells.find((cell) => cell.start === window[0] && cell.end === window[1]);
  const choose = (cell: HeatCell) => onWindow([cell.start, cell.end]);
  const metrics = [
    { question: 'How often do windows point the same way?', value: doc.heatmap.metrics.direction_agreement, width: doc.heatmap.metrics.direction_agreement, format: (value: number) => `${(value * 100).toFixed(0)}%` },
    { question: 'How often is there strong evidence?', value: doc.heatmap.metrics.significant_fraction, width: doc.heatmap.metrics.significant_fraction, format: (value: number) => `${(value * 100).toFixed(0)}%` },
    { question: 'How much do the slopes vary?', value: doc.heatmap.metrics.slope_dispersion, width: doc.heatmap.metrics.slope_dispersion === null ? null : 1 / (1 + doc.heatmap.metrics.slope_dispersion), format: (value: number) => `${value.toFixed(1)}× the full-record slope` },
    { question: 'How stable is the confidence-range verdict?', value: doc.heatmap.metrics.ci_stability, width: doc.heatmap.metrics.ci_stability, format: (value: number) => `${(value * 100).toFixed(0)}%` },
  ];
  return <section className="card section">
    <div className="eyebrow">Stress-test</div>
    <h2>What if you had only looked at some of the years?</h2>
    <p className="muted">Move either slider or choose a preset. The heatmap shows every available start and end year.</p>
    <div className="slider-grid">
      <label>Start year <output>{window[0]}</output>
        <input type="range" min={first} max={Math.max(first, last - minYears + 1)} value={window[0]} onChange={(event) => onWindow(normalizeWindow(+event.target.value, window[1], minYears, first, last))} />
      </label>
      <label>End year <output>{window[1]}</output>
        <input type="range" min={Math.min(last, window[0] + minYears - 1)} max={last} value={window[1]} onChange={(event) => onWindow(normalizeWindow(window[0], +event.target.value, minYears, first, last))} />
      </label>
    </div>
    <div className="chips">{presets(doc).map((preset) => <button className="btn" key={preset.label} onClick={() => onWindow([preset.start, preset.end])}>{preset.label}</button>)}</div>
    <p className="live-sentence" aria-live="polite">{windowSentence(doc, selected)}</p>{selected && <p className={`evidence-pill ${selected.significant ? 'positive' : 'caution'}`}>{selected.significant ? 'Strong evidence in this span' : 'Weak or no evidence in this span'}{Math.sign(selected.slope_per_decade) !== Math.sign(doc.analyses[doc.headline.primary].slope_per_decade) ? ' · Opposite direction to the full record' : ''}</p>}<div className="stress-grid"><div className="stress-main"><div className="heatmap-heading">
      <h3>Every possible choice of years</h3>
      <p className="muted">Rows show end year; columns show start year. Blue slopes fall, orange slopes rise; a dot marks a significant window.</p>
    </div>
    <WindowHeatmap doc={doc} selected={window} onSelect={choose} />
    <div className="heat-legend">
      <span>↓ Falling</span>
      <span>• Significant</span>
      <span>Rising ↑</span>
    </div>
    </div><aside className="stress-side"><h3>How solid is the answer?</h3><div className="metric-grid">{metrics.map((metric) => <div className="metric card" key={metric.question}>
      <b>{metric.question}</b>
      <span>{typeof metric.value === 'number' ? metric.format(metric.value) : '—'}</span>
      <div className="meter" aria-hidden="true"><i style={{ width: `${typeof metric.width === 'number' ? Math.max(0, Math.min(100, metric.width * 100)) : 0}%` }} /></div>
    </div>)}</div>
    <p className="notice">{doc.heatmap.metrics.verdict_text}</p></aside></div>
  </section>;
}
