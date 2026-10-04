// Watches references/f2.pdf (the user's problem file) for new text or images.
// The PDF is re-saved by hand with fresh screenshots and complaint text, so a
// content hash is the reliable signal; mtime alone misses same-size saves.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "C:/Users/Surya/OneDrive/Documents/project/ai_affiliate";
const PDF = `${ROOT}/references/f2.pdf`;
const STATE = `${ROOT}/.f2-watcher-state.json`;

if (!existsSync(PDF)) {
  console.log("f2.pdf tidak ada di references/. Tidak ada yang perlu diperiksa.");
  process.exit(0);
}

const bytes = readFileSync(PDF);
const sha = createHash("sha256").update(bytes).digest("hex");

const previous = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;

writeFileSync(STATE, JSON.stringify({ sha, size: bytes.length, seenAt: new Date().toISOString() }, null, 2));

if (!previous) {
  console.log(`Baseline baru tercatat: ${bytes.length} bytes, sha ${sha.slice(0, 12)}`);
  console.log("Jalankan lagi setelah f2.pdf diperbarui untuk melihat perbedaannya.");
  process.exit(0);
}

if (previous.sha === sha) {
  console.log(`f2.pdf tidak berubah sejak ${previous.seenAt}.`);
  process.exit(0);
}

console.log(`f2.pdf BERUBA: ${previous.size} -> ${bytes.length} bytes`);
console.log(`sha ${previous.sha.slice(0, 12)} -> ${sha.slice(0, 12)}`);

// Extract the text so the new complaints can be read without opening the PDF.
const text = execFileSync("python", ["-c", `
from pypdf import PdfReader
import sys
r = PdfReader(r"${PDF.replace(/\//g, "\\\\")}")
print("PAGES:", len(r.pages))
for i, p in enumerate(r.pages):
    t = (p.extract_text() or "").strip()
    imgs = len(list(p.images))
    print(f"--- page {i+1} ({imgs} image) ---")
    print(t)
`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

console.log("\n=== ISI PDF SEKARANG ===");
console.log(text);

// Save embedded images so they can be inspected if the complaint is visual.
const OUT = `${ROOT}/.f2-images`;
mkdirSync(OUT, { recursive: true });
const script = `
from pypdf import PdfReader
r = PdfReader(r"${PDF.replace(/\//g, "\\\\")}")
for i, p in enumerate(r.pages):
    for j, im in enumerate(p.images):
        open(r"${OUT.replace(/\//g, "\\\\")}\\\\p%d_%d_%s" % (i+1, j, im.name), "wb").write(im.data)
        print("p%d_%d_%s" % (i+1, j, im.name))
`;
const saved = execFileSync("python", ["-c", script], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
console.log(`\nGambar diekstrak ke .f2-images/ (${saved.length}): ${saved.join(", ")}`);
console.log(`Folder: ${dirname(PDF)}/.. -> ${OUT}`);
