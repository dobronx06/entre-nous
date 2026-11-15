/* Captures d'écran du jeu « Le match des envies » pour contrôle visuel : téléphone en clair et en
   sombre, petits téléphones (ce qui tient à l'écran sans défiler), écran d'ordinateur.
   Usage : EN_PW=… node dev/e2e/shots-match.js   ->  dev/e2e/shots/match-*.png */
const path = require("path");
const { setup, sleep, SHOTS } = require("./lib");

/* Paquets de secours : ils ne servent que si jeux/match.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const ideas = ["Voir un film en plein air, plaid sur les genoux", "Tenter un escape game rien qu'à deux", "Prendre un train de nuit et se réveiller dans un autre pays", "Faire durer un brunch jusqu'au milieu de l'après-midi"];
  const mk = (id, name, adult) => ({ id, name, hint: "Paquet d'essai pour les captures.", adult, items: Array.from({ length: 36 }, (_, i) => ideas[i % ideas.length] + " (" + id + " " + (i + 1) + ")") });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.match = { decks: [mk("sorties", "Sorties et soirées"), mk("maison", "À la maison"), mk("voyages", "Voyages et escapades"), mk("fous", "Projets fous"), mk("table", "À table"), mk("couette", "Sous la couette", true)] };
}
/* Réponses d'essai, par position dans le paquet : quelques envies communes, dont des coups de cœur. */
const A = (p) => [2, 1, 0, 2, 0, 0, 1, 2, 0][p % 9], B = (p) => [2, 0, 1, 1, 0, 2, 2, 0, 0][p % 9];

/* Une capture de la page entière coupe l'émulation tactile de Playwright : sans la rétablir, les captures
   suivantes montreraient le téléphone comme un ordinateur à souris (aide au clavier affichée). */
