'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { AnalysisDoc, AnalyseRequest, PrimaryMethod } from '@/lib/types';
import ResultHeader from './ResultHeader';
import TrendChart from './TrendChart';
import TrustChecks from './TrustChecks';
import DiagnosticsPanel from './DiagnosticsPanel';
import WindowSliders from './WindowSliders';
import SummaryPanel from './SummaryPanel';
import { Panel, TabList, type TabItem } from './Tabs';
import ResearchTab from './ResearchTab';
import ExportTab from './ExportTab';
import { presets } from '@/lib/story';
import { Chart as ChartJS } from 'chart.js';
import { historyAdd } from '@/lib/ux';
import { headlineSentence, plainComparison, statusWording } from '@/lib/story';
const TABS: TabItem[] = [
  { id: 'answer', label: 'Answer', hint: 'What changed?' },
  { id: 'trust', label: 'Can I trust it?', hint: 'Checks' },
  { id: 'stress', label: 'Stress-test', hint: 'Change the years' },
  { id: 'details', label: 'Details', hint: 'For researchers' },
  { id: 'summary', label: 'Summary & export', hint: 'Take it with you' },
];

export default function ResultsView({ initial }: { initial?: AnalysisDoc; }) {
  const params = useSearchParams();
  const paramsKey = params.toString();
  const [doc, setDoc] = useState<AnalysisDoc | undefined>(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(!initial);
  const [tab, setTabState] = useState<string>('answer');
  const [guess, setGuess] = useState('');
  const [window, setWindow] = useState<[number, number]>([0, 0]);
  const [primary, setPrimary] = useState<PrimaryMethod>('season_only');
  useEffect(() => {
    const read = () => { const h = globalThis.location.hash.replace('#', ''); if (TABS.some((t) => t.id === h)) setTabState(h); };
    read(); globalThis.addEventListener('hashchange', read); return () => globalThis.removeEventListener('hashchange', read);
  }, []);
  const setTab = (id: string) => { setTabState(id); try { globalThis.history.replaceState(null, '', `${globalThis.location.pathname}${globalThis.location.search}#${id}`); } catch { /* ignore */ } globalThis.scrollTo?.({ top: 0 }); };
  useEffect(()=>{if(doc&&!busy&&!params.has('src'))historyAdd({id:globalThis.window?.location.search||'',title:doc.title,href:`/results${globalThis.window?.location.search||''}`,date:new Date().toISOString()})},[doc,busy,params]);
  useEffect(() => {
    const q = new URLSearchParams(paramsKey);
    if (initial) { setDoc(initial); setBusy(false); return; }
    const key = q.get('k');
    if (q.get('src') === 'upload') {
      try { const stored = sessionStorage.getItem(`upload:${key}`); if (stored) { setDoc(JSON.parse(stored) as AnalysisDoc); setBusy(false); return; } } catch { /* malformed or blocked session storage */ }
      setError('This uploaded analysis is not available in this browser session. Upload the CSV again to restore it.'); setBusy(false); return;
    }
    const variableId = q.get('v');
    if (!variableId) { setBusy(false); return; }
    const months = (q.get('season') || '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number);
    const request: AnalyseRequest = { variableId, region: q.has('w') ? { type: 'bbox', west: Number(q.get('w')), south: Number(q.get('s')), east: Number(q.get('e')), north: Number(q.get('n')), name: q.get('place') || undefined } : { type: 'point', lat: Number(q.get('lat')), lon: Number(q.get('lon')), name: q.get('place') || undefined }, startYear: Number(q.get('start')), endYear: Number(q.get('end')), season: { label: q.get('sl') || 'Whole year', months }, alpha: Number(q.get('alpha') || .05), primary: (q.get('primary') as PrimaryMethod) || 'season_only' };
    const controller = new AbortController(); setBusy(true); setError('');
    fetch('/api/analyse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not analyse this question.'); setDoc(result as AnalysisDoc); }).catch((reason: unknown) => { if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message); }).finally(() => setBusy(false));
    return () => controller.abort();
  }, [initial, paramsKey]);
  useEffect(() => {
    if (!doc) return;
    const full = presets(doc)[0]; setWindow([full.start, full.end]); setPrimary(doc.headline.primary);
  }, [doc]);
  const waiting = busy || (!doc && !error && (params.has('v') || params.get('src') === 'upload'));
  if (waiting) return <main className="shell" aria-live="polite">
    <h1>Working through your question…</h1>
    <div className="card progress-card"><p>We’re preparing NASA’s monthly record and checking how the trend holds up.</p>{['Fetching NASA data','Cleaning gaps','Calculating trends','Testing different year windows'].map(x=><div className="progress-step" key={x}><span className="skeleton-dot"/> <span>{x}</span><span className="skeleton-line" aria-hidden="true"/></div>)}<button className="btn" onClick={()=>history.back()}>Cancel</button></div>
  </main>;
  if (error) return <main className="shell">
    <div className="notice" role="alert">{error}</div>
    <p>
      <p>Check that your place and dates are valid, then try again.</p><Link className="btn" href="/explore">Change place or period</Link> <button className="btn" onClick={() => location.reload()}>Try again</button> <Link className="btn" href="/">Use an example</Link>
    </p>
  </main>;
  if (!doc) return <main className="shell">
    <h1>Results</h1>
    <p>Choose a question or open a worked example.</p>
    <Link className="btn" href="/explore">Build a question</Link>
  </main>;
  const result = doc.analyses[primary];
  const selectedCell = doc.heatmap.cells.find((cell) => cell.start === window[0] && cell.end === window[1]);
  const shownTrend = selectedCell ? { ...result, slope_per_decade: selectedCell.slope_per_decade, ci_low: selectedCell.ci_low, ci_high: selectedCell.ci_high, p: selectedCell.p, significant: selectedCell.significant } : result;
  const index = TABS.findIndex((t) => t.id === tab);
  const answer = result.trend === 'increasing' ? 'Going up' : result.trend === 'decreasing' ? 'Going down' : 'No clear change';
  return <main className="shell results-shell">
    <ResultHeader doc={doc} result={result} />
    <TabList items={TABS} active={tab} onChange={setTab} label="Result sections" />

    <Panel id="answer" active={tab}>
      <div className="answer-grid">
        <section className="card start-here">
          <div className="eyebrow">The answer</div>
          <h2>{headlineSentence(doc)}</h2>
          <span className={`evidence-pill ${result.significant ? 'positive' : 'caution'}`} title="Strong evidence means the pattern would be unusual if there were no long-term change. Weak or no evidence does not prove there was no change.">{statusWording(result)} ⓘ</span>
          <ul>
            <li><b>How big:</b> {plainComparison(doc)}</li>
            <li><b>How sure:</b> {result.significant ? 'The pattern is unlikely to be random ups and downs alone.' : 'The data do not strongly support a long-term change. That does not prove nothing changed.'}</li>
            <li><b>What to watch:</b> {doc.diagnostics?.warnings[0] ?? (doc.variable.caveat ? doc.variable.caveat.split(/(?<=[.!?])\s+/)[0] : 'This result does not show what caused the pattern.')}</li>
          </ul>
          <div className="guess-box">
            <b>Your first impression?</b>
            <div className="chips">{['Going up', 'Going down', 'No clear change'].map((choice) => <button key={choice} className={`btn ${guess === choice ? 'primary' : ''}`} aria-pressed={guess === choice} onClick={() => setGuess(choice)}>{choice}</button>)}</div>
            {guess && <p role="status">{guess === answer ? `You guessed “${guess}”: that matches the best estimate.` : `You guessed “${guess}”; the best estimate says “${answer}”.`}{!result.significant && ' Remember: weak evidence means the data cannot rule out chance.'}</p>}
          </div>
        </section>
        <section className="card chart-card">
          <h3>{doc.season.label} values by year</h3>
          <TrendChart doc={doc} trend={shownTrend} selected={window} chartId="guided-chart" />
          <p className="muted">Dashed line: estimated trend. Shaded band: plausible range. Diamonds: highest and lowest years.</p>
        </section>
      </div>
    </Panel>

    <Panel id="trust" active={tab}>
      <TrustChecks doc={doc} />
      <section className="card section"><h2>Data quality</h2><DiagnosticsPanel doc={doc} /></section>
    </Panel>

    <Panel id="stress" active={tab}>
      <WindowSliders doc={doc} window={window} onWindow={setWindow} />
    </Panel>

    <Panel id="details" active={tab}>
      <ResearchTab doc={doc} primary={primary} onPrimary={setPrimary} window={window} onWindow={setWindow} />
    </Panel>

    <Panel id="summary" active={tab}>
      <ExportTab lead={<SummaryPanel doc={doc} result={result} />} doc={doc} charts={{ yearly: () => ChartJS.getChart('guided-chart')?.toBase64Image(), monthly: () => ChartJS.getChart('monthly-chart')?.toBase64Image() }} />
    </Panel>

    <div className="tab-footer">
      <button className="btn" disabled={index <= 0} onClick={() => setTab(TABS[index - 1].id)}>← {index > 0 ? TABS[index - 1].label : ''}</button>
      <span className="muted">{index + 1} of {TABS.length}</span>
      {index < TABS.length - 1 ? <button className="btn primary" onClick={() => setTab(TABS[index + 1].id)}>{TABS[index + 1].label} →</button> : <Link className="btn primary" href="/explore">Ask another question →</Link>}
    </div>
    <footer className="footer"><Link href="/about">Methods & limitations</Link> · {doc.provenance?.citation}</footer>
  </main>;
}
