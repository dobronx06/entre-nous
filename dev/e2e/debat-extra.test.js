/* Essais d'endurance du jeu « Le débat idiot » : ce que deux personnes font pour de vrai et que
   l'essai de base ne couvre pas (recharger à chaque étape, quitter et revenir, arriver en retard,
   toucher au même instant, perdre le réseau, relancer pendant que l'autre joue, toucher plusieurs
   fois sur un petit écran, jouer au clavier), plus des valeurs hostiles envoyées par un téléphone
   et observées sur l'autre.

   Usage : EN_PW=… node dev/e2e/debat-extra.test.js [filtre]
   Le filtre ne garde que les scénarios dont le nom le contient (pratique pour en rejouer un seul).
   EN_NET=1 laisse passer les polices du site : les mesures de mise en page se font alors avec elles. */
const { setup, check, done, sleep } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const KEY = "en:g:debat";
const GO = '.debat [data-act="go"]', SKIP = '.debat [data-act="skip"]', DONE = '.debat [data-act="done"]';
const NEXT = '.debat [data-act="next"]', END = '.debat [data-act="end"]', AGAIN = '.debat [data-act="again"]';
const vote = (v) => '.debat [data-act="vote"][data-v="' + v + '"]';
const HOME = '.g-top a[href="#accueil"]', RESUME = '.banner a[href="#jeu-debat"]', CARD = '.card-link[href="#jeu-debat"]', STOP = '.g-foot [data-act="g-stop"]';
const DESK = { viewport: { width: 1280, height: 800 }, scale: 1, mobile: false, touch: false };

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}

/* Sujets de secours : ils ne servent que si jeux/debat.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.debat = { topics: Array.from({ length: 12 }, (_, i) => "Sujet d'essai numéro " + (i + 1)) };
}
/* L'horloge du téléphone, qu'un essai peut avancer avec window.__ahead(ms) au lieu d'attendre trente
   secondes. Le décalage survit aux rechargements, comme celui d'une vraie horloge mal réglée. */
function clock(start) {
  const real = Date.now.bind(Date), K = "essai:horloge";
  let skew = start || 0;
  try { const v = localStorage.getItem(K); if (v != null) skew = Number(v) || 0; } catch (e) { /* page sans stockage */ }
  Date.now = () => real() + skew;
  window.__ahead = (ms) => { skew += ms; try { localStorage.setItem(K, String(skew)); } catch (e) { /* idem */ } };
}
/* Compte les vibrations, les bips et les éclairs : la fin du temps se vérifie sans rien entendre. */
function probe() {
  window.__fx = { buzz: 0, beep: 0, flash: 0 };
  try { Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { window.__fx.buzz++; return true; } }); } catch (e) { /* sans importance */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { const make = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__fx.beep++; return make.call(this); }; }
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("debat-flash")) window.__fx.flash++; })))
    .observe(document, { childList: true, subtree: true });
}

/* Douze fois le même sujet, de longueur moyenne, servi à la place de jeux/debat.data.js : la mise en page
   de chaque écran ne dépend alors plus du tirage, et un essai de touchers donne toujours le même résultat. */
const SAME = "(window.GAME_DATA = window.GAME_DATA || {}).debat = " + JSON.stringify({ topics: Array.from({ length: 12 }, () => "La raclette se mange aussi en plein mois d'août") }) + ";";

/* o.skew : décalage de l'horloge de ce téléphone, en millisecondes ; o.data : contenu imposé ;
   le reste va à lib.phone. */
async function phone(env, name, o) {
  o = o || {};
  const p = await env.phone(name, o);
  p.touch = o.touch !== false;
  await p.ctx.addInitScript(fixture);
  await p.ctx.addInitScript(clock, o.skew || 0);
  await p.ctx.addInitScript(probe);
  if (o.data) await p.ctx.route(/\/jeux\/debat\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: o.data }));
  return p;
}

const count = (p, s) => p.page.locator(s).count();
const text = (p, s) => p.page.locator(s).first().textContent();
const screen = (p) => p.page.evaluate(() => { const el = document.querySelector(".debat"); return el ? el.getAttribute("data-screen") : ""; });
/* Où en est ce téléphone : son écran de jeu, ou ce qui l'a remplacé. */
const where = (p) => p.page.evaluate(() => { const el = document.querySelector(".debat"); return el ? el.getAttribute("data-screen") : document.querySelector("main.intro") ? "partie arrêtée" : "hors du jeu"; });
const on = (p, name, ms) => until(async () => (await screen(p)) === name, ms);
const bothOn = async (a, b, name, ms) => (await Promise.all([on(a, name, ms), on(b, name, ms)])).every(Boolean);
const title = async (p) => (await text(p, ".debat .g-title")).trim();
const motion = async (p) => (await text(p, ".debat-topic, .debat-motion")).trim();
const step = (p) => text(p, ".debat-step");
const lead = (p) => text(p, ".debat .g-lead");
const sides = async (p) => (await p.page.locator(".debat-side").allTextContents()).join(" / ");
const num = async (p) => parseInt(await text(p, ".debat-num"), 10);
const score = async (p) => (await p.page.locator(".g-score b").allTextContents()).join("-");
const fx = (p) => p.page.evaluate(() => window.__fx);
const saved = (p) => p.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const posts = async (env) => (await env.ctl()).count.post;
const net = (p) => p.page.locator(".g-top [data-net]").getAttribute("data-net");
const linked = (p) => until(async () => (await net(p)) === "ok", 8000);
const focused = (p, s) => p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), s);
/* L'écran de jeu est debout : aucune balise injectée, aucun script exécuté, aucune erreur. */
const healthy = async (p) => !p.errors.length && await p.page.evaluate(() => !!document.querySelector("main.game .debat") && !document.querySelector("#app img, #app script, #app iframe") && window.__xss === undefined);
/* Ce qui ne va pas dans l'écran affiché ("" si tout va bien) : page qui défile de côté, zone tactile de
   moins de 44 px, chiffres du chrono trop petits, hors de l'écran ou cachés par la rangée de boutons,
   espace ordinaire devant une ponctuation double ou dans des guillemets. */
const fit = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, h = window.innerHeight, out = [];
  const box = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
  if (document.documentElement.scrollWidth > w + 1) out.push("page de " + document.documentElement.scrollWidth + " px pour " + w);
  document.querySelectorAll("main.game button, main.game a, main.game summary").forEach((el) => {
    const r = el.getBoundingClientRect(), name = "« " + el.textContent.trim().slice(0, 24) + " »";
    if (r.height > 0 && r.height < 44) out.push(name + " haut de " + Math.round(r.height) + " px");
    if (r.width > 0 && (r.left < -1 || r.right > w + 1)) out.push(name + " dépasse en largeur");
  });
  const digits = document.querySelector(".debat-num"), row = box(".debat .g-actions"), game = document.querySelector(".debat");
  if (digits) {
    const size = parseFloat(getComputedStyle(digits).fontSize), range = document.createRange();
    range.selectNodeContents(digits);
    const ink = range.getBoundingClientRect();
    if (size < 64) out.push("chiffres du chrono de " + Math.round(size) + " px");
    if (ink.top < 0 || ink.bottom > h + 1) out.push("chiffres du chrono hors de l'écran (jusqu'à " + Math.round(ink.bottom) + " px sur " + h + ")");
    /* Le haut de la rangée est un dégradé transparent : un quart de la ligne peut passer dessous sans gêner la lecture. */
    if (row && ink.bottom - row.top > ink.height / 4) out.push("chiffres du chrono cachés par la rangée de boutons sur " + Math.round(ink.bottom - row.top) + " px");
  }
  if (row && (row.top < 0 || row.bottom > h + 1)) out.push("rangée de boutons hors de l'écran");
  const typo = game && / [?!:;%»]|« /.exec(game.textContent);
  if (typo) out.push("espace ordinaire dans « " + game.textContent.slice(Math.max(0, typo.index - 12), typo.index + 6) + " »");
  return out.join(" ; ");
});

