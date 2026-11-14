import type { MonthlyRow, RegionSpec, VariableDef } from "../types";

export interface RegionalFetch {
  rows: MonthlyRow[];
  gridPoints: { lat: number; lon: number }[];
  requestUrls: string[];
  warnings: string[];
  fetchedAt: string;
}

export type PowerErrorCode = "BAD_INPUT" | "UPSTREAM" | "NO_DATA" | "TIMEOUT";

export class PowerError extends Error {
  readonly code: PowerErrorCode;
  /** Set when POWER itself tells us the legal year range, so the caller can retry once. */
  retry?: { startYear?: number; endYear?: number };

  constructor(code: PowerErrorCode, message: string) {
    super(message);
    this.name = "PowerError";
    this.code = code;
  }
}

/** MERRA-2 coordinate locations used by POWER meteorology. 0.625° is exactly representable. */
export const MERRA2_LAT_STEP = 0.5;
export const MERRA2_LON_STEP = 0.625;
export const MAX_GRID_POINTS = 25;

export const powerRequestPolicy = {
  timeoutMs: 60_000,
  maxAttempts: 4,
  backoffBaseMs: 500,
  concurrency: 4,
  cacheTtlMs: 6 * 60 * 60 * 1000,
  cacheMaxEntries: 200,
};

const POWER_ORIGIN = "https://power.larc.nasa.gov/api/temporal/monthly/point";

type CacheEntry = { value: unknown; expires: number };

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export function clearPowerCache(): void {
  responseCache.clear();
  inFlight.clear();
}

export function formatCoord(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  let text = rounded.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (text === "-0") text = "0";
  return text;
}

export function isMissingPowerValue(value: unknown, fillValue: number | null): boolean {
  if (value == null) return true;
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) return true;
  if (fillValue != null && numeric === fillValue) return true;
  // POWER's documented fill is -999. Real values in this catalog stay well above -900
  // (temperatures, pressure in kPa, fractions, irradiances).
  return numeric <= -900;
}

export function sampleMerra2Points(region: RegionSpec): {
  points: { lat: number; lon: number }[];
  warnings: string[];
} {
  if (region.type === "point") {
    assertLatLon(region.lat, region.lon);
    return { points: [{ lat: region.lat, lon: region.lon }], warnings: [] };
  }
  assertBbox(region);
  const lats = gridLats(region.south, region.north);
  const lons = gridLons(region.west, region.east);
  if (lats.length === 0 || lons.length === 0) {
    const centre = bboxCentre(region);
    return {
      points: [centre],
      warnings: [
        `This box is smaller than one MERRA-2 cell (0.5° latitude by 0.625° longitude), so the request uses the box centre (${formatCoord(centre.lat)}°, ${formatCoord(centre.lon)}°).`,
      ],
    };
  }
  const fullCount = lats.length * lons.length;
  let useLats = lats;
  let useLons = lons;
  const warnings: string[] = [];
  if (fullCount > MAX_GRID_POINTS) {
    const shape = chooseSubsetShape(lats.length, lons.length, MAX_GRID_POINTS);
    useLats = pickEven(lats, shape.nLat);
    useLons = pickEven(lons, shape.nLon);
    warnings.push(
      `This box contains ${fullCount} MERRA-2 cells. The request uses ${useLats.length * useLons.length} of them, spaced evenly, so the regional mean is a sample of the cells rather than the mean of every cell.`,
    );
  }
  const points: { lat: number; lon: number }[] = [];
  for (const lat of useLats) {
    for (const lon of useLons) points.push({ lat, lon });
  }
  return { points, warnings };
}

export function buildPowerUrl(powerParam: string, lat: number, lon: number, startYear: number, endYear: number): string {
  const query = new URLSearchParams({
    parameters: powerParam,
    community: "AG",
    longitude: formatCoord(lon),
    latitude: formatCoord(lat),
    start: String(startYear),
    end: String(endYear),
    format: "JSON",
  });
  return `${POWER_ORIGIN}?${query.toString()}`;
}

/** Monthly values keyed by YYYY-MM. Month 13 (POWER's annual mean) is dropped. */
export function parseMonthlyValues(payload: unknown, powerParam: string): Map<string, number | null> {
  if (!payload || typeof payload !== "object") {
    throw new PowerError("UPSTREAM", "NASA POWER returned a response that could not be read.");
  }
  const root = payload as Record<string, unknown>;
  const properties = root.properties;
  if (!properties || typeof properties !== "object") {
    throw new PowerError("UPSTREAM", "NASA POWER returned no data properties for this point.");
  }
  const parameter = (properties as Record<string, unknown>).parameter;
  if (!parameter || typeof parameter !== "object") {
    throw new PowerError("UPSTREAM", "NASA POWER returned no parameter block for this point.");
  }
  const series = (parameter as Record<string, unknown>)[powerParam];
  if (!series || typeof series !== "object") {
    throw new PowerError("UPSTREAM", `NASA POWER did not return ${powerParam} for this point.`);
  }
  const fill = readFillValue(root);
  const out = new Map<string, number | null>();
  for (const [key, raw] of Object.entries(series as Record<string, unknown>)) {
    const match = /^(\d{4})(\d{2})$/.exec(key);
    if (!match) continue;
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;
    out.set(`${match[1]}-${match[2]}`, isMissingPowerValue(raw, fill) ? null : Number(raw));
  }
  return out;
}

