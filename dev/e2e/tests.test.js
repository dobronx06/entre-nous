/* Essai de non-régression des tests à deux : un test complet sur un seul appareil,
   puis le même à deux téléphones par le salon chiffré (faux relais). */
const { setup, check, done } = require("./lib");

const TEST = "voyages";

async function answerAll(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator(".opt").nth(i % 3).click();
    await page.waitForTimeout(260);
  }
}

(async () => {
  const env = await setup();

  console.log("Un seul appareil, chacun son tour");
  const solo = await env.phone("solo");
  await solo.page.goto(env.base + "#test-" + TEST);
  const total = parseInt(await solo.page.locator(".facts li b").first().textContent(), 10);
  check(total > 0, "la présentation annonce " + total + " questions");
  await solo.page.fill("#name-a", "Alex");
  await solo.page.fill("#name-b", "Inès");
  await solo.page.click('[data-act="start"][data-mode="same"]');
  await answerAll(solo.page, total);
  check(await solo.page.locator(".handoff").count() === 1, "le passage de main s'affiche après la première personne");
  await solo.page.click('[data-act="resume"]');
  await answerAll(solo.page, total);
  await solo.page.waitForSelector(".report");
  check(/\d+\s*%/.test(await solo.page.locator(".hero-num").textContent()), "le rapport affiche un pourcentage");
  check((await solo.page.locator(".rep-head h1").textContent()).includes("Alex"), "le rapport reprend les prénoms");

  console.log("Deux téléphones, en même temps");
  const a = await env.phone("a"), b = await env.phone("b");
  await a.page.goto(env.base + "#test-" + TEST);
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="start"][data-mode="room"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  check(/#j=/.test(link || ""), "le lien d'invitation est proposé avant de répondre");
  await b.page.goto(link);
  await b.page.click('[data-act="start"][data-mode="join"]');
  await a.page.click('[data-act="resume"]');
  await Promise.all([answerAll(a.page, total), answerAll(b.page, total)]);
  await Promise.all([a.page.waitForSelector(".report", { timeout: 30000 }), b.page.waitForSelector(".report", { timeout: 30000 })]);
  const pa = await a.page.locator(".hero-num").textContent(), pb = await b.page.locator(".hero-num").textContent();
  check(pa === pb, "les deux téléphones affichent le même rapport (" + pa.trim() + ")");
  const st = await env.ctl();
  check(st.count.post === 2, "deux messages chiffrés déposés sur le relais (" + st.count.post + ")");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