/* Le jeu ignore un toucher qui suit de trop près l'apparition d'un écran ou de ses boutons : on laisse passer ce délai. */
async function settled(p) {
  const age = await p.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "null"); return s && s.local.e ? Date.now() - s.local.e.at : 1e6; }, KEY);
  if (age < 700) await sleep(700 - age);
}
/* Ce que la rangée de boutons du bas cache de l'élément `sel`, en pixels. */
const hidden = (p, sel) => p.page.evaluate((sel) => Math.round(Math.max(0, document.querySelector(sel).getBoundingClientRect().bottom - document.querySelector(".debat .g-actions").getBoundingClientRect().top)), sel);
async function tap(p, sel) {
  await p.page.waitForSelector(sel, { timeout: 8000 });
  await settled(p);
  await p.page.click(sel, { timeout: 8000 });
}
/* Le point visé dans un bouton : son milieu, ou plus à gauche si `frac` le demande. */
async function center(p, sel, frac) {
  const el = p.page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const r = await el.boundingBox();
  return { x: r.x + r.width * (frac || 0.5), y: r.y + r.height / 2 };
}
const hit = (p, at) => (p.touch ? p.page.touchscreen.tap(at.x, at.y) : p.page.mouse.click(at.x, at.y));
/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent sur ce qui
   s'affiche à cet endroit après le premier. */
async function rapid(p, sel, n) {
  await p.page.waitForSelector(sel, { timeout: 8000 });
  await settled(p);
  const at = await center(p, sel);
  for (let i = 0; i < n; i++) { await hit(p, at); await sleep(120); }
}
/* Des touchers au même instant sur plusieurs téléphones : les positions sont relevées avant, pour que rien ne les retarde. */
async function together(list) {
  for (const [p, sel] of list) { await p.page.waitForSelector(sel, { timeout: 8000 }); await settled(p); }
  const at = await Promise.all(list.map(([p, sel]) => center(p, sel)));
  await Promise.all(list.map(([p], i) => hit(p, at[i])));
}
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
async function tabTo(p, sel) {
  for (let i = 1; i <= 8; i++) {
    await p.page.keyboard.press("Tab");
    if (await focused(p, sel)) return i;
  }
  return -1;
}
const ahead = (p, sec) => p.page.evaluate((ms) => window.__ahead(ms), sec * 1000);
/* Avance l'horloge de ce téléphone : il ne reste que `margin` secondes au temps de parole en cours
   (une marge négative le place après la fin). */
const toZero = (p, margin) => p.page.evaluate((o) => {
  const s = JSON.parse(localStorage.getItem(o.key));
  window.__ahead(Math.max(0, (Number(s.setup.duree) || 60) * 1000 - (Date.now() - s.local.t.at) - o.margin * 1000));
}, { key: KEY, margin });

async function start(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-debat");
  await p.page.fill("#name-a", o.a != null ? o.a : "Alex");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  await p.page.click('[data-act="g-opt"][data-val="' + (o.duree || "30") + '"]');
  await p.page.click('[data-act="g-start"][data-mode="' + (o.duo ? "duo" : "solo") + '"]');
}
async function join(p, link) {
  await p.page.goto(link);
  await p.page.click('[data-act="g-join"]');
}
/* Deux téléphones dans la même partie, tous deux devant le premier sujet.
   o : prénoms et durée (voir start), o.phone : options des deux téléphones, o.skew : { a, b } horloges décalées. */
async function pair(env, tag, o) {
  o = o || {};
  const skew = o.skew || {};
  const a = await phone(env, "a-" + tag, Object.assign({ skew: skew.a }, o.phone)), b = await phone(env, "b-" + tag, Object.assign({ skew: skew.b }, o.phone));
  await start(a, env, Object.assign({ duo: true }, o));
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await join(b, link);
  if (!(await bothOn(a, b, "sujet-0", 10000) && await linked(a) && await linked(b))) throw new Error("la partie ne s'est pas ouverte des deux côtés");
  return { a, b, link };
}
/* Ce téléphone perd le réseau. Le navigateur d'essai laisse vivre un flux déjà ouvert : le relais les
   coupe donc tous (l'autre téléphone se rebranche tout seul deux secondes plus tard). */
async function cut(env, p) {
  await p.ctx.setOffline(true);
  await env.ctl("drop=1");
}
const need = (ok, what) => { if (!ok) throw new Error(what); };
/* Un débat entier jusqu'au vote : `starter` lance le chrono, puis chacun arrête son propre temps de parole. */
async function debate(starter, a, b, k) {
  await tap(starter, GO);
  for (const ph of ["pour", "contre"]) {
    need(await bothOn(a, b, ph + "-" + k, 8000), "l'écran " + ph + "-" + k + " ne s'est pas ouvert des deux côtés");
    await tap(await count(a, DONE) ? a : b, DONE);
  }
  need(await bothOn(a, b, "vote-" + k, 8000), "le vote " + k + " ne s'est pas ouvert des deux côtés");
}
/* Sur un seul téléphone : un débat jusqu'au vote. */
async function soloDebate(p, k) {
  for (const [sel, next] of [[GO, "pour-"], [DONE, "contre-"], [DONE, "vote-"]]) {
    await tap(p, sel);
    need(await on(p, next + k), "l'écran " + next + k + " ne s'est pas ouvert");
  }
}
async function reload(p) {
  await p.page.reload();
  await p.page.waitForSelector(".debat");
}
/* Le pirate modifie sa partie enregistrée puis recharge, sans laisser à la page le temps de réécrire
   par-dessus : le socle redépose alors cet état sur le relais. x.sh : état commun ; x.su : réglages ;
   x.d : sa tranche (une chaîne est lue comme du JSON, pour les clés qu'un objet ne sait pas porter). */
async function inject(p, x) {
  const loaded = p.page.waitForEvent("load");
  await p.page.evaluate((o) => {
    const s = JSON.parse(localStorage.getItem(o.key)), now = Date.now(), x = o.x;
    if (x.su) s.setup = Object.assign({}, s.setup, x.su);
    if (x.sh) s.sh = x.sh;
    if (x.su || x.sh) { s.st++; s.sw = s.me; s.seq[s.me].h = Math.max(s.seq[s.me].h + 1, now); }
    if ("d" in x) { s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d: typeof x.d === "string" ? JSON.parse(x.d) : x.d }; s.seq[s.me].d = Math.max(s.seq[s.me].d + 1, now); }
    localStorage.setItem(o.key, JSON.stringify(s));
    location.reload();
  }, { key: KEY, x }).catch(() => { /* la page se recharge pendant l'appel */ });
  await loaded;
}

const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push({ name, fn });

/* ====================================================================== Recharger, quitter, revenir */

scenario("Recharger à chaque étape, sur chaque téléphone", async (env) => {
  const { a, b } = await pair(env, "recharge");
  await until(async () => await posts(env) >= 2);
  await sleep(500);
  const base = await posts(env);
  check(base === 2, "l'arrivée des deux joueurs coûte deux messages (" + base + ")");
  /* Recharge les deux téléphones, puis vérifie l'écran de chacun et que rien n'a été renvoyé. */
  const still = async (na, nb, n, label) => {
    for (const p of [a, b]) { await reload(p); await linked(p); }
    await sleep(500);
    const got = [await screen(a), await screen(b), await posts(env)];
    return check(got[0] === na && got[1] === nb && got[2] === base + n, label + " (" + got.join(", ") + " messages)");
  };
  const topic = await motion(a);
  await still("sujet-0", "sujet-0", 0, "annonce : après rechargement des deux, même écran, rien de renvoyé");
  check(await motion(a) === topic && await motion(b) === topic, "et le même sujet des deux côtés");

  await tap(a, GO);
  await bothOn(a, b, "pour-0");
  await sleep(1500);
  const n1 = [await num(a), await num(b)];
  await still("pour-0", "pour-0", 1, "premier temps de parole : même écran après rechargement");
  const n2 = [await num(a), await num(b)];
  check(n2.every((n, i) => n <= n1[i] && n >= n1[i] - 6), "les deux chronos reprennent où ils en étaient (" + n1.join(" et ") + " avant, " + n2.join(" et ") + " après)");
  check((await saved(a)).local.t.mine === 1 && !(await saved(b)).local.t.mine, "et c'est toujours le téléphone d'A qui passera à la suite");
  await toZero(a, 1.2);
  check(await bothOn(a, b, "contre-0", 6000), "à zéro chez A, rechargé entre-temps, les deux passent au second temps de parole");
  check(await num(a) >= 28 && await num(b) >= 28, "dont le chrono repart de trente secondes des deux côtés");
  await still("contre-0", "contre-0", 2, "second temps de parole : même écran après rechargement");
  await tap(await count(a, DONE) ? a : b, DONE);
  await bothOn(a, b, "vote-0");
  await still("vote-0", "vote-0", 3, "vote : même écran après rechargement");

  await tap(a, vote("a"));
  await on(a, "attente-0");
  await until(() => count(b, ".debat .hint"));
  await still("attente-0", "vote-0", 4, "A a voté : après rechargement, A attend toujours et B peut toujours voter");
  check(await count(a, ".debat-pick") === 0 && JSON.stringify((await saved(a)).S.a.d.v) === "{\"0\":\"a\"}", "le vote d'A n'est ni perdu ni rejouable");
  check((await text(b, ".debat .hint")).includes("Alex a déjà voté") && await count(b, ".debat-cast, .g-score") === 0 && !(await text(b, ".debat")).includes("a voté pour"), "et B sait seulement qu'Alex a voté");
  await tap(b, vote("a"));
  await bothOn(a, b, "verdict-0");
  await still("verdict-0", "verdict-0", 5, "verdict : même écran après rechargement");
  check(await title(a) === "Alex remporte ce débat." && await title(b) === "Alex remporte ce débat." && await score(a) === "1-0" && await score(b) === "1-0", "avec le même verdict et le même score");
  await tap(b, END);
  await bothOn(a, b, "fin");
  await still("fin", "fin", 6, "résultat : même écran après rechargement, et un débat complet a coûté six messages");
  check(await count(a, ".debat-list li") === 1 && await count(b, ".debat-list li") === 1 && await title(b) === "Alex remporte la partie.", "le débat joué n'est ni perdu ni compté deux fois");
});

