/* Outils communs des essais de bout en bout (Playwright, sans navigateur visible).

   Chaque essai lance son propre serveur de fichiers et son propre faux relais sur des
   ports libres, puis ouvre un ou deux « téléphones » : des contextes de navigateur
   isolés (stockage séparé), en taille de mobile, tactiles.

   Lancer un essai :
     EN_PW=/chemin/vers/node_modules/playwright-core node dev/e2e/<nom>.test.js
   (EN_PW est inutile si playwright-core est installé à portée de require.)

   const { setup, check, done } = require("./lib");
   const env = await setup();                       // { base, relayUrl, phone, ctl, close }
   const a = await env.phone("a");                  // { page, ctx, errors, shot }
   await a.page.goto(env.base + "#accueil");
   check(cond, "ce qui est vérifié");
   await done(env);                                 // ferme tout, code de sortie 1 si un check a échoué */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createRelay } = require("../mock-relay");

const pw = require(process.env.EN_PW || "playwright-core");
const ROOT = path.resolve(__dirname, "../..");
const SHOTS = process.env.EN_SHOTS || path.join(ROOT, "dev", "e2e", "shots");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function staticServer(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, p);
    if (file.indexOf(root) !== 0) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end("introuvable : " + p); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  });
}

let failed = 0, passed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  ÉCHEC " + label); }
  return !!cond;
}

/* opts.net : laisse passer les polices et le QR code (utile pour les captures d'écran).
   opts.relay : false pour ne pas brancher le faux relais (essais du mode sans réseau). */
async function setup(opts) {
  opts = opts || {};
  const web = staticServer(ROOT), relay = createRelay();
  const webPort = await listen(web), relayPort = await listen(relay.server);
  /* « localhost » et non 127.0.0.1 : le navigateur y autorise crypto.subtle (contexte sûr). */
  const base = "http://localhost:" + webPort + "/", relayUrl = "http://localhost:" + relayPort + "/";
  const browser = await pw.chromium.launch({ headless: true });
  const phones = [];

  async function phone(name, o) {
    o = o || {};
    const ctx = await browser.newContext({
      viewport: o.viewport || { width: 390, height: 844 },
      deviceScaleFactor: o.scale || 2,
      isMobile: o.mobile !== false,
      hasTouch: o.touch !== false,
      colorScheme: o.dark ? "dark" : "light",
      locale: "fr-FR",
      reducedMotion: o.motion ? "no-preference" : "reduce"
    });
    if (!opts.net) await ctx.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
    /* Le vrai relais ne doit jamais être touché par un essai. */
    await ctx.route(/ntfy\.sh/, (r) => r.abort());
    if (opts.relay !== false) {
      await ctx.addInitScript((u) => { try { localStorage.setItem("en:relay", JSON.stringify(u)); } catch (e) { /* sans importance */ } }, relayUrl);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push("console: " + m.text()); });
    const p = {
      name, ctx, page, errors,
      async shot(label) {
        fs.mkdirSync(SHOTS, { recursive: true });
        const file = path.join(SHOTS, label + ".png");
        await page.screenshot({ path: file, fullPage: o.fullPage !== false });
        return file;
      }
    };
    phones.push(p);
    return p;
  }

  const ctl = async (query) => {
    const res = await fetch(relayUrl + "__ctl" + (query ? "?" + query : ""));
    return res.json();
  };

  async function close() {
    await browser.close();
    await new Promise((r) => web.close(r));
    relay.server.closeAllConnections && relay.server.closeAllConnections();
    await new Promise((r) => relay.server.close(r));
  }

  return { base, relayUrl, browser, phone, phones, ctl, close };
}

/* Termine un essai : vérifie qu'aucun téléphone n'a levé d'erreur JavaScript. */
async function done(env) {
  env.phones.forEach((p) => check(p.errors.length === 0, "aucune erreur JavaScript sur le téléphone " + p.name + (p.errors.length ? " : " + p.errors.join(" | ") : "")));
  await env.close();
  console.log("\n" + passed + " vérifications réussies, " + failed + " en échec");
  process.exit(failed ? 1 : 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { setup, check, done, sleep, ROOT, SHOTS };
