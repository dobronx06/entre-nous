/* Captures d'écran du jeu « Dessine-moi » (clair et sombre, téléphone, petit téléphone, ordinateur) pour contrôle visuel.
   Usage : EN_PW=… node dev/e2e/shots-dessin.js   ->  dev/e2e/shots/dessin-*.png */
const path = require("path");
const { setup, sleep, SHOTS } = require("./lib");

function fixture() {
  if (window.GAME_DATA && window.GAME_DATA.dessin) return;
  const list = ["{o} au réveil", "La grimace préférée {de_o}", "Votre premier rendez-vous", "Le voyage de vos rêves", "L'animal que vous formez à deux", "{o} à la chasse au moustique, en pleine nuit"];
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.dessin = { prompts: ["portrait", "souvenir", "futur", "delire"].reduce((all, c) => all.concat(list.map((x, i) => ({ c, x: i < 2 || i > 4 ? x : x + " (" + c + ")" }))), []) };
}
const arc = (cx, cy, r, from, to) => Array.from({ length: 31 }, (_, i) => [cx + r * Math.cos(from + ((to - from) * i) / 30), cy + r * Math.sin(from + ((to - from) * i) / 30)]);
const zig = (x, y, w, h, n) => Array.from({ length: n + 1 }, (_, i) => [x + (w * i) / n, y + (i % 2 ? -h : 0)]);
async function stroke(p, pts, ink, size) {
  if (ink != null) await p.page.click('[data-act="ink"][data-v="' + ink + '"]');
  if (size != null) await p.page.click('[data-act="size"][data-v="' + size + '"]');
  const b = await p.page.locator(".dessin-sheet").boundingBox(), at = (q) => [b.x + q[0] * b.width, b.y + q[1] * b.height];
  await p.page.mouse.move(...at(pts[0]));
  await p.page.mouse.down();
  for (const q of pts.slice(1)) await p.page.mouse.move(...at(q), { steps: 3 });
  await p.page.mouse.up();
}
/* Un bonhomme vite fait, pour que les captures ressemblent à une vraie partie. */
async function portrait(p, hair, glasses) {
  await stroke(p, arc(0.5, 0.42, 0.24, -1.7, 4.7), 0, 0);
  await stroke(p, arc(0.41, 0.37, glasses ? 0.06 : 0.02, 0, 6.4));
  await stroke(p, arc(0.59, 0.37, glasses ? 0.06 : 0.02, 0, 6.4));
  if (glasses) await stroke(p, [[0.47, 0.37], [0.53, 0.37]]);
  await stroke(p, arc(0.5, 0.45, 0.12, 0.5, 2.6));
  await stroke(p, zig(0.28, 0.24, 0.44, 0.1, 9), hair, 1);
  await stroke(p, [[0.5, 0.66], [0.5, 0.9]], 1, 1);
  await stroke(p, [[0.3, 0.74], [0.5, 0.72], [0.7, 0.76]]);
  await stroke(p, arc(0.83, 0.14, 0.07, 0, 6.4), 5, 1);
}
async function begin(p) {
  await p.page.waitForSelector('[data-act="start"]');
  /* Après le passage du téléphone, le bouton « à moi » ne répond qu'au bout d'une seconde. */
  await sleep(await p.page.locator(".g-pass").count() ? 1100 : 450);
  await p.page.click('[data-act="start"]');
  await p.page.waitForSelector(".dessin-sheet");
  await sleep(450);
}
async function round(p, hair) {
  for (const glasses of [false, true]) {
    await begin(p);
    await portrait(p, hair, glasses);
    await p.page.click('[data-act="done"]');
  }
  await p.page.waitForSelector(".dessin-pair");
}
async function prepare(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  return p;
}
async function solo(p, base, a, b, opts) {
  await p.page.goto(base + "#jeu-dessin");
  await p.page.fill("#name-a", a);
  await p.page.fill("#name-b", b);
  for (const v of opts) await p.page.click('[data-act="g-opt"][data-val="' + v + '"]');
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector('[data-act="start"]');
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await prepare(env, "a-" + tag, { dark }), b = await prepare(env, "b-" + tag, { dark }), s = await prepare(env, "seul-" + tag, { dark });
    await a.page.goto(env.base + "#accueil");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(800);
    await a.page.locator('article.card:has(a[href="#jeu-dessin"])').screenshot({ path: path.join(SHOTS, "dessin-1-carte-" + tag + ".png") });
    await a.page.goto(env.base + "#jeu-dessin");
    await sleep(300);
    await a.shot("dessin-2-presentation-" + tag);
    await a.page.click('[data-act="g-opt"][data-val="portrait"]');
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    await sleep(400);
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await a.page.waitForSelector('[data-act="start"]');
    await a.shot("dessin-3-pret-" + tag);
    await begin(a);
    await portrait(a, 2, false);
    await a.page.click('[data-act="clear"]');
    await a.shot("dessin-4-dessin-" + tag);
    await a.page.click('[data-act="done"]');
    await a.page.waitForSelector(".g-wait");
    await a.shot("dessin-5-attente-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await begin(b);
    await portrait(b, 3, true);
    await b.page.click('[data-act="done"]');
    await b.page.waitForSelector(".dessin-pair");
    await sleep(600);
    await b.shot("dessin-6-revelation-" + tag);
    await sleep(600);
    await b.page.click('[data-act="next"]');
    await a.page.waitForSelector(".dessin > .hint");
    await a.shot("dessin-6-suite-" + tag);

    await solo(s, env.base, "Alex", "Inès", ["0", "delire"]);
    await begin(s);
    await portrait(s, 4, false);
    await s.page.click('[data-act="done"]');
    await s.page.waitForSelector(".g-pass");
    await s.shot("dessin-7-passage-" + tag);
    await begin(s);
    await portrait(s, 1, true);
    await s.page.click('[data-act="done"]');
    await s.page.waitForSelector(".dessin-pair");
    await sleep(1100);
    await s.page.click('[data-act="next"]');
    await round(s, 3);
    await sleep(1100);
    await s.page.click('[data-act="next"]');
    await s.page.waitForSelector('[data-act="start"]');
    await s.page.evaluate(() => { const g = JSON.parse(localStorage.getItem("en:g:dessin")); g.sh = { r: 999 }; localStorage.setItem("en:g:dessin", JSON.stringify(g)); });
    await s.page.reload();
    await s.page.waitForSelector('[data-act="again"]');
    await s.shot("dessin-8-fin-" + tag);
    await s.page.click('.g-foot [data-act="g-stop"]');
    await s.page.click('.g-foot [data-act="g-stop"]');
    await s.page.waitForSelector(".dessin-gal");
    await s.page.click(".dessin-gal summary");
    await sleep(300);
    await s.shot("dessin-9-galerie-" + tag);
  }

  /* Petit téléphone, barres du navigateur visibles, prénom et sujet longs : tout doit rester à portée de pouce. */
  const small = await prepare(env, "petit", { viewport: { width: 360, height: 560 }, fullPage: false });
  await solo(small, env.base, "Marie-Antoinette", "Jean-Christophe", ["30", "portrait"]);
  await begin(small);
  await portrait(small, 2, false);
  await small.shot("dessin-10-petit-dessin");
  await small.page.click('[data-act="done"]');
  await begin(small);
  await portrait(small, 4, true);
  await small.page.click('[data-act="done"]');
  await small.page.waitForSelector(".dessin-pair");
  await sleep(400);
  await small.shot("dessin-11-petit-revelation");

  /* Téléphone étroit : « Effacer » armé garde sa place ; trois lignes de sujet, les outils restent dégagés. */
  const narrow = await prepare(env, "etroit", { viewport: { width: 320, height: 568 }, fullPage: false });
  await solo(narrow, env.base, "Marie-Antoinette", "Jean-Christophe", ["60", "portrait"]);
  await begin(narrow);
  await portrait(narrow, 2, false);
  await narrow.page.click('[data-act="clear"]');
  await narrow.shot("dessin-15-etroit-effacer");

  /* Téléphone tenu en largeur : la feuille à gauche, les outils à droite. */
  const wide = await prepare(env, "large", { viewport: { width: 844, height: 390 }, fullPage: false });
  await solo(wide, env.base, "Alex", "Inès", ["60", "portrait"]);
  await begin(wide);
  await portrait(wide, 3, true);
  await wide.shot("dessin-16-largeur-dessin");

  /* Deux téléphones, dernier sujet : A relance une pile pendant que B regarde encore la révélation. */
  const a = await prepare(env, "a-relance"), b = await prepare(env, "b-relance");
  await a.page.goto(env.base + "#jeu-dessin");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-opt"][data-val="0"]');
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await a.page.waitForSelector('[data-act="start"]');
  for (const p of [a, b]) {
    await p.page.evaluate(() => { const g = JSON.parse(localStorage.getItem("en:g:dessin")); g.sh = { r: window.GAME_DATA.dessin.prompts.length - 1 }; localStorage.setItem("en:g:dessin", JSON.stringify(g)); });
    await p.page.reload();
  }
  await begin(a);
  await portrait(a, 2, false);
  await a.page.click('[data-act="done"]');
  await begin(b);
  await portrait(b, 3, true);
  await b.page.click('[data-act="done"]');
  await a.page.waitForSelector(".dessin-pair");
  await sleep(1100);
  await a.page.click('[data-act="next"]');
  await a.page.click('[data-act="again"][data-v="delire"]');
  await b.page.waitForSelector(".dessin > .hint");
  await sleep(800);
  await b.shot("dessin-17-relance");

  /* Ordinateur */
  const desk = await prepare(env, "ordi", { viewport: { width: 1280, height: 800 }, scale: 1, mobile: false, touch: false, fullPage: false });
  await solo(desk, env.base, "Alex", "Inès", ["souvenir"]);
  await desk.shot("dessin-12-ordi-pret");
  await begin(desk);
  await portrait(desk, 2, false);
  await desk.shot("dessin-13-ordi-dessin");
  await desk.page.click('[data-act="done"]');
  await begin(desk);
  await portrait(desk, 3, true);
  await desk.page.click('[data-act="done"]');
  await desk.page.waitForSelector(".dessin-pair");
  await sleep(400);
  await desk.shot("dessin-14-ordi-revelation");

  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