export function averageAcrossPoints(series: Map<string, number | null>[], month: string): number | null {
  if (series.length === 0) return null;
  let present = 0;
  let sum = 0;
  for (const point of series) {
    const value = point.has(month) ? point.get(month) : null;
    if (value == null) continue;
    present += 1;
    sum += value;
  }
  if (present === 0) return null;
  const missingFraction = (series.length - present) / series.length;
  if (missingFraction > 0.5) return null;
  return sum / present;
}

export async function fetchRegionalMonthly(args: {
  variable: VariableDef;
  region: RegionSpec;
  startYear: number;
  endYear: number;
  signal?: AbortSignal;
}): Promise<RegionalFetch> {
  const { variable, region, signal } = args;
  throwIfAborted(signal);
  assertVariable(variable);
  const sampled = sampleMerra2Points(region);
  const { startYear, endYear, warnings } = clampRequestedYears(variable, args.startYear, args.endYear);
  warnings.push(...sampled.warnings);

  let effectiveEnd = endYear;
  let payloads: unknown[];
  try {
    payloads = await fetchPoints(variable.powerParam, sampled.points, startYear, effectiveEnd, signal);
  } catch (error) {
    if (error instanceof PowerError && error.retry?.endYear != null && error.retry.endYear < effectiveEnd && error.retry.endYear >= startYear) {
      effectiveEnd = error.retry.endYear;
      warnings.push(
        `NASA POWER said monthly data for this request only run through ${effectiveEnd}, so the end year was set to ${effectiveEnd}.`,
      );
      payloads = await fetchPoints(variable.powerParam, sampled.points, startYear, effectiveEnd, signal);
    } else if (error instanceof PowerError && error.retry?.startYear != null && error.retry.startYear > startYear && error.retry.startYear <= effectiveEnd) {
      throw new PowerError(
        "BAD_INPUT",
        `${variable.name} is available from ${error.retry.startYear} in NASA POWER, which is later than this request. Narrow the years and try again.`,
      );
    } else {
      throw error;
    }
  }

  const series = payloads.map((payload) => parseMonthlyValues(payload, variable.powerParam));
  const rows = buildYearRows(series, startYear, effectiveEnd);
  const trimmed = trimTrailingNulls(rows);
  if (trimmed.length === 0) {
    throw new PowerError(
      "NO_DATA",
      `NASA POWER has no ${variable.shortName} values for this place between ${startYear} and ${effectiveEnd}. The months may still be marked missing.`,
    );
  }
  const nominalEnd = `${effectiveEnd}-12`;
  const lastDate = trimmed[trimmed.length - 1].date;
  if (lastDate < nominalEnd) {
    warnings.push(
      `Monthly ${variable.shortName} from NASA POWER currently ends at ${lastDate}, so the series stops there instead of ${nominalEnd}.`,
    );
  }

  return {
    rows: trimmed,
    gridPoints: sampled.points,
    requestUrls: sampled.points.map((point) => buildPowerUrl(variable.powerParam, point.lat, point.lon, startYear, effectiveEnd)),
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

function assertVariable(variable: VariableDef): void {
  if (!variable || typeof variable.powerParam !== "string" || variable.powerParam.length === 0) {
    throw new PowerError("BAD_INPUT", "Choose a variable from the NASA POWER catalog.");
  }
  if (!Number.isInteger(variable.recordStartYear)) {
    throw new PowerError("BAD_INPUT", "This variable is missing the year its POWER record starts.");
  }
}

function clampRequestedYears(
  variable: VariableDef,
  startYear: number,
  endYear: number,
): { startYear: number; endYear: number; warnings: string[] } {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new PowerError("BAD_INPUT", "Start year and end year have to be whole years, such as 2001.");
  }
  if (startYear > endYear) {
    throw new PowerError("BAD_INPUT", "The start year has to be the same as or earlier than the end year.");
  }
  const currentYear = new Date().getUTCFullYear();
  const maxSpan = currentYear - variable.recordStartYear + 1;
  const requestedSpan = endYear - startYear + 1;
  if (requestedSpan > maxSpan) {
    throw new PowerError(
      "BAD_INPUT",
      `${variable.name} spans ${variable.recordStartYear}–${currentYear} in NASA POWER (${maxSpan} years). This request is ${requestedSpan} years, which is longer than the whole record.`,
    );
  }
  const warnings: string[] = [];
  let start = startYear;
  let end = endYear;
  if (start < variable.recordStartYear) {
    warnings.push(
      `${variable.name} begins in ${variable.recordStartYear} in NASA POWER, so this request starts in ${variable.recordStartYear} instead of ${startYear}.`,
    );
    start = variable.recordStartYear;
  }
  if (end > currentYear) {
    warnings.push(
      `NASA POWER monthly data do not go past ${currentYear}, so the end year was set to ${currentYear}.`,
    );
    end = currentYear;
  }
  if (start > end) {
    throw new PowerError(
      "BAD_INPUT",
      `${variable.name} begins in ${variable.recordStartYear}, which is after ${endYear}. Pick a later end year.`,
    );
  }
  return { startYear: start, endYear: end, warnings };
}

async function fetchPoints(
  powerParam: string,
  points: { lat: number; lon: number }[],
  startYear: number,
  endYear: number,
  signal: AbortSignal | undefined,
): Promise<unknown[]> {
  return mapPool(points, powerRequestPolicy.concurrency, async (point) => {
    throwIfAborted(signal);
    const url = buildPowerUrl(powerParam, point.lat, point.lon, startYear, endYear);
    return waitForAbort(getCachedJson(url), signal);
  });
}

function buildYearRows(series: Map<string, number | null>[], startYear: number, endYear: number): MonthlyRow[] {
  const rows: MonthlyRow[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}`;
      rows.push({ date, value: averageAcrossPoints(series, date) });
    }
  }
  return rows;
}

function trimTrailingNulls(rows: MonthlyRow[]): MonthlyRow[] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].value == null) end -= 1;
  return rows.slice(0, end);
}

async function getCachedJson(url: string): Promise<unknown> {
  const cached = readCache(url);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(url);
  if (pending) return pending;
  const promise = fetchJsonUncached(url)
    .then((body) => {
      writeCache(url, body);
      return body;
    })
    .finally(() => {
      if (inFlight.get(url) === promise) inFlight.delete(url);
    });
  inFlight.set(url, promise);
  return promise;
}

function readCache(url: string): unknown {
  const entry = responseCache.get(url);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    responseCache.delete(url);
    return undefined;
  }
  responseCache.delete(url);
  responseCache.set(url, entry);
  return entry.value;
}

function writeCache(url: string, value: unknown): void {
  if (responseCache.has(url)) responseCache.delete(url);
  responseCache.set(url, { value, expires: Date.now() + powerRequestPolicy.cacheTtlMs });
  while (responseCache.size > powerRequestPolicy.cacheMaxEntries) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

async function fetchJsonUncached(url: string): Promise<unknown> {
  const attempts = Math.max(1, powerRequestPolicy.maxAttempts);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchOnce(url);
    } catch (error) {
      if (error instanceof PowerError) throw error;
      if (attempt < attempts - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new PowerError("UPSTREAM", "NASA POWER could not be reached. Check the connection and try again.");
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt < attempts - 1) {
        await sleep(backoffMs(attempt, retryAfterMs(response)));
        continue;
      }
      if (response.status === 429) {
        throw new PowerError("UPSTREAM", "NASA POWER is limiting requests right now. Wait a minute, or choose a smaller area, and try again.");
      }
      throw new PowerError("UPSTREAM", `NASA POWER had a server error (HTTP ${response.status}) after several tries. Wait a minute and try again.`);
    }
    const body = await readJsonBody(response);
    if (response.status >= 400) {
      const error = new PowerError("UPSTREAM", upstreamMessage(body, response.status));
      const limit = dateLimit(body);
      if (limit) error.retry = limit;
      throw error;
    }
    if (body == null) {
      throw new PowerError("UPSTREAM", "NASA POWER returned an empty response.");
    }
    return body;
  }
  throw new PowerError("UPSTREAM", "NASA POWER could not be reached. Check the connection and try again.");
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = powerRequestPolicy.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const seconds = Math.round(timeoutMs / 1000);
      throw new PowerError("TIMEOUT", `NASA POWER did not respond within ${seconds} seconds. Try again, or request a smaller area.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (response.ok) {
      throw new PowerError("UPSTREAM", "NASA POWER returned a response that was not valid JSON.");
    }
    return null;
  }
}

