import { afterEach, describe, expect, it, vi } from "vitest";
import { getVariable, VARIABLES } from "./catalog";
import {
  PowerError,
  averageAcrossPoints,
  clearPowerCache,
  fetchRegionalMonthly,
  isMissingPowerValue,
  parseMonthlyValues,
  powerRequestPolicy,
  sampleMerra2Points,
} from "./client";
import type { VariableDef } from "../types";
import { buildProvenance, PowerError as ExportedPowerError, fetchRegionalMonthly as fetchFromIndex } from "./index";
import type { RegionalFetch } from "./index";

const originalPolicy = { ...powerRequestPolicy };
const t2m = () => {
  const variable = getVariable("t2m");
  if (!variable) throw new Error("catalog missing t2m");
  return variable;
};
const iowa = { type: "point" as const, lat: 42, lon: -93.75 };

afterEach(() => {
  Object.assign(powerRequestPolicy, originalPolicy);
  clearPowerCache();
  vi.unstubAllGlobals();
});

describe("catalog", () => {
  it("has a researcher-sized list of distinct, categorized variables", () => {
    expect(VARIABLES.length).toBeGreaterThanOrEqual(14);
    const ids = new Set(VARIABLES.map((variable) => variable.id));
    const params = new Set(VARIABLES.map((variable) => variable.powerParam));
    expect(ids.size).toBe(VARIABLES.length);
    expect(params.size).toBe(VARIABLES.length);
    const categories = new Set(["Temperature", "Water cycle", "Land", "Atmosphere", "Energy"]);
    for (const variable of VARIABLES) {
      expect(categories.has(variable.category)).toBe(true);
      expect(variable.units.length).toBeGreaterThan(0);
      expect(variable.recordStartYear).toBeGreaterThanOrEqual(1981);
    }
    expect(getVariable("t2m")?.recordStartYear).toBe(1981);
    expect(getVariable("sunlight")?.recordStartYear).toBe(1984);
    expect(getVariable("clouds")?.recordStartYear).toBe(1984);
    expect(getVariable("aod")?.recordStartYear).toBe(2001);
    expect(getVariable("column-water")?.recordStartYear).toBe(2001);
    expect(getVariable("missing")).toBeUndefined();
  });
});

describe("MERRA-2 grid sampling", () => {
  it("uses published cell centres, including a centre that sits on the box edge", () => {
    const sampled = sampleMerra2Points({
      type: "bbox",
      west: -94,
      east: -93.5,
      south: 42,
      north: 42,
    });
    expect(sampled.points).toEqual([{ lat: 42, lon: -93.75 }]);
    expect(sampled.warnings).toEqual([]);
  });

  it("returns every centre in a small box", () => {
    const sampled = sampleMerra2Points({
      type: "bbox",
      west: -94.375,
      east: -93.125,
      south: 41.5,
      north: 42.5,
    });
    expect(sampled.points).toEqual([
      { lat: 41.5, lon: -94.375 },
      { lat: 41.5, lon: -93.75 },
      { lat: 41.5, lon: -93.125 },
      { lat: 42, lon: -94.375 },
      { lat: 42, lon: -93.75 },
      { lat: 42, lon: -93.125 },
      { lat: 42.5, lon: -94.375 },
      { lat: 42.5, lon: -93.75 },
      { lat: 42.5, lon: -93.125 },
    ]);
  });

  it("uses the box centre when no cell centre falls inside", () => {
    const sampled = sampleMerra2Points({
      type: "bbox",
      west: -93.7,
      east: -93.5,
      south: 41.9,
      north: 42.1,
    });
    expect(sampled.points).toEqual([{ lat: 42, lon: -93.6 }]);
    expect(sampled.warnings[0]).toMatch(/smaller than one MERRA-2 cell/);
  });

  it("keeps centres on both sides of the dateline", () => {
    const sampled = sampleMerra2Points({
      type: "bbox",
      west: 179,
      east: -179,
      south: 0,
      north: 0,
    });
    expect(sampled.points.map((point) => point.lon)).toEqual([-180, -179.375, 179.375]);
  });

  it("caps a large box at 25 evenly spaced centres and says so", () => {
    const sampled = sampleMerra2Points({
      type: "bbox",
      west: -180,
      east: 180,
      south: -90,
      north: 90,
    });
    expect(sampled.points).toHaveLength(25);
    expect(sampled.points[0]).toEqual({ lat: -90, lon: -180 });
    expect(sampled.points[sampled.points.length - 1]).toEqual({ lat: 90, lon: 179.375 });
    expect(sampled.warnings[0]).toContain("207936");
  });

  it("leaves a point request on the coordinate the user gave", () => {
    const sampled = sampleMerra2Points({ type: "point", lat: 42.125, lon: -93.625 });
    expect(sampled.points).toEqual([{ lat: 42.125, lon: -93.625 }]);
  });
});

