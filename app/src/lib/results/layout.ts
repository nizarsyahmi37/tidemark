import type { HeatCell } from '@/lib/types';

export type HeatmapRow = { end: number; cells: (HeatCell | null)[] };

export function buildHeatmapGrid(starts: number[], ends: number[], cells: HeatCell[]): HeatmapRow[] {
  const byWindow = new Map(cells.map((cell) => [`${cell.start}:${cell.end}`, cell]));
  return ends.map((end) => ({
    end,
    cells: starts.map((start) => (start < end ? byWindow.get(`${start}:${end}`) ?? null : null)),
  }));
}

export function forestScale(cells: { ci_low: number; ci_high: number }[]) {
  const extent = Math.max(0.01, ...cells.flatMap((cell) => [Math.abs(cell.ci_low), Math.abs(cell.ci_high)]));
  return extent * 1.08;
}

export function normalizeWindow(start: number, end: number, minYears: number, first: number, last: number) {
  const minEnd = Math.min(last, first + minYears - 1);
  const safeStart = Math.max(first, Math.min(start, last - minYears + 1));
  const safeEnd = Math.max(safeStart + minYears - 1, Math.min(last, end));
  return [safeStart, Math.max(minEnd, safeEnd)] as [number, number];
}
