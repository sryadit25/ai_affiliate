import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`Lumaway route check failed: ${message}`);
  process.exitCode = 1;
};
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(relative);
  return [relative.replaceAll("\\", "/")];
});

const navigation = read("lib/luma-navigation.ts");
const rootPage = read("app/page.tsx");
const appShell = read("app/LumawayWorkspaceApp.tsx");
const catchAll = read("app/app.lumaway/[[...route]]/page.tsx");
const sidebar = read("app/components/LumaSidebar.tsx");
const notifications = read("app/components/NotificationCenter.tsx");
const analytics = read("app/components/AIAnalytics.tsx");
const finalCss = read("app/luma-final-fixes.css");
const serviceWorker = read("public/sw.js");

if (!navigation.includes('export const APP_BASE = ""')) {
  fail("APP_BASE must use clean paths for app.lumaway.online");
}

for (const route of [
  "dashboard",
  "upload",
  "excel-sync",
  "database",
  "ai-analytics",
  "promo-studio",
  "kanban",
  "support-tickets",
  "billing",
  "social-lumaway",
  "profile",
  "administration",
]) {
  if (!navigation.includes(`\"${route}\"`) && !navigation.includes(`${route}:`)) {
    fail(`missing route mapping: ${route}`);
  }
}

if (!exists("app/LumawayWorkspaceApp.tsx")) {
  fail("Lumaway workspace app shell is missing");
}
if (!rootPage.includes('redirect("/web/home")')) {
  fail("root public domain must enter the Lumaway landing page");
}
if (!exists("proxy.ts")) {
  fail("hostname routing proxy is missing");
} else {
  const proxy = read("proxy.ts");
  if (!proxy.includes('APP_HOST="app.lumaway.online"')) fail("proxy must target app.lumaway.online");
  if (!proxy.includes('/app.lumaway')) fail("proxy must preserve legacy /app.lumaway compatibility");
  if (!proxy.includes("NextResponse.rewrite")) fail("proxy must rewrite clean app-subdomain routes internally");
}
if (!exists("app/app.lumaway/[[...route]]/page.tsx")) {
  fail("Lumaway catch-all route is missing");
}
if (!catchAll.includes('LumawayWorkspaceApp')) {
  fail("Lumaway catch-all route must render the workspace app shell");
}
if (!exists("app/app.lumaway/[[...route]]/loading.tsx")) {
  fail("route-level Lumaway loading state is missing");
}
if (exists("app/app.lumaway/[[...slug]]/page.tsx")) {
  fail("duplicate catch-all route [[...slug]] must not exist");
}

if (!appShell.includes("routeForSection(legacyHash)")) {
  fail("legacy hash migration must remain available");
}
if (!appShell.includes('navigateToSection(target, { replace: true })')) {
  fail("post-login navigation must resolve through path-based routing");
}
if (!appShell.includes('`${APP_BASE}/login`') || !appShell.includes('`${APP_BASE}/register`')) {
  fail("login/register must resolve through APP_BASE clean paths");
}

for (const [legacyPath, target] of [
  ["app/login/page.tsx", "/app.lumaway/login"],
  ["app/register/page.tsx", "/app.lumaway/register"],
]) {
  if (!exists(legacyPath) || !read(legacyPath).includes(target)) {
    fail(`${legacyPath} must redirect to ${target}`);
  }
}

if (!navigation.includes('value === "/?auth=signin"') || !navigation.includes('value === "/?auth=signup"')) {
  fail("legacy root auth URLs must normalize to Lumaway login/register");
}

// Dashboard navigation must not reintroduce hash anchors. Legacy hash handling is allowed only in the app shell/navigation compatibility layer.
// Skip links (href="#main-content") in public web pages are valid accessibility patterns.
for (const file of walk("app").filter((file) => /\.(tsx|ts|jsx|js)$/.test(file))) {
  if (file === "app/LumawayWorkspaceApp.tsx") continue;
  if (file.startsWith("app/web/")) continue;
  const source = read(file);
  if (/href\s*=\s*["'`]#/.test(source) || /href\s*=\s*\{\s*["'`]#/.test(source)) {
    fail(`hash href is not allowed in dashboard source: ${file}`);
  }
}

if (!sidebar.includes('className="sidebar-edge-collapse"')) {
  fail("desktop sidebar expand/minimize control is missing");
}
if (!sidebar.includes('className="mobile-sidebar-trigger"')) {
  fail("mobile sidebar trigger is missing");
}
if (!notifications.includes('<LumaIcon name="bell" />')) {
  fail("notification control must render the Lumaway bell icon");
}

if (!analytics.includes("history-hamburger-trigger")) {
  fail("analysis history hamburger trigger is missing");
}
if (!analytics.includes("ai-history-row-menu") || !finalCss.includes(".history-hamburger-trigger") || !finalCss.includes(".ai-history-row-menu")) {
  fail("analysis history hamburger menu styles/actions are missing");
}
if (!finalCss.includes(".sidebar-edge-collapse{position:absolute")) {
  fail("sidebar expand/minimize control must live on the sidebar edge");
}
if (!appShell.includes('document.documentElement.dataset.theme = "light"')) {
  fail("Lumaway must stay in stable light-only mode");
}

if (!serviceWorker.includes('const CACHE = "lumaway-shell-v5"')) {
  fail("service worker cache version must match the light-only production shell");
}
if (serviceWorker.includes('caches.match("/")')) {
  fail("service worker must not use the root route as an offline navigation fallback");
}
if (!serviceWorker.includes('fetch(request, { cache: "no-store" })')) {
  fail("navigation requests must prefer the latest server shell");
}
if (!serviceWorker.includes('url.pathname.startsWith("/_next/")')) {
  fail("service worker must explicitly bypass Next.js chunk caching");
}

if (!process.exitCode) {
  console.log("Lumaway route/UI regression checks passed.");
}