scenario("Quitter vers l'accueil et revenir", async (env) => {
  const { a, b } = await pair(env, "accueil");
  const leave = async (p) => { await p.page.click(HOME); await p.page.waitForSelector(CARD); };
  const back = async (p) => { await p.page.click(RESUME); await p.page.waitForSelector(".debat"); };
  await leave(a);
  await tap(b, GO);
  await on(b, "pour-0");
  await sleep(2000);
  await back(a);
  check(await on(a, "pour-0") && await num(a) >= 29, "A revient de l'accueil en plein temps de parole : son chrono part de l'instant où il le voit");

  /* B, qui a lancé le chrono, s'en va quatre secondes avant la fin et ne revient qu'après. */
  await toZero(b, 4);
  await leave(b);
  const sent = await posts(env);
  await toZero(a, 1);
  check(await until(() => count(a, ".debat-over"), 4000) && (await fx(a)).flash === 1 && await count(a, DONE) === 0, "B est sur l'accueil : chez A le temps s'écoule et la fin est signalée");
  check(await until(async () => (await text(a, DONE)).includes("Passer à la suite"), 6000), "trois secondes plus tard, A peut passer à la suite");
  await ahead(b, 9);
  await back(b);
  await sleep(800);
  check(await screen(b) === "pour-0" && (await text(b, DONE)).includes("Passer à la suite") && (await fx(b)).flash === 0, "B revient bien après la fin : son téléphone n'enchaîne pas tout seul, il propose de passer à la suite");
  check(await posts(env) === sent, "et rien n'a été envoyé pendant ce temps");
  await together([[a, DONE], [b, DONE]]);
  const moved = await bothOn(a, b, "contre-0");
  await sleep(1500);
  check(moved && await screen(a) === "contre-0" && await screen(b) === "contre-0" && await num(a) >= 26 && await num(b) >= 26, "les deux touchent « Passer à la suite » au même instant : un seul temps de parole passe");

  const sp = await count(a, DONE) ? a : b, before = await num(sp);
  await leave(sp);
  await sleep(1500);
  await back(sp);
  const after = await num(sp);
  check(after < before && after >= before - 4 && (await text(sp, DONE)).includes("J'ai fini"), "qui parle quitte et revient : son chrono a continué, sans repartir de trente (" + before + " puis " + after + ")");
  await tap(sp, DONE);
  await bothOn(a, b, "vote-0");
  await tap(a, vote("b"));
  await on(a, "attente-0");
  await leave(a);
  check(await count(a, RESUME) === 1, "A a voté puis quitte : l'accueil lui propose de reprendre");
  await tap(b, vote("b"));
  await on(b, "verdict-0");
  await back(a);
  check(await on(a, "verdict-0") && await title(a) === "Inès remporte ce débat." && await score(a) === "0-1", "de retour, A trouve le verdict et son vote a compté");
  await tap(a, END);
  await bothOn(a, b, "fin");
  await leave(b);
  check(await count(b, RESUME) === 0 && await count(b, '.card-state[href="#jeu-debat"]') === 0, "partie terminée : l'accueil de B ne propose plus de la reprendre");
  await b.page.click(CARD);
  check(await on(b, "fin") && await count(b, AGAIN) === 1, "mais la page du jeu montre encore le résultat, avec « Rejouer »");
});

scenario("Un téléphone : quitter ou arrêter pendant le chrono", async (env) => {
  const p = await phone(env, "seul");
  await start(p, env);
  await on(p, "sujet-0");
  await tap(p, GO);
  await on(p, "pour-0");
  await toZero(p, 1);
  await p.page.click(HOME);
  await p.page.waitForSelector(CARD);
  await sleep(2000);
  check((await fx(p)).flash === 0 && (await saved(p)).sh.ph === "pour", "sur l'accueil, le chrono arrivé à zéro ne signale rien et ne fait pas avancer la partie");
  await ahead(p, 5);
  await p.page.click(RESUME);
  check(await on(p, "pour-0") && (await text(p, DONE)).includes("Passer à la suite") && await num(p) === 0, "de retour bien après, le téléphone propose de passer à la suite");
  await tap(p, DONE);
  await on(p, "contre-0");
  await toZero(p, 1);
  await p.page.click(STOP); await sleep(450);
  await p.page.click(STOP);
  await p.page.waitForSelector('[data-act="g-start"]');
  await sleep(2000);
  check((await fx(p)).flash === 0 && await saved(p) === null && !p.errors.length, "« Arrêter la partie » une seconde avant la fin : aucun éclair, aucune partie fantôme");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  check(await on(p, "sujet-0") && (await step(p)).includes("Débat 1"), "et une nouvelle partie repart du premier débat");
  await soloDebate(p, 0);
  await reload(p);
  check(await screen(p) === "vote-0" && await count(p, ".debat-pick") === 3, "vote rechargé : toujours ouvert");
  await tap(p, vote("="));
  await on(p, "verdict-0");
  await tap(p, END);
  await on(p, "fin");
  await reload(p);
  check(await screen(p) === "fin" && await title(p) === "Égalité parfaite." && await count(p, ".debat-list li") === 1, "résultat rechargé : toujours là");
});

/* ====================================================================== Arriver en retard */

scenario("L'invité n'a pas encore rejoint la partie", async (env) => {
  const a = await phone(env, "a-tard"), b = await phone(env, "b-tard");
  await start(a, env, { duo: true });
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await on(a, "sujet-0");
  await until(async () => await posts(env) >= 1);
  await sleep(500);
  const sent = await posts(env);
  check(await count(a, GO) === 0 && await count(a, SKIP) === 0 && (await text(a, ".debat .g-wait .sync")).replace(/\u00a0/g, " ") === "En attente d'Inès…", "le créateur commence sans attendre : le débat ne peut pas partir sans Inès, son téléphone le dit");
  check(await count(a, ".debat-topic") === 1 && await count(a, ".debat-side") === 2 && await count(a, ".g-wait > details") === 1, "il voit déjà le sujet et les camps, et retrouve le lien d'invitation");
  await reload(a);
  await linked(a);
  await sleep(500);
  check(await screen(a) === "sujet-0" && await count(a, GO) === 0 && await posts(env) === sent, "après rechargement, il attend toujours, sans rien avoir renvoyé");
  /* Le doigt du créateur est déjà là où « C'est parti » va s'afficher : un toucher tombe sur le bouton à l'instant où il apparaît. */
  await a.page.evaluate((sel) => {
    new MutationObserver((list, obs) => {
      const el = document.querySelector(sel);
      if (!el) return;
      obs.disconnect();
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
      window.__early = true;
    }).observe(document.getElementById("app"), { childList: true, subtree: true });
  }, GO);
  await join(b, link);
  check(await bothOn(a, b, "sujet-0", 8000) && await until(async () => await count(a, GO) === 1 && await count(b, GO) === 1, 8000) && await count(a, ".g-wait") === 0 && await count(b, ".g-wait") === 0, "dès qu'Inès rejoint la partie, « C'est parti » s'affiche des deux côtés");
  await sleep(300);
  check(await a.page.evaluate(() => window.__early === true) && await screen(a) === "sujet-0" && await screen(b) === "sujet-0", "le toucher tombé sur « C'est parti » à l'instant où il apparaît ne lance pas le débat");
  check(await motion(b) === await motion(a) && await sides(b) === await sides(a), "avec le même sujet et les mêmes camps");
  await tap(b, SKIP);
  await bothOn(a, b, "sujet-1");
  await tap(a, SKIP);
  await bothOn(a, b, "sujet-2");
  await debate(a, a, b, 2);
  await together([[a, vote("=")], [b, vote("=")]]);
  check(await bothOn(a, b, "verdict-2") && await title(a) === "Égalité." && (await step(b)).includes("Débat 1") && await score(b) === "0-0", "et le débat se joue normalement : deux sujets passés ne comptent pas comme des débats");
});

