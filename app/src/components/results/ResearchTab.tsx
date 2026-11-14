'use client';
import type { AnalysisDoc, PrimaryMethod } from '@/lib/types';
import MethodsTable from './MethodsTable';
import DiagnosticsPanel from './DiagnosticsPanel';
import ForestPlot from './ForestPlot';
import MonthlyChart from './MonthlyChart';
import TrendChart from './TrendChart';
import WindowHeatmap from './WindowHeatmap';
import WindowsTable from './WindowsTable';
import Disclosure from './Disclosure';
import { normalizeWindow } from '@/lib/results/layout';
import { useState } from 'react';
import { Panel, SubTabs } from './Tabs';
export default function ResearchTab({ doc, primary, onPrimary, window, onWindow }: { doc: AnalysisDoc; primary: PrimaryMethod; onPrimary: (method: PrimaryMethod) => void; window: [number, number]; onWindow: (window: [number, number]) => void; }) {
  const [sub, setSub] = useState('methods');
  const result = doc.analyses[primary];
  const first = doc.annual_season_series[0]?.year ?? 0;
  const last = doc.annual_season_series.at(-1)?.year ?? first;
  const selected = doc.heatmap.cells.find((cell) => cell.start === window[0] && cell.end === window[1]);
  return <><SubTabs label="Detail views" active={sub} onChange={setSub} items={[{ id: 'methods', label: 'Methods & diagnostics' }, { id: 'charts', label: 'Charts' }, { id: 'windows', label: 'Year windows' }, { id: 'how', label: 'How it is calculated' }]}>
    <Panel id="methods" active={sub}>
    <section className="card section">
      <h2>Methods comparison</h2>
      <p>All four analyses use the same source series. Select a row to change the primary result.</p>
      <MethodsTable doc={doc} primary={primary} onPrimary={onPrimary} />
    </section>
    <section className="card section">
      <h2>Diagnostics and data quality</h2>
      <DiagnosticsPanel doc={doc} />
    </section>
    <section className="card section">
      <h2>Method estimates</h2>
      <ForestPlot doc={doc} />
    </section>
    </Panel>
    <Panel id="charts" active={sub}>
    <section className="card section">
      <h2>Yearly trend</h2>
      <TrendChart doc={doc} trend={result} chartId="research-chart" />
    </section>
    <section className="card section">
      <h2>Monthly series</h2>
      <p className="muted">Toggle between observed values, departures from each month’s usual level, and the monthly climatology.</p>
      <MonthlyChart doc={doc} />
    </section>
    </Panel>
    <Panel id="windows" active={sub}>
    <section className="card section">
      <h2>Window sensitivity</h2>
      <p>{doc.heatmap.metrics.verdict_text}</p>
      <div className="slider-grid">
        <label>Start year <output>{window[0]}</output>
          <input type="range" min={first} max={Math.max(first, last - doc.heatmap.min_years + 1)} value={window[0]} onChange={(event) => onWindow(normalizeWindow(+event.target.value, window[1], doc.heatmap.min_years, first, last))} />
        </label>
        <label>End year <output>{window[1]}</output>
          <input type="range" min={Math.min(last, window[0] + doc.heatmap.min_years - 1)} max={last} value={window[1]} onChange={(event) => onWindow(normalizeWindow(window[0], +event.target.value, doc.heatmap.min_years, first, last))} />
        </label>
      </div>
      <WindowHeatmap doc={doc} selected={window} onSelect={(cell) => onWindow([cell.start, cell.end])} />{selected && <p>{selected.start}–{selected.end}: slope {selected.slope_per_decade.toPrecision(4)} {doc.variable.units} per decade; p = {selected.p?.toPrecision(3) ?? '—'}.</p>}<WindowsTable doc={doc} />
    </section>
    </Panel>
    <Panel id="how" active={sub}>
    <section className="card section">
      <h2>How we calculated this</h2>
      <p>Sen slope is the median of pairwise slopes, expressed per decade. Mann–Kendall uses S and Var(S), with tie correction; Gilbert confidence limits estimate slope uncertainty. Seasonal Mann–Kendall compares like months. Hamed–Rao adjusts for lag-1 autocorrelation. The window sweep repeats the calculation across every eligible period.</p>
      <p>Limitations: overlapping windows are not independent, missing months can affect seasonal coverage, and reanalysis values blend observations with a model.</p>
      <Disclosure doc={doc} />
    </section>
      </Panel>
  </SubTabs></>;
}
