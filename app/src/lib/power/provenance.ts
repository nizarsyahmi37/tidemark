import type { Provenance, RegionSpec, VariableDef } from "../types";
import { formatCoord, type RegionalFetch } from "./client";

const POWER_SENTENCE =
  "The data was obtained from the National Aeronautics and Space Administration (NASA) Langley Research Center Prediction Of Worldwide Energy Resources (POWER) Project funded through the NASA Earth Science Division.";

const METHODOLOGY = "https://power.larc.nasa.gov/docs/methodology/";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DatasetFamily = "merra2" | "precip" | "radiation" | "ceres" | "unspecified";

const FAMILY: Record<string, DatasetFamily> = {
  T2M: "merra2",
  T2M_MAX: "merra2",
  T2M_MIN: "merra2",
  TS: "merra2",
  T2MDEW: "merra2",
  RH2M: "merra2",
  QV2M: "merra2",
  EVLAND: "merra2",
  GWETTOP: "merra2",
  GWETROOT: "merra2",
  GWETPROF: "merra2",
  WS10M: "merra2",
  PS: "merra2",
  PRECTOTCORR: "precip",
  CLOUD_AMT: "radiation",
  ALLSKY_SFC_SW_DWN: "radiation",
  CLRSKY_SFC_SW_DWN: "radiation",
  ALLSKY_SFC_LW_DWN: "radiation",
  ALLSKY_SFC_PAR_TOT: "radiation",
  AOD_55: "ceres",
  PW: "ceres",
};

export function buildProvenance(variable: VariableDef, region: RegionSpec, fetched: RegionalFetch): Provenance {
  const accessed = accessDate(fetched.fetchedAt);
  const family = FAMILY[variable.powerParam] ?? "unspecified";
  const place = describeRegion(region);
  const sampling =
    fetched.gridPoints.length <= 1
      ? "The request is a single coordinate; POWER returns the grid cell that contains it."
      : `The regional value is the unweighted mean of ${fetched.gridPoints.length} MERRA-2 cell centres.`;

  return {
    source: sourceLabel(family),
    dataset: variable.sourceDataset,
    powerParam: variable.powerParam,
    gridPoints: fetched.gridPoints,
    requestUrls: fetched.requestUrls,
    fetchedAt: fetched.fetchedAt,
    citation: [
      `${POWER_SENTENCE} Service: POWER Monthly and Annual API, https://power.larc.nasa.gov. Accessed ${accessed}.`,
      `${variable.name} (${variable.powerParam}) at ${place}. ${sampling}`,
      datasetParagraph(family, variable),
    ].join("\n\n"),
    bibtex: bibtexFor(family, accessed),
  };
}

function sourceLabel(family: DatasetFamily): string {
  switch (family) {
    case "precip":
      return "NASA POWER (MERRA-2 observation-corrected precipitation)";
    case "radiation":
      return "NASA POWER (GEWEX SRB Release 4-IP and CERES SYN1deg)";
    case "ceres":
      return "NASA POWER (CERES SYN1deg)";
    case "unspecified":
      return "NASA POWER";
    default:
      return "NASA POWER (MERRA-2)";
  }
}

function datasetParagraph(family: DatasetFamily, variable: VariableDef): string {
  const gelaro =
    "Gelaro, R., and Coauthors, 2017: The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). J. Climate, 30, 5419–5454, https://doi.org/10.1175/JCLI-D-16-0758.1.";
  const reichle =
    "Reichle, R. H., Q. Liu, R. D. Koster, C. S. Draper, S. P. P. Mahanama, and G. S. Partyka, 2017: Land surface precipitation in MERRA-2. J. Climate, 30, 1643–1664, https://doi.org/10.1175/JCLI-D-16-0570.1.";
  const rutan =
    "Rutan, D. A., S. Kato, D. R. Doelling, F. G. Rose, L. T. Nguyen, T. E. Caldwell, and N. G. Loeb, 2015: CERES synoptic product: Methodology and validation of surface radiant flux. J. Atmos. Oceanic Technol., 32, 1121–1143, https://doi.org/10.1175/JTECH-D-14-00165.1.";
  const stackhouse =
    "Stackhouse, P. W., S. J. Cox, J. C. Mikovitz, and T. Zhang, 2021: GEWEX Surface Radiation Budget (SRB) Release 4 Integrated Product (IP4) — algorithm theoretical basis document and evaluation. NASA Technical Reports Server, https://ntrs.nasa.gov/citations/20210018620.";
  const kratz =
    "Kratz, D. P., P. W. Stackhouse, S. K. Gupta, A. C. Wilber, P. Sawaengphokhai, and G. R. McGarragh, 2014: The Fast Longwave and Shortwave Flux (FLASHFlux) data product: Single-scanner footprint fluxes. J. Appl. Meteor. Climatol., 53, 1059–1079, https://doi.org/10.1175/JAMC-D-13-061.1.";

  switch (family) {
    case "precip":
      return `Underlying data: MERRA-2, with the observation-corrected precipitation POWER's meteorology page cites. ${gelaro} ${reichle}`;
    case "radiation":
      return `Underlying data: GEWEX SRB Release 4-IP for 1984–2000 and CERES SYN1deg from 2001, as described on POWER's energy-flux page (${METHODOLOGY}). ${stackhouse} ${rutan} POWER also documents CERES FLASHFlux as the low-latency tail after SYN1deg. ${kratz} A trend that crosses 1 January 2001 can step because the product changed.`;
    case "ceres":
      return variable.powerParam === "AOD_55"
        ? `Underlying data: CERES SYN1deg Edition 4.2 aerosol optical depth at 550 nm. POWER's clouds and aerosols page (${METHODOLOGY}data/sources_clds_aerosols/) describes this as the SYN1deg aerosol field (MODIS Dark Target and Deep Blue retrievals assimilated for that product), not a surface pollution measurement. ${rutan}`
        : `Underlying data: CERES SYN1deg. POWER's parameter definition states that precipitable water is sourced from CERES, and this layer cites the SYN1deg surface-flux paper POWER uses rather than a separate water-vapor retrieval paper. ${rutan}`;
    case "unspecified":
      return `This layer does not attach a separate journal paper for ${variable.powerParam}. Cite the POWER methodology pages instead of an invented dataset paper: ${METHODOLOGY}`;
    default:
      return `Underlying data: MERRA-2. Parameters POWER derives from hourly MERRA-2 fields (monthly maximum and minimum temperature, relative humidity, 10 m wind) are still MERRA-2 values, not a separate observing network. ${gelaro} Methodology: ${METHODOLOGY}data/sources_meteorology/.`;
  }
}