/* ====================================================================== Au même instant */

scenario("Les deux touchent au même instant, plusieurs fois", async (env) => {
  const { a, b } = await pair(env, "ensemble");
  const same = async () => await screen(a) === await screen(b) && await motion(a) === await motion(b);
  await together([[a, SKIP], [b, GO]]);
  check(await bothOn(a, b, "sujet-1") && await same(), "A passe le sujet à l'instant où B lance le débat : les deux se retrouvent devant le sujet suivant");
  await together([[a, GO], [b, SKIP]]);
  check(await bothOn(a, b, "pour-1") && await same(), "l'inverse : le débat démarre des deux côtés, sur le même sujet");
  const want = { 1: ["a", "b", "Mauvaise foi partagée."], 2: ["b", "a", "Trop de politesse pour gagner."], 3: ["=", "a", "Égalité."] };
  for (let k = 1; k <= 3; k++) {
    if (k > 1) {
      await together([[a, GO], [b, GO]]);
      check(await bothOn(a, b, "pour-" + k), "débat " + k + " : « C'est parti » touché des deux côtés à la fois, un seul départ");
    }
    await sleep(700);
    const sent = await posts(env);
    await Promise.all([toZero(a, 1.2), toZero(b, 1.2)]);
    const moved = await bothOn(a, b, "contre-" + k, 6000);
    await sleep(1200);
    check(moved && await screen(a) === "contre-" + k && await screen(b) === "contre-" + k && await num(a) >= 26 && await num(b) >= 26, "débat " + k + " : les deux chronos arrivent à zéro ensemble, on passe au second temps de parole et pas plus loin");
    check(await posts(env) - sent === 1, "débat " + k + " : un seul des deux téléphones a envoyé ce changement (" + (await posts(env) - sent) + " message)");
    /* Qui parle touche « J'ai fini » pendant que le chrono de l'autre arrive à zéro. */
    const sp = await count(a, DONE) ? a : b;
    await toZero(sp === a ? b : a, 0.8);
    await sleep(650);
    await tap(sp, DONE);
    check(await bothOn(a, b, "vote-" + k, 6000), "débat " + k + " : « J'ai fini » touché quand l'autre chrono arrive à zéro, le vote s'ouvre des deux côtés");
    await together([[a, vote(want[k][0])], [b, vote(want[k][1])]]);
    check(await bothOn(a, b, "verdict-" + k) && await title(a) === want[k][2] && await title(b) === want[k][2] && await score(a) === await score(b), "débat " + k + " : deux votes au même instant, même verdict des deux côtés (" + want[k][2] + ")");
    await together(k === 1 ? [[a, NEXT], [b, NEXT]] : k === 2 ? [[a, NEXT], [b, END]] : [[a, END], [b, NEXT]]);
    const name = k < 3 ? "sujet-" + (k + 1) : "fin";
    await sleep(1500);
    check(await bothOn(a, b, name) && await same(), k === 1 ? "« Sujet suivant » touché des deux côtés : un seul sujet de passé" : k === 2 ? "A touche « Sujet suivant » et B « Terminer » : les deux se retrouvent au sujet suivant" : "A touche « Terminer » et B « Sujet suivant » : les deux se retrouvent devant le résultat");
  }
  check(await count(a, ".debat-list li") === 3 && await count(b, ".debat-list li") === 3 && await score(a) === "0-0" && await title(a) === await title(b), "le résultat est le même des deux côtés : trois débats, aucun point");
  await together([[a, AGAIN], [b, AGAIN]]);
  await sleep(1500);
  check(await bothOn(a, b, "sujet-0") && (await saved(a)).gen === 2 && (await saved(b)).gen === 2 && await same() && await sides(a) === await sides(b), "« Rejouer » touché des deux côtés : une seule nouvelle manche, le même sujet et les mêmes camps");
  const n = await posts(env);
  check(n <= 44, "trois débats où tout est touché en double restent sous quarante-quatre messages (" + n + ")");
});

scenario("« J'ai fini » croise la fin du chrono", async (env) => {
  const { a, b } = await pair(env, "croise");
  /* Qui écoute lance le chrono : c'est son téléphone qui enchaînera à zéro. */
  const first = await a.page.locator(".debat-side").first().evaluate((el) => el.classList.contains("as-a")), sp = first ? a : b, li = first ? b : a;
  await tap(li, GO);
  need(await bothOn(a, b, "pour-0"), "le débat ne démarre pas");
  await sleep(700);
  const at = await center(sp, DONE), sent = await posts(env);
  /* Un relais lent : aucun des deux ne voit à temps ce que l'autre envoie. */
  await env.ctl("delay=1500");
  await toZero(li, 0.5);
  await sleep(300);
  await hit(sp, at);
  need(await bothOn(a, b, "contre-0", 6000), "le second temps de parole ne s'ouvre pas des deux côtés");
  await sleep(3500);
  const by = [(await saved(a)).sh.by, (await saved(b)).sh.by];
  check(await posts(env) - sent === 2 && by[0] === by[1], "qui parle touche « J'ai fini » à l'instant où l'autre téléphone arrive à zéro : deux envois se croisent, et les deux téléphones gardent le même (" + (await posts(env) - sent) + " messages, lancé par " + by.join(" et ") + ")");
  const before = await posts(env);
  await Promise.all([toZero(a, 1.2), toZero(b, 1.2)]);
  const moved = await bothOn(a, b, "vote-0", 8000);
  await sleep(2500);
  await env.ctl("delay=0");
  check(moved && await posts(env) - before === 1, "à la fin du second temps de parole, un seul des deux enchaîne (" + (await posts(env) - before) + " message)");
});

/* ====================================================================== Réseau */

scenario("Un téléphone hors ligne un moment", async (env) => {
  const { a, b } = await pair(env, "horsligne");
  await cut(env, b);
  await tap(a, GO);
  await on(a, "pour-0");
  await toZero(a, 0.8);
  need(await on(a, "contre-0", 6000), "A n'est pas passé au second temps de parole");
  await sleep(1500);
  check(await screen(b) === "sujet-0", "B, hors ligne, ne voit pas la partie avancer");
  await b.ctx.setOffline(false);
  check(await on(b, "contre-0", 40000) && await motion(b) === await motion(a) && await num(b) >= 28, "de retour en ligne, B rattrape la partie là où elle en est");
  await tap(await count(a, DONE) ? a : b, DONE);
  await bothOn(a, b, "vote-0");

  await cut(env, a);
  await tap(a, vote("b"));
  await on(a, "attente-0");
  await tap(b, vote("b"));
  await on(b, "attente-0");
  await sleep(2500);
  check(await screen(a) === "attente-0" && await screen(b) === "attente-0", "A vote hors ligne : chacun attend le vote de l'autre");
  await a.ctx.setOffline(false);
  check(await bothOn(a, b, "verdict-0", 40000) && await title(a) === "Inès remporte ce débat." && await title(b) === "Inès remporte ce débat." && await score(a) === "0-1" && await score(b) === "0-1", "A revient en ligne : son vote part, le verdict s'ouvre des deux côtés");

  await tap(a, NEXT);
  await bothOn(a, b, "sujet-1");
  await tap(a, GO);
  await bothOn(a, b, "pour-1");
  await cut(env, a);
  await Promise.all([toZero(a, 1), toZero(b, 1)]);
  check(await on(a, "contre-1", 5000), "A, qui a lancé le chrono, perd le réseau avant la fin : son téléphone passe quand même au second temps de parole");
  check(await until(async () => (await text(b, DONE)).includes("Passer à la suite"), 8000), "B, sans nouvelles, se voit proposer de passer à la suite");
  await tap(b, DONE);
  await on(b, "contre-1");
  await a.ctx.setOffline(false);
  check(await until(async () => { const s = await saved(a); return s.sent.h === s.seq.a.h; }, 40000), "A revient en ligne et dépose son état");
  await sleep(1000);
  check(await screen(a) === "contre-1" && await screen(b) === "contre-1", "les deux en sont au second temps de parole, personne n'a reculé ni sauté le vote");
  await tap(await count(a, DONE) ? a : b, DONE);
  check(await bothOn(a, b, "vote-1", 8000), "et la partie continue jusqu'au vote");
});

