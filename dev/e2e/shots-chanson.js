/* Captures d'écran du jeu « Le blind test du couple » pour contrôle visuel : une partie à deux
   téléphones en clair et en sombre, puis, sur un seul téléphone, le passage, les petits écrans
   et « Nos playlists ».
   Usage : EN_PW=… node dev/e2e/shots-chanson.js   ->  dev/e2e/shots/chanson-*.png */
const path = require("path");
const { setup, sleep } = require("./lib");

const DATA = path.join(__dirname, "../../jeux/chanson.data.js"), GAME = path.join(__dirname, "../../jeux/chanson.js");
const SONGS = [
  ["Les Lumières du port", "Nadia Ferrant", "On l'a entendue partout pendant ce voyage en train"],
  ["Matin calme", "Les Ondes", "Le réveil des grasses matinées"],
  ["Jardin d'hiver", "Clara Vasse", "Ta saison préférée, sans hésiter"],
  ["Route vers le sud", "", "Ce qu'on chante fenêtres ouvertes"],
  ["Une valse pour rien", "Orchestre du Dimanche", "Le slow raté du mariage de tes amis"]
];

async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/chanson.css";
    document.head.appendChild(l);
  }));
  return p;
}
const screen = (p) => p.page.locator("main.game [data-screen]").first().getAttribute("data-screen");
async function on(p, re) { for (let i = 0; i < 100; i++) { try { if (re.test(await screen(p))) return; } catch (e) { /* rendu en cours */ } await sleep(100); } }
const tap = async (p, sel) => { await p.page.waitForSelector(sel); await sleep(550); await p.page.click(sel); };
async function write(p, s) {
  await p.page.waitForSelector('[data-form="chanson"]');
  await p.page.fill('[name="titre"]', s[0]);
  await p.page.fill('[name="artiste"]', s[1]);
  await p.page.fill('[name="indice"]', s[2]);
  await p.page.press('[name="indice"]', "Enter");
}
async function guess(p, t) {
  await p.page.waitForSelector('[data-form="devine"]');
  if (t == null) return tap(p, '[data-act="chat"]');
  await p.page.fill('[name="devine"]', t);
  await p.page.press('[name="devine"]', "Enter");
}
async function solo(env, name, o) {
  const p = await phone(env, name, o);
  await p.page.goto(env.base + "#jeu-chanson");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await on(p, /^ecrire/);
  return p;
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark });
    await a.page.goto(env.base + "#jeu-chanson");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(300);
    await a.shot("chanson-01-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await on(a, /^ecrire-0-a$/);
    await a.page.fill('[name="titre"]', SONGS[0][0]);
    await a.shot("chanson-02-ecrire-" + tag);
    await write(a, SONGS[0]);
    await on(a, /^attente/);
    await sleep(300);
    await a.shot("chanson-03-attente-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await write(b, SONGS[1]);
    await on(b, /^devine-0$/);
    await on(a, /^indice-0$/);
    await sleep(400);
    await b.shot("chanson-04-devine-" + tag);
    await a.shot("chanson-05-indice-" + tag);
    await guess(b, "lumiere du port");
    await on(b, /^revele-0$/);
    await sleep(600);
    await b.shot("chanson-06-trouve-" + tag);
    await tap(b, '[data-act="next"]');
    await guess(a, "Matin d'été");
    await on(a, /^revele-1$/);
    await sleep(600);
    await a.shot("chanson-07-presque-" + tag);
    await tap(a, '[data-act="force"]');
    await sleep(400);
    await a.shot("chanson-08-ca-compte-" + tag);
    await tap(a, '[data-act="next"]');
    for (let r = 1; r < 5; r++) {
      await Promise.all([write(a, SONGS[(r + 1) % 5]), write(b, SONGS[(r + 3) % 5])]);
      const g1 = r % 2 ? a : b, g2 = r % 2 ? b : a;
      await guess(g1, r === 1 ? null : "pas sûr");
      await on(g2, new RegExp("^revele-" + 2 * r + "$"));
      if (r === 1) { await sleep(600); await g1.shot("chanson-09-langue-au-chat-" + tag); }
      await tap(g2, '[data-act="next"]');
      await guess(g2, "route vers le sud");
      await on(g1, new RegExp("^revele-" + (2 * r + 1) + "$"));
      await tap(g1, '[data-act="next"]');
    }
    await on(a, /^resultat$/);
    await sleep(500);
    await a.shot("chanson-10-playlist-" + tag);
    await tap(a, '[data-act="g-stop"]'); await sleep(500); await a.page.click('[data-act="g-stop"]');
    await a.page.waitForSelector(".chanson-keep");
    await a.page.click(".chanson-keep > summary");
    await a.page.click(".chanson-old > summary");
    await sleep(300);
    await a.shot("chanson-11-nos-playlists-" + tag);
  }

  const one = await solo(env, "seul");
  await write(one, SONGS[0]);
  await on(one, /^passe/);
  await one.shot("chanson-12-seul-passage");
  for (const [w, h] of [[375, 553], [320, 568]]) {
    const p = await solo(env, "petit-" + w, { viewport: { width: w, height: h }, fullPage: false });
    await p.shot("chanson-13-petit-" + w + "x" + h + "-ecrire");
    await write(p, SONGS[4]);
    await tap(p, '[data-act="go"]');
    await write(p, SONGS[2]);
    await on(p, /^devine/);
    await sleep(300);
    await p.shot("chanson-14-petit-" + w + "x" + h + "-devine");
    await guess(p, "une valse pour rien");
    await on(p, /^revele/);
    await sleep(600);
    await p.shot("chanson-15-petit-" + w + "x" + h + "-revele");
  }
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