describe("parsing POWER monthly payloads", () => {
  it("drops month 13, turns fills and nulls into null, and keeps real zeros", () => {
    const parsed = parseMonthlyValues(
      {
        header: { fill_value: -999 },
        properties: {
          parameter: {
            T2M: {
              "202001": 0,
              "202002": -999,
              "202003": null,
              "202004": -12.5,
              "202013": 40,
              "not-a-month": 5,
            },
          },
        },
      },
      "T2M",
    );
    expect(parsed.get("2020-01")).toBe(0);
    expect(parsed.get("2020-02")).toBeNull();
    expect(parsed.get("2020-03")).toBeNull();
    expect(parsed.get("2020-04")).toBe(-12.5);
    expect(parsed.has("2020-13")).toBe(false);
    expect([...parsed.keys()]).toEqual(["2020-01", "2020-02", "2020-03", "2020-04"]);
  });

  it("treats -999-like sentinels as missing and keeps cold temperatures", () => {
    expect(isMissingPowerValue(-999, -999)).toBe(true);
    expect(isMissingPowerValue(-999.9, -999)).toBe(true);
    expect(isMissingPowerValue(null, -999)).toBe(true);
    expect(isMissingPowerValue(-40, -999)).toBe(false);
    expect(isMissingPowerValue(0, -999)).toBe(false);
  });

  it("averages non-null points and nulls a month only when more than half are missing", () => {
    const present = (value: number | null) => new Map([["2020-01", value]]);
    expect(averageAcrossPoints([present(10), present(null)], "2020-01")).toBe(10);
    expect(averageAcrossPoints([present(10), present(20), present(30)], "2020-01")).toBe(20);
    expect(averageAcrossPoints([present(10), present(null), present(null)], "2020-01")).toBeNull();
  });
});

