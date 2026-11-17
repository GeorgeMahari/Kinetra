/** Reference standards (backend/app/modules/assessments/engine/references.py), from data.json. */
import data from "./data.json" with { type: "json" };

export interface Reference {
  id: string;
  citation: string;
  url: string;
  note: string;
  approximate: boolean;
}

export interface Interpretation {
  reference_id: string;
  scheme: string;
  label: string;
  detail: Record<string, unknown>;
}

export const ALL = data.references as Record<string, Reference>;

/** Reference ids by their Python constant name. */
export const REF = {
  FRIEND_2015: "friend_2015_treadmill",
  COOPER_1968: "cooper_1968",
  WHO_BMI: "who_bmi_adults",
  NICE_WHTR: "nice_ng246_whtr",
  NHANES_RHR: id("NHANES_RHR"),
  TVETER_2014: id("TVETER_2014"),
  STRAND_2014: id("STRAND_2014"),
  CSEP_PUSHUPS: id("CSEP_PUSHUPS"),
  CHMS_SIT_REACH: id("CHMS_SIT_REACH"),
  SPRINGER_2007: id("SPRINGER_2007"),
  YMCA_STEP: id("YMCA_STEP"),
  MARIN_JIMENEZ_2024: id("MARIN_JIMENEZ_2024"),
  MARKOVIC_2004: id("MARKOVIC_2004"),
  BARRERA_505_2025: id("BARRERA_505_2025"),
  HAUGEN_BUCHHEIT_2016: id("HAUGEN_BUCHHEIT_2016"),
  ECKNER_2011: id("ECKNER_2011"),
  ALBRECHT_2021: id("ALBRECHT_2021"),
  PLISKY_2006: id("PLISKY_2006"),
  MUNRO_HERRINGTON_2011: id("MUNRO_HERRINGTON_2011"),
  NACHER_2026: id("NACHER_2026"),
  CONLEY_1991: id("CONLEY_1991"),
};

function id(constant: string): string {
  const names = data.reference_constants as Record<string, string>;
  return names[constant];
}

export const FRIEND_PERCENTILES = data.friend_percentiles as number[];
export const FRIEND_TREADMILL = data.friend_treadmill as unknown as Record<string, [number, number, number[]][]>;
