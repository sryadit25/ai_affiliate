// One-way safety mirror. Pushes every local branch + tag to the private backup
// remote so there is always an off-site copy of the work, even if the upstream
// owner rewrites or force-pushes history on origin. Never touches origin.
//
// Setup (once, after `gh auth login`):  npm run fork:setup
// Run manually:                         npm run backup
import { execFileSync } from "node:child_process";

const REMOTE = process.env.BACKUP_REMOTE || "backup";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function tryGit(args) {
  try {
    return { ok: true, out: git(args) };
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || "").toString().trim();
    return { ok: false, out: detail };
  }
}

const remotes = git(["remote"]).split(/\r?\n/).filter(Boolean);
if (!remotes.includes(REMOTE)) {
  console.error(`backup: remote '${REMOTE}' belum ada.`);
  console.error("backup: jalankan dulu:  npm run fork:setup   (butuh `gh auth login`)");
  console.error(`backup: atau manual:    git remote add ${REMOTE} <url-fork-anda>`);
  process.exit(1);
}

const url = git(["remote", "get-url", REMOTE]);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const head = git(["rev-parse", "--short", "HEAD"]);

console.log(`backup: mengirim SEMUA branch + tag ke '${REMOTE}' (${url})`);

// Kirim hanya branch lokal + tag. Sengaja BUKAN `--mirror`, karena `--mirror`
// ikut mendorong ref pelacak `refs/remotes/origin/*` (sampah) ke fork. Tidak
// di-prune: backup hanya menambah/memperbarui, tak pernah menghapus data.
// Tidak pernah menyentuh origin.
const push = tryGit([
  "push",
  REMOTE,
  "--force",
  "+refs/heads/*:refs/heads/*",
  "+refs/tags/*:refs/tags/*",
]);
if (!push.ok) {
  console.error("backup: GAGAL mengirim ke fork.");
  console.error(push.out);
  process.exit(1);
}

console.log(`backup: OK — ${branch}@${head} dan seluruh branch/tag tersimpan di '${REMOTE}'.`);
