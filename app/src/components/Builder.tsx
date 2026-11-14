'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { SeasonSpec, VariableDef } from '@/lib/types';
import { AREA_SIZES, QUICK_STARTS, SEASONS, areaBox, coordLabel, gridCells, periodDefaults, seasonPhrase } from '@/lib/ux';
import PlaceMap from './MapLoader';
import RecentInvestigations from './RecentInvestigations';

const PLACES = [
  { name: 'Klang Valley, Malaysia', lat: 3.1, lon: 101.6 },
  { name: 'Wisconsin, USA', lat: 44.5, lon: -89.5 },
  { name: 'Iowa, USA', lat: 42, lon: -93.5 },
  { name: 'The Sahel', lat: 15, lon: 0 },
  { name: 'Amazon basin', lat: -3, lon: -60 },
  { name: 'Arctic (Svalbard)', lat: 78, lon: 16 },
] as const;
const STEPS = ['Question', 'Measure', 'Place', 'Time', 'Review'] as const;
const SEASON_HELP: Record<string, string> = {
  'Whole year': 'Best starting point: averages all 12 months.',
  'Winter (DJF)': 'December–February. Use these calendar months in either hemisphere.',
  'Spring (MAM)': 'March–May.',
  'Summer (JJA)': 'June–August.',
  'Autumn (SON)': 'September–November.',
};
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METHODS = [
  ['season_only', 'One value per year (recommended)'],
  ['deseasonalized', 'Months compared with their usual level'],
  ['seasonal_mk', 'Each calendar month on its own'],
  ['raw', 'Month by month, as they come'],
] as const;

function lastCompleteYear(latest: string | null): number {
  const year = Number(latest?.slice(0, 4)) || new Date().getUTCFullYear();
  return latest && latest.slice(5) === '12' ? year : year - 1;
}