function bibtexFor(family: DatasetFamily, accessed: string): string {
  const power = `@misc{NASAPOWER,
  author = {{NASA Langley Research Center POWER Project}},
  title = {Prediction of Worldwide Energy Resources ({POWER})},
  howpublished = {\\url{https://power.larc.nasa.gov}},
  note = {Monthly and Annual API. ${POWER_SENTENCE} Accessed ${accessed}.},
  year = {${accessed.slice(-4)}}
}`;
  const gelaro = `@article{Gelaro2017,
  author = {Gelaro, Ronald and others},
  title = {The {Modern-Era} Retrospective Analysis for Research and Applications, Version 2 ({MERRA-2})},
  journal = {Journal of Climate},
  year = {2017},
  volume = {30},
  number = {14},
  pages = {5419--5454},
  doi = {10.1175/JCLI-D-16-0758.1}
}`;
  const reichle = `@article{Reichle2017,
  author = {Reichle, Rolf H. and Liu, Q. and Koster, Randal D. and Draper, Clara S. and Mahanama, Sarith P. P. and Partyka, Gary S.},
  title = {Land Surface Precipitation in {MERRA-2}},
  journal = {Journal of Climate},
  year = {2017},
  volume = {30},
  number = {5},
  pages = {1643--1664},
  doi = {10.1175/JCLI-D-16-0570.1}
}`;
  const rutan = `@article{Rutan2015,
  author = {Rutan, David A. and Kato, Seiji and Doelling, David R. and Rose, Fred G. and Nguyen, Le Trang and Caldwell, Thomas E. and Loeb, Norman G.},
  title = {{CERES} Synoptic Product: Methodology and Validation of Surface Radiant Flux},
  journal = {Journal of Atmospheric and Oceanic Technology},
  year = {2015},
  volume = {32},
  number = {6},
  pages = {1121--1143},
  doi = {10.1175/JTECH-D-14-00165.1}
}`;
  const stackhouse = `@techreport{Stackhouse2021,
  author = {Stackhouse, Paul W. and Cox, Stephen J. and Mikovitz, J. Colleen and Zhang, Taiping},
  title = {{GEWEX} Surface Radiation Budget ({SRB}) Release 4 Integrated Product ({IP4}): Algorithm Theoretical Basis Document and Evaluation},
  institution = {NASA Langley Research Center},
  year = {2021},
  url = {https://ntrs.nasa.gov/citations/20210018620}
}`;
  const kratz = `@article{Kratz2014,
  author = {Kratz, David P. and Stackhouse, Paul W. and Gupta, Shashi K. and Wilber, Anne C. and Sawaengphokhai, Parnchai and McGarragh, Greg R.},
  title = {The Fast Longwave and Shortwave Flux ({FLASHFlux}) Data Product: Single-Scanner Footprint Fluxes},
  journal = {Journal of Applied Meteorology and Climatology},
  year = {2014},
  volume = {53},
  number = {4},
  pages = {1059--1079},
  doi = {10.1175/JAMC-D-13-061.1}
}`;
  const entries = [power];
  if (family === "merra2" || family === "precip") entries.push(gelaro);
  if (family === "precip") entries.push(reichle);
  if (family === "radiation") entries.push(stackhouse, rutan, kratz);
  if (family === "ceres") entries.push(rutan);
  return entries.join("\n\n");
}

function describeRegion(region: RegionSpec): string {
  if (region.type === "point") {
    const where = `latitude ${formatCoord(region.lat)}°, longitude ${formatCoord(region.lon)}°`;
    return region.name ? `${region.name} (${where})` : where;
  }
  const where = `west ${formatCoord(region.west)}°, south ${formatCoord(region.south)}°, east ${formatCoord(region.east)}°, north ${formatCoord(region.north)}°`;
  return region.name ? `${region.name} (${where})` : `the box ${where}`;
}

function accessDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
