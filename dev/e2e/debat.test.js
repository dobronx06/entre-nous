/* Essais du jeu « Le débat idiot » : une partie complète sur un téléphone, puis sur deux par le faux
   relais, avec rechargements, chrono repris, téléphone qui s'absente, votes secrets, relance par le
   second joueur et données hostiles ; puis ce que font de vraies mains : toucher trois fois, jouer au
   clavier, rejouer plusieurs parties, sur un petit écran, depuis un fichier local. */
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const KEY = "en:g:debat";

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Sujets de secours : ils ne servent que si jeux/debat.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.debat = { topics: Array.from({ length: 12 }, (_, i) => "Sujet d'essai numéro " + (i + 1)) };
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
/* Le navigateur d'essai refuse de garder l'écran allumé : ce faux verrou accepte toujours, et compte ceux qui sont tenus. */
function fakeLock() {
  window.__locks = [];
  const make = () => { const l = new EventTarget(); l.gone = false; l.release = () => { l.gone = true; l.dispatchEvent(new Event("release")); return Promise.resolve(); }; return l; };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: () => { const l = make(); window.__locks.push(l); return Promise.resolve(l); } } });
}
/* o.lock : faux verrou d'écran ; o.topics : nombre de sujets imposé, servi à la place de jeux/debat.data.js ;
   le reste va à lib.phone (viewport, mobile, touch…). */
