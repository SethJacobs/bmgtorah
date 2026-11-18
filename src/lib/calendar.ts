import { HDate, Sedra } from "@hebcal/core";
import { DafYomi } from "@hebcal/learning";
import { MASECHTA_BY_HEBCAL, PARSHA_BY_HEBCAL, type CalName } from "./calendar-names";

/** Parsha(s) for the coming Shabbos (chutz la'aretz reading). Empty on a Yom Tov Shabbos. */
export function parshaOfWeek(date = new Date()): CalName[] {
  try {
    const shabbos = new HDate(date).onOrAfter(6);
    const sedra = new Sedra(shabbos.getFullYear(), false);
    const res = sedra.lookup(shabbos);
    if (res.chag) return [];
    return res.parsha.map((p: string) => PARSHA_BY_HEBCAL[p]).filter(Boolean);
  } catch {
    return [];
  }
}

/** Today's daf in the Daf Yomi cycle, e.g. { masechta: Bava Basra, daf: 34 } */
export function dafYomi(date = new Date()): { masechta: CalName; daf: number } | null {
  try {
    const d = new DafYomi(date);
    const masechta = MASECHTA_BY_HEBCAL[d.getName()];
    return masechta ? { masechta, daf: Number(d.getBlatt()) } : null;
  } catch {
    return null;
  }
}

export function hebrewDate(date = new Date()) {
  try {
    return new HDate(date).renderGematriya(true);
  } catch {
    return "";
  }
}