describe("fetchRegionalMonthly", () => {
  it("rejects bad coordinates, reversed years, and a span longer than the record without calling POWER", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const variable = t2m();
    await expect(fetchRegionalMonthly({
      variable,
      region: { type: "point", lat: 91, lon: 0 },
      startYear: 2020,
      endYear: 2020,
    })).rejects.toMatchObject({ code: "BAD_INPUT" });
    await expect(fetchRegionalMonthly({
      variable,
      region: { type: "bbox", west: 0, south: 10, east: 1, north: 0 },
      startYear: 2020,
      endYear: 2020,
    })).rejects.toMatchObject({ code: "BAD_INPUT" });
    await expect(fetchRegionalMonthly({
      variable,
      region: iowa,
      startYear: 2021,
      endYear: 2020,
    })).rejects.toMatchObject({ code: "BAD_INPUT" });
    const current = new Date().getUTCFullYear();
    await expect(fetchRegionalMonthly({
      variable: getVariable("sunlight") as VariableDef,
      region: iowa,
      startYear: 1981,
      endYear: current,
    })).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clamps the start to the record, drops the annual mean, and keeps an interior fill as null", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: unknown) => {
      urls.push(String(input));
      return jsonResponse(payload("T2M", {
        ...months(1981, 1),
        "198102": -999,
        "198113": 50,
      }));
    });
    const result = await fetchRegionalMonthly({
      variable: t2m(),
      region: iowa,
      startYear: 1980,
      endYear: 1981,
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("start=1981");
    expect(urls[0]).not.toContain("start=1980");
    expect(result.rows.map((row) => row.date)).toEqual(expectedMonths(1981, 1981));
    expect(result.rows[0]).toEqual({ date: "1981-01", value: 1 });
    expect(result.rows[1]).toEqual({ date: "1981-02", value: null });
    expect(result.rows.every((row) => row.value !== 50)).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("1981"))).toBe(true);
  });

  it("nulls a month when more than half the cells are missing and trims the unreleased tail", async () => {
    vi.stubGlobal("fetch", async (input: unknown) => {
      const lat = new URL(String(input)).searchParams.get("latitude");
      const values = months(2020, lat === "41.5" ? 10 : lat === "42" ? 20 : 30);
      values["202002"] = lat === "41.5" ? 10 : -999;
      values["202003"] = 6;
      for (const month of ["04", "05", "06", "07", "08", "09", "10", "11", "12"]) values[`2020${month}`] = -999;
      values["202013"] = 99;
      return jsonResponse(payload("T2M", values));
    });
    const result = await fetchRegionalMonthly({
      variable: t2m(),
      region: { type: "bbox", west: -93.75, east: -93.75, south: 41.5, north: 42.5 },
      startYear: 2020,
      endYear: 2020,
    });
    expect(result.gridPoints).toEqual([
      { lat: 41.5, lon: -93.75 },
      { lat: 42, lon: -93.75 },
      { lat: 42.5, lon: -93.75 },
    ]);
    expect(result.rows).toEqual([
      { date: "2020-01", value: 20 },
      { date: "2020-02", value: null },
      { date: "2020-03", value: 6 },
    ]);
    expect(result.warnings.some((warning) => warning.includes("2020-03"))).toBe(true);
    expect(result.requestUrls).toHaveLength(3);
  });

  it("retries 503 and network errors, and does not retry a 400 or a timeout", async () => {
    powerRequestPolicy.backoffBaseMs = 0;
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls < 3) return new Response("down", { status: 503 });
      return jsonResponse(payload("T2M", months(2020, 2)));
    });
    const recovered = await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2020, endYear: 2020 });
    expect(recovered.rows[0].value).toBe(2);
    expect(calls).toBe(3);

    clearPowerCache();
    calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("socket hang up");
      return jsonResponse(payload("T2M", months(2019, 4)));
    });
    const networked = await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2019, endYear: 2019 });
    expect(networked.rows[5].value).toBe(4);
    expect(calls).toBe(3);

    clearPowerCache();
    calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse({ messages: ["One of your parameters is incorrect: NOPE."] }, 400);
    });
    await expect(fetchRegionalMonthly({
      variable: { ...t2m(), powerParam: "NOPE" },
      region: iowa,
      startYear: 2018,
      endYear: 2018,
    })).rejects.toMatchObject({ name: "PowerError", code: "UPSTREAM" });
    expect(calls).toBe(1);

    clearPowerCache();
    calls = 0;
    powerRequestPolicy.timeoutMs = 20;
    vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    await expect(fetchRegionalMonthly({
      variable: t2m(),
      region: iowa,
      startYear: 2017,
      endYear: 2017,
    })).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(calls).toBe(1);
  });

  it("shares one in-flight request and then serves the next call from the cache", async () => {
    let calls = 0;
    let release: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    const first = fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2016, endYear: 2016 });
    const second = fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2016, endYear: 2016 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    release(jsonResponse(payload("T2M", months(2016, 7))));
    const [a, b] = await Promise.all([first, second]);
    expect(a.rows[0].value).toBe(7);
    expect(b.rows[0].value).toBe(a.rows[0].value);

    const third = await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2016, endYear: 2016 });
    expect(third.rows[0].value).toBe(7);
    expect(calls).toBe(1);
  });

  it("expires a cache entry once its TTL has passed", async () => {
    powerRequestPolicy.cacheTtlMs = -1;
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse(payload("T2M", months(2015, 1)));
    });
    await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2015, endYear: 2015 });
    await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2015, endYear: 2015 });
    expect(calls).toBe(2);
  });

  it("follows a POWER end-date rejection down to the year the API allows", async () => {
    vi.stubGlobal("fetch", async (input: unknown) => {
      const url = String(input);
      if (url.includes("end=2020")) {
        return jsonResponse({
          messages: ["Please provide a correct end date. Your end date out of range. The data is available to 2019/12/31."],
        }, 422);
      }
      return jsonResponse(payload("T2M", { ...months(2018, 1), ...months(2019, 2) }));
    });
    const result = await fetchRegionalMonthly({ variable: t2m(), region: iowa, startYear: 2018, endYear: 2020 });
    expect(result.rows[0].date).toBe("2018-01");
    expect(result.rows[result.rows.length - 1].date).toBe("2019-12");
    expect(result.requestUrls[0]).toContain("end=2019");
    expect(result.warnings.some((warning) => warning.includes("2019"))).toBe(true);
  });

  it("reports no data when every month is a fill, including a leftover annual mean", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse(payload("T2M", { ...months(2014, -999), "201413": 15 })));
    await expect(fetchRegionalMonthly({
      variable: t2m(),
      region: iowa,
      startYear: 2014,
      endYear: 2014,
    })).rejects.toBeInstanceOf(PowerError);
    await expect(fetchRegionalMonthly({
      variable: t2m(),
      region: iowa,
      startYear: 2014,
      endYear: 2014,
    })).rejects.toMatchObject({ code: "NO_DATA" });
  });

  it("stops when the caller aborts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const signal = AbortSignal.abort();
    await expect(fetchRegionalMonthly({
      variable: t2m(),
      region: iowa,
      startYear: 2020,
      endYear: 2020,
      signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps at most four point requests in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal("fetch", async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return jsonResponse(payload("T2M", months(2013, 1)));
    });
    const result = await fetchRegionalMonthly({
      variable: t2m(),
      region: { type: "bbox", west: 0, east: 1.875, south: 0, north: 0.5 },
      startYear: 2013,
      endYear: 2013,
    });
    expect(result.gridPoints).toHaveLength(8);
    expect(maxInFlight).toBe(4);
  });
});

