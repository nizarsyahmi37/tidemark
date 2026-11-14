'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseMonthlyCsv } from '@/lib/csv';
import { SEASONS } from '@/lib/ux';

/** 20 years of made-up monthly values with a gentle upward trend and a seasonal cycle, so people can try the tool instantly. */
function sampleCsv(): string {
  const lines = ['date,value'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 2003; y <= 2022; y++) for (let m = 1; m <= 12; m++) {
    const v = 14 + 0.04 * (y - 2003 + m / 12) + 6 * Math.sin(((m - 4) * Math.PI) / 6) + (rnd() - 0.5) * 1.6;
    lines.push(`${y}-${String(m).padStart(2, '0')},${v.toFixed(2)}`);
  }
  return lines.join('\n');
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums), hi = Math.max(...nums), w = 600, h = 120;
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - 8 - ((v - lo) / (hi - lo || 1)) * (h - 16);
  let d = '', pen = false;
  values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; pen = true; });
  return (
    <svg className="upload-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Preview of ${values.length} monthly values from ${lo.toFixed(2)} to ${hi.toFixed(2)}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--teal)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Upload() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState('My monthly series');
  const [units, setUnits] = useState('');
  const [place, setPlace] = useState('');
  const [season, setSeason] = useState(SEASONS[0].label);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseMonthlyCsv(text) : null), [text]);
  const ready = !!parsed && parsed.rows.length >= 36 && parsed.errors.length === 0;
  const valid = parsed?.rows.filter((r) => r.value != null).length ?? 0;

  const readFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try { setText(await file.text()); setFileName(file.name); } catch { setError('We could not read that file. Try another CSV.'); }
  };
  const loadSample = () => { setText(sampleCsv()); setFileName('Sample data'); setName('Sample series'); setUnits('°C'); setPlace('Made-up example'); };
  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sampleCsv()], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sample-monthly-series.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!parsed || !ready) return;
    setError(''); setBusy(true);
    try {
      const years = parsed.rows.map((r) => Number(r.date.slice(0, 4)));
      const chosen = SEASONS.find((s) => s.label === season) ?? SEASONS[0];
      const response = await fetch('/api/analyse', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startYear: Math.min(...years), endYear: Math.max(...years), season: chosen, csv: { name: [name, place].filter(Boolean).join(' · '), units: units || 'units', rows: parsed.rows } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The analysis could not be completed.');
      const key = crypto.randomUUID();
      sessionStorage.setItem(`upload:${key}`, JSON.stringify(result));
      router.push(`/results?src=upload&k=${key}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not analyse this file.');
    } finally { setBusy(false); }
  };

  const stepLabels = ['Add your data', 'Check it', 'Describe & run'];
  return (
    <main className="shell upload-shell">
      <div className="breadcrumbs"><Link href="/">Home</Link> / Upload data</div>
      <h1>Analyse your own monthly data</h1>
      <p className="muted">Station records, in-situ sensors or another satellite product: if it is one value per month, you get the same trend analysis, stress-test and exports.</p>
      <nav className="wizard-stepper" aria-label="Steps">
        {stepLabels.map((label, i) => (
          <button key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''} aria-current={step === i + 1 ? 'step' : undefined}
            disabled={i > 0 && !ready} onClick={() => setStep(i + 1)}><span>{step > i + 1 ? '✓' : i + 1}</span>{label}</button>
        ))}
      </nav>

      {step === 1 && (
        <section className="card upload-card">
          <div
            className={`dropzone ${dragging ? 'over' : ''}`} role="button" tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void readFile(e.dataTransfer.files[0]); }}
          >
            <div className="drop-icon" aria-hidden>⬆</div>
            <b>{fileName ? `Loaded: ${fileName}` : 'Drop a CSV file here, or click to choose one'}</b>
            <span className="muted">Monthly values only · up to 6,000 rows</span>
            <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => void readFile(e.target.files?.[0])} />
          </div>
          <div className="actions">
            <button className="btn" onClick={loadSample}>Try it with sample data</button>
            <button className="btn" onClick={downloadSample}>Download the sample CSV</button>
          </div>
          <div className="format-grid">
            <div><b>Two columns</b><pre>{'date,value\n2001-01,12.4\n2001-02,10.8'}</pre></div>
            <div><b>Three columns</b><pre>{'year,month,value\n2001,1,12.4\n2001,2,10.8'}</pre></div>
          </div>
          <p className="muted">Commas, semicolons or tabs all work. Leave a value empty for a missing month. You need at least 3 years (36 months); 15 or more is better.</p>
          <details>
            <summary>Or paste your data</summary>
            <label className="field">Paste CSV<textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); setFileName(''); }} placeholder={'date,value\n2001-01,12.4\n2001-02,10.8'} /></label>
          </details>
          {parsed && parsed.errors.length > 0 && <div className="notice" role="alert"><b>We found a problem:</b><ul>{parsed.errors.slice(0, 4).map((m) => <li key={m}>{m}</li>)}</ul></div>}
          {parsed && parsed.errors.length === 0 && parsed.rows.length < 36 && <p className="notice">Only {parsed.rows.length} months found. Add at least 36.</p>}
          {error && <p className="notice" role="alert">{error}</p>}
          <div className="actions"><button className="btn primary" disabled={!ready} onClick={() => setStep(2)}>Check my data →</button></div>
        </section>
      )}

      {step === 2 && parsed && (
        <section className="card upload-card">
          <h2>Does this look right?</h2>
          <div className="metric-grid">
            <div className="metric"><b>{parsed.rows.length}</b><span>months</span></div>
            <div className="metric"><b>{parsed.rows[0]?.date.slice(0, 4)}–{parsed.rows.at(-1)?.date.slice(0, 4)}</b><span>period</span></div>
            <div className="metric"><b>{valid}</b><span>values found</span></div>
            <div className="metric"><b>{parsed.gaps}</b><span>missing months</span></div>
          </div>
          <Sparkline values={parsed.rows.map((r) => r.value)} />
          {parsed.warnings.map((w) => <p key={w} className="notice">{w}</p>)}
          <details>
            <summary>First rows as we read them</summary>
            <div className="tablewrap"><table className="table"><thead><tr><th>Month</th><th>Value</th></tr></thead><tbody>
              {parsed.rows.slice(0, 8).map((r) => <tr key={r.date}><td>{r.date}</td><td>{r.value ?? 'missing'}</td></tr>)}
            </tbody></table></div>
          </details>
          <div className="actions">
            <button className="btn" onClick={() => setStep(1)}>← Change data</button>
            <button className="btn primary" onClick={() => setStep(3)}>Looks right →</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card upload-card">
          <h2>Tell us what it is</h2>
          <div className="row">
            <label className="field">What is it?<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mean air temperature" /></label>
            <label className="field">Units<input value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. °C, mm, ppm" /></label>
            <label className="field">Where?<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Penang station" /></label>
          </div>
          <label className="field">Which part of the year should we focus on?
            <select value={season} onChange={(e) => setSeason(e.target.value)}>{SEASONS.map((s) => <option key={s.label}>{s.label}</option>)}</select>
          </label>
          {error && <p className="notice" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn" onClick={() => setStep(2)}>← Back</button>
            <button className="btn primary" disabled={busy || !ready} onClick={submit}>{busy ? 'Analysing…' : 'Analyse my data →'}</button>
          </div>
        </section>
      )}
    </main>
  );
}
