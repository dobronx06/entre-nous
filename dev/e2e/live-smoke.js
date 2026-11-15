/* Essai de fumée sur le site en ligne, avec le VRAI relais : deux téléphones, une manche de
   « Sur la même longueur d'onde ». À lancer à la main après une mise en ligne, avec parcimonie :
   chaque passage dépose une dizaine de messages sur le quota quotidien du relais.
   Usage : EN_PW=… node dev/e2e/live-smoke.js https://dobronx06.github.io/entre-nous/ */
const pw = require(process.env.EN_PW || "playwright-core");

const base = process.argv[2];
if (!/^https:\/\//.test(base || "")) { console.error("Indique l'adresse du site en ligne (https://…)."); process.exit(2); }

let failed = 0;
const check = (cond, label) => { console.log((cond ? "  ok    " : "  ÉCHEC ") + label); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine */ }
    if (Date.now() - t0 > ms) return false;
    await sleep(250);
  }
}

(async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const phone = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    return { page, errors };
  };
  const a = await phone(), b = await phone();
  await a.page.goto(base + "#jeu-onde");
  await a.page.fill("#name-a", "Essai A");
  await a.page.fill("#name-b", "Essai B");
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  check(/#g=/.test(link || ""), "le lien d'invitation est proposé");
  check(await a.page.locator(".qr").count() === 1, "le QR code s'affiche");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  check(await until(() => a.page.locator(".onde-form").count(), 15000), "la partie démarre chez l'hôte quand l'invité arrive");
  check(await until(() => a.page.locator('.g-top [data-net="ok"]').count(), 15000) && await until(() => b.page.locator('.g-top [data-net="ok"]').count(), 15000), "les deux téléphones sont reliés au relais");
  for (const p of [a, b]) {
    await p.page.fill(".onde-form .g-field", "Essai");
    await p.page.press(".onde-form .g-field", "Enter");
  }
  check(await until(async () => (await a.page.locator(".onde-pair").count()) && (await b.page.locator(".onde-pair").count()), 15000), "la révélation s'ouvre sur les deux téléphones");
  check(a.errors.length + b.errors.length === 0, "aucune erreur JavaScript" + (a.errors.concat(b.errors).length ? " : " + a.errors.concat(b.errors).join(" | ") : ""));
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
