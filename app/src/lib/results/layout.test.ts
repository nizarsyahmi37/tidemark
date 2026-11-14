import { describe, expect, it } from 'vitest';
import { buildHeatmapGrid, forestScale, normalizeWindow } from './layout';
import { presets } from '../story';
import type { AnalysisDoc } from '../types';
import sample from '../../data/klang_valley_rain.json';
import type { HeatCell } from '../types';
const cell = (start: number, end: number): HeatCell => ({ start, end, n: end - start + 1, slope_per_decade: 1, ci_low: -2, ci_high: 3, p: .04, significant: true });
describe('results layout helpers', () => {
  it('places only existing windows into end-year rows', () => {
    const rows = buildHeatmapGrid([2000, 2001, 2002], [2001, 2002], [cell(2000, 2001), cell(2000, 2002), cell(2001, 2002)]);
    expect(rows[0].cells).toEqual([cell(2000, 2001), null, null]);
    expect(rows[1].cells).toEqual([cell(2000, 2002), cell(2001, 2002), null]);
  });
  it('returns full, extreme, and recent window presets from observed cells', () => {
    const choices = presets(sample as unknown as AnalysisDoc);
    expect(choices.map((choice) => choice.label)).toEqual(['Full record', 'Cherry-pick the biggest rise', 'Cherry-pick the biggest fall', 'Last 10 years']);
    expect(choices[0].start).toBe(sample.headline.first_year);
    expect(choices[1].start).toBe(sample.heatmap.cells.reduce((a, b) => a.slope_per_decade > b.slope_per_decade ? a : b).start);
  });
  it('uses symmetric forest plot extent and enforces minimum window length', () => {
    expect(forestScale([cell(1, 2)])).toBeCloseTo(3.24);
    expect(normalizeWindow(2005, 2005, 8, 2000, 2020)).toEqual([2005, 2012]);
  });
});
