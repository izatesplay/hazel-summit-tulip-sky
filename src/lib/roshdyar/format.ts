const TEHRAN = "Asia/Tehran";

export function tehranDayKey(input: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(input));
}

export function tehranMonthKey(input: string | Date) {
  const key = tehranDayKey(input);
  return key.slice(0, 7);
}

/** Wall-clock datetime in Asia/Tehran, stable for a whole calendar day. */
export function atTehran(dayOffset: number, hour = 10) {
  const [y, m, d] = tehranDayKey(new Date()).split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d + dayOffset, hour, 0, 0) - (3 * 60 + 30) * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function daysSince(iso: string) {
  const a = Date.parse(`${tehranDayKey(iso)}T00:00:00Z`);
  const b = Date.parse(`${tehranDayKey(new Date())}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatToman(n: number) {
  return new Intl.NumberFormat("fa-IR").format(Math.round(n));
}

export function formatTomanShort(n: number) {
  const abs = Math.abs(Math.round(n));
  const fmt = (v: number) =>
    new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(v);
  if (abs >= 1_000_000_000) return `${fmt(abs / 1_000_000_000)} میلیارد`;
  if (abs >= 1_000_000) return `${fmt(abs / 1_000_000)} میلیون`;
  return formatToman(abs);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeZone: TEHRAN,
  }).format(new Date(iso));
}

export function formatTodayLabel() {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TEHRAN,
  }).format(new Date());
}

export function persianYear(date = new Date()) {
  const y = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    timeZone: TEHRAN,
  }).format(date);
  return y.replace(/[^\d]/g, "");
}

export function faDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

export function normalizePhone(input: string) {
  let s = input.trim();
  s = s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+98")) s = `0${s.slice(3)}`;
  else if (s.startsWith("0098")) s = `0${s.slice(4)}`;
  else if (s.startsWith("98") && s.length >= 12) s = `0${s.slice(2)}`;
  return s;
}

export function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

export function isSameTehranDay(iso: string, dayOffset = 0) {
  return tehranDayKey(iso) === tehranDayKey(atTehran(dayOffset));
}

export function isBeforeToday(iso: string) {
  return tehranDayKey(iso) < tehranDayKey(new Date());
}