scenario("Le relais oublie tout en pleine partie", async (env) => {
  const { a, b } = await pair(env, "oubli");
  await debate(a, a, b, 0);
  await together([[a, vote("a")], [b, vote("a")]]);
  await bothOn(a, b, "verdict-0");
  await tap(b, NEXT);
  await bothOn(a, b, "sujet-1");
  await debate(b, a, b, 1);
  /* B perd le réseau, A vote, le relais oublie tout : le vote d'A n'existe plus que sur son téléphone. */
  await cut(env, b);
  await tap(a, vote("b"));
  await on(a, "attente-1");
  await until(async () => { const s = await saved(a); return s.sent.d === s.seq.a.d; });
  await env.ctl("reset=1");
  await b.ctx.setOffline(false);
  for (const p of [a, b]) await reload(p);
  check(await on(a, "attente-1") && await on(b, "vote-1"), "après l'oubli et deux rechargements, chacun retrouve son écran");
  check(await until(() => count(b, ".debat .hint"), 15000), "le vote d'A, redéposé par son téléphone, arrive chez B");
  await tap(b, vote("b"));
  check(await bothOn(a, b, "verdict-1", 15000) && await title(a) === "Inès remporte ce débat." && await score(a) === "1-1" && await score(b) === "1-1", "B vote : le verdict s'ouvre, et le premier débat compte toujours");
  await tap(a, NEXT);
  check(await bothOn(a, b, "sujet-2") && await motion(a) === await motion(b), "et la partie continue");
  const n = await posts(env);
  check(n >= 5 && n <= 8, "les deux téléphones ont redéposé leur état sans s'emballer (" + n + " messages)");
});

scenario("Un téléphone perd son stockage et revient par le lien d'invitation", async (env) => {
  const { a, b, link } = await pair(env, "perdu");
  /* Navigateur vidé (onglet privé refermé) : B rouvre le lien reçu au début et rejoint de nouveau. */
  const wipe = async () => {
    await b.page.evaluate(() => localStorage.clear());
    await b.page.goto("about:blank");
    await join(b, link);
    await b.page.waitForSelector(".debat");
    await sleep(1500);
  };
  await debate(a, a, b, 0);
  await together([[a, vote("a")], [b, vote("a")]]);
  await bothOn(a, b, "verdict-0");
  await tap(a, NEXT);
  await bothOn(a, b, "sujet-1");
  await wipe();
  check(await where(b) === "sujet-1" && await motion(b) === await motion(a) && (await step(b)).includes("Débat 2"), "A a écrit en dernier : B retrouve le sujet en cours, et son vote du premier débat compte toujours (" + await where(b) + ")");
  await tap(b, SKIP);
  await bothOn(a, b, "sujet-2");
  /* B a écrit en dernier : l'état commun n'existe plus que chez A, qui ne le redépose pas tant qu'il n'écrit
     rien (c'est le socle qui en décide). Le jeu, lui, doit remettre les deux d'accord au premier geste d'A. */
  await wipe();
  check(/^sujet-[12]$/.test(await where(b)) && await healthy(b), "B a écrit en dernier (« Autre sujet ») puis perd son stockage : il revient dans la partie (" + await where(b) + " chez B, " + await where(a) + " chez A)");
  await tap(a, GO);
  check(await bothOn(a, b, "pour-2", 8000) && await title(a) === await title(b), "dès qu'A agit, les deux se retrouvent");
});

/* ====================================================================== Nouvelle manche */

scenario("Nouvelle manche pendant que l'autre joue encore", async (env) => {
  const { a, b } = await pair(env, "manche");
  await debate(a, a, b, 0);
  await together([[a, vote("a")], [b, vote("a")]]);
  await bothOn(a, b, "verdict-0");
  /* B, hors ligne, continue de son côté pendant qu'A termine et relance. */
  await cut(env, b);
  await tap(b, NEXT);
  await on(b, "sujet-1");
  await tap(b, GO);
  await on(b, "pour-1");
  await tap(a, END);
  await on(a, "fin");
  await tap(a, AGAIN);
  await on(a, "sujet-0");
  await tap(a, GO);
  await on(a, "pour-0");
  await b.ctx.setOffline(false);
  check(await on(b, "pour-0", 40000) && (await saved(b)).gen === 2 && await motion(b) === await motion(a) && await title(b) === await title(a), "B revient en ligne : il suit la nouvelle manche lancée par A");
  check(await num(b) >= 28, "avec un chrono neuf");
  await sleep(1500);
  check(await screen(a) === "pour-0" && (await saved(a)).gen === 2, "et ce que B avait fait de son côté ne ramène pas A en arrière");
  await tap(await count(a, DONE) ? a : b, DONE);
  await bothOn(a, b, "contre-0");
  await tap(await count(a, DONE) ? a : b, DONE);
  await bothOn(a, b, "vote-0");
  await together([[a, vote("b")], [b, vote("b")]]);
  check(await bothOn(a, b, "verdict-0") && await score(a) === "0-1" && await score(b) === "0-1", "les votes de la nouvelle manche comptent seuls : ceux de l'ancienne ont disparu");

  /* Le doigt de B part vers un bouton ; A agit juste avant ; le toucher de B tombe sur l'écran suivant. */
  let at = await center(b, NEXT);
  await tap(a, NEXT);
  await on(b, "sujet-1");
  await hit(b, at);
  await sleep(600);
  check(await screen(b) === "sujet-1" && await screen(a) === "sujet-1", "A touche « Sujet suivant » juste avant B : le toucher de B, tombé sur « C'est parti », ne lance pas le débat");
  await debate(a, a, b, 1);
  await together([[a, vote("a")], [b, vote("a")]]);
  await bothOn(a, b, "verdict-1");
  at = await center(b, END);
  await tap(a, NEXT);
  await on(b, "sujet-2");
  await hit(b, at);
  await sleep(600);
  check(await screen(b) === "sujet-2" && await screen(a) === "sujet-2", "B visait « Terminer » : son toucher, tombé sur « Autre sujet », ne passe pas le sujet");
  await debate(b, a, b, 2);
  await together([[a, vote("=")], [b, vote("=")]]);
  await bothOn(a, b, "verdict-2");
  await tap(a, END);
  await bothOn(a, b, "fin");
  at = await center(b, AGAIN, 0.25);
  await tap(a, AGAIN);
  await on(b, "sujet-0");
  await hit(b, at);
  await sleep(600);
  check(await screen(b) === "sujet-0" && await screen(a) === "sujet-0" && (await saved(a)).gen === 3 && (await saved(b)).gen === 3, "A touche « Rejouer » juste avant B : une seule manche de plus, et le débat n'est pas lancé par mégarde");
});

/* ====================================================================== Doigt impatient */

