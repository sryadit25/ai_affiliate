// Regression check for the affiliate table numeric handling.
// Numeric columns sometimes hold the formatted strings spreadsheets produce:
// "1.300", "Rp 12.000", "12,5", "(1.500)". Number() returns NaN for those, so the
// old sorter fell back to localeCompare and ordered rows as text -- "12.500"
// landed below "9", and the display collapsed the value to Rp 0.
import { readNumber, sortByValue } from "../lib/numeric.ts";

// 1. Formatted money strings are read as numbers, not NaN.
const cases = [
  ["1.300", 1300], ["1,300", 1300], ["Rp 1.300", 1300], ["12.500", 12500],
  ["1.234.567", 1234567], ["12,5", 12.5], ["1.234,56", 1234.56],
  ["1,234.56", 1234.56], ["(1.500)", -1500], ["-1.500", -1500],
  ["abc", 0], [null, 0], [undefined, 0], ["", 0], ["-", 0], ["N/A", 0],
];
for (const [input, want] of cases) {
  const got = readNumber(input);
  console.log(`readNumber(${JSON.stringify(input)}) = ${got}`);
  console.assert(got === want, `readNumber(${JSON.stringify(input)}) should be ${want}, got ${got}`);
}

// 2. Plain numbers and numeric types survive untouched.
console.assert(readNumber(1500) === 1500, "plain number");
console.assert(readNumber(0) === 0, "zero");

// 3. Numeric columns sort by magnitude, not as text.
const rows = [{ qty: "9" }, { qty: "10" }, { qty: "1.300" }, { qty: "12.500" }];
const desc = sortByValue(rows, "qty", false).map((r) => r.qty);
const asc = sortByValue(rows, "qty", true).map((r) => r.qty);
console.log("desc qty:", desc.join(" "));
console.log("asc  qty:", asc.join(" "));
console.assert(JSON.stringify(desc) === JSON.stringify(["12.500", "1.300", "10", "9"]), "desc numeric sort");
console.assert(JSON.stringify(asc) === JSON.stringify(["9", "10", "1.300", "12.500"]), "asc numeric sort");

// 4. A text column still sorts alphabetically.
const names = [{ n: "Zaki" }, { n: "Andi" }, { n: "Budi" }];
const sortedNames = sortByValue(names, "n", true).map((r) => r.n);
console.log("asc name:", sortedNames.join(" "));
console.assert(JSON.stringify(sortedNames) === JSON.stringify(["Andi", "Budi", "Zaki"]), "text sort");

console.log("OK: affiliate table numeric handling");
