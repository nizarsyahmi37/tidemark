import type { VariableDef } from './types';

export const SEASONS = [
  { label: 'Whole year', months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { label: 'Winter (DJF)', months: [12,1,2] }, { label: 'Spring (MAM)', months: [3,4,5] },
  { label: 'Summer (JJA)', months: [6,7,8] }, { label: 'Autumn (SON)', months: [9,10,11] },
];
export const QUICK_STARTS = [
  { question: 'Is it getting hotter or colder?', blurb: 'Average air temperature, year by year', icon: '🌡️', variableId: 't2m', season: 'Whole year' },
  { question: 'Is it getting wetter or drier?', blurb: 'Average daily rainfall', icon: '🌧️', variableId: 'precip', season: 'Whole year' },
  { question: 'Is the land drying out?', blurb: 'How wet the soil is where roots grow', icon: '🌱', variableId: 'soil-root', season: 'Whole year' },
  { question: 'Is the air getting hazier?', blurb: 'Haze from smoke, dust and pollution (AOD)', icon: '🌫️', variableId: 'aod', season: 'Whole year' },
  { question: 'Is it getting cloudier or sunnier?', blurb: 'How much of the sky is covered by cloud', icon: '☁️', variableId: 'clouds', season: 'Whole year' },
  { question: 'Is it getting windier?', blurb: 'Average wind speed 10 m above ground', icon: '💨', variableId: 'wind-10m', season: 'Whole year' },
];
export const AREA_SIZES = [
  { id: 'small', label: 'Small', deg: 0.75, hint: 'about 80 km across' },
  { id: 'medium', label: 'Medium', deg: 2.5, hint: 'about 270 km across' },
  { id: 'large', label: 'Large', deg: 6, hint: 'about 650 km across' },
] as const;
export function areaBox(lat: number, lon: number, deg: number): [number, number, number, number] {
  const h = deg / 2;
  return [Math.max(-180, lon - h), Math.max(-90, lat - h), Math.min(180, lon + h), Math.min(90, lat + h)];
}
export function coordLabel(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
}
export function seasonPhrase(label: string): string {
  return label === 'Whole year' ? 'over the whole year' : `in ${label.toLowerCase()}`;
}
export function gridCells(box: [number, number, number, number] | null): number {
  if (!box) return 1;
  return Math.max(1, Math.ceil(Math.abs(box[3] - box[1]) / 0.5)) * Math.max(1, Math.ceil(Math.abs(box[2] - box[0]) / 0.625));
}
export function periodDefaults(recordStartYear: number, latestMonth: string | null, now = new Date()): { start: number; end: number } {
  const latestYear = Number(latestMonth?.slice(0,4)) || now.getUTCFullYear();
  const end = latestMonth ? (latestMonth.slice(5) === '12' ? latestYear : latestYear - 1) : latestYear - 1;
  return { start: Math.max(recordStartYear, end - 30), end };
}
export function quickStartVariable(id: string, variables: VariableDef[]) { return variables.find(v => v.id === id); }
export function historyRead(): { title:string; href:string; date:string; id:string }[] { try { const x=localStorage.getItem('tidemark-history'); return x ? JSON.parse(x) : []; } catch { return []; } }
export function historyAdd(item: { title:string; href:string; date:string; id:string }) { try { const next=[item,...historyRead().filter(x=>x.id!==item.id)].slice(0,8); localStorage.setItem('tidemark-history',JSON.stringify(next)); } catch { /* storage may be unavailable */ } }
