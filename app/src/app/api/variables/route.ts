import { VARIABLES, fetchRegionalMonthly } from '@/lib/power';

export async function GET() {
  let latestAvailableMonth: string | null = null;
  try {
    const year = new Date().getUTCFullYear();
    const sample = await fetchRegionalMonthly({ variable: VARIABLES[0], region: { type: 'point', lat: 0, lon: 0 }, startYear: year, endYear: year });
    latestAvailableMonth = sample.rows.filter((row) => row.value !== null).at(-1)?.date ?? null;
  } catch {
    // The catalog remains useful if POWER is temporarily unavailable.
  }
  return Response.json({ variables: VARIABLES, latestAvailableMonth }, { headers: { 'Cache-Control': 'no-store' } });
}
