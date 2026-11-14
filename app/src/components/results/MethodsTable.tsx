'use client';
import type { AnalysisDoc, PrimaryMethod } from '@/lib/types';
import { METHODS, formatNumber } from '@/lib/story';
export default function MethodsTable({ doc, primary, onPrimary }: { doc: AnalysisDoc; primary: PrimaryMethod; onPrimary: (method: PrimaryMethod) => void; }) {
  return <div className="tablewrap">
    <table className="table methods-table">
      <thead>
        <tr>
          <th>Method</th>
          <th>n</th>
          <th>Slope / decade</th>
          <th>95% CI</th>
          <th>p</th>
          <th>tau</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>{METHODS.map(([key, label]) => {
        const r = doc.analyses[key]; return <tr key={key} className={primary === key ? 'primary-method' : ''}>
          <td>
            <button className="text-button" aria-pressed={primary === key} onClick={() => onPrimary(key)}>{label}{primary === key ? ' · Primary' : ''}</button>
          </td>
          <td>{r.n}</td>
          <td>{formatNumber(r.slope_per_decade, doc.variable, { signed: true })} {doc.variable.units}</td>
          <td>{formatNumber(r.ci_low, doc.variable)} to {formatNumber(r.ci_high, doc.variable)}</td>
          <td>{r.p?.toPrecision(3) ?? '—'}</td>
          <td>{r.tau?.toFixed(2) ?? '—'}</td>
          <td>{r.significant ? 'Evidence' : 'Unclear'}</td>
        </tr>;
      })}</tbody>
    </table>
    <p className="muted">Choose a row to change the primary method shown in the verdict. α = {doc.request?.alpha ?? .05}.</p>
  </div>;
}