async function shot(p, label) {
  await p.shot(label);
  if (p.cdp) await p.cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
}
/* Au doigt sur les téléphones (pas d'état de survol dans les captures), à la souris sur l'ordinateur. */
/* Un écran qui vient d'apparaître ignore les touchers pendant une demi-seconde : on attend, comme quelqu'un qui lit. */
async function pace(p) {
  const now = await p.page.evaluate(() => {
    const el = document.querySelector("main [data-screen]"), s = JSON.parse(localStorage.getItem("en:g:match") || "null");
    window.__loaded = window.__loaded || Date.now() + Math.random();
    return window.__loaded + "|" + location.hash + "|" + (el ? el.getAttribute("data-screen") : "") + "|" + (s ? s.gen + ":" + s.setup.seed : "");
  }).catch(() => "");
  if (now !== p.seen) { p.seen = now; await sleep(650); }
}
const press = async (p, sel) => { await pace(p); return p.cdp ? p.page.locator(sel).first().tap() : p.page.locator(sel).first().click(); };
const twice = async (p, sel) => { await press(p, sel); await press(p, sel); };
const SEND = '[data-act="send"]';
/* Répond aux cartes de from à to ; arrivé au bout du paquet (36 idées), valide. */
async function play(p, f, from, to) {
  for (let i = from; i < to; i++) await press(p, '.match-acts [data-k="' + f(i) + '"]');
  if (to === 36) await press(p, SEND);
}
const quit = async (p) => { await press(p, '[data-act="stop"]'); await press(p, SEND); };
async function drag(p, dx, dy, label) {
  const box = await p.page.locator(".match-card").boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.page.mouse.move(x, y);
  await p.page.mouse.down();
  await p.page.mouse.move(x + dx, y + dy, { steps: 6 });
  await sleep(250);
  await shot(p, label);
  await p.page.mouse.move(x, y, { steps: 3 });
  await p.page.mouse.up();
  await p.page.mouse.move(1, 1);
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  if (!o || o.touch !== false) p.cdp = await p.ctx.newCDPSession(p.page);
  return p;
}
async function solo(p, base, deck) {
  await p.page.goto(base + "#jeu-match");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  if (deck) await press(p, '[data-act="g-opt"][data-val="' + deck + '"]');
  await press(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector(".match-card");
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark }), one = await phone(env, "seul-" + tag, { dark });

    await a.page.goto(env.base + "#accueil");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(800);
    await a.page.locator('article.card:has(a[href="#jeu-match"])').screenshot({ path: path.join(SHOTS, "match-01-carte-accueil-" + tag + ".png") });
    await a.page.goto(env.base + "#jeu-match");
    await sleep(300);
    await shot(a, "match-02-presentation-" + tag);
    await press(a, '[data-act="g-start"][data-mode="duo"]');
    await sleep(500);
    await shot(a, "match-03-invitation-" + tag);
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await press(a, '[data-act="g-go"]');
    await a.page.waitForSelector(".match-card");
    await sleep(300);
    await shot(a, "match-04-carte-" + tag);
    await drag(a, -104, -14, "match-05-glisser-non-" + tag);
    await drag(a, 96, 10, "match-06-glisser-pourquoi-pas-" + tag);
    await drag(a, 8, -110, "match-07-glisser-carrement-" + tag);
    await play(a, A, 0, 36);
    await a.page.waitForSelector(".g-wait");
    await sleep(300);
    await shot(a, "match-08-attente-" + tag);

    await b.page.goto(link);
    await sleep(300);
    await shot(b, "match-09-invite-" + tag);
    await press(b, '[data-act="g-join"]');
    await b.page.waitForSelector(".match-card");
    await play(b, B, 0, 13);
    await sleep(300);
    await shot(b, "match-10-carte-b-" + tag);
    await press(b, '[data-act="stop"]');
    await sleep(200);
    await shot(b, "match-11-arret-a-valider-" + tag);
    await press(b, '[data-act="undo"]');
    await play(b, B, 13, 35);
    await sleep(200);
    await shot(b, "match-12-derniere-carte-" + tag);
    await press(b, '.match-acts [data-k="' + B(35) + '"]');
    await b.page.waitForSelector(SEND);
    await sleep(200);
    await shot(b, "match-12b-validation-" + tag);
    await press(b, SEND);
    await Promise.all([a.page.waitForSelector(".match-list"), b.page.waitForSelector(".match-list")]);
    await press(b, ".match-done >> nth=1");
    await sleep(400);
    await shot(b, "match-13-resultat-" + tag);

    /* Deuxième paquet : A répond puis s'absente, B finit et relance ; à son retour, A découvre le résultat manqué. */
    await a.page.evaluate(() => window.scrollTo(0, 300));
    await press(b, '[data-act="again"][data-deck="voyages"]');
    await a.page.waitForSelector('[data-act="ok"]');
    await sleep(300);
    await a.page.screenshot({ path: path.join(SHOTS, "match-14-resultat-garde-" + tag + ".png") });
    await press(a, '[data-act="ok"]');
    await a.page.waitForSelector(".match-card");
    await sleep(300);
    await shot(a, "match-14b-paquet-suivant-" + tag);
    await play(a, A, 0, 36);
    await a.page.waitForSelector(".g-wait");
    await sleep(900);
    await a.page.goto("about:blank");
    await play(b, B, 0, 36);
    await b.page.waitForSelector('[data-act="again"]');
    await press(b, '[data-act="again"][data-deck="couette"]');
    await b.page.waitForSelector(".match-card");
    await sleep(900);
    await a.page.goto(env.base + "#jeu-match");
    await a.page.waitForSelector('[data-act="ok"]');
    await sleep(300);
    await shot(a, "match-15-resultat-manque-" + tag);

    /* Un seul téléphone : le passage, un paquet sans rien en commun, puis la liste gardée sur la présentation. */
    await solo(one, env.base, "table");
    await play(one, A, 0, 36);
    await one.page.waitForSelector(".g-pass");
    await sleep(300);
    await shot(one, "match-16-passage-" + tag);
    await press(one, '[data-act="go"]');
    await play(one, B, 0, 36);
    await one.page.waitForSelector(".match-list");
    await press(one, ".match-done");
    await press(one, '[data-act="again"][data-deck="fous"]');
    await one.page.waitForSelector(".match-card");
    await press(one, '[data-act="review"]');
    await one.page.waitForSelector('[data-act="ok"]');
    await sleep(300);
    await shot(one, "match-16b-resultat-revu-" + tag);
    await press(one, '[data-act="ok"]');
    await quit(one);
    await press(one, '[data-act="go"]');
    await play(one, () => 2, 0, 36);
    await one.page.waitForSelector('[data-act="again"]');
    await sleep(300);
    await shot(one, "match-17-rien-en-commun-" + tag);
    await twice(one, '.g-foot [data-act="g-stop"]');
    await one.page.waitForSelector(".match-keep");
    await sleep(300);
    await shot(one, "match-18-presentation-avec-liste-" + tag);
    await press(one, ".match-keep summary");
    await sleep(300);
    await shot(one, "match-19-nos-envies-" + tag);
    await twice(one, '[data-act="vider"]');
    await sleep(300);
    await shot(one, "match-19b-liste-videe-" + tag);
  }

  /* Petits téléphones : seule la fenêtre est capturée, pour voir ce qui tient sans défiler. */
  for (const [w, h] of [[390, 664], [360, 640], [320, 568]]) {
    const small = await phone(env, "petit-" + w, { viewport: { width: w, height: h }, fullPage: false });
    await solo(small, env.base, "voyages");
    await sleep(300);
    await shot(small, "match-20-petit-" + w + "-carte");
    await play(small, A, 0, 7);
    await press(small, '[data-act="stop"]');
    await sleep(200);
    await shot(small, "match-21-petit-" + w + "-arret");
    await press(small, '[data-act="undo"]');
    await sleep(200);
    await shot(small, "match-21b-petit-" + w + "-carte-8");
  }

  /* Sur un écran d'ordinateur : la carte et le résultat. */
  const pc = await phone(env, "ordinateur", { viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1 });
  await solo(pc, env.base);
  await play(pc, A, 0, 4);
  await pc.page.mouse.move(1, 1);
  await sleep(300);
  await shot(pc, "match-22-ordinateur-carte");
  await play(pc, A, 4, 36);
  await press(pc, '[data-act="go"]');
  await play(pc, B, 0, 36);
  await pc.page.waitForSelector(".match-list");
  await pc.page.mouse.move(1, 1);
  await sleep(300);
  await shot(pc, "match-23-ordinateur-resultat");
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
