// One-time setup: fork the upstream repo into the developer's own account and
// wire it up as the `backup` remote. Requires GitHub CLI (`gh`) to be logged in
// (`gh auth login`). Never changes the existing `origin` remote.
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const UPSTREAM = process.env.UPSTREAM_REPO || "totemocreativestudio/ai_affiliate";
const REMOTE = process.env.BACKUP_REMOTE || "backup";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// Selalu jalankan dari direktori netral: `gh repo fork` yang dipanggil di dalam
// sebuah repo akan meng-rename `origin` -> `upstream` dan memasang fork sebagai
// `origin`. Kita tidak mau itu; remote lokal harus utuh.
const NEUTRAL = tmpdir();
const gh = (args) =>
  execFileSync("gh", args, { encoding: "utf8", cwd: NEUTRAL }).trim();

// 0. Pastikan sudah login.
let whoami;
try {
  whoami = execFileSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf8" }).trim();
} catch (err) {
  console.error("fork:setup: `gh` belum login. Jalankan dulu:  gh auth login");
  console.error((err.stderr || err.message || "").toString().trim());
  process.exit(1);
}
console.log(`fork:setup: login sebagai '${whoami}'`);

// 1. Buat fork (idempoten: kalau sudah ada, gh hanya mengembalikan fork itu).
console.log(`fork:setup: membuat/menemukan fork dari ${UPSTREAM} ...`);
try {
  gh(["repo", "fork", UPSTREAM, "--clone=false"]);
} catch (err) {
  const msg = (err.stderr || err.message || "").toString();
  // "already exists" bukan error fatal.
  if (!/already exists|sudah ada/i.test(msg)) {
    console.error("fork:setup: gagal membuat fork.");
    console.error(msg.trim());
    process.exit(1);
  }
}

let forkUrl;
try {
  forkUrl = gh(["repo", "view", `${whoami}/ai_affiliate`, "--json", "url", "--jq", ".url"]);
} catch {
  forkUrl = `https://github.com/${whoami}/ai_affiliate.git`;
}

// 2. Pasang / perbarui remote `backup`.
const remotes = git(["remote"]).split(/\r?\n/).filter(Boolean);
if (remotes.includes(REMOTE)) {
  git(["remote", "set-url", REMOTE, forkUrl]);
  console.log(`fork:setup: remote '${REMOTE}' diperbarui -> ${forkUrl}`);
} else {
  git(["remote", "add", REMOTE, forkUrl]);
  console.log(`fork:setup: remote '${REMOTE}' ditambahkan -> ${forkUrl}`);
}

console.log("");
console.log("fork:setup: SELESAI. Selanjutnya backup dengan:  npm run backup");
console.log(`fork:setup: origin tetap aman -> ${git(["remote", "get-url", "origin"])}`);
