// Self-check for localizePublicAsset. The regression it guards is subtle: blog
// cover rows store absolute URLs against app.lumaway.online, and a pattern that
// only matched the public hosts left that origin in the src, so the browser
// requested app.lumaway.online/web/insights/<file>.svg and every cover broke.
// Run with: node scripts/check-public-assets.mjs
import assert from "node:assert/strict";

// Import the real module. Node strips TypeScript annotations natively, so the
// check exercises the shipped code rather than a copy that can drift.
const { localizePublicAsset } = await import("../lib/public-insights.ts");

const cases = [
  // Stored rows use the app subdomain; the path must survive intact.
  ["https://app.lumaway.online/insights/01-cara-upload-data-affiliate.svg", "/insights/01-cara-upload-data-affiliate.svg"],
  ["https://www.lumaway.online/insights/09-data-health.svg", "/insights/09-data-health.svg"],
  ["https://lumaway.online/insights/09-data-health.svg", "/insights/09-data-health.svg"],
  // A path must never grow a /web prefix.
  ["/insights/03-kpi.svg", "/insights/03-kpi.svg"],
  // Unrelated origins are left untouched.
  ["https://cdn.example.com/a.svg", "https://cdn.example.com/a.svg"],
  ["https://lumaway.co/insights/a.svg", "https://lumaway.co/insights/a.svg"],
];

for (const [input, expected] of cases) {
  const actual = localizePublicAsset(input);
  assert.equal(actual, expected, `localizePublicAsset(${input})`);
}

console.log(`public asset check passed: ${cases.length} cases`);