const zones = (p, sel) => p.page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, r: r.right, b: r.bottom, stop: el.getAttribute("data-act") === "g-stop", name: el.textContent.trim().replace(/\s+/g, " ").slice(0, 24) };
}), sel);
/* Remet la partie enregistrée telle qu'elle était, puis recharge. */
async function restore(p, snap) {
  const loaded = p.page.waitForEvent("load");
  await p.page.evaluate((o) => { localStorage.setItem(o.key, o.snap); location.reload(); }, { key: KEY, snap }).catch(() => { /* la page se recharge pendant l'appel */ });
  await loaded;
  await p.page.waitForSelector(".debat");
  await p.page.evaluate(() => window.scrollTo(0, 0));
}
/* Où toucher, dans le bouton `sel`, pour tomber sur un autre bouton une fois l'écran `want` affiché :
   une répétition générale, annulée ensuite, montre ce que cet écran place au même endroit. */
async function aim(p, sel, want) {
  await p.page.waitForSelector(sel, { timeout: 8000 });
  await settled(p);
  const snap = await p.page.evaluate((k) => localStorage.getItem(k), KEY);
  await p.page.click(sel);
  need(await on(p, want), "un seul toucher ne mène pas à " + want);
  const next = (await zones(p, "main.game [data-act]")).sort((x, y) => y.stop - x.stop);
  await restore(p, snap);
  const box = (await zones(p, sel))[0], o = { snap, name: box.name, under: "", at: { x: (box.x + box.r) / 2, y: (box.y + box.b) / 2 } };
  for (const n of next) {
    const x0 = Math.max(box.x, n.x), x1 = Math.min(box.r, n.r), y0 = Math.max(box.y, n.y), y1 = Math.min(box.b, n.b);
    if (x1 - x0 >= 10 && y1 - y0 >= 10) { o.at = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; o.under = n.name; break; }
  }
  return o;
}
/* Trois touchers d'un doigt impatient sur le bouton `sel`, tous au même endroit (voir aim). La partie doit
   se retrouver à l'écran `want`, ni plus loin ni arrêtée. Renvoie "" si c'est le cas. */
async function burst(p, sel, want) {
  const o = await aim(p, sel, want);
  for (let i = 0; i < 3; i++) { await hit(p, o.at); await sleep(120); }
  await sleep(500);
  const got = await where(p);
  if (got === want) return "";
  /* On repart de l'écran attendu, pour essayer les boutons suivants. */
  await restore(p, o.snap);
  await tap(p, sel);
  await on(p, want);
  return "« " + o.name + " » : " + got + " au lieu de " + want + (o.under ? ", le doigt est tombé sur « " + o.under + " »" : "");
}

scenario("Touchers répétés sur chaque bouton, petits écrans", async (env) => {
  for (const [w, h] of [[320, 568], [375, 553], [360, 640], [390, 664], [390, 844]]) {
    const p = await phone(env, "rafale-" + w + "-" + h, { viewport: { width: w, height: h }, data: SAME }), bad = [];
    const go = async (sel, want) => { const b = await burst(p, sel, want); if (b) bad.push(b); };
    await start(p, env);
    await on(p, "sujet-0");
    await go(SKIP, "sujet-1");
    for (let k = 1; k <= 3; k++) {
      await go(GO, "pour-" + k);
      await go(DONE, "contre-" + k);
      await go(DONE, "vote-" + k);
      await go(".debat-picks > :nth-child(" + k + ")", "verdict-" + k);
      await go(k < 3 ? NEXT : END, k < 3 ? "sujet-" + (k + 1) : "fin");
    }
    await go(AGAIN, "sujet-0");
    check(!bad.length, w + " x " + h + " : trois touchers rapides sur un bouton ne font avancer la partie que d'un écran" + (bad.length ? " (" + bad.join(" | ") + ")" : ""));
    await p.ctx.close();
  }
});

scenario("Touchers répétés à deux téléphones", async (env) => {
  /* Un écran de 360 x 640, courant sur Android. Chaque geste a sa propre partie : un téléphone
     sorti du jeu par mégarde n'y revient pas. */
  const table = async (tag, size) => {
    const { a, b } = await pair(env, "rafale-" + tag, { phone: { viewport: size || { width: 360, height: 640 }, data: SAME } });
    return { a, b, state: async () => await where(a) + " chez A, " + await where(b) + " chez B", all: async (name) => await where(a) === name && await where(b) === name };
  };
  let t = await table("fini");
  await rapid(t.a, GO, 3);
  await sleep(600);
  check(await t.all("pour-0"), "trois touchers sur « C'est parti » : le chrono démarre, la parole n'est pas coupée (" + await t.state() + ")");
  await bothOn(t.a, t.b, "pour-0");
  await rapid(await count(t.a, DONE) ? t.a : t.b, DONE, 3);
  await sleep(600);
  check(await t.all("contre-0"), "qui parle touche trois fois « J'ai fini » : un seul temps de parole se termine, personne ne quitte la partie (" + await t.state() + ")");

  /* Qui parle en second laisse filer le temps : son téléphone, qui n'a pas lancé ce chrono, propose de passer à la suite. */
  t = await table("suite");
  await tap(t.a, GO);
  await bothOn(t.a, t.b, "pour-0");
  await tap(await count(t.a, DONE) ? t.a : t.b, DONE);
  await bothOn(t.a, t.b, "contre-0");
  const sp = await count(t.a, DONE) ? t.a : t.b;
  await toZero(sp, -4);
  need(await until(async () => (await text(sp, DONE)).includes("Passer à la suite"), 4000), "« Passer à la suite » n'apparaît pas");
  await rapid(sp, DONE, 3);
  await sleep(600);
  check(await t.all("vote-0"), "trois touchers sur « Passer à la suite » : le vote s'ouvre, personne ne quitte la partie (" + await t.state() + ")");

  /* A vote en second. Au premier débat, on relève où sont « Égalité » puis les boutons du verdict ;
     au deuxième, même écran, le doigt d'A touche deux fois « Égalité » là où ces boutons apparaîtront. */
  t = await table("vote", { width: 320, height: 568 });
  let at = null, under = "";
  for (let k = 0; k < 2; k++) {
    await debate(t.a, t.a, t.b, k);
    await tap(t.b, vote("="));
    await on(t.b, "attente-" + k);
    await until(() => count(t.a, ".debat .hint"));
    const box = (await zones(t.a, vote("=")))[0];
    if (k) {
      for (let i = 0; i < 2; i++) { await hit(t.a, at || { x: (box.x + box.r) / 2, y: (box.y + box.b) / 2 }); await sleep(150); }
      await sleep(800);
      check(await t.all("verdict-1"), "A vote en second, de deux touchers sur « Égalité » : le verdict reste affiché des deux côtés (" + await t.state() + (under ? ", le doigt est tombé sur « " + under + " »" : "") + ")");
      break;
    }
    await tap(t.a, vote("="));
    need(await bothOn(t.a, t.b, "verdict-0"), "le verdict ne s'ouvre pas");
    for (const n of await zones(t.a, ".debat .g-actions [data-act]")) {
      const x0 = Math.max(box.x, n.x), x1 = Math.min(box.r, n.r), y0 = Math.max(box.y, n.y), y1 = Math.min(box.b, n.b);
      if (!at && x1 - x0 >= 10 && y1 - y0 >= 10) { at = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; under = n.name; }
    }
    await tap(t.a, NEXT);
    need(await bothOn(t.a, t.b, "sujet-1"), "le deuxième débat ne s'ouvre pas");
  }
});

scenario("Toucher « J'ai fini » à l'instant où le temps s'écoule", async (env) => {
  const p = await phone(env, "dernier", { viewport: { width: 360, height: 640 }, data: SAME });
  await start(p, env);
  await on(p, "sujet-0");
  await tap(p, GO);
  /* Qui parle touche deux fois « J'ai fini » à la dernière seconde : le téléphone vient de passer à la suite tout seul. */
  for (const [from, to, label] of [["pour-0", "contre-0", "du premier temps de parole : le second orateur garde tout son temps"], ["contre-0", "vote-0", "du second : le vote s'ouvre, la partie n'est pas arrêtée"]]) {
    need(await on(p, from), from + " ne s'ouvre pas");
    const o = await aim(p, DONE, to);
    await toZero(p, 0.6);
    need(await on(p, to, 4000), "à zéro, le téléphone ne passe pas à " + to);
    for (let i = 0; i < 2; i++) { await hit(p, o.at); await sleep(150); }
    await sleep(500);
    const got = await where(p);
    if (!check(got === to, "deux touchers sur « J'ai fini » juste après la fin " + label + (got === to ? "" : " (" + got + (o.under ? ", le doigt est tombé sur « " + o.under + " »" : "") + ")"))) break;
  }
});