export default function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = useRef(params);

  // catalog
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [latest, setLatest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  // wizard state
  const [step, setStep] = useState(0);
  const [variableId, setVariableId] = useState('t2m');
  const [place, setPlace] = useState<{ name: string; lat: number; lon: number }>({ name: PLACES[0].name, lat: PLACES[0].lat, lon: PLACES[0].lon });
  const [nameTouched, setNameTouched] = useState(false);
  const [mode, setMode] = useState<'spot' | 'area'>('spot');
  const [areaDeg, setAreaDeg] = useState<number>(AREA_SIZES[1].deg);
  const [start, setStart] = useState(1995);
  const [end, setEnd] = useState(2025);
  const [season, setSeason] = useState<SeasonSpec>(SEASONS[0]);
  const [custom, setCustom] = useState(false);
  const [alpha, setAlpha] = useState(0.05);
  const [primary, setPrimary] = useState('season_only');
  const [geo, setGeo] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const selected = variables.find((v) => v.id === variableId);
  const box = mode === 'area' ? areaBox(place.lat, place.lon, areaDeg) : null;
  const maxEnd = lastCompleteYear(latest);

  // --- load catalog once, then apply URL state
  useEffect(() => {
    const ctrl = new AbortController();
    const q = initial.current;
    fetch('/api/variables', { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('The variable catalog is unavailable right now.');
        return (await r.json()) as { variables: VariableDef[]; latestAvailableMonth: string | null };
      })
      .then((d) => {
        setVariables(d.variables);
        setLatest(d.latestAvailableMonth);
        const chosen = d.variables.find((v) => v.id === (q.get('v') || '')) ?? d.variables.find((v) => v.id === 't2m') ?? d.variables[0];
        if (chosen) setVariableId(chosen.id);
        const p = periodDefaults(chosen?.recordStartYear ?? 1981, d.latestAvailableMonth);
        setStart(Number(q.get('start')) || p.start);
        setEnd(Number(q.get('end')) || p.end);
        const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
        if (q.get('lat') && q.get('lon') && Number.isFinite(lat) && Number.isFinite(lon)) {
          setPlace({ name: q.get('place') || coordLabel(lat, lon), lat, lon });
          setNameTouched(Boolean(q.get('place')));
        }
        if (q.get('area')) { setMode('area'); setAreaDeg(Number(q.get('area')) || AREA_SIZES[1].deg); }
        const months = (q.get('season') || '').split(',').map(Number).filter((m) => m >= 1 && m <= 12);
        if (months.length) {
          const known = SEASONS.find((s) => s.months.join() === months.join());
          setSeason(known ?? { label: q.get('sl') || 'Custom months', months });
          setCustom(!known);
        }
        const s = Number(q.get('step'));
        if (Number.isInteger(s) && s >= 0 && s <= 4) setStep(s);
      })
      .catch((e: Error) => { if (e.name !== 'AbortError') setCatalogError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  // --- keep the URL in sync (no navigation, no refetch) so refresh / sharing works
  useEffect(() => {
    if (loading) return;
    const q = new URLSearchParams({ step: String(step), v: variableId, place: place.name, lat: String(place.lat), lon: String(place.lon), start: String(start), end: String(end), season: season.months.join(','), sl: season.label });
    if (mode === 'area') q.set('area', String(areaDeg));
    window.history.replaceState(null, '', `/explore?${q}`);
  }, [loading, step, variableId, place, mode, areaDeg, start, end, season]);

  const cats = useMemo(() => ['All', ...Array.from(new Set(variables.map((v) => v.category)))], [variables]);
  const filtered = useMemo(
    () => variables.filter((v) => (category === 'All' || v.category === category) && `${v.name} ${v.definition} ${v.category}`.toLowerCase().includes(search.toLowerCase())),
    [variables, category, search],
  );

  const pickVariable = (id: string) => {
    const v = variables.find((x) => x.id === id);
    if (!v) return;
    setVariableId(id);
    const p = periodDefaults(v.recordStartYear, latest);
    setStart(p.start); setEnd(p.end);
  };
  const movePin = (lat: number, lon: number) => {
    const la = +lat.toFixed(3), lo = +lon.toFixed(3);
    setPlace((p) => ({ lat: la, lon: lo, name: nameTouched ? p.name : coordLabel(la, lo) }));
  };
  const choosePreset = (p: (typeof PLACES)[number]) => { setPlace({ ...p }); setNameTouched(true); setGeo(''); };
  const locate = () => {
    if (!navigator.geolocation) { setGeo('Your browser cannot share a location. Pick a place on the map instead.'); return; }
    setGeo('Looking for your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { movePin(pos.coords.latitude, pos.coords.longitude); setGeo('Pin moved to your location. Only used here; nothing is stored or sent.'); },
      () => setGeo('We could not get your location (permission denied or unavailable). Pick a place on the map instead.'),
      { timeout: 10000 },
    );
  };
  const setQuickPeriod = (years: number) => {
    const first = selected?.recordStartYear ?? 1981;
    setStart(years === 0 ? first : Math.max(first, end - years + 1));
  };
  const chooseSeason = (s: SeasonSpec | 'custom') => {
    if (s === 'custom') { setCustom(true); setSeason({ label: 'Custom months', months: season.months.length === 12 ? [6, 7, 8] : season.months }); return; }
    setCustom(false); setSeason(s);
  };
  const toggleMonth = (m: number) => {
    const months = season.months.includes(m) ? season.months.filter((x) => x !== m) : [...season.months, m].sort((a, b) => a - b);
    setSeason({ label: 'Custom months', months });
  };

  const cells = gridCells(box);
  const span = end - start + 1;
  const problems: string[] = [];
  if (!selected) problems.push('Choose what to measure.');
  if (selected && start < selected.recordStartYear) problems.push(`${selected.name} starts in ${selected.recordStartYear}.`);
  if (end > maxEnd) problems.push(`Data are only complete through ${maxEnd}.`);
  if (end - start < 7) problems.push('Choose at least 8 years so a pattern can be separated from noise.');
  if (!season.months.length) problems.push('Choose at least one month.');
  const valid = problems.length === 0;
  const question = `Has ${selected?.shortName ?? 'this measure'} changed ${box ? 'across an area around' : 'near'} ${place.name}, ${start}–${end}, ${seasonPhrase(season.label)}?`;

  const run = () => {
    const q = new URLSearchParams({ v: variableId, place: place.name, start: String(start), end: String(end), season: season.months.join(','), sl: season.label, alpha: String(alpha), primary });
    if (box) { q.set('w', String(box[0])); q.set('s', String(box[1])); q.set('e', String(box[2])); q.set('n', String(box[3])); }
    else { q.set('lat', String(place.lat)); q.set('lon', String(place.lon)); }
    router.push(`/results?${q}`);
  };
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startFrom = (variable: string) => { pickVariable(variable); go(2); };

  const [shortCaveat, ...moreCaveat] = (selected?.caveat ?? '').split(/(?<=[.!?])\s+/);

  return (
    <main className="shell wizard-shell">
      <div className="breadcrumbs"><Link href="/">Home</Link> / Investigate</div>
      <div className="wizard-head">
        <h1>{step === 0 ? 'What do you want to find out?' : ['', 'What should we measure?', 'Where on Earth?', 'Which years and season?', 'Ready to run?'][step]}</h1>
        {step > 0 && <button className="text-button" onClick={() => go(0)}>Start over</button>}
      </div>
      <nav className="wizard-stepper" aria-label="Steps">
        {STEPS.map((label, i) => (
          <button key={label} className={step === i ? 'current' : i < step ? 'done' : ''} aria-current={step === i ? 'step' : undefined} onClick={() => go(i)} disabled={i > 0 && loading}>
            <span>{i < step ? '✓' : i + 1}</span>{label}
          </button>
        ))}
      </nav>

      {loading && <p className="muted" role="status">Loading NASA variables and checking the latest data month…</p>}
      {catalogError && <p className="notice" role="alert">{catalogError} You can still <Link href="/">open a worked example</Link> or <Link href="/upload">upload your own data</Link>.</p>}

      <section className="wizard-content" aria-live="polite">
        {step === 0 && (
          <>
            <p className="muted">Pick a question. We choose a sensible measure and settings, and you can change anything on the way.</p>
            <div className="grid question-grid">
              {QUICK_STARTS.map((x) => {
                const v = variables.find((item) => item.id === x.variableId);
                return (
                  <button key={x.variableId} className="card question-card" disabled={!v} onClick={() => startFrom(x.variableId)}>
                    <span className="qs-icon" aria-hidden>{x.icon}</span>
                    <strong>{x.question}</strong>
                    <span>{x.blurb}</span>
                  </button>
                );
              })}
            </div>
            <p><button className="btn" onClick={() => go(1)}>Or browse all {variables.length || ''} measures →</button></p>
            <RecentInvestigations />
          </>
        )}

        {step === 1 && (
          <div className="picker-layout">
            <div>
              <div className="chips">
                {cats.map((c) => <button key={c} className={`btn ${category === c ? 'primary' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
              </div>
              <label className="field">Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. rain, wind, soil, sunlight" /></label>
              <div className="variable-list">
                {filtered.map((v) => (
                  <button key={v.id} className={`variable-row ${v.id === variableId ? 'selected' : ''}`} onClick={() => pickVariable(v.id)} aria-pressed={v.id === variableId}>
                    <b>{v.name}</b><span>{v.unitLabel}</span>
                  </button>
                ))}
                {!filtered.length && <p className="muted">Nothing matches “{search}”. Try a simpler word.</p>}
              </div>
            </div>
            {selected && (
              <aside className="card detail-pane">
                <div className="eyebrow">{selected.category}</div>
                <h2>{selected.name}</h2>
                <p>{selected.definition}</p>
                <p><b>Why it matters.</b> {selected.whyItMatters}</p>
                {shortCaveat && (
                  <div className="notice">
                    <b>Good to know:</b> {shortCaveat}
                    {moreCaveat.length > 0 && <details><summary>More detail</summary><p>{moreCaveat.join(' ')}</p></details>}
                  </div>
                )}
                <p className="muted">Data available from {selected.recordStartYear}. Measured in {selected.unitLabel}.</p>
              </aside>
            )}
          </div>
        )}

        {step === 2 && (
          <>
            <div className="seg-row">
              <div className="segmented" role="group" aria-label="One spot or an area">
                <button className={mode === 'spot' ? 'active' : ''} aria-pressed={mode === 'spot'} onClick={() => setMode('spot')}>📍 One spot</button>
                <button className={mode === 'area' ? 'active' : ''} aria-pressed={mode === 'area'} onClick={() => setMode('area')}>⬚ An area</button>
              </div>
              <p className="muted">{mode === 'spot' ? 'Uses the single NASA grid cell under the pin: good for a town or site.' : 'Averages every grid cell inside the box: smoother, good for a region or country.'}</p>
            </div>
            {mode === 'area' && (
              <div className="chips" role="group" aria-label="Area size">
                {AREA_SIZES.map((a) => <button key={a.id} className={`btn ${areaDeg === a.deg ? 'primary' : ''}`} aria-pressed={areaDeg === a.deg} onClick={() => setAreaDeg(a.deg)}>{a.label} <small>· {a.hint}</small></button>)}
              </div>
            )}
            <div className="chips" aria-label="Quick places">
              <button className="btn" onClick={locate}>◎ Use my location</button>
              {PLACES.map((p) => <button key={p.name} className={`btn ${place.name === p.name ? 'primary' : ''}`} onClick={() => choosePreset(p)}>{p.name}</button>)}
            </div>
            {geo && <p role="status" className="muted">{geo}</p>}
            <PlaceMap lat={place.lat} lon={place.lon} box={box} onPick={movePin} />
            <p className="tag">{place.name} · averaging {cells} grid cell{cells === 1 ? '' : 's'}</p>
            <details>
              <summary>Rename the place or type exact coordinates</summary>
              <div className="row">
                <label className="field">Place label<input value={place.name} onChange={(e) => { setNameTouched(true); setPlace({ ...place, name: e.target.value }); }} /></label>
                <label className="field">Latitude<input type="number" min={-90} max={90} step="0.1" value={place.lat} onChange={(e) => setPlace({ ...place, lat: +e.target.value })} /></label>
                <label className="field">Longitude<input type="number" min={-180} max={180} step="0.1" value={place.lon} onChange={(e) => setPlace({ ...place, lon: +e.target.value })} /></label>
              </div>
            </details>
          </>
        )}

        {step === 3 && (
          <>
            <p className="muted">Longer records separate lasting change from normal year-to-year swings. {selected && <>Data for this measure start in {selected.recordStartYear} and are complete through {maxEnd}.</>}</p>
            <div className="chips" aria-label="Quick periods">
              {([['Last 20 years', 20], ['Last 30 years', 30], ['Everything available', 0]] as const).map(([label, years]) => {
                const first = selected?.recordStartYear ?? 1981;
                const active = end === maxEnd && start === (years === 0 ? first : Math.max(first, end - years + 1));
                return <button key={label} className={`btn ${active ? 'primary' : ''}`} aria-pressed={active} onClick={() => { setEnd(maxEnd); setQuickPeriod(years); }}>{label}</button>;
              })}
            </div>
            <div className="row">
              <label className="field">From year<input type="number" min={selected?.recordStartYear} max={end} value={start} onChange={(e) => setStart(+e.target.value)} /></label>
              <label className="field">To year<input type="number" min={start} max={maxEnd} value={end} onChange={(e) => setEnd(+e.target.value)} /></label>
            </div>
            <p className={span >= 20 ? 'tag' : 'notice'}>{span} years selected{span < 15 ? ': a short record, so treat the result with extra caution.' : span >= 30 ? ': a good length for spotting lasting change.' : '.'}</p>
            <h2>Which part of the year?</h2>
            <div className="chips" role="group" aria-label="Season">
              {SEASONS.map((s) => <button key={s.label} className={`btn ${!custom && season.label === s.label ? 'primary' : ''}`} aria-pressed={!custom && season.label === s.label} onClick={() => chooseSeason(s)}>{s.label}</button>)}
              <button className={`btn ${custom ? 'primary' : ''}`} aria-pressed={custom} onClick={() => chooseSeason('custom')}>Pick months…</button>
            </div>
            <p className="muted">{custom ? 'Tap the months to include.' : SEASON_HELP[season.label]}</p>
            {custom && (
              <div className="chips" role="group" aria-label="Months">
                {MONTH_NAMES.map((name, i) => <button key={name} className={`btn ${season.months.includes(i + 1) ? 'primary' : ''}`} aria-pressed={season.months.includes(i + 1)} onClick={() => toggleMonth(i + 1)}>{name}</button>)}
              </div>
            )}
            <details>
              <summary>For researchers: significance level and main method</summary>
              <div className="row">
                <label className="field">Significance level<select value={alpha} onChange={(e) => setAlpha(+e.target.value)}><option value={0.1}>0.10: more sensitive</option><option value={0.05}>0.05: usual choice</option><option value={0.01}>0.01: stricter</option></select></label>
                <label className="field">Main method<select value={primary} onChange={(e) => setPrimary(e.target.value)}>{METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
              </div>
            </details>
          </>
        )}

        {step === 4 && (
          <>
            <p className="big">{question}</p>
            <div className="card review-card">
              <ReviewRow label="Measure" value={selected?.name ?? '—'} onEdit={() => go(1)} />
              <ReviewRow label="Place" value={`${place.name}${box ? ' (area average)' : ' (one spot)'}`} onEdit={() => go(2)} />
              <ReviewRow label="Years" value={`${start}–${end} (${span} years)`} onEdit={() => go(3)} />
              <ReviewRow label="Season" value={season.label} onEdit={() => go(3)} />
              <p className="muted">Uses {cells} NASA grid cell{cells === 1 ? '' : 's'}. Usually takes a few seconds.</p>
            </div>
            {!valid && <div className="notice" role="alert"><b>Fix before running:</b><ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>}
            <div className="card"><b>You will get</b><ul><li>A plain-language answer: did it change, by how much, and how sure are we.</li><li>A stress-test that shows whether the answer depends on the years you pick.</li><li>Data tables, charts, a methods paragraph and a reproducible script to take with you.</li></ul></div>
          </>
        )}
      </section>

      {step > 0 && (
        <div className="wizard-actions">
          <button className="btn" onClick={() => go(step - 1)}>← Back</button>
          <p className="live-question">{question}</p>
          {step < 4
            ? <button className="btn primary" disabled={loading || !selected} onClick={() => go(step + 1)}>Next →</button>
            : <button className="btn primary" disabled={!valid} onClick={run}>Run analysis →</button>}
        </div>
      )}
    </main>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="review-row">
      <span className="muted">{label}</span>
      <b>{value}</b>
      <button className="text-button" onClick={onEdit}>Change</button>
    </div>
  );
}