function upstreamMessage(body: unknown, status: number): string {
  const messages = powerMessages(body);
  if (messages.length > 0) {
    return `NASA POWER rejected the request: ${messages.join(" ")}`;
  }
  return `NASA POWER rejected the request (HTTP ${status}).`;
}

function dateLimit(body: unknown): { startYear?: number; endYear?: number } | undefined {
  const text = powerMessages(body).join(" ");
  const start = /starts at (\d{4})\/(\d{2})\/(\d{2})/.exec(text);
  const end = /available to (\d{4})\/(\d{2})\/(\d{2})/.exec(text);
  if (!start && !end) return undefined;
  return {
    startYear: start ? Number(start[1]) : undefined,
    endYear: end ? Number(end[1]) : undefined,
  };
}

function powerMessages(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];
  return messages.filter((message): message is string => typeof message === "string");
}

function readFillValue(root: Record<string, unknown>): number | null {
  const header = root.header;
  if (!header || typeof header !== "object") return -999;
  const fill = (header as { fill_value?: unknown }).fill_value;
  return typeof fill === "number" && Number.isFinite(fill) ? fill : -999;
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
  return undefined;
}

function backoffMs(attempt: number, retryAfter?: number): number {
  const base = powerRequestPolicy.backoffBaseMs * 2 ** attempt;
  const jitter = base * 0.2 * Math.random();
  return Math.max(base + jitter, retryAfter ?? 0);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("The NASA POWER request was cancelled.", "AbortError");
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function assertLatLon(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new PowerError("BAD_INPUT", "Latitude has to be a number from -90 to 90.");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new PowerError("BAD_INPUT", "Longitude has to be a number from -180 to 180.");
  }
}

