// Numeric columns in the affiliate tables sometimes arrive as the formatted
// strings that spreadsheets produce: "1.300", "Rp 12.000", "12,5", "(1.500)".
// Number() returns NaN for all of those, so the tables used to fall back to
// localeCompare and order rows as text -- "12.500" landed below "9".
export function readNumber(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw || /^(-|--|—|–|n\/?a|null|none)$/i.test(raw)) return 0;

  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  let s = raw
    .replace(/\u00a0/g, " ")
    .replace(/rp\s*/gi, "")
    .replace(/[\s']/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/^-/, "");
  if (!s) return 0;

  const comma = s.lastIndexOf(","), dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    // Both separators present: the final one is decimal only for a 1-2 digit
    // suffix, otherwise both are thousands groups (1.234,56 / 1,234.56).
    const last = Math.max(comma, dot);
    const suffix = s.slice(last + 1);
    const decimalSep = comma > dot ? "," : ".";
    const groupSep = decimalSep === "," ? "." : ",";
    s = suffix.length > 0 && suffix.length <= 2
      ? s.split(groupSep).join("").replace(decimalSep, ".")
      : s.replace(/[.,]/g, "");
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? "," : ".";
    const parts = s.split(sep);
    const right = parts.slice(1);
    if (right.length > 1 && right.every((p) => p.length === 3)) {
      s = parts.join("");            // 1.234.567 grouping
    } else if (right.length === 1 && right[0].length === 3) {
      s = parts[0] + right[0];        // 1.300 / 1,300 thousands group
    } else {
      s = parts.join(".") + (right.length ? "" : ""); // 12,5 -> 12.5
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
}

// True only when the value actually carries digits. readNumber("Zaki") is 0,
// so checking for a finite result alone would misclassify every text column.
function looksNumeric(v: any): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (v == null) return false;
  return /\d/.test(String(v));
}

// Numeric-aware sort for table columns. Columns whose values are all numeric
// sort by magnitude; mixed columns fall back to a locale compare.
export function sortByValue<T extends Record<string, any>>(rows: T[], key: string, asc: boolean): T[] {
  const numeric = rows.some((r) => looksNumeric(r?.[key]));
  const dir = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a?.[key], bv = b?.[key];
    if (numeric) return (readNumber(av) - readNumber(bv)) * dir;
    return String(av ?? "").localeCompare(String(bv ?? ""), "id", { numeric: true, sensitivity: "base" }) * dir;
  });
}