async function phone(env, name, o) {
  o = o || {};
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  await p.ctx.addInitScript(probe);
  if (o.lock) await p.ctx.addInitScript(fakeLock);
  if (o.topics) {
    const body = "(window.GAME_DATA = window.GAME_DATA || {}).debat = " + JSON.stringify({ topics: Array.from({ length: o.topics }, (_, i) => "Sujet imposé numéro " + (i + 1)) }) + ";";
    await p.ctx.route(/\/jeux\/debat\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body }));
  }
  return p;
}
/* Présentation du jeu : prénoms, durée, puis départ sur un téléphone ou sur deux. */
async function start(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-debat");
  await p.page.fill("#name-a", o.a != null ? o.a : "Alex");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  if (o.duree) await p.page.click('[data-act="g-opt"][data-val="' + o.duree + '"]');
  await p.page.click('[data-act="g-start"][data-mode="' + (o.duo ? "duo" : "solo") + '"]');
}
/* Deux téléphones dans la même partie. o.phone : options des téléphones. */
async function pair(env, tag, o) {
  o = o || {};
  const a = await phone(env, "a" + tag, o.phone), b = await phone(env, "b" + tag, o.phone);
  await start(a, env, Object.assign({ duo: true }, o));
  await b.page.goto(await a.page.locator(".share[data-url]").getAttribute("data-url"));
  await b.page.click('[data-act="g-join"]');
  return { a, b };
}
const screen = (p) => p.page.evaluate(() => { const el = document.querySelector(".debat"); return el ? el.getAttribute("data-screen") : ""; });
const on = (p, name, ms) => until(async () => (await screen(p)) === name, ms);
const title = async (p) => (await p.page.locator(".debat .g-title").textContent()).trim();
const topic = (p) => p.page.locator(".debat-topic").textContent();
const step = (p) => p.page.locator(".debat-step").textContent();
const lead = (p) => p.page.locator(".debat .g-lead").textContent();
const sides = async (p) => (await p.page.locator(".debat-side").allTextContents()).join(" / ");
const num = async (p) => parseInt(await p.page.locator(".debat-num").textContent(), 10);
const score = async (p) => (await p.page.locator(".g-score b").allTextContents()).join("-");
const count = (p, sel) => p.page.locator(sel).count();
const fx = (p) => p.page.evaluate(() => window.__fx);
const saved = (p) => p.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const held = (p) => p.page.evaluate(() => window.__locks.filter((l) => !l.gone).length);
const safe = async (p) => await count(p, "#app img") === 0 && await p.page.evaluate(() => window.__xss === undefined);
const DONE = '.debat [data-act="done"]', GO = '.debat [data-act="go"]';
/* Ce qui dépasse de l'écran en largeur (la page ne doit jamais défiler de côté). */
const overflow = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  document.querySelectorAll("#app *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > w + 1) out.push((el.className && el.className.baseVal == null ? "." + String(el.className).split(" ")[0] : el.tagName.toLowerCase()) + " jusqu'à " + Math.round(r.right) + " px");
  });
  return document.documentElement.scrollWidth > w + 1 || out.length ? "page de " + document.documentElement.scrollWidth + " px pour " + w + " ; " + out.slice(0, 3).join(", ") : "";
});
/* Boutons et liens du jeu dont la zone tactile fait moins de 44 px de haut. */
const small = (p) => p.page.evaluate(() => Array.from(document.querySelectorAll("main.game button, main.game a"))
  .map((el) => ({ t: el.textContent.trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
  .filter((x) => x.h > 0 && x.h < 44).map((x) => "« " + x.t + " » : " + x.h + " px").join(", "));
/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent sur ce qui
   s'affiche à cet endroit après le premier. */
async function rapid(p, sel, n) {
  const box = await p.page.locator(sel).first().boundingBox();
  for (let i = 0; i < n; i++) {
    await p.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
  }
}
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
async function tabTo(p, sel) {
  for (let i = 1; i <= 8; i++) {
    await p.page.keyboard.press("Tab");
    if (await p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), sel)) return i;
  }
  return -1;
}

/* Le jeu ignore un toucher qui suit de trop près l'apparition d'un écran ou de ses boutons : on laisse passer ce délai. */
async function settled(p) {
  const age = await p.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "null"); return s && s.local.e ? Date.now() - s.local.e.at : 1e6; }, KEY);
  if (age < 700) await sleep(700 - age);
}
async function tap(p, act, v) {
  const sel = '.debat [data-act="' + act + '"]' + (v ? '[data-v="' + v + '"]' : "");
  await p.page.waitForSelector(sel);
  await settled(p);
  await p.page.click(sel);
}
/* Modifie la partie enregistrée puis recharge, sans laisser à la page le temps de réécrire par-dessus. */
async function rewrite(p, fn, arg) {
  const loaded = p.page.waitForEvent("load");
  await p.page.evaluate((o) => {
    const s = JSON.parse(localStorage.getItem(o.key));
    (0, eval)("(" + o.fn + ")")(s, o.arg);
    localStorage.setItem(o.key, JSON.stringify(s));
    location.reload();
  }, { key: KEY, fn: fn.toString(), arg }).catch(() => { /* la page se recharge pendant l'appel */ });
  await loaded;
  await p.page.waitForSelector(".debat");
}
/* Fait comme si le temps de parole en cours avait commencé plus tôt sur ce téléphone : il lui reste `left` secondes. */
const jump = (p, left, dur) => rewrite(p, (s, o) => { s.local.t.at = Date.now() - (o.dur - o.left) * 1000; }, { left, dur: dur || 30 });
/* Un débat entier jusqu'au vote : `starter` lance le chrono, puis chacun arrête son propre temps de parole. */
async function debate(starter, a, b, k) {
  await tap(starter, "go");
  for (const ph of ["pour", "contre"]) {
    await Promise.all([on(a, ph + "-" + k), on(b, ph + "-" + k)]);
    await tap(await count(a, DONE) ? a : b, "done");
  }
  await Promise.all([on(a, "vote-" + k), on(b, "vote-" + k)]);
}

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul", { lock: true });
  await one.page.goto(env.base + "#jeu-debat");
  check((await one.page.locator("main.intro h1").textContent()).includes("défendre"), "la présentation du jeu s'affiche");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="30"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await on(one, "sujet-0");
  const first = (await topic(one)).trim(), camps = await sides(one);
  check(first.length > 10 && /[^.]\.$/.test(first), "un sujet s'affiche, terminé par un point");
  check(/^.+Pour \/ .+Contre$/.test(camps) && camps.includes("Alex") && camps.includes("Inès"), "chacun reçoit son camp (" + camps + ")");
  check((await lead(one)).includes((camps.indexOf("Alex") < camps.indexOf("Inès") ? "Alex" : "Inès") + " ouvre le débat") && (await lead(one)).includes("Trente secondes chacun"), "l'annonce dit qui commence, et pour combien de temps");
  await tap(one, "skip");
  check(await on(one, "sujet-1") && (await topic(one)).trim() !== first && (await step(one)).includes("Débat 1"), "« Autre sujet » change de sujet sans compter un débat");
  await sleep(700);
  await rapid(one, '.debat [data-act="skip"]', 3);
  check(await screen(one) === "sujet-2", "trois touchers d'un doigt impatient sur « Autre sujet » : un seul sujet passé");
  /* Le camp de chacun est tiré au sort à chaque sujet : on relit celui du sujet qui va être débattu. */
  const P = (await sides(one)).indexOf("Alex") < (await sides(one)).indexOf("Inès") ? "Alex" : "Inès", C = P === "Alex" ? "Inès" : "Alex", pw = P === "Alex" ? "a" : "b", cw = pw === "a" ? "b" : "a";
  await tap(one, "go");
  await on(one, "pour-2");
  check(await title(one) === P + " plaide pour." && await count(one, ".debat.as-" + pw) === 1, "le temps de parole dit qui parle, dans son encre");
  check([30, 29].includes(await num(one)) && (await one.page.locator(DONE).textContent()).includes("J'ai fini"), "le chrono part de trente secondes, avec le bouton « J'ai fini »");
  check((await fx(one)).beep === 1 && (await fx(one)).flash === 0, "un bip marque le départ");
  await sleep(1500);
  const n1 = await num(one);
  check(n1 >= 26 && n1 <= 29, "le chrono descend (" + n1 + ")");
  check(await held(one) === 1, "pendant le temps de parole, l'écran est gardé allumé");
  await one.page.evaluate(() => window.__locks[0].release());
  check(await until(async () => await held(one) === 1 && await one.page.evaluate(() => window.__locks.length === 2), 2000), "si le navigateur reprend ce droit, le jeu le redemande");
  await one.page.reload();
  await on(one, "pour-2");
  const n2 = await num(one);
  check(n2 <= n1 && n2 >= n1 - 3, "après rechargement, le chrono reprend où il en était (" + n2 + ")");
  await jump(one, 1.5);
  check(await on(one, "contre-2", 6000), "à zéro, la parole passe toute seule à l'autre");
  const end = await fx(one);
  check(end.flash === 1 && end.buzz === 1 && end.beep === 1, "avec un éclair, une vibration et un bip");
  check(await title(one) === C + " plaide contre." && await count(one, ".debat.as-" + cw) === 1 && [30, 29].includes(await num(one)), "le second temps de parole démarre pour " + C);
  await tap(one, "done");
  await on(one, "vote-2");
  check((await title(one)).includes("Qui a le mieux plaidé") && await count(one, ".debat-pick") === 3, "« J'ai fini » ouvre le vote : les deux joueurs ou l'égalité");
  check(await held(one) === 0, "au vote, l'écran n'est plus retenu");
  await tap(one, "vote", pw);
  await on(one, "verdict-2");
  check(await title(one) === P + " remporte ce débat." && await score(one) === (pw === "a" ? "1-0" : "0-1"), "le verdict désigne " + P + " et le score suit");
  await one.page.reload();
  check(await on(one, "verdict-2") && await title(one) === P + " remporte ce débat.", "après rechargement, on retrouve le verdict");
  await tap(one, "next");
  check(await on(one, "sujet-3") && (await step(one)).includes("Débat 2"), "« Sujet suivant » ouvre le deuxième débat");
  await tap(one, "go");
  await on(one, "pour-3");
  await jump(one, -40);
  await sleep(600);
  check(await screen(one) === "pour-3" && (await fx(one)).flash === 0 && await num(one) === 0, "rouvert longtemps après la fin du temps, le téléphone n'enchaîne pas tout seul");
  check((await one.page.locator(DONE).textContent()).includes("Passer à la suite"), "il propose de passer à la suite");
  await tap(one, "done");
  await on(one, "contre-3");
  await tap(one, "done");
  await on(one, "vote-3");
  await tap(one, "vote", "=");
  check(await on(one, "verdict-3") && await title(one) === "Égalité." && await score(one) === (pw === "a" ? "1-0" : "0-1"), "une égalité ne donne de point à personne");
  await one.page.goto(env.base + "#accueil");
  check(await count(one, '.card-state[href="#jeu-debat"]') === 1, "partie en cours : l'accueil propose de la reprendre");
  await one.page.goto(env.base + "#jeu-debat");
  await tap(one, "end");
  check(await on(one, "fin") && await title(one) === P + " remporte la partie.", "« Terminer » affiche le résultat : " + P + " gagne");
  check(await count(one, ".debat-list li") === 2 && (await lead(one)).includes("2 débats, dont 1 sans vainqueur"), "le récapitulatif liste les deux débats joués, pas les sujets passés");
  await one.page.goto(env.base + "#accueil");
  check(await count(one, '.card-state[href="#jeu-debat"]') === 0, "partie terminée : l'accueil ne propose plus de la reprendre");
  await one.page.goto(env.base + "#jeu-debat");
  await tap(one, "again");
  check(await on(one, "sujet-0") && (await step(one)).includes("Débat 1"), "« Rejouer » relance une partie au premier débat");
  const total = await one.page.evaluate(() => window.GAME_DATA.debat.topics.length);
  await rewrite(one, (s, k) => { s.sh = { k, ph: "sujet" }; }, total - 1);
  check(await on(one, "sujet-" + (total - 1)) && await count(one, '.debat [data-act="skip"]') === 0, "au dernier sujet de la liste, « Autre sujet » disparaît");
  await tap(one, "go");
  await tap(one, "done");
  await tap(one, "done");
  await tap(one, "vote", "b");
  await on(one, "verdict-" + (total - 1));
  check(await count(one, '.debat [data-act="next"]') === 0 && (await one.page.locator('.debat [data-act="end"]').textContent()).includes("Voir le résultat"), "et le verdict ne propose plus que le résultat");
  for (const sh of [{ k: -1, ph: "pour" }, { k: 1.5, ph: "vote" }, { k: "1", ph: "contre" }, { k: null, ph: "fin" }, { k: total, ph: "vote" }, { k: 0, ph: 42 }, { k: 0, ph: "constructor" }, { k: 0, ph: "sujet", v: HOSTILE }]) {
    await rewrite(one, (s, x) => { s.sh = x; }, sh);
    check(await screen(one) === "sujet-0" && await safe(one), "état commun " + JSON.stringify(sh).slice(0, 34) + " : retour au début du sujet");
  }
  await rewrite(one, (s, h) => { s.sh = { k: 0, ph: "vote", v: { 0: h, 1: "a" } }; s.setup.duree = h; s.setup.seed = h; }, HOSTILE);
  check(await screen(one) === "vote-0" && await safe(one), "un verdict illisible ne compte pas : le vote reste ouvert");

  console.log("Deux téléphones");
  const { a, b } = await pair(env, "", { duree: "30" }), ph = { a, b };
  check(await on(a, "sujet-0") && await on(b, "sujet-0"), "la partie s'ouvre sur les deux téléphones");
  check(await topic(a) === await topic(b) && await sides(a) === await sides(b), "avec le même sujet et les mêmes camps");
  const pour0 = (await sides(a)).indexOf("Alex") < (await sides(a)).indexOf("Inès") ? "a" : "b";
  check((await lead(ph[pour0])).includes("Tu es pour") && (await lead(ph[pour0 === "a" ? "b" : "a"])).includes("Tu es contre") && (await lead(b)).includes("Trente secondes"), "chacun lit son camp, avec la durée choisie par A");
  await tap(a, "skip");
  check(await on(a, "sujet-1") && await on(b, "sujet-1") && await topic(a) === await topic(b), "« Autre sujet » touché par A change le sujet chez B aussi");
  const pw1 = (await sides(a)).indexOf("Alex") < (await sides(a)).indexOf("Inès") ? "a" : "b", cw1 = pw1 === "a" ? "b" : "a";
  await tap(b, "go");
  check(await on(a, "pour-1") && await on(b, "pour-1") && await title(a) === await title(b), "« C'est parti » touché par B lance le même chrono sur les deux téléphones");
  check(await count(ph[pw1], DONE) === 1 && await count(ph[cw1], DONE) === 0, "seul le téléphone de qui parle peut arrêter le chrono");
  await sleep(1200);
  await jump(b, 1.5);
  check(await on(a, "contre-1", 8000) && await on(b, "contre-1"), "B recharge puis arrive à zéro : il fait passer les deux téléphones au second temps de parole");
  check((await fx(b)).flash === 1 && (await fx(a)).flash === 0, "l'éclair de fin s'affiche sur le téléphone arrivé à zéro");
  await b.page.goto("about:blank");
  const sent = (await env.ctl()).count.post;
  await jump(a, 1.2);
  check(await until(async () => (await a.page.locator(".debat-over").textContent()).includes("Temps écoulé"), 6000), "B est parti : chez A, le chrono arrive à zéro");
  check(await screen(a) === "contre-1" && (await fx(a)).flash === 1 && await count(a, DONE) === 0, "A le signale, mais n'enchaîne pas tout seul");
  check(await until(async () => (await a.page.locator(DONE).textContent()).includes("Passer à la suite"), 6000) && (await env.ctl()).count.post === sent, "trois secondes plus tard, il propose de passer à la suite, sans avoir rien envoyé");
  await tap(a, "done");
  await on(a, "vote-1");
  await b.page.goto(env.base + "#jeu-debat");
  check(await on(b, "vote-1", 8000), "de retour, B rejoint le vote");
  await tap(a, "vote", "a");
  check(await on(a, "attente-1") && await title(a) === "A voté.", "A vote : son téléphone attend B");
  check(await until(async () => (await b.page.locator(".debat .hint").textContent()).includes("Alex a déjà voté")) && (await saved(b)).S.a.d.v[1] === "a", "le vote d'Alex est arrivé chez B");
  check(await screen(b) === "vote-1" && await count(b, ".debat-cast, .g-score") === 0 && !(await b.page.locator(".debat").textContent()).includes("a voté pour"), "mais il n'y est pas affiché");
  await b.page.reload();
  check(await on(b, "vote-1") && await count(b, ".debat-pick") === 3, "après rechargement, B peut toujours voter");
  await tap(b, "vote", "b");
  check(await on(a, "verdict-1") && await on(b, "verdict-1"), "quand les deux ont voté, le verdict s'ouvre sur les deux téléphones");
  check(await title(a) === "Mauvaise foi partagée." && await title(b) === "Mauvaise foi partagée." && await score(a) === "0-0", "chacun a voté pour soi : mauvaise foi partagée, aucun point");
  await a.page.reload();
  check(await on(a, "verdict-1") && (await a.page.locator(".debat-cast").textContent()).includes("a voté pour Inès"), "après rechargement, A retrouve le verdict et les deux votes");
  await tap(a, "next");
  check(await on(a, "sujet-2") && await on(b, "sujet-2") && (await step(b)).includes("Débat 2"), "« Sujet suivant » touché par A ouvre le deuxième débat chez les deux");
  await debate(a, a, b, 2);
  await tap(b, "vote", "a");
  await on(b, "attente-2");
  check(await until(() => count(a, ".debat .hint")) && await screen(a) === "vote-2" && await count(a, ".debat-cast") === 0, "cette fois B vote d'abord : A ne voit pas son choix");
  await tap(a, "vote", "b");
  check(await on(a, "verdict-2") && await on(b, "verdict-2") && await title(a) === "Trop de politesse pour gagner." && await title(b) === "Trop de politesse pour gagner.", "chacun a voté pour l'autre : trop de politesse pour gagner");
  await tap(b, "next");
  await Promise.all([on(a, "sujet-3"), on(b, "sujet-3")]);
  await debate(b, a, b, 3);
  await Promise.all([tap(a, "vote", "a"), tap(b, "vote", "a")]);
  check(await on(a, "verdict-3") && await on(b, "verdict-3") && await title(a) === "Alex remporte ce débat." && await title(b) === "Alex remporte ce débat.", "deux votes pour Alex au même instant : Alex gagne sur les deux téléphones");
  check((await lead(b)).includes("Même Inès le reconnaît") && await score(a) === "1-0" && await score(b) === "1-0", "et marque un point");
  await tap(b, "end");
  check(await on(a, "fin") && await on(b, "fin") && await title(a) === "Alex remporte la partie." && await title(b) === await title(a), "« Terminer » touché par B : même résultat des deux côtés");
  check(await count(a, ".debat-list li") === 3 && await count(b, ".debat-list li") === 3 && (await lead(a)).includes("3 débats, dont 2 sans vainqueur"), "avec les trois débats joués");
  await tap(b, "again");
  check(await on(a, "sujet-0") && await on(b, "sujet-0") && (await step(a)).includes("Débat 1"), "B relance : A repart aussi au premier débat");
  check(await topic(a) === await topic(b) && await sides(a) === await sides(b), "avec le même nouveau sujet et les mêmes camps");
  const posts = (await env.ctl()).count.post;
  check(posts <= 24, "trois débats, un sujet passé et une relance coûtent au plus vingt-quatre messages (" + posts + ")");

  console.log("Données hostiles");
  await rewrite(b, (s, h) => {
    s.sh = { k: 1e9, ph: h, v: h };
    s.setup = Object.assign({}, s.setup, { duree: h, vus: [h, -1, 1e9, 2.5, 3, 3, {}] });
    s.st += 5;
    s.S.b = { k: s.gen + ":" + s.setup.seed, d: { v: { 0: h, 1: 7, x: "a" } } };
    s.seq.b.h = s.seq.b.d = Date.now();
  }, HOSTILE);
  check(await until(async () => { const s = await saved(a); return s.sh.ph === HOSTILE && s.S.b.d.v[0] === HOSTILE; }, 8000), "B envoie un état commun et une tranche hostiles, qui arrivent chez A");
  check(await screen(a) === "sujet-0" && await safe(a) && (await topic(a)).trim().length > 10, "A reprend au début du sujet, sans rien exécuter");
  check(await topic(a) === await topic(b) && (await lead(a)).includes("Une minute chacun"), "réglages hostiles : même sujet des deux côtés, durée par défaut");
  await debate(a, a, b, 0);
  check(await count(a, ".debat-pick") === 3 && await count(b, ".debat-pick") === 3 && await safe(a) && await safe(b), "la partie continue : le faux vote de B ne compte pas");
  await Promise.all([tap(a, "vote", "a"), tap(b, "vote", "b")]);
  check(await on(a, "verdict-0") && await on(b, "verdict-0") && await title(a) === "Mauvaise foi partagée.", "et les vrais votes donnent le verdict");
  check(JSON.stringify((await saved(b)).S.b.d.v) === "{\"0\":\"b\"}", "en votant, B a nettoyé sa tranche");
  const c = await phone(env, "c");
  const token = Buffer.from(JSON.stringify({ g: "debat", v: 1, n: [HOSTILE, HOSTILE], r: "0".repeat(32), k: "k".repeat(43), su: { seed: HOSTILE, duree: HOSTILE, vus: HOSTILE }, gen: 1 })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await c.page.goto(env.base + "#g=" + token);
  await c.page.click('[data-act="g-join"]');
  check(await on(c, "sujet-0") && await safe(c) && (await lead(c)).includes("Une minute chacun"), "invitation aux prénoms et réglages hostiles : du texte, et une minute par défaut");
  check(await count(c, GO) === 0 && (await c.page.locator(".debat .g-wait .sync").textContent()).includes("En attente de <img"), "tant que l'autre n'a pas rejoint la partie, le débat ne peut pas être lancé");
  /* On fait comme si l'autre joueur était arrivé, une fois le premier envoi de C terminé (il réécrirait la partie par-dessus). */
  await until(async () => { const s = await saved(c); return s.sent.h === s.seq.b.h; });
  await rewrite(c, (s) => { s.seq.a.h = 1; });
  await tap(c, "go");
  await on(c, "pour-0");
  check([60, 59].includes(await num(c)) && (await title(c)).includes("<img") && await safe(c), "le temps de parole affiche le prénom hostile comme du texte");
  await jump(c, -10, 60);
  await tap(c, "done");
  await on(c, "contre-0");
  await jump(c, -10, 60);
  await tap(c, "done");
  await on(c, "vote-0");
  await tap(c, "vote", "a");
  check(await on(c, "attente-0") && await safe(c), "le vote et l'attente aussi");

  console.log("Doigt impatient, puis clavier");
  const hasty = await phone(env, "rafale");
  await start(hasty, env, { duree: "30" });
  await on(hasty, "sujet-0");
  await sleep(700);
  await rapid(hasty, GO, 3);
  check(await screen(hasty) === "pour-0", "trois touchers sur « C'est parti » : le chrono démarre, la parole n'est pas coupée");
  await sleep(700);
  await rapid(hasty, DONE, 3);
  check(await screen(hasty) === "contre-0", "trois touchers sur « J'ai fini » : un seul temps de parole se termine");
  await sleep(700);
  await rapid(hasty, DONE, 3);
  check(await screen(hasty) === "vote-0" && await count(hasty, ".debat-pick") === 3, "trois touchers à la fin du second : le vote s'ouvre, personne n'a voté par mégarde");
  await sleep(700);
  await rapid(hasty, '.debat [data-act="vote"][data-v="a"]', 3);
  check(await screen(hasty) === "verdict-0" && await score(hasty) === "1-0", "trois touchers sur un vote : un seul verdict");
  await sleep(700);
  await rapid(hasty, '.debat [data-act="end"]', 3);
  check(await screen(hasty) === "fin" && (await saved(hasty)).gen === 1, "trois touchers sur « Terminer » : le résultat s'affiche, aucune partie relancée");
  await sleep(700);
  await rapid(hasty, '.debat [data-act="again"]', 3);
  check(await screen(hasty) === "sujet-0" && (await saved(hasty)).gen === 2, "trois touchers sur « Rejouer » : une seule nouvelle partie, pas encore commencée");
  const keys = await phone(env, "clavier", { viewport: { width: 1280, height: 800 }, scale: 1, mobile: false, touch: false });
  await start(keys, env);
  await on(keys, "sujet-0");
  const tabs = [];
  let ring = true;
  for (const [sel, next] of [[GO, "pour-0"], [DONE, "contre-0"], [DONE, "vote-0"], [".debat-pick", "verdict-0"], ['.debat [data-act="next"]', "sujet-1"]]) {
    tabs.push(await tabTo(keys, sel));
    ring = ring && await keys.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });
    await keys.page.keyboard.press("Enter");
    await on(keys, next, 2000);
  }
  check(await screen(keys) === "sujet-1" && tabs.every((n) => n === 1), "au clavier, un débat s'enchaîne sans attendre : une tabulation puis Entrée à chaque écran (" + tabs.join(", ") + ")");
  check(ring, "avec un focus visible sur chaque bouton");

  console.log("Rejouer sans resservir");
  const again = await phone(env, "rejouer", { topics: 6 });
  await start(again, env);
  const seen = [];
  for (let game = 0; game < 3; game++) {
    await on(again, "sujet-0");
    seen.push(await topic(again));
    await tap(again, "skip");
    await on(again, "sujet-1");
    seen.push(await topic(again));
    for (const [act, v] of [["go"], ["done"], ["done"], ["vote", "a"], ["end"], ["again"]]) await tap(again, act, v);
  }
  check(new Set(seen).size === 6, "trois parties de suite sur six sujets : aucun n'est resservi (" + new Set(seen).size + " différents sur 6)");
  check(await on(again, "sujet-0") && await topic(again) === seen[0], "tous les sujets ont été vus : le plus ancien revient en premier");

  console.log("Petit écran, prénoms extrêmes");
  const NAMES = { a: "D'Art<img src=x>&\"é\"", b: "W".repeat(20) }, SMALL = { viewport: { width: 320, height: 568 } };
  const wide = [], tiny = [];
  const look = async (p, label) => {
    const o = await overflow(p), t = await small(p);
    if (o) wide.push(label + " (" + o + ")");
    if (t) tiny.push(label + " (" + t + ")");
  };
  const mini = await phone(env, "petit", SMALL);
  await start(mini, env, NAMES);
  await on(mini, "sujet-0");
  await look(mini, "annonce");
  for (const [act, v, label] of [["go", "", "premier temps de parole"], ["done", "", "second temps de parole"], ["done", "", "vote"], ["vote", "b", "verdict"], ["end", "", "résultat"]]) {
    await tap(mini, act, v);
    await sleep(150);
    await look(mini, label);
  }
  check(await screen(mini) === "fin" && (await title(mini)).includes("W".repeat(20)) && await safe(mini), "prénoms avec apostrophe, balise, guillemets ou vingt lettres : affichés tels quels jusqu'au résultat");
  const two = await pair(env, "-petit", Object.assign({ phone: SMALL }, NAMES));
  await Promise.all([on(two.a, "sujet-0"), on(two.b, "sujet-0")]);
  await look(two.b, "annonce à deux");
  await debate(two.a, two.a, two.b, 0);
  await look(two.a, "vote à deux");
  await tap(two.a, "vote", "b");
  await on(two.a, "attente-0");
  await look(two.a, "attente du vote de l'autre");
  await tap(two.b, "vote", "a");
  await Promise.all([on(two.a, "verdict-0"), on(two.b, "verdict-0")]);
  await look(two.a, "verdict à deux");
  check(await safe(two.a) && await safe(two.b) && await title(two.b) === "Trop de politesse pour gagner.", "à deux téléphones aussi, jusqu'au verdict");
  check(!wide.length, "320 px : rien ne dépasse en largeur" + (wide.length ? " : " + wide.join(" | ") : ""));
  check(!tiny.length, "320 px : toutes les zones tactiles du jeu font au moins 44 px" + (tiny.length ? " : " + tiny.join(" | ") : ""));

  console.log("Sans sujets");
  const bare = await env.phone("vide");
  await bare.ctx.route(/debat\.data\.js/, (r) => r.abort());
  await bare.page.goto(env.base + "#jeu-debat");
  await bare.page.click('[data-act="g-start"][data-mode="solo"]');
  check(await until(() => count(bare, '.game .g-note[data-screen="vide"]')) && await count(bare, ".debat") === 0, "si le fichier des sujets manque, le jeu le dit au lieu de planter");

  console.log("Page intégrée");
  const f = await phone(env, "cadre");
  await f.page.setContent('<iframe src="' + env.base + '#jeu-debat" style="width:380px;height:800px"></iframe>');
  const frame = f.page.frameLocator("iframe");
  await frame.locator('[data-act="g-start"][data-mode="solo"]').click();
  await frame.locator('.debat [data-act="go"]').waitFor();
  await sleep(700);
  await frame.locator('.debat [data-act="go"]').click();
  await frame.locator(".debat-clock").waitFor();
  await sleep(1300);
  const n = parseInt(await frame.locator(".debat-num").textContent(), 10);
  check(n >= 57 && n <= 59, "dans un cadre, le chrono tourne aussi (" + n + ")");

  console.log("Fichier local");
  const local = await phone(env, "fichier");
  await local.page.goto(pathToFileURL(path.join(ROOT, "index.html")).href + "#jeu-debat");
  check(await count(local, '[data-act="g-start"][data-mode="duo"]') === 0, "ouvert comme un fichier (file://), seul le jeu sur un téléphone est proposé");
  await local.page.click('[data-act="g-start"][data-mode="solo"]');
  await on(local, "sujet-0");
  await tap(local, "go");
  await sleep(1300);
  check(await screen(local) === "pour-0" && [58, 59].includes(await num(local)), "et le chrono y tourne");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
