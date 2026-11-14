import type { VariableDef } from "../types";

/**
 * Variables checked against the live POWER monthly point API on 15 Nov 2026.
 * recordStartYear is the first year with a non-fill value, not the year the
 * API will accept as `start` (it accepts 1981 even when those months are -999).
 */
export const VARIABLES: VariableDef[] = [
  {
    id: "t2m",
    powerParam: "T2M",
    name: "Air temperature at 2 m",
    shortName: "air temperature",
    category: "Temperature",
    units: "C",
    unitLabel: "degrees Celsius",
    definition:
      "The average temperature of the air about 2 metres above the ground, for the whole month. This is the number people usually mean by the month's temperature.",
    whyItMatters:
      "It is the baseline for heat, frost, and energy demand, and it is the series to use when the question is whether a place's average temperature has changed.",
    caveat:
      "MERRA-2 is a reanalysis: a weather model blended with observations, not a thermometer at the point you chose. The value is for a grid cell about 0.5° by 0.625°. POWER's methodology says the newest months can come from GEOS-IT rather than MERRA-2, and it recommends ending a trend study about two months behind real time.",
    sourceDataset:
      "MERRA-2 (GMAO), 1/2° latitude by 5/8° longitude. POWER may append GEOS-IT for the most recent months.",
    recordStartYear: 1981,
  },
  {
    id: "t2m-max",
    powerParam: "T2M_MAX",
    name: "Hottest 2 m temperature in the month",
    shortName: "monthly hot extreme",
    category: "Temperature",
    units: "C",
    unitLabel: "degrees Celsius",
    definition:
      "The single highest hourly air temperature at 2 metres during that month. POWER computes it from MERRA-2 hourly temperatures.",
    whyItMatters:
      "It tracks the hottest hour of each month, which is a different question from whether typical afternoons got warmer.",
    caveat:
      "This is not the average daily high. At monthly resolution it is one extreme hour. A check for August 2020 at 42°N, 93.75°W matched the hottest daily maximum (37.37°C), not the mean of the daily maxima (about 30.7°C). The series is much noisier than mean temperature.",
    sourceDataset:
      "Derived by POWER from MERRA-2 hourly 2 m temperature (response sources MERRA2 and POWER).",
    recordStartYear: 1981,
  },
  {
    id: "t2m-min",
    powerParam: "T2M_MIN",
    name: "Coldest 2 m temperature in the month",
    shortName: "monthly cold extreme",
    category: "Temperature",
    units: "C",
    unitLabel: "degrees Celsius",
    definition:
      "The single lowest hourly air temperature at 2 metres during that month. POWER computes it from MERRA-2 hourly temperatures.",
    whyItMatters:
      "It tracks the coldest hour of each month, which is what decides hard frost, not how cold a typical night was.",
    caveat:
      "This is not the average daily low. At monthly resolution it is one extreme hour. In the August 2020 check at 42°N, 93.75°W the monthly value equalled the lowest daily minimum, not the mean of the daily minima.",
    sourceDataset:
      "Derived by POWER from MERRA-2 hourly 2 m temperature (response sources MERRA2 and POWER).",
    recordStartYear: 1981,
  },
  {
    id: "skin-temp",
    powerParam: "TS",
    name: "Earth skin temperature",
    shortName: "skin temperature",
    category: "Temperature",
    units: "C",
    unitLabel: "degrees Celsius",
    definition:
      "The temperature of the surface itself — soil, vegetation, snow, or water — rather than the air above it.",
    whyItMatters:
      "The surface warms and cools faster than the air, so skin temperature responds more directly to sun, rain, and snow cover.",
    caveat:
      "This is the MERRA-2 model surface temperature, not a satellite land-surface temperature such as MODIS, and not the 2 m air temperature.",
    sourceDataset: "MERRA-2 (GMAO) earth skin temperature.",
    recordStartYear: 1981,
  },
  {
    id: "dewpoint",
    powerParam: "T2MDEW",
    name: "Dew point at 2 m",
    shortName: "dew point",
    category: "Temperature",
    units: "C",
    unitLabel: "degrees Celsius",
    definition:
      "The temperature the air at 2 metres would have to cool to for water vapor to condense. A higher dew point means more moisture in the air.",
    whyItMatters:
      "Dew point is how muggy a month felt, and it sets how cold the night can get before dew or frost forms.",
    caveat:
      "Below 0°C this is a frost point. It is a MERRA-2 reanalysis value for the grid cell, not a hygrometer at the site.",
    sourceDataset: "MERRA-2 (GMAO) dew/frost point at 2 metres.",
    recordStartYear: 1981,
  },
  {
    id: "precip",
    powerParam: "PRECTOTCORR",
    name: "Bias-corrected precipitation",
    shortName: "rainfall",
    category: "Water cycle",
    units: "mm/day",
    unitLabel: "mm of rain per day",
    definition:
      "The month's average precipitation at the surface, in millimetres per day, after MERRA-2 has been corrected toward rain-gauge and satellite analyses. Snowfall is included as water equivalent, so this is not rain alone.",
    whyItMatters:
      "It is the POWER precipitation series meant for comparison with gauges; the uncorrected model precipitation is not served as its own parameter.",
    caveat:
      "Still a gridded reanalysis product, not the gauge at the point you chose. Hills and coastlines inside a cell are averaged together. POWER's meteorology page cites Reichle et al. (2017) for the correction.",
    sourceDataset:
      "MERRA-2 observation-corrected precipitation (Reichle et al. 2017, the correction cited on POWER's meteorology page).",
    recordStartYear: 1981,
  },
  {
    id: "humidity",
    powerParam: "RH2M",
    name: "Relative humidity at 2 m",
    shortName: "relative humidity",
    category: "Water cycle",
    units: "%",
    unitLabel: "percent relative humidity",
    definition:
      "How close the air at 2 metres is to being saturated, as a percent. 100% would be a cloud of fog; lower values mean the air could still hold more water vapor.",
    whyItMatters:
      "It is the humidity that affects drying, fire weather, and how oppressive heat feels.",
    caveat:
      "POWER calculates this from MERRA-2. Because warmer air can hold more vapor, relative humidity can fall even when the actual amount of water vapor rises. Read it next to specific humidity or dew point before calling a place 'drier'.",
    sourceDataset:
      "Calculated by POWER from MERRA-2 (response sources MERRA2 and POWER).",
    recordStartYear: 1981,
  },
  {
    id: "specific-humidity",
    powerParam: "QV2M",
    name: "Specific humidity at 2 m",
    shortName: "specific humidity",
    category: "Water cycle",
    units: "g/kg",
    unitLabel: "grams of water vapor per kilogram of air",
    definition:
      "The mass of water vapor mixed into a kilogram of air at 2 metres. Unlike relative humidity, it does not depend on how warm the air is.",
    whyItMatters:
      "It measures the moisture itself, so it is the right humidity series when the question is whether the air holds more water than it used to.",
    caveat:
      "MERRA-2 reanalysis for the grid cell, not a humidity sensor at the site.",
    sourceDataset: "MERRA-2 (GMAO) specific humidity at 2 metres.",
    recordStartYear: 1981,
  },
  {
    id: "evaporation",
    powerParam: "EVLAND",
    name: "Land evaporation",
    shortName: "land evaporation",
    category: "Water cycle",
    units: "mm/day",
    unitLabel: "mm of water evaporated per day",
    definition:
      "Water leaving the land surface as vapor, averaged over the month, in millimetres per day. Over ocean this field is not the quantity to use.",
    whyItMatters:
      "Together with precipitation it says whether the land surface is losing or gaining water.",
    caveat:
      "This is modelled evaporation from the MERRA-2 land surface, not an eddy-covariance flux tower. Snow-covered months are often near zero.",
    sourceDataset: "MERRA-2 (GMAO) land evaporation.",
    recordStartYear: 1981,
  },
  {
    id: "column-water",
    powerParam: "PW",
    name: "Precipitable water",
    shortName: "column water vapor",
    category: "Water cycle",
    units: "cm",
    unitLabel: "centimetres of water if the whole column condensed",
    definition:
      "How deep the puddle would be if you condensed every bit of water vapor in a column of air from the ground to the top of the atmosphere.",
    whyItMatters:
      "It is the atmospheric store that clouds and rain draw on, and it is not the same thing as rain or as humidity at 2 metres.",
    caveat:
      "POWER's parameter list says this field is sourced from CERES, and the monthly response header reports SYN1DEG only. The record starts in 2001, later than MERRA-2 humidity. It is a 1° satellite product, not a weather-balloon sounding at the site.",
    sourceDataset: "CERES SYN1deg column water vapor, 1° grid, from January 2001.",
    recordStartYear: 2001,
  },
  {
    id: "soil-surface",
    powerParam: "GWETTOP",
    name: "Surface soil wetness",
    shortName: "surface soil wetness",
    category: "Land",
    units: "1",
    unitLabel: "fraction of the top soil that is wet (0 dry, 1 saturated)",
    definition:
      "How wet the top of the soil is, in the model's upper few centimetres (POWER describes this layer as about 5 cm). 0 is completely dry and 1 is saturated.",
    whyItMatters:
      "The surface layer is what rain wets first and what dries out between storms, so it moves faster than deeper soil.",
    caveat:
      "Modelled by the Catchment land-surface model inside MERRA-2. It is not a probe in the ground and not the SMAP satellite soil-moisture product. Frozen or snow-covered ground is a weak point for this kind of model.",
    sourceDataset: "MERRA-2 Catchment land-surface model, surface soil wetness (about 0–5 cm).",
    recordStartYear: 1981,
  },
  {
    id: "soil-root",
    powerParam: "GWETROOT",
    name: "Root-zone soil wetness",
    shortName: "root-zone soil wetness",
    category: "Land",
    units: "1",
    unitLabel: "fraction of the root zone that is wet (0 dry, 1 saturated)",
    definition:
      "How much of the root zone — POWER describes it as generally the upper 1 metre — is filled with water. 0 is completely dry and 1 is saturated.",
    whyItMatters:
      "This is the water plants can draw on, so it is closer to agricultural drought than the wetness of the top few centimetres.",
    caveat:
      "Modelled by the Catchment land-surface model inside MERRA-2, not an in-situ sensor and not SMAP. The 'root zone' is the model's layer, which will not match every crop's actual roots.",
    sourceDataset: "MERRA-2 Catchment land-surface model, root-zone soil wetness (about the upper 1 m).",
    recordStartYear: 1981,
  },
  {
    id: "soil-profile",
    powerParam: "GWETPROF",
    name: "Profile soil wetness",
    shortName: "profile soil wetness",
    category: "Land",
    units: "1",
    unitLabel: "fraction of the full soil column that is wet (0 dry, 1 saturated)",
    definition:
      "Wetness of the whole soil column from the surface down to bedrock in the model. 0 is completely dry and 1 is saturated.",
    whyItMatters:
      "The full column changes more slowly than the surface, so it behaves like a seasonal water store rather than last week's rain.",
    caveat:
      "Modelled by the MERRA-2 Catchment model, not a measurement. Bedrock depth is the model's, not a survey at the site.",
    sourceDataset: "MERRA-2 Catchment land-surface model, profile soil wetness (surface to bedrock).",
    recordStartYear: 1981,
  },
  {
    id: "wind-10m",
    powerParam: "WS10M",
    name: "Wind speed at 10 m",
    shortName: "wind",
    category: "Atmosphere",
    units: "m/s",
    unitLabel: "metres per second",
    definition:
      "The average wind speed 10 metres above the ground. Ten metres is the usual height for weather-station wind.",
    whyItMatters:
      "Wind at this height controls how fast the surface dries and how much the air mixes.",
    caveat:
      "A grid-cell average from MERRA-2. A city, forest, or valley station is often slower than the open cell. This is not a wind-turbine site assessment.",
    sourceDataset:
      "MERRA-2 wind at 10 m, served by POWER (response sources MERRA2 and POWER).",
    recordStartYear: 1981,
  },
  {
    id: "pressure",
    powerParam: "PS",
    name: "Surface pressure",
    shortName: "surface pressure",
    category: "Atmosphere",
    units: "kPa",
    unitLabel: "kilopascals at the surface",
    definition:
      "The weight of the air at the elevation of the grid cell, in kilopascals. Sea-level pressure is about 101 kPa; higher ground is lower.",
    whyItMatters:
      "It locates the passing highs and lows, and it shows the elevation the other MERRA-2 fields are sitting on.",
    caveat:
      "This is surface pressure, not sea-level pressure. Two nearby cells can differ mostly because one is higher, not because the weather is different. A slow drift is a poor stand-in for a climate trend.",
    sourceDataset: "MERRA-2 (GMAO) surface pressure.",
    recordStartYear: 1981,
  },
  {
    id: "clouds",
    powerParam: "CLOUD_AMT",
    name: "Cloud amount",
    shortName: "cloud cover",
    category: "Atmosphere",
    units: "%",
    unitLabel: "percent of the sky covered by cloud",
    definition:
      "The average fraction of the sky covered by cloud during the month, in percent.",
    whyItMatters:
      "Cloud cover is the main control on how much sunlight reaches the ground and how much heat the surface can lose at night.",
    caveat:
      "The monthly series joins GEWEX SRB (1984–2000) and CERES SYN1deg (from 2001) on a 1° grid. POWER warns that a jump at that join may be a change of product, not of the sky. This is not a human cloud observer.",
    sourceDataset:
      "GEWEX SRB Release 4-IP through 2000, then CERES SYN1deg (1° grid). Confirmed by response sources SRB and SYN1DEG.",
    recordStartYear: 1984,
  },
  {
    id: "aod",
    powerParam: "AOD_55",
    name: "Aerosol optical depth at 550 nm",
    shortName: "aerosol optical depth",
    category: "Atmosphere",
    units: "dimensionless",
    unitLabel: "aerosol optical depth (unitless)",
    definition:
      "How much the particles in a vertical column of air at a wavelength of 0.55 micrometres block and scatter sunlight. Larger numbers mean a hazier column.",
    whyItMatters:
      "It is the aerosol field CERES uses when it estimates how much sunlight reaches the surface, so it belongs with the radiation series.",
    caveat:
      "This is not surface air pollution and not PM2.5. It is a column optical depth from CERES SYN1deg Edition 4.2 (MODIS aerosol retrievals fed into that product), on a 1° grid, starting in 2001. Smoke high in the atmosphere counts even when the air at the ground is cleaner.",
    sourceDataset:
      "CERES SYN1deg Edition 4.2 aerosol optical depth at 550 nm, 1° grid, from January 2001.",
    recordStartYear: 2001,
  },
  {
    id: "sunlight",
    powerParam: "ALLSKY_SFC_SW_DWN",
    name: "All-sky surface sunlight",
    shortName: "sunlight",
    category: "Energy",
    units: "MJ/m^2/day",
    unitLabel: "megajoules of sunlight per square metre per day",
    definition:
      "Sunlight landing on a horizontal surface, direct plus diffuse, with clouds included. The monthly value is the average daily total, not the sum for the whole month.",
    whyItMatters:
      "This is the sunlight crops and solar panels actually receive, clouds included.",
    caveat:
      "A satellite estimate on a 1° grid, not a pyranometer at the site. GEWEX SRB Release 4-IP covers 1984–2000 and CERES SYN1deg Edition 4.2 covers 2001 onward. POWER warns not to treat a trend that crosses January 2001 as a climate signal without checking for a step. FLASHFlux is the low-latency CERES stream in the docs; the monthly series still ends several months behind the meteorological fields. Neighbouring MERRA-2 sample points can fall in the same 1° cell and repeat one value.",
    sourceDataset:
      "GEWEX SRB Release 4-IP (1984–2000) and CERES SYN1deg Edition 4.2 (from 2001), 1° grid.",
    recordStartYear: 1984,
  },
  {
    id: "clear-sky-sunlight",
    powerParam: "CLRSKY_SFC_SW_DWN",
    name: "Clear-sky surface sunlight",
    shortName: "clear-sky sunlight",
    category: "Energy",
    units: "MJ/m^2/day",
    unitLabel: "megajoules of sunlight per square metre per day under clear sky",
    definition:
      "The sunlight that would reach a horizontal surface if the sky were clear: direct plus diffuse, without clouds. Monthly values are average daily totals.",
    whyItMatters:
      "The gap between clear-sky and all-sky sunlight is what clouds took away, separate from changes in aerosols or the sun's angle.",
    caveat:
      "Same sources and 1° grid as all-sky sunlight, including the SRB-to-CERES join at the start of 2001. Clear-sky here is the satellite product's clear-sky estimate, not a day you personally saw as cloudless.",
    sourceDataset:
      "GEWEX SRB Release 4-IP (1984–2000) and CERES SYN1deg Edition 4.2 (from 2001), 1° grid.",
    recordStartYear: 1984,
  },
  {
    id: "longwave",
    powerParam: "ALLSKY_SFC_LW_DWN",
    name: "All-sky downward longwave",
    shortName: "downward longwave",
    category: "Energy",
    units: "MJ/m^2/day",
    unitLabel: "megajoules of infrared energy per square metre per day",
    definition:
      "Infrared energy coming down from the atmosphere onto a horizontal surface, clouds included. The monthly value is the average daily total.",
    whyItMatters:
      "It is the heat the sky sends back to the surface. Water vapor and clouds both raise it, which is why cloudy nights stay warmer.",
    caveat:
      "Satellite-based estimate, same SRB (through 2000) then CERES SYN1deg (from 2001) join as the sunlight series, on a 1° grid. Not a ground radiometer.",
    sourceDataset:
      "GEWEX SRB Release 4-IP (1984–2000) and CERES SYN1deg Edition 4.2 (from 2001), 1° grid.",
    recordStartYear: 1984,
  },
  {
    id: "par",
    powerParam: "ALLSKY_SFC_PAR_TOT",
    name: "Photosynthetically active radiation",
    shortName: "PAR",
    category: "Energy",
    units: "MJ/m^2/day",
    unitLabel: "megajoules of photosynthetically active light per square metre per day",
    definition:
      "The part of sunlight plants use for photosynthesis (roughly the visible band), direct plus diffuse, clouds included, on a horizontal surface.",
    whyItMatters:
      "It is closer to a growth resource than total solar energy, which also counts infrared sunlight plants do not use.",
    caveat:
      "Same 1° SRB-then-CERES record as the other surface fluxes, including the product join at the start of 2001. Units are energy, not micromoles of photons.",
    sourceDataset:
      "GEWEX SRB Release 4-IP (1984–2000) and CERES SYN1deg Edition 4.2 (from 2001), 1° grid.",
    recordStartYear: 1984,
  },
];

export function getVariable(id: string): VariableDef | undefined {
  return VARIABLES.find((variable) => variable.id === id);
}
