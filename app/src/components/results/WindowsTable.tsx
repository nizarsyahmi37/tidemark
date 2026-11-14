'use client';
import { useMemo, useState } from 'react';
import type { AnalysisDoc, HeatCell } from '@/lib/types';
import { formatNumber } from '@/lib/story';
export default function WindowsTable({ doc }: { doc: AnalysisDoc; }) {
  const [significant, setSignificant] = useState(false);
  const [sort, setSort] = useState<'start' | 'slope' | 'p'>('start');
  const rows = useMemo(() => doc.heatmap.cells.filter((row) => !significant || row.significant).sort((a, b) => sort === 'start' ? a.start - b.start || a.end - b.end : sort === 'slope' ? b.slope_per_decade - a.slope_per_decade : (a.p ?? 1) - (b.p ?? 1)), [doc.heatmap.cells, significant, sort]);
  const csv = (items: HeatCell[]) => ['start,end,n,slope_per_decade,ci_low,ci_high,p,significant', ...items.map((r) => [r.start, r.end, r.n, r.slope_per_decade, r.ci_low, r.ci_high, r.p ?? '', r.significant].join(','))].join('\n');
  return <section>
    <div className="row">
      <label>
        <input type="checkbox" checked={significant} onChange={(event) => setSignificant(event.target.checked)} /> Significant windows only</label>
      <label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
        <option value="start">Start year</option>
        <option value="slope">Slope</option>
        <option value="p">p-value</option>
      </select>
      </label>
      <button className="btn" onClick={() => navigator.clipboard?.writeText(csv(rows))}>Copy CSV ({rows.length} rows)</button>
    </div>
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Years</th>
            <th>n</th>
            <th>Slope / decade</th>
            <th>95% CI</th>
            <th>p</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>{rows.map((r) => <tr key={`${r.start}-${r.end}`}>
          <td>{r.start}–{r.end}</td>
          <td>{r.n}</td>
          <td>{formatNumber(r.slope_per_decade, doc.variable, { signed: true })}</td>
          <td>{formatNumber(r.ci_low, doc.variable)} to {formatNumber(r.ci_high, doc.variable)}</td>
          <td>{r.p?.toPrecision(3) ?? '—'}</td>
          <td>{r.significant ? 'Evidence' : 'Unclear'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
