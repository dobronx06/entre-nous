/* Captures d'écran du jeu « L'histoire à quatre mains » pour contrôle visuel : une histoire à deux téléphones
   en clair et en sombre, puis, en clair, ce qui ne se voit que sur un seul téléphone ou sur un petit écran.
   Le jeu n'est pas (encore) dans index.html : le script l'injecte, styles compris.
   Usage : EN_PW=… node dev/e2e/shots-histoire.js   ->  dev/e2e/shots/histoire-*.png */
const path = require("path");
const { setup, sleep, ROOT } = require("./lib");

const DATA = path.join(ROOT, "jeux", "histoire.data.js"), GAME = path.join(ROOT, "jeux", "histoire.js");
const STORY = [
  "Le directeur, très ému, lui proposa un café et un prêt immobilier.",
  "Le pigeon refusa le café, mais demanda si le taux était fixe.",
  "Pendant ce temps, dans la file d'attente, une dame tricotait un pull pour son cactus.",
  "Le cactus, lui, rêvait d'ouvrir un compte épargne.",
  "C'est alors que les lumières s'éteignirent d'un coup.",
  "Quand elles se rallumèrent, le coffre-fort était plein de graines.",
  "Tout le monde regarda le pigeon, qui siffla d'un air innocent.",
  "Depuis ce jour, la banque n'ouvre plus que le dimanche, pour les oiseaux."
];

async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/histoire.css";
    document.head.appendChild(l);
  }));
  return p;
}
async function write(p, t) {
  await p.page.waitForSelector(".histoire-field");
  await p.page.fill(".histoire-field", t);
  await p.page.click(".histoire-form .btn");
}
async function solo(p, env, len) {
  await p.page.goto(env.base + "#jeu-histoire");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  await p.page.click('[data-act="g-opt"][data-val="' + len + '"]');
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector("main.game [data-screen]");
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark });
    await a.page.goto(env.base + "#jeu-histoire");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await a.page.click('[data-act="g-opt"][data-val="8"]');
    await sleep(300);
    await a.shot("histoire-01-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await a.page.waitForSelector(".histoire");
    await b.page.waitForSelector(".histoire");
    await sleep(800);
    const P = (await a.page.locator(".histoire-field").count()) ? [a, b] : [b, a];
    await P[0].shot("histoire-02-premiere-phrase-" + tag);
    await P[1].shot("histoire-03-attente-debut-" + tag);
    for (let i = 0; i < 8; i++) {
      const w = P[i % 2], o = P[1 - (i % 2)];
      if (i === 3) {
        await w.page.fill(".histoire-field", "Il fallait faire vite, avant que");
        await sleep(300);
        await w.shot("histoire-05-ecrire-suite-" + tag);
      }
      if (i === 7) { await w.page.waitForSelector(".histoire-field"); await w.shot("histoire-06-derniere-" + tag); }
      await write(w, STORY[i]);
      if (i === 2) { await sleep(500); await w.shot("histoire-04-attente-" + tag); }
      if (i < 7) await o.page.waitForSelector(".histoire-field");
    }
    await a.page.waitForSelector('[data-screen="fin"]');
    await sleep(500);
    await a.shot("histoire-07-complete-" + tag);
    await a.page.click('[data-act="lire"]');
    await sleep(500);
    await a.shot("histoire-08-lecture-debut-" + tag);
    for (let r = 0; r < 3; r++) await a.page.click('[data-act="suite"]');
    await sleep(500);
    await a.shot("histoire-09-lecture-" + tag);
    for (let r = 3; r <= 8; r++) await a.page.click('[data-act="suite"]');
    await a.page.waitForSelector('[data-screen="histoire"]');
    await sleep(400);
    await a.shot("histoire-10-histoire-avant-l-autre-" + tag);
    await b.page.click('[data-act="lire"]');
    for (let r = 0; r <= 8; r++) await b.page.click('[data-act="suite"]');
    await a.page.waitForSelector('[data-act="again"]');
    await sleep(400);
    await a.shot("histoire-11-histoire-" + tag);
    await a.page.click('[data-act="g-stop"]');
    await sleep(600);
    await a.page.click('[data-act="g-stop"]');
    await a.page.waitForSelector("[data-extra]");
    await a.page.click(".histoire-kept > summary");
    await a.page.click(".histoire-old > summary");
    await sleep(300);
    await a.shot("histoire-12-nos-histoires-" + tag);
  }

  const one = await phone(env, "seul");
  await solo(one, env, "12");
  await one.shot("histoire-13-seul-passe");
  await one.page.click('[data-act="moi"]');
  await write(one, STORY[0]);
  await one.page.waitForSelector(".g-pass");
  await one.page.click('[data-act="moi"]');
  await one.page.waitForSelector(".histoire-field");
  await one.shot("histoire-14-seul-second");

  /* Le plus étroit des téléphones : la phrase à continuer et le champ doivent tenir. */
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const small = await phone(env, "petit-" + w, { viewport: { width: w, height: h }, fullPage: false });
    await solo(small, env, "8");
    for (let i = 0; i < 8; i++) {
      await small.page.click('[data-act="moi"]');
      if (i === 1) { await small.page.waitForSelector(".histoire-field"); await small.shot("histoire-15-" + w + "x" + h + "-ecrire"); }
      await write(small, STORY[i]);
    }
    await small.page.click('[data-act="lire"]');
    for (let r = 0; r < 4; r++) await small.page.click('[data-act="suite"]');
    await sleep(400);
    await small.shot("histoire-16-" + w + "x" + h + "-lecture");
    for (let r = 4; r <= 8; r++) await small.page.click('[data-act="suite"]');
    await sleep(400);
    await small.shot("histoire-17-" + w + "x" + h + "-histoire");
  }

  const empty = await env.phone("sans-debuts");
  await empty.ctx.addInitScript(() => { (window.GAME_DATA = window.GAME_DATA || {}).histoire = { starts: [] }; });
  await empty.ctx.addInitScript({ path: GAME });
  await solo(empty, env, "8");
  await sleep(300);
  await empty.shot("histoire-18-sans-debuts");
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