describe("provenance", () => {
  const fetched = (paramYears = "2020"): RegionalFetch => ({
    rows: [{ date: "2020-01", value: 1 }],
    gridPoints: [{ lat: 42, lon: -93.75 }],
    requestUrls: [`https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${paramYears}`],
    warnings: [],
    fetchedAt: "2026-11-15T18:00:00.000Z",
  });

  it("cites POWER and Gelaro for MERRA-2 temperature", () => {
    const provenance = buildProvenance(t2m(), { ...iowa, name: "central Iowa" }, fetched());
    expect(provenance.powerParam).toBe("T2M");
    expect(provenance.fetchedAt).toBe("2026-11-15T18:00:00.000Z");
    expect(provenance.citation).toContain("15 November 2026");
    expect(provenance.citation).toContain("Langley");
    expect(provenance.citation).toContain("10.1175/JCLI-D-16-0758.1");
    expect(provenance.citation).toContain("central Iowa");
    expect(provenance.bibtex).toContain("10.1175/JCLI-D-16-0758.1");
    expect(provenance.bibtex).toContain("https://power.larc.nasa.gov");
  });

  it("adds the precipitation correction paper POWER cites", () => {
    const variable = getVariable("precip");
    if (!variable) throw new Error("missing precip");
    const provenance = buildProvenance(variable, iowa, fetched());
    expect(provenance.bibtex).toContain("10.1175/JCLI-D-16-0570.1");
    expect(provenance.citation).toContain("10.1175/JCLI-D-16-0758.1");
  });

  it("cites SRB and CERES for sunlight, and only the SYN1deg paper for aerosol optical depth", () => {
    const sunlight = getVariable("sunlight");
    const aod = getVariable("aod");
    if (!sunlight || !aod) throw new Error("missing radiation variables");
    const solar = buildProvenance(sunlight, iowa, fetched());
    expect(solar.bibtex).toContain("10.1175/JTECH-D-14-00165.1");
    expect(solar.bibtex).toContain("20210018620");
    expect(solar.bibtex).toContain("10.1175/JAMC-D-13-061.1");
    expect(solar.citation).toContain("1 January 2001");
    const aerosol = buildProvenance(aod, iowa, fetched());
    expect(aerosol.bibtex).toContain("10.1175/JTECH-D-14-00165.1");
    expect(aerosol.bibtex).not.toContain("20210018620");
    expect(aerosol.citation).toContain("not a surface pollution measurement");
  });
});

describe("public exports", () => {
  it("re-exports the client used by the rest of the app", () => {
    expect(fetchFromIndex).toBe(fetchRegionalMonthly);
    expect(ExportedPowerError).toBe(PowerError);
    const fetched: RegionalFetch = {
      rows: [],
      gridPoints: [],
      requestUrls: [],
      warnings: [],
      fetchedAt: "2026-11-15T00:00:00.000Z",
    };
    expect(fetched.rows).toEqual([]);
  });
});

const live = process.env.LIVE === "1";
(live ? it : it.skip)("live smoke: one year of 2 m temperature at a MERRA-2 cell", async () => {
  const variable = getVariable("t2m");
  if (!variable) throw new Error("missing t2m");
  const result = await fetchRegionalMonthly({
    variable,
    region: { ...iowa, name: "central Iowa" },
    startYear: 2020,
    endYear: 2020,
  });
  expect(result.rows).toHaveLength(12);
  expect(result.rows[0].date).toBe("2020-01");
  expect(result.rows[11].date).toBe("2020-12");
  for (const row of result.rows) {
    expect(row.value).not.toBeNull();
    expect(row.value as number).toBeGreaterThan(-40);
    expect(row.value as number).toBeLessThan(40);
  }
  expect(result.rows[0].value as number).toBeLessThan(result.rows[6].value as number);
  expect(result.gridPoints).toEqual([{ lat: 42, lon: -93.75 }]);
  expect(result.requestUrls).toHaveLength(1);
  expect(result.requestUrls[0]).toContain("parameters=T2M");
  expect(result.requestUrls[0]).toContain("community=AG");
  const provenance = buildProvenance(variable, iowa, result);
  expect(provenance.citation).toContain("10.1175/JCLI-D-16-0758.1");
}, 90_000);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function payload(param: string, values: Record<string, number | null>): unknown {
  return {
    header: { fill_value: -999, sources: ["MERRA2"] },
    properties: { parameter: { [param]: values } },
  };
}

function months(year: number, value: number): Record<string, number> {
  const values: Record<string, number> = {};
  for (let month = 1; month <= 12; month += 1) {
    values[`${year}${String(month).padStart(2, "0")}`] = value;
  }
  values[`${year}13`] = 12345;
  return values;
}

function expectedMonths(startYear: number, endYear: number): string[] {
  const dates: string[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) dates.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return dates;
}