function assertBbox(region: Extract<RegionSpec, { type: "bbox" }>): void {
  assertLatLon(region.south, region.west);
  assertLatLon(region.north, region.east);
  if (region.south > region.north) {
    throw new PowerError("BAD_INPUT", "The south edge of the box has to be at or below the north edge.");
  }
}

function gridLats(south: number, north: number): number[] {
  const eps = 1e-9;
  const first = Math.ceil((south - eps - -90) / MERRA2_LAT_STEP);
  const last = Math.floor((north + eps - -90) / MERRA2_LAT_STEP);
  const lats: number[] = [];
  for (let index = first; index <= last; index += 1) {
    const lat = Math.round((-90 + index * MERRA2_LAT_STEP) * 1e6) / 1e6;
    if (lat < -90 || lat > 90) continue;
    lats.push(lat);
  }
  return lats;
}

function gridLons(west: number, east: number): number[] {
  const eps = 1e-9;
  const lons: number[] = [];
  const wraps = west > east;
  for (let index = 0; index <= 575; index += 1) {
    const lon = Math.round((-180 + index * MERRA2_LON_STEP) * 1e6) / 1e6;
    const inside = wraps ? lon >= west - eps || lon <= east + eps : lon >= west - eps && lon <= east + eps;
    if (inside) lons.push(lon);
  }
  return lons;
}

function bboxCentre(region: Extract<RegionSpec, { type: "bbox" }>): { lat: number; lon: number } {
  const lat = (region.south + region.north) / 2;
  if (region.west <= region.east) {
    return { lat, lon: (region.west + region.east) / 2 };
  }
  const width = 360 - region.west + region.east;
  let lon = region.west + width / 2;
  if (lon > 180) lon -= 360;
  if (lon === 180) lon = -180;
  return { lat, lon };
}

function chooseSubsetShape(nLat: number, nLon: number, cap: number): { nLat: number; nLon: number } {
  const target = nLon / nLat;
  let bestLat = 1;
  let bestLon = 1;
  let bestCount = 0;
  let bestAspect = Number.POSITIVE_INFINITY;
  for (let rows = 1; rows <= Math.min(nLat, cap); rows += 1) {
    const cols = Math.min(nLon, Math.floor(cap / rows));
    if (cols < 1) continue;
    const count = rows * cols;
    const aspectError = Math.abs(cols / rows - target);
    if (count > bestCount || (count === bestCount && aspectError < bestAspect)) {
      bestCount = count;
      bestAspect = aspectError;
      bestLat = rows;
      bestLon = cols;
    }
  }
  return { nLat: bestLat, nLon: bestLon };
}

function pickEven<T>(items: T[], count: number): T[] {
  const indexes = evenIndexes(items.length, count);
  const seen = new Set<number>();
  const picked: T[] = [];
  for (const index of indexes) {
    if (seen.has(index)) continue;
    seen.add(index);
    picked.push(items[index]);
  }
  return picked;
}

function evenIndexes(length: number, count: number): number[] {
  if (count >= length) return Array.from({ length }, (_, index) => index);
  if (count <= 1) return [Math.floor((length - 1) / 2)];
  const indexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    indexes.push(Math.round((index * (length - 1)) / (count - 1)));
  }
  return indexes;
}
