/* Lance tous les essais de bout en bout (dev/e2e/*.test.js) l'un après l'autre et résume.
   Usage : EN_PW=/chemin/vers/playwright-core node dev/e2e/run-all.js [filtre] */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const only = process.argv[2] || "";
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js") && f.indexOf(only) >= 0).sort();
let bad = 0;
files.forEach((f) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8", env: process.env });
  const out = (r.stdout || "") + (r.stderr || "");
  const last = out.trim().split("\n").pop() || "";
  const fails = out.split("\n").filter((l) => l.indexOf("ÉCHEC") >= 0);
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log((ok ? "ok    " : "ÉCHEC ") + f.padEnd(26) + " " + last + "  (" + Math.round((Date.now() - t0) / 1000) + " s)");
  fails.forEach((l) => console.log("        " + l.trim()));
  if (!ok && !fails.length) console.log(out.trim().split("\n").slice(-12).map((l) => "        " + l).join("\n"));
});
console.log("\n" + (files.length - bad) + " fichiers d'essai sur " + files.length + " passent.");
process.exit(bad ? 1 : 0);