/* ====================================================================== Écrans et prénoms */

scenario("Petit écran, grand écran, prénoms extrêmes", async (env) => {
  const NAMES = { a: "Jean-Christophe d'Ar", b: "W".repeat(20) };
  for (const [tag, o, names] of [["320 x 568", { viewport: { width: 320, height: 568 } }, NAMES], ["568 x 320 (téléphone couché)", { viewport: { width: 568, height: 320 } }, { a: "Alex", b: "Inès" }], ["1280 x 800", DESK, { a: "", b: "" }]]) {
    const { a, b } = await pair(env, "ecran-" + tag.slice(0, 3), Object.assign({ phone: o }, names)), bad = [];
    const look = async (p, label) => { const f = await fit(p); if (f) bad.push(label + " : " + f); };
    await look(a, "annonce");
    await tap(a, GO);
    await bothOn(a, b, "pour-0");
    await look(a, "temps de parole chez A");
    await look(b, "temps de parole chez B");
    if (names.a === "") check(/^Partenaire [12] plaide pour\.$/.test(await title(a)), tag + " : sans prénoms, le jeu parle de « Partenaire 1 » et « Partenaire 2 »");
    const sp = await count(a, DONE) ? a : b, ot = sp === a ? b : a;
    await toZero(ot, -4);
    await until(() => count(ot, DONE), 4000);
    await look(ot, "temps écoulé");
    await tap(sp, DONE);
    await bothOn(a, b, "contre-0");
    await tap(await count(a, DONE) ? a : b, DONE);
    await bothOn(a, b, "vote-0");
    await look(a, "vote");
    await tap(a, vote("b"));
    await on(a, "attente-0");
    await look(a, "attente");
    const wait = (await text(a, ".g-wait .sync")).replace(/\u00a0/g, " ");
    check(wait === "En attente du vote " + (names.b === "Inès" ? "d'Inès" : "de " + (names.b || "Partenaire 2")) + "…", tag + " : l'attente nomme l'autre joueur (" + wait + ")");
    await until(() => count(b, ".debat .hint"));
    await look(b, "vote, l'autre a déjà voté");
    await tap(b, vote("a"));
    await bothOn(a, b, "verdict-0");
    await look(b, "verdict");
    check(await title(b) === "Trop de politesse pour gagner." && (await text(b, ".debat-cast")).includes("a voté pour " + (names.a || "Partenaire 1")), tag + " : le verdict dit qui a voté pour qui");
    /* Le haut de la rangée de boutons est un dégradé transparent : une douzaine de pixels dessous restent lisibles. */
    if (names === NAMES) check(await hidden(b, ".debat .g-score") <= 12, tag + " : à l'arrivée du verdict, le score est visible au-dessus des boutons (" + await hidden(b, ".debat .g-score") + " px cachés)");
    await tap(b, END);
    await bothOn(a, b, "fin");
    await look(a, "résultat");
    check(!bad.length, tag + " : rien ne dépasse, tout bouton fait 44 px, les chiffres du chrono sont grands et entiers, la ponctuation est française" + (bad.length ? " (" + bad.join(" | ") + ")" : ""));
    if (o === DESK) {
      const wide = await a.page.evaluate(() => document.querySelector(".debat").getBoundingClientRect().width);
      check(wide <= 46 * 16 + 1, "grand écran : le jeu reste dans une colonne étroite (" + Math.round(wide) + " px)");
    }
    await a.ctx.close();
    await b.ctx.close();
  }
});

/* ====================================================================== Clavier */

scenario("Au clavier seulement, à deux", async (env) => {
  const { a, b } = await pair(env, "clavier", { phone: DESK });
  const tabs = [];
  let ring = true;
  /* Tabule jusqu'au bouton, vérifie que le focus se voit, puis l'active. */
  const press = async (p, sel, key) => {
    tabs.push(await tabTo(p, sel));
    ring = ring && await p.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });
    await p.page.keyboard.press(key || "Enter");
  };
  check(await focused(a, ".debat [data-focus]") && await focused(b, ".debat [data-focus]"), "à l'ouverture, le focus est sur le sujet");
  /* Entrée gardée enfoncée : le clavier répète l'appui. */
  tabs.push(await tabTo(a, GO));
  for (let i = 0; i < 6; i++) { await a.page.keyboard.down("Enter"); await sleep(40); }
  await a.page.keyboard.up("Enter");
  await sleep(800);
  check(await screen(a) === "pour-0" && await on(b, "pour-0"), "Entrée gardée enfoncée sur « C'est parti » : le chrono démarre, la parole n'est pas coupée");
  check(await focused(a, ".debat-speaker") && await focused(b, ".debat-speaker"), "le focus passe sur le nom de qui parle, des deux côtés");
  await press(await count(a, DONE) ? a : b, DONE, "Space");
  await bothOn(a, b, "contre-0");
  await press(await count(a, DONE) ? a : b, DONE);
  check(await bothOn(a, b, "vote-0"), "« J'ai fini » à la barre d'espace puis à Entrée : le vote s'ouvre");
  tabs.push(await tabTo(b, vote("=")));
  await press(a, ".debat-pick");
  await on(a, "attente-0");
  await until(() => count(b, ".debat .hint"));
  check(await focused(b, vote("=")), "le vote d'A arrive pendant que B choisit au clavier : le focus de B reste sur son bouton");
  await b.page.keyboard.press("Space");
  check(await bothOn(a, b, "verdict-0") && await title(a) === "Égalité.", "les deux votes au clavier donnent le verdict");
  await press(b, NEXT);
  check(await bothOn(a, b, "sujet-1") && tabs.every((n) => n > 0 && n <= 3), "tout le débat se joue en trois tabulations au plus par écran (" + tabs.join(", ") + ")");
  check(ring, "avec un focus visible sur chaque bouton");
});

/* ====================================================================== Horloges */

scenario("Horloges déréglées et fin du temps", async (env) => {
  const { a, b } = await pair(env, "horloges", { skew: { a: 3 * 3600e3, b: -7 * 60e3 } });
  await tap(a, GO);
  await bothOn(a, b, "pour-0");
  check(await num(a) >= 29 && await num(b) >= 29, "A a trois heures d'avance, B sept minutes de retard : les deux chronos partent de trente secondes");
  await sleep(1200);
  await reload(b);
  const n = await num(b);
  check(n >= 25 && n <= 29, "et celui de B reprend après rechargement (" + n + ")");
  /* A lance tous les temps de parole : à chaque fin, son téléphone signale et enchaîne. Celui de B, qui a vu
     chaque phase commencer trois dixièmes de seconde plus tard (le temps du réseau), la signale-t-il aussi ? */
  const seen = { a: 0, b: 0 }, phases = [["contre-0"], ["vote-0", "="], ["contre-1"], ["vote-1", "="], ["contre-2"], ["vote-2", "="]];
  for (const [name, v] of phases) {
    const f0 = [(await fx(a)).flash, (await fx(b)).flash];
    await Promise.all([toZero(a, 1.2), toZero(b, 1.5)]);
    need(await bothOn(a, b, name, 6000), name + " ne s'ouvre pas des deux côtés");
    await sleep(400);
    seen.a += (await fx(a)).flash - f0[0];
    seen.b += (await fx(b)).flash - f0[1];
    if (v) {
      await together([[a, vote(v)], [b, vote(v)]]);
      await tap(a, NEXT);
      await tap(a, GO);
      await bothOn(a, b, "pour-" + (Number(name.slice(-1)) + 1));
    }
  }
  check(seen.a === phases.length, "le téléphone qui a lancé le chrono signale chaque fin de temps (" + seen.a + " sur " + phases.length + ")");
  check(seen.b === phases.length, "l'autre téléphone la signale aussi, à chaque fois (" + seen.b + " sur " + phases.length + ")");
});

