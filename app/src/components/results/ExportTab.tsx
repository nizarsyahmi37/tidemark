'use client';
import type { AnalysisDoc } from '@/lib/types';
import { useState } from 'react';
import { methodsParagraph, pythonScript } from '@/lib/exporters';
import { METHODS } from '@/lib/story';
import { Chart as ChartJS } from 'chart.js';
import { Panel, SubTabs } from './Tabs';
import type { ReactNode } from 'react';
export type ChartImages = { yearly?: () => string | undefined; monthly?: () => string | undefined; };
function save(name: string, content: string, type = 'text/plain') { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
function csv(headers: string[], rows: unknown[][]) { return [headers.join(','), ...rows.map((row) => row.map((value) => JSON.stringify(value ?? '')).join(','))].join('\n'); }
export default function ExportTab({ doc, charts, lead }: { doc: AnalysisDoc; charts: ChartImages; lead?: ReactNode; }) {
  const [copied, setCopied] = useState('');
  const [sub, setSub] = useState(lead ? 'meaning' : 'downloads');
  const script = pythonScript(doc);
  const link = typeof window === 'undefined' ? '' : window.location.href;
  const copy = async (label: string, value: string) => { await navigator.clipboard?.writeText(value); setCopied(label); };
  const items: [string, string, () => void][] = [
    ['Monthly series CSV', 'The monthly values and anomalies used in the analysis.', () => save('monthly-series.csv', csv(['date', 'value', 'anomaly'], doc.series.map((row) => [row.date, row.value, row.anomaly])), 'text/csv')],
    ['Yearly series CSV', 'Seasonal annual values behind the trend chart.', () => save('yearly-season.csv', csv(['year', 'value'], doc.annual_season_series.map((row) => [row.year, row.value])), 'text/csv')],
    ['Window results CSV', 'Every tested start and end year with its estimate.', () => save('windows.csv', csv(['start', 'end', 'n', 'slope', 'ci_low', 'ci_high', 'p', 'significant'], doc.heatmap.cells.map((row) => [row.start, row.end, row.n, row.slope_per_decade, row.ci_low, row.ci_high, row.p, row.significant])), 'text/csv')],
    ['Complete analysis JSON', 'The full result, diagnostics, and provenance record.', () => save('analysis.json', JSON.stringify(doc, null, 2), 'application/json')],
    ['Methods paragraph', 'A concise citation-ready description of the analysis.', () => copy('Methods paragraph', methodsParagraph(doc))],
    ['Yearly chart PNG', 'A PNG exported from the Chart.js yearly chart.', () => { const image = charts.yearly?.() ?? ChartJS.getChart('yearly-chart')?.toBase64Image(); if (image) save('yearly-chart.png', image, 'image/png'); }],
    ['Monthly chart PNG', 'A PNG exported from the Chart.js monthly chart.', () => { const image = charts.monthly?.() ?? ChartJS.getChart('monthly-chart')?.toBase64Image(); if (image) save('monthly-chart.png', image, 'image/png'); }],
    ['BibTeX citation', 'Citation for the data source and method.', () => copy('BibTeX citation', `${doc.provenance?.bibtex ?? ''}\n@article{hamedrao1998,author={Hamed, K. H. and Rao, A. R.},title={A modified Mann-Kendall trend test for autocorrelated data},year={1998}}`)],
  ];
  return <><SubTabs label="Export sections" active={sub} onChange={setSub} items={[...(lead ? [{ id: 'meaning', label: 'What it means' }] : []), { id: 'downloads', label: 'Downloads' }, { id: 'cite', label: 'Cite & data source' }, { id: 'script', label: 'Python script' }]}>
    {lead && <Panel id="meaning" active={sub}>{lead}</Panel>}
    <Panel id="downloads" active={sub}>
    <section className="card section">
      <h2>Take the analysis with you</h2>
      <div className="export-grid">{items.map(([title, description, action]) => <article className="export-card" key={title}>
        <h3>{title}</h3>
        <p>{description}</p>
        <button className="btn" onClick={action}>Export / copy</button>
      </article>)}</div>
      <h3>Permalink</h3>
      <div className="copy-row">
        <code>{link}</code>
        <button className="btn" onClick={() => copy('Permalink', link)}>Copy link</button>
      </div>{copied && <p role="status">Copied {copied}.</p>}</section>
    </Panel>
    <Panel id="cite" active={sub}>
    <section className="card section">
      <h2>Provenance</h2>
      <dl className="provenance-list">
        <dt>Source</dt>
        <dd>{doc.provenance?.source ?? doc.variable.source}</dd>
        <dt>Grid points</dt>
        <dd>{doc.provenance?.gridPoints?.length ?? doc.region.n_gridcells} points</dd>
        <dt>Fetched</dt>
        <dd>{doc.provenance?.fetchedAt ?? 'Not recorded'}</dd>
        <dt>Citation</dt>
        <dd>{doc.provenance?.citation ?? 'No citation supplied'}</dd>
      </dl>
      <h3>Request URLs</h3>{doc.provenance?.requestUrls?.length ? doc.provenance.requestUrls.map((url) => <div className="copy-row" key={url}>
        <code>{url}</code>
        <button className="btn" onClick={() => copy('request URL', url)}>Copy</button>
      </div>) : <p className="muted">No request URLs were recorded.</p>}{copied && <p role="status">Copied {copied}.</p>}<h3>BibTeX</h3>
      <pre className="code-preview">{doc.provenance?.bibtex ?? 'No BibTeX citation was supplied.'}</pre>
    </section>
    </Panel>
    <Panel id="script" active={sub}>
    <section className="card section">
      <div className="actions">
        <h2>Python reproduction script</h2>
        <button className="btn" onClick={() => copy('Python script', script)}>Copy script</button>
      </div>
      <pre className="code-preview">
        <code>{script}</code>
      </pre>{copied === 'Python script' && <p role="status">Copied Python script.</p>}<p className="muted">Uses the exported monthly-series.csv. Methods: {METHODS.map((row) => row[1]).join('; ')}.</p>
    </section>
      </Panel>
  </SubTabs></>;
}
