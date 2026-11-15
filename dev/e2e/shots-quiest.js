/* Captures d'écran du jeu « Qui de nous deux ? » pour contrôle visuel : une partie à deux téléphones en
   clair et en sombre, puis, en clair, le passage du téléphone et les petits écrans.
   Usage : EN_PW=… node dev/e2e/shots-quiest.js   ->  dev/e2e/shots/quiest-*.png */
const path = require("path");
const { setup, sleep } = require("./lib");

const DATA = path.join(__dirname, "../../jeux/quiest.data.js"), GAME = path.join(__dirname, "../../jeux/quiest.js");
const PA = "aab2a0bbaab22bb", PB = "abb2b0aba2020ab";

async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/quiest.css";
    document.head.appendChild(l);
  }));
  return p;
}
async function answer(p, codes) {
  for (const c of codes) {
    await p.page.waitForSelector(".quiest-card");
    await p.page.click('[data-act="pick"][data-val="' + c + '"]');
    await sleep(270);
  }
}
async function solo(env, name, o, a, b, pack) {
  const p = await phone(env, name, o);
  await p.page.goto(env.base + "#jeu-quiest");
  await p.page.fill("#name-a", a || "Alex");
  await p.page.fill("#name-b", b || "Inès");
  if (pack) await p.page.click('[data-act="g-opt"][data-val="' + pack + '"]');
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector(".quiest-card");
  await sleep(300);
  return p;
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark });
    await a.page.goto(env.base + "#accueil");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await a.page.goto(env.base + "#jeu-quiest");
    await sleep(500);
    await a.shot("quiest-01-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await a.page.waitForSelector(".quiest-card");
    await sleep(400);
    await a.shot("quiest-02-question-" + tag);
    await answer(a, PA.slice(0, 6));
    await sleep(300);
    await a.shot("quiest-03-question-7-" + tag);
    await answer(a, PA.slice(6));
    await a.page.waitForSelector('[data-screen="attente"]');
    await sleep(400);
    await a.shot("quiest-04-attente-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await b.page.waitForSelector(".quiest-card");
    await sleep(300);
    await b.shot("quiest-05-question-b-" + tag);
    await answer(b, PB);
    await b.page.waitForSelector('[data-screen="resultat"]');
    await sleep(400);
    await b.shot("quiest-06-resultat-avant-l-autre-" + tag);
    await a.page.waitForSelector('[data-screen="pret"]');
    await sleep(300);
    await a.shot("quiest-07-pret-" + tag);
    await a.page.click('[data-act="voir"]');
    await a.page.waitForSelector('[data-screen="resultat"]');
    await sleep(400);
    await a.shot("quiest-08-resultat-" + tag);
  }

  const one = await solo(env, "seul", {}, "Alex", "Inès", "coquin");
  await one.shot("quiest-09-seul-coquin");
  await answer(one, "a".repeat(15));
  await one.page.waitForSelector(".g-pass");
  await sleep(300);
  await one.shot("quiest-10-seul-passe");

  for (const [w, h] of [[390, 844], [320, 568]]) {
    const p = await solo(env, "petit-" + w, { viewport: { width: w, height: h }, fullPage: false }, "Marie-Charlotte", "Maximilien");
    await answer(p, "ab");
    /* Une question longue, pour voir si tout tient au-dessus des boutons. */
    await p.page.evaluate(() => { const t = document.querySelector(".quiest-card .g-title"); t.textContent = "Qui répond « je sais pas, et toi ? » à « on mange quoi ? » ?"; });
    await p.shot("quiest-11-question-" + w + "x" + h);
    const d = await phone(env, "petit-sombre-" + w, { viewport: { width: w, height: h }, fullPage: false, dark: true });
    await d.page.goto(env.base + "#jeu-quiest");
    await d.page.fill("#name-a", "Alex");
    await d.page.fill("#name-b", "Inès");
    await d.page.click('[data-act="g-start"][data-mode="solo"]');
    await answer(d, PA);
    await d.page.click('[data-act="moi"]');
    await answer(d, PB);
    await d.page.waitForSelector('[data-screen="resultat"]');
    await sleep(300);
    await d.page.evaluate(() => window.scrollTo(0, 420));
    await sleep(200);
    await d.shot("quiest-12-resultat-sombre-" + w + "x" + h);
  }
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
