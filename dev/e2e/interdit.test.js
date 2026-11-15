/* Essais du jeu « Le mot interdit » : une partie complète sur un téléphone, puis sur deux par le faux
   relais, avec rechargements en plein tour des deux côtés, cartes cachées à qui devine, compte à
   mi-temps, bilan qui n'arrive pas, relance par le second joueur et données hostiles. */
const path = require("path");
const { setup, check, done, sleep, ROOT } = require("./lib");

const KEY = "en:g:interdit";
const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const DATA = path.join(ROOT, "jeux", "interdit.data.js"), GAME = path.join(ROOT, "jeux", "interdit.js");

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Compte les vibrations, les bips et les éclairs : la fin du temps se vérifie sans rien entendre. */
function probe() {
  window.__fx = { buzz: 0, beep: 0, flash: 0 };
  try { Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { window.__fx.buzz++; return true; } }); } catch (e) { /* sans importance */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { const make = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__fx.beep++; return make.call(this); }; }
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("interdit-flash")) window.__fx.flash++; })))
    .observe(document, { childList: true, subtree: true });
}
/* Le jeu n'est pas encore dans index.html : ses fichiers sont injectés avant les scripts de la page. */
function style() {
  document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/interdit.css";
    document.head.appendChild(l);
  });
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(style);
  await p.ctx.addInitScript(probe);
  return p;
}
async function start(p, env, o) {
  await p.page.goto(env.base + "#jeu-interdit");
  await p.page.fill("#name-a", o.a || "Alex");
  await p.page.fill("#name-b", o.b || "Inès");
  if (o.duree) await p.page.click('[data-act="g-opt"][data-val="' + o.duree + '"]');
  await p.page.click('[data-act="g-start"][data-mode="' + (o.duo ? "duo" : "solo") + '"]');
}
const screen = (p) => p.page.evaluate(() => { const el = document.querySelector(".interdit"); return el ? el.getAttribute("data-screen") : ""; });
const on = (p, name, ms) => until(async () => (await screen(p)) === name, ms);
const text = (p, sel) => p.page.locator(sel).first().textContent();
const count = (p, sel) => p.page.locator(sel).count();
const word = async (p) => (await text(p, ".interdit-word")).trim();
const num = async (p) => parseInt(await text(p, ".interdit-num"), 10);
const fx = (p) => p.page.evaluate(() => window.__fx);
const saved = (p) => p.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const safe = async (p) => await count(p, "#app img") === 0 && await p.page.evaluate(() => window.__xss === undefined);
const appText = (p) => p.page.evaluate(() => document.getElementById("app").innerText);
/* Le jeu ignore un toucher qui suit de trop près l'apparition d'un écran : on laisse passer ce délai. */
async function settled(p) {
  const age = await p.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "null"); return s && s.local.e ? Date.now() - s.local.e.at : 1e6; }, KEY);
  if (age < 700) await sleep(700 - age);
}
async function tap(p, act) {
  const sel = '.interdit [data-act="' + act + '"]';
  await p.page.waitForSelector(sel);
  await settled(p);
  await p.page.click(sel);
  /* Une carte qui vient d'arriver ne se compte pas tout de suite (double toucher) : on laisse le temps de la lire. */
  if (act === "ok" || act === "pass") await sleep(400);
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
  await p.page.waitForSelector(".interdit");
}
/* Fait comme si le tour en cours avait commencé plus tôt sur ce téléphone : il lui reste `left` secondes. */
const jump = (p, left, dur) => rewrite(p, (s, o) => { s.local.t.at = Date.now() - (o.dur - o.left) * 1000; }, { left, dur });

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-interdit");
  check((await text(one, "main.intro h1")).includes("demi-mot"), "la présentation du jeu s'affiche");
  check(await count(one, '[data-act="g-opt"][data-opt="duree"]') === 3, "trois durées au choix");
  await start(one, env, { duree: "45" });
  check(await on(one, "passe-0"), "le jeu commence par passer le téléphone");
  check((await text(one, ".g-pass h1")).includes("Au tour d'Alex") && await count(one, ".interdit-card") === 0, "à Alex, qui fait deviner en premier, sans rien montrer de la carte");
  await tap(one, "moi");
  check(await on(one, "pret-0") && (await text(one, ".interdit .g-title")).includes("Alex fait deviner, Inès devine"), "Alex tient l'appareil : qui fait deviner et qui devine");
  check((await text(one, ".interdit .g-lead")).includes("45 secondes") && await count(one, ".interdit-card") === 0, "la durée est annoncée, la carte toujours cachée");
  await tap(one, "go");
  check(await on(one, "jeu-0") && await count(one, ".interdit-card") === 1 && await count(one, ".interdit-x li") === 3, "« C'est parti » : un mot et trois mots interdits");
  check([45, 44].includes(await num(one)) && (await fx(one)).beep === 1, "le chrono part de 45 secondes, avec un bip");
  const seen = [await word(one)];
  await tap(one, "ok");
  check((await text(one, ".interdit-count")).includes("1 trouvé") && await word(one) !== seen[0], "« Trouvé » compte un point et passe à la carte suivante");
  seen.push(await word(one));
  const box = await one.page.locator('[data-act="ok"]').boundingBox();
  await one.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(120);
  await one.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(400);
  check((await text(one, ".interdit-count")).includes("2 trouvés"), "un double toucher sur « Trouvé » ne compte qu'une carte");
  seen.push(await word(one));
  await tap(one, "pass");
  check((await text(one, ".interdit-count")).includes("1 passé") && (await text(one, ".interdit-count")).includes("2 trouvés"), "« Passer » change de carte sans point");
  seen.push(await word(one));
  const n1 = await num(one);
  await one.page.reload();
  await on(one, "jeu-0");
  const n2 = await num(one);
  check(await word(one) === seen[3] && (await text(one, ".interdit-count")).includes("2 trouvés") && n2 <= n1 && n2 >= n1 - 3, "après rechargement, même carte, même compte, le chrono continue (" + n1 + " puis " + n2 + ")");
  await jump(one, 1.5, 45);
  check(await on(one, "passe-1", 6000), "à zéro, le tour se termine tout seul et le téléphone passe à l'autre");
  const end = await fx(one);
  check(end.flash === 1 && end.buzz === 1 && end.beep === 1, "avec un éclair, une vibration et un bip");
  check((await text(one, ".g-pass h1")).includes("Au tour d'Inès") && (await text(one, ".interdit-got")).includes("2 mots trouvés"), "bilan du tour : deux mots, puis au tour d'Inès");
  const listed = await one.page.locator(".interdit-words li").allTextContents();
  check(listed.length === 3 && listed[0].includes(seen[0]) && listed[2].includes(seen[2]) && (await count(one, ".interdit-words .no")) === 1, "le bilan liste les mots trouvés puis le mot passé");
  await tap(one, "moi");
  await tap(one, "go");
  await on(one, "jeu-1");
  check(await count(one, ".interdit.as-b") === 1 && seen.indexOf(await word(one)) < 0, "tour 2 : Inès fait deviner, dans son encre, une carte jamais vue (même celle restée à l'écran au buzzer)");
  /* Les quatre tours suivants, vite : une carte trouvée, puis le temps saute à la fin. */
  for (let t = 1; t < 6; t++) {
    if (t > 1) { await tap(one, "moi"); await tap(one, "go"); await on(one, "jeu-" + t); }
    seen.push(await word(one));
    await tap(one, "ok");
    seen.push(await word(one));
    await jump(one, 0.6, 45);
    await on(one, t < 5 ? "passe-" + (t + 1) : "fin", 6000);
  }
  check(await screen(one) === "fin", "après six tours, le résultat");
  check(new Set(seen).size === seen.length, "aucune carte n'est servie deux fois dans la partie (" + seen.length + " cartes)");
  check((await text(one, ".interdit .g-big")).replace(/\s+/g, " ").trim() === "7 mots" && (await one.page.locator(".g-score b").allTextContents()).join("-") === "4-3", "le total du couple (7) et le compte de chacun (4 et 3)");
  check(await count(one, ".interdit-turns li") === 6 && (await text(one, ".interdit .g-lead")).includes("Nouveau record"), "les six tours sont détaillés, et c'est un nouveau record");
  await tap(one, "again");
  check(await on(one, "passe-0") && (await text(one, ".g-pass h1")).includes("Au tour d'Inès"), "« Rejouer » : nouvelle partie, Inès commence cette fois");
  check((await text(one, ".interdit .g-note")).includes("Partie précédente") && (await text(one, ".interdit .g-note")).includes("7 mots"), "le score de la partie d'avant est rappelé");
  await tap(one, "moi");
  await tap(one, "go");
  await on(one, "jeu-0");
  check(seen.indexOf(await word(one)) < 0, "la nouvelle partie ne ressert pas les cartes de la précédente");

  console.log("Valeurs hostiles");
  await rewrite(one, (s, o) => {
    const k = s.gen + ":" + s.setup.seed;
    s.n = ["<b>Al</b>", "Inès"];
    s.setup.vus = [o.h, 5, 5, -3, 1.5];
    s.setup.prev = { a: o.h, b: 2 };
    s.setup.duree = "999";
    s.sh = { t: o.h, go: "1" };
    s.S.a = { k, d: { r: { 1: { f: [o.h, 3.5, -1, 2], p: "zz", n: 5 }, 3: o.h, x: 1 }, m: { t: o.h, f: 1e9 } } };
    s.local = { c: { t: o.h, f: o.h, i: -4 }, t: "x", h: [] };
  }, HOSTILE);
  check((await screen(one)).length > 0 && await safe(one), "des valeurs mal formées partout : l'écran s'affiche, rien n'est interprété");
  await rewrite(one, (s, o) => { s.sh = { t: 1, go: 0 }; s.local = { h: 1 }; s.S.b = { k: s.gen + ":" + s.setup.seed, d: { r: { 0: { f: [o.h, 2, 999999999], p: [1], n: 4 } } } }; }, HOSTILE);
  check(await on(one, "pret-1") && await safe(one) && (await text(one, ".interdit-got")).includes("1 mot trouvé"), "un bilan à moitié hostile : seuls les rangs valables comptent");
  check((await text(one, ".interdit .g-lead")).includes("une minute"), "une durée inconnue retombe sur une minute");
  check((await appText(one)).includes("<b>Al</b>") && await count(one, ".g-who b") === 0, "un prénom en HTML s'affiche comme du texte");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await start(a, env, { duo: true, duree: "45" });
  await b.page.goto(await a.page.locator(".share[data-url]").getAttribute("data-url"));
  await b.page.click('[data-act="g-join"]');
  check(await on(a, "pret-0") && await on(b, "pret-0"), "les deux téléphones annoncent le premier tour");
  check((await text(a, ".interdit .g-title")).includes("À toi de faire deviner") && await count(a, '[data-act="go"]') === 1, "A fait deviner : à lui de lancer le chrono");
  check((await text(b, ".interdit .g-title")).includes("Alex fait deviner, tu devines") && await count(b, '[data-act="go"]') === 0 && await count(b, ".g-wait") === 1, "B devine : pas de bouton, il attend le départ");
  await tap(a, "go");
  check(await on(a, "jeu-0") && await on(b, "devine-0"), "le chrono part sur les deux téléphones");
  const w0 = await word(a);
  check(await count(b, ".interdit-card, .interdit-x") === 0 && !(await appText(b)).includes(w0), "B ne voit ni la carte ni ses mots interdits (" + w0 + ")");
  check(await count(b, ".interdit-clock") === 1 && (await text(b, ".interdit .g-title")).includes("Alex fait deviner"), "B voit un grand chrono et le nom de qui fait deviner");
  const seen2 = [w0];
  await tap(a, "ok");
  seen2.push(await word(a));
  await tap(a, "ok");
  seen2.push(await word(a));
  await b.page.reload();
  check(await on(b, "devine-0") && (await num(b)) <= 44, "B recharge en plein tour : le chrono reprend");
  await a.page.reload();
  check(await on(a, "jeu-0") && await word(a) === seen2[2] && (await text(a, ".interdit-count")).includes("2 trouvés"), "A recharge en plein tour : même carte, même compte");
  await jump(a, 20, 45);
  check(await until(async () => (await text(b, ".interdit .g-lead")).includes("À mi-temps : 2 mots trouvés"), 6000), "à mi-temps, le compte arrive sur l'écran de B");
  await jump(b, 3, 45);
  await jump(a, 1.5, 45);
  check(await on(a, "pret-1", 6000) && await on(b, "pret-1", 6000), "à zéro, le tour se termine des deux côtés");
  check((await fx(a)).flash === 1 && await until(async () => (await fx(b)).flash === 1, 4000), "le buzzer sonne chez qui fait deviner et chez qui devine, une fois chacun");
  check((await text(b, ".interdit-got")).includes("2 mots trouvés") && (await text(b, ".interdit-total")).includes("2"), "B voit le bilan du tour et le total");
  check((await text(b, ".interdit .g-title")).includes("À toi de faire deviner") && await count(a, '[data-act="go"]') === 0, "les rôles s'inversent : à B de lancer le tour");
  await tap(b, "go");
  await on(b, "jeu-1");
  await on(a, "devine-1");
  check(seen2.indexOf(await word(b)) < 0 && !(await appText(a)).includes(await word(b)), "B a une carte jamais vue, que A ne voit pas");
  /* Tours 2 à 4 : une carte trouvée, puis le temps saute à la fin chez qui fait deviner. */
  for (let t = 1; t < 4; t++) {
    const s = t % 2 ? b : a, o = s === a ? b : a;
    if (t > 1) { await tap(s, "go"); await on(s, "jeu-" + t); await on(o, "devine-" + t); }
    seen2.push(await word(s));
    await tap(s, "ok");
    seen2.push(await word(s));
    await jump(s, 0.6, 45);
    await on(o, "pret-" + (t + 1), 6000);
  }
  /* Tour 5 : A fait deviner, mais son bilan n'arrive pas ; B finit par passer à la suite sans l'attendre. */
  await tap(a, "go");
  await on(b, "devine-4");
  await tap(a, "ok");
  await jump(b, -9, 45);
  check(await until(() => b.page.locator('[data-act="skip"]').count()), "longtemps après la fin du temps sans bilan, B peut passer au tour suivant");
  await tap(b, "skip");
  check(await on(b, "pret-5") && await on(a, "pret-5", 6000), "B passe au tour suivant, A suit");
  check((await text(b, ".interdit-recap")).includes("pas arrivé"), "le bilan manquant est signalé");
  await jump(a, 0.5, 45);
  check(await until(async () => (await text(b, ".interdit-got")).includes("1 mot trouvé"), 6000), "le bilan d'A arrive plus tard : il compte quand même");
  await tap(b, "go");
  await on(b, "jeu-5");
  check(seen2.indexOf(await word(b)) < 0, "toujours aucune carte servie deux fois");
  await tap(b, "ok");
  await jump(b, 0.6, 45);
  check(await on(a, "fin", 6000) && await on(b, "fin", 6000), "après six tours, le résultat des deux côtés");
  const ta = (await text(a, ".interdit .g-big")).trim(), tb = (await text(b, ".interdit .g-big")).trim();
  check(ta === tb && ta.replace(/\s+/g, " ") === "7 mots" && (await a.page.locator(".g-score b").allTextContents()).join("-") === "4-3", "même total des deux côtés (" + ta + "), et le compte de chacun");
  await tap(b, "again");
  check(await on(a, "pret-0", 6000) && await on(b, "pret-0"), "B relance : A repart aussi au premier tour");
  check((await text(b, ".interdit .g-title")).includes("À toi de faire deviner") && (await text(a, ".interdit .g-note")).includes("7 mots"), "cette fois B commence, et le score d'avant est rappelé");
  const posts = (await env.ctl()).count.post;
  check(posts <= 30, "une partie complète à deux, relance comprise, coûte au plus trente messages (" + posts + ")");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