scenario("Revenir juste après la fin du temps, quand l'autre a déjà enchaîné", async (env) => {
  const { a, b } = await pair(env, "retour");
  /* Il faut un sujet où B parle en premier : A passe les autres. */
  let k = 0;
  while (k < 8 && !(await a.page.locator(".debat-side").first().evaluate((el) => el.classList.contains("as-b")))) { await tap(a, SKIP); k++; await bothOn(a, b, "sujet-" + k); }
  /* A lance le chrono puis s'absente ; B, qui parle, termine avant la fin ; A revient une seconde après la fin de son propre chrono. */
  await tap(a, GO);
  need(await bothOn(a, b, "pour-" + k) && await count(b, DONE) === 1, "pas de sujet où B parle en premier");
  await a.page.click(HOME);
  await a.page.waitForSelector(CARD);
  await tap(b, DONE);
  await on(b, "contre-" + k);
  await sleep(600);
  const sent = await posts(env), was = await num(b);
  /* Un relais à 400 ms, comme un vrai réseau de téléphone. */
  await env.ctl("delay=400");
  await toZero(a, -1);
  await a.page.click(RESUME);
  await on(a, "contre-" + k, 8000);
  await sleep(1500);
  await env.ctl("delay=0");
  const f = await fx(a);
  check(f.flash === 0 && f.buzz === 0, "A revient alors que B a déjà rendu la parole : son téléphone ne signale pas une fin de temps qui n'a pas eu lieu (" + f.flash + " éclair, " + f.buzz + " vibration)");
  check(await posts(env) === sent, "et n'envoie rien (" + (await posts(env) - sent) + " message)");
  check(await num(b) <= was && Math.abs(await num(a) - await num(b)) <= 31, "le chrono de B, lui, continue");
  /* Le téléphone de B, qui doit enchaîner, s'endort avant la fin (autre application, écran verrouillé) et ne
     se réveille qu'une seconde après : son horloge a sauté d'un coup. */
  const f0 = (await fx(b)).flash, sent2 = await posts(env);
  await toZero(b, -1);
  await sleep(700);
  check(await screen(b) === "contre-" + k && await count(b, ".debat-over") === 1 && (await fx(b)).flash === f0 && await posts(env) === sent2, "B se réveille une seconde après la fin de son chrono : son téléphone affiche le temps écoulé, sans éclair ni envoi");
  check(await until(async () => (await text(b, DONE)).includes("Passer à la suite"), 5000), "puis propose de passer à la suite");
});

/* ====================================================================== Valeurs hostiles */

scenario("Valeurs hostiles envoyées par l'autre téléphone", async (env) => {
  const { a, b } = await pair(env, "pirate"), total = await a.page.evaluate(() => window.GAME_DATA.debat.topics.length);
  /* Attend que ce que B vient de déposer soit arrivé chez A. */
  const arrived = (x) => until(async () => {
    const sa = await saved(a), sb = await saved(b);
    return sa.st === sb.st && sa.sw === sb.sw && sa.setup.seed === sb.setup.seed && (!("d" in x) || JSON.stringify(sa.S.b.d) === JSON.stringify(sb.S.b.d));
  }, 8000);
  const bad = [];
  for (const sh of [{ k: 1e308, ph: "vote" }, { k: -1, ph: "fin" }, { k: "2", ph: "pour" }, { k: [1], ph: "contre" }, { k: 0.5, ph: "vote" }, { k: null, ph: "vote" }, { ph: "vote" }, { k: total, ph: "vote" },
    { k: 0, ph: ["vote"] }, { k: 0, ph: "__proto__" }, { k: 0, ph: "toString" }, { k: 0, ph: 3 }, { k: 0, ph: HOSTILE, v: { 0: HOSTILE } }, { k: { valueOf: 1 }, ph: "pour", x: "y".repeat(2000) }]) {
    await inject(b, { sh });
    if (!(await arrived({}) && await screen(a) === "sujet-0" && await healthy(a))) bad.push(JSON.stringify(sh).slice(0, 40) + " -> " + await screen(a));
  }
  check(!bad.length, "quatorze états communs malformés : A reprend chaque fois au début du premier sujet, sans rien exécuter" + (bad.length ? " (" + bad.join(" | ") + ")" : ""));
  await inject(b, { sh: { k: total - 1, ph: "vote" } });
  check(await arrived({}) && await on(a, "vote-" + (total - 1)) && await healthy(a) && await count(a, ".debat-pick") === 3, "un saut au vote du dernier sujet, sans débat : A affiche ce vote, sans dégât");

  const odd = [];
  for (const d of [{ v: "a" }, { v: null }, { v: 7 }, { v: [HOSTILE] }, { v: { 0: "A" } }, { v: { 0: ["a"] } }, { v: { 0: 1 } }, { v: { 0: HOSTILE } }, "{\"v\":{\"__proto__\":{\"0\":\"a\"}}}", { v: { 1: "a", 5: "b" } }]) {
    await inject(b, { sh: { k: 0, ph: "vote" }, d });
    if (!(await arrived({ d }) && await screen(a) === "vote-0" && await count(a, ".debat .hint") === 0 && await count(a, ".debat-pick") === 3 && await healthy(a))) odd.push((typeof d === "string" ? d : JSON.stringify(d)).slice(0, 40) + " -> " + await screen(a));
  }
  check(!odd.length, "dix votes malformés dans la tranche de B : aucun ne compte chez A, le vote reste ouvert" + (odd.length ? " (" + odd.join(" | ") + ")" : ""));
  await inject(b, { d: { v: { 0: "a" }, x: "y".repeat(3000) } });
  check(await arrived({ d: 1 }) && await until(() => count(a, ".debat .hint")) && await screen(a) === "vote-0" && await count(a, ".debat-cast") === 0, "un vote valable noyé dans une grosse tranche : A apprend seulement que B a voté");
  await a.page.evaluate((h) => {
    const x = document.createElement("button");
    x.setAttribute("data-act", "vote");
    x.setAttribute("data-v", h);
    document.querySelector(".debat").appendChild(x);
    x.click();
  }, HOSTILE);
  await sleep(300);
  check(await screen(a) === "vote-0" && JSON.stringify((await saved(a)).S.a.d) === "{}", "un bouton de vote forgé avec une valeur inconnue n'écrit rien");
  await tap(a, vote("b"));
  check(await on(a, "verdict-0") && await title(a) === "Trop de politesse pour gagner." && await healthy(a), "le vrai vote d'A donne le verdict");

  const off = [];
  for (const su of [{ duree: 30 }, { duree: ["90"] }, { duree: "45" }, { duree: {} }, { duree: null }, { duree: HOSTILE }, { vus: "abc" }, { vus: Array(5000).fill(3) }, { vus: [[0], "1", -1, 1.5, 1e9, null, 2, 2] },
    { vus: { length: 2, 0: 1 } }, { seed: "graine" }, { seed: -7.5 }, { seed: 1e300 }, { seed: "" }, { seed: HOSTILE, duree: "90", vus: [0, 1] }]) {
    await inject(b, { su, sh: { k: 0, ph: "sujet" } });
    await b.page.waitForSelector(".debat");
    const ok = await arrived({}) && await on(a, "sujet-0") && await healthy(a) && await healthy(b) && await motion(a) === await motion(b) && await sides(a) === await sides(b) &&
      /^(Trente secondes|Une minute|Une minute trente) chacun/.test((await lead(a)).split(". ").pop());
    if (!ok) off.push(JSON.stringify(su).slice(0, 40) + " -> " + await screen(a));
  }
  check(!off.length, "quinze réglages malformés (durée, sujets déjà vus, graine) : même sujet et mêmes camps des deux côtés, durée connue" + (off.length ? " (" + off.join(" | ") + ")" : ""));
  b.errors.length = 0; /* le téléphone pirate a volontairement un état abîmé : ses propres erreurs ne comptent pas */
  await sleep(800);
  await debate(a, a, b, 0);
  await together([[a, vote("a")], [b, vote("a")]]);
  check(await bothOn(a, b, "verdict-0") && await title(a) === "Alex remporte ce débat." && await score(a) === "1-0" && await healthy(a), "après tout cela, un débat se joue normalement");
});

/* ====================================================================== */

(async () => {
  const only = process.argv[2] || "";
  const env = await setup({ net: !!process.env.EN_NET });
  for (const s of SCENARIOS) {
    if (only && s.name.indexOf(only) < 0) continue;
    console.log(s.name);
    const first = env.phones.length;
    try { await s.fn(env); } catch (e) { check(false, "le scénario va jusqu'au bout (interrompu : " + String(e && e.message).split("\n")[0] + ")"); }
    for (const p of env.phones.slice(first)) await p.ctx.close().catch(() => {});
    await env.ctl("reset=1");
  }
  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
