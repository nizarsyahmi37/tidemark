'use client';
import type { AnalysisDoc, HeatCell } from '@/lib/types';
import { formatNumber } from '@/lib/story';
import { buildHeatmapGrid } from '@/lib/results/layout';
export default function WindowHeatmap({ doc, selected, onSelect }: { doc: AnalysisDoc; selected: [number, number]; onSelect: (cell: HeatCell) => void; }) {
  const cells = doc.heatmap.cells;
  const max = Math.max(0.00001, ...cells.map((cell) => Math.abs(cell.slope_per_decade)));
  const years = doc.annual_season_series.length;
  const size = Math.max(13, Math.min(28, 720 / Math.max(years, 1)));
  const rows = buildHeatmapGrid(doc.heatmap.starts, doc.heatmap.ends, cells);
  return <div className="heatmap-scroll" style={{ '--cell-size': `${size}px` } as React.CSSProperties}>
    <table className="heatmap-table">
      <thead>
        <tr>
          <th className="sticky-corner">End ↓ / Start →</th>{doc.heatmap.starts.map((year) => <th key={year} scope="col" className="sticky-top">{year}</th>)}</tr>
      </thead>
      <tbody>{rows.map((row) => <tr key={row.end}>
        <th className="sticky-side" scope="row">{row.end}</th>{row.cells.map((cell, index) => cell ? <td key={cell.start}>
          <button type="button" className={`heat-cell ${cell.significant ? 'significant' : ''} ${selected[0] === cell.start && selected[1] === cell.end ? 'selected' : ''}`} style={{ backgroundColor: cell.slope_per_decade < 0 ? `rgba(48, 112, 170, ${.12 + .72 * Math.abs(cell.slope_per_decade) / max})` : `rgba(218, 132, 48, ${.12 + .72 * Math.abs(cell.slope_per_decade) / max})` }} aria-label={`${cell.start} to ${cell.end}: ${formatNumber(cell.slope_per_decade, doc.variable, { signed: true })} ${doc.variable.units} per decade, ${cell.significant ? 'significant' : 'not significant'}`} aria-pressed={selected[0] === cell.start && selected[1] === cell.end} title={`${cell.start}–${cell.end}: ${formatNumber(cell.slope_per_decade, doc.variable, { signed: true })} per decade`} onClick={() => onSelect(cell)}>{cell.significant ? '•' : ''}</button>
        </td> : <td key={`${row.end}-${doc.heatmap.starts[index]}`} className="empty-cell" />)}</tr>)}</tbody>
    </table>
  </div>;
}
