/* Captures d'écran du jeu « Tu préfères ? » pour contrôle visuel : une partie sur un téléphone puis à deux,
   en clair et en sombre, puis les petits écrans.
   Usage : EN_PW=… node dev/e2e/shots-prefere.js   ->  dev/e2e/shots/prefere-*.png */
const path = require("path");
const { setup, sleep } = require("./lib");

const DATA = path.join(__dirname, "../../jeux/prefere.data.js"), GAME = path.join(__dirname, "../../jeux/prefere.js");
const VA = "011010011100101001110100", VB = "100110011100010100111001";

/* Le jeu n'est pas encore dans index.html : ses fichiers sont ajoutés à chaque ouverture de page. */
async function phone(env, name, o, bare) {
  const p = await env.phone(name, o);
  if (!bare) await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/prefere.css";
    document.head.appendChild(l);
  }));
  return p;
}
async function tap(p, sel) { await sleep(400); await p.page.click(sel); }
async function answer(p, w, v, from, to) {
  for (let j = from || 0; j < (to == null ? v.length : to); j++) {
    await p.page.waitForSelector('[data-screen="q-' + w + "-" + Math.floor(j / 2) + "-" + (j % 2) + '"]');
    await tap(p, '[data-act="pick"][data-k="' + v[j] + '"]');
  }
}
async function send(p, w) {
  await p.page.waitForSelector('[data-screen="fin-' + w + '"]');
  await tap(p, '[data-act="send"]');
}
async function solo(env, name, o, pack) {
  const p = await phone(env, name, o);
  await p.page.goto(env.base + "#jeu-prefere");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  if (pack) await p.page.click('[data-act="g-opt"][data-val="' + pack + '"]');
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector('[data-screen="q-a-0-0"]');
  await sleep(300);
  return p;
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const one = await phone(env, "seul-" + tag, { dark });
    await one.page.goto(env.base + "#jeu-prefere");
    await one.page.fill("#name-a", "Alex");
    await one.page.fill("#name-b", "Inès");
    await sleep(500);
    await one.shot("prefere-01-presentation-" + tag);
    await one.page.click('[data-act="g-start"][data-mode="solo"]');
    await one.page.waitForSelector('[data-screen="q-a-0-0"]');
    await sleep(400);
    await one.shot("prefere-02-choisir-" + tag);
    await answer(one, "a", VA, 0, 1);
    await one.page.waitForSelector('[data-screen="q-a-0-1"]');
    await sleep(400);
    await one.shot("prefere-03-deviner-" + tag);
    await answer(one, "a", VA, 1);
    await one.page.waitForSelector('[data-screen="fin-a"]');
    await sleep(300);
    await one.shot("prefere-04-fin-" + tag);
    await send(one, "a");
    await one.page.waitForSelector('[data-screen="passage"]');
    await sleep(300);
    await one.shot("prefere-05-passage-" + tag);
    await tap(one, '[data-act="go"]');
    await answer(one, "b", VB);
    await send(one, "b");
    await one.page.waitForSelector('[data-screen="resultat"]');
    await sleep(400);
    await one.shot("prefere-06-resultat-" + tag);

    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark });
    await a.page.goto(env.base + "#jeu-prefere");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await a.page.click('[data-act="g-opt"][data-val="coquin"]');
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await answer(a, "a", VA);
    await send(a, "a");
    await a.page.waitForSelector('[data-screen="attente"]');
    await sleep(400);
    await a.shot("prefere-07-attente-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await answer(b, "b", VB);
    await send(b, "b");
    await a.page.waitForSelector('[data-screen="resultat"]');
    await b.page.waitForSelector('[data-screen="resultat"]');
    await tap(b, '[data-act="again"][data-pack="nous"]');
    await a.page.waitForSelector('[data-act="ok"]');
    await sleep(400);
    await a.shot("prefere-08-partie-precedente-" + tag);
  }

  /* La hauteur utile d'un petit iPhone dans Safari, puis le plus étroit des téléphones. */
  for (const [w, h] of [[375, 553], [320, 568]]) {
    const p = await solo(env, "petit-" + w, { viewport: { width: w, height: h }, fullPage: false }, "nous");
    await p.shot("prefere-09-petit-" + w + "x" + h + "-choisir");
    await answer(p, "a", VA, 0, 1);
    await p.page.waitForSelector('[data-screen="q-a-0-1"]');
    await sleep(400);
    await p.shot("prefere-10-petit-" + w + "x" + h + "-deviner");
    await answer(p, "a", VA, 1);
    await send(p, "a");
    await tap(p, '[data-act="go"]');
    await answer(p, "b", VB);
    await send(p, "b");
    await p.page.waitForSelector('[data-screen="resultat"]');
    await sleep(400);
    await p.shot("prefere-11-petit-" + w + "x" + h + "-resultat");
  }

  /* Sans le fichier des dilemmes : un message clair, pas de faux résultat. */
  const empty = await phone(env, "sans-dilemmes", {}, true);
  await empty.page.goto(env.base + "#jeu-prefere");
  await empty.page.fill("#name-a", "Alex");
  await empty.page.click('[data-act="g-start"][data-mode="solo"]');
  await sleep(400);
  await empty.shot("prefere-12-sans-dilemmes");
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
