/* Essais d'endurance du jeu « Le match des envies » : ce que deux personnes font pour de vrai et
   que l'essai de base ne couvre pas (recharger à chaque étape, quitter et revenir, toucher plusieurs
   fois, jouer au même instant, perdre le réseau, relancer un paquet pendant que l'autre a une carte
   en main), plus des valeurs hostiles injectées depuis un téléphone et observées sur l'autre.

   Usage : EN_PW=… node dev/e2e/match-extra.test.js [filtre]
   Le filtre ne garde que les scénarios dont le nom le contient (pratique pour en rejouer un seul).
   EN_NET=1 laisse passer les polices du site : les mesures de largeur se font alors avec elles. */
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const HOME = '.g-top a[href="#accueil"]', RESUME = '.banner a[href="#jeu-match"]', END = '.g-foot [data-act="g-stop"]';
const UNDO = '[data-act="undo"]', QUIT = '.match-acts [data-act="stop"]', SEND = '[data-act="send"]', GO = '[data-act="go"]', OKAY = '[data-act="ok"]', REVIEW = '[data-act="review"]';
const ans = (k) => '.match-acts [data-k="' + k + '"]';
const again = (id) => '[data-act="again"][data-deck="' + id + '"]';

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}

/* Paquets de secours : ils ne servent que si jeux/match.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const mk = (id, name, adult) => ({ id, name, hint: "Paquet d'essai.", adult, items: Array.from({ length: 36 }, (_, i) => "Envie d'essai n° " + (i + 1) + " du paquet " + id) });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.match = { decks: [mk("sorties", "Sorties et soirées"), mk("maison", "À la maison"), mk("voyages", "Voyages et escapades"), mk("fous", "Projets fous"), mk("table", "À table"), mk("couette", "Sous la couette", true)] };
}
/* Le reste des options va à lib.phone. Sans écran tactile (o.touch === false), on clique au lieu de toucher.
   Les captures se limitent à l'écran visible : une capture de page entière coupe l'émulation tactile, ce qui
   change l'aide affichée sous la carte et fausserait les mesures qui suivent. */
async function phone(env, name, o) {
  o = Object.assign({ fullPage: false }, o);
  const p = await env.phone(name, o);
  p.touch = o.touch !== false;
  await p.ctx.addInitScript(fixture);
  return p;
}

const norm = (s) => (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const count = (p, s) => p.page.locator(s).count();
const text = async (p, s) => norm(await p.page.locator(s).first().textContent());
const card = (p) => text(p, ".match-card .g-card-text");
const pos = (p) => text(p, ".match-count");
const tag = (p) => text(p, ".match-card .g-tag");
const title = (p) => text(p, ".match .g-title");
const ideas = async (p) => (await p.page.locator(".match-list li p").allTextContents()).map(norm);
const html = (p) => p.page.evaluate(() => document.getElementById("app").innerHTML);
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:match")));
const kept = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:match:liste")) || []);
const posts = async (env) => (await env.ctl()).count.post;
/* Il arrive que le socle dépose deux fois l'arrivée de l'invité (sa première lecture du salon croise son premier
   envoi) : ce message-là ne vient pas du jeu. Une fois l'invité arrivé, renvoie ce qui dépasse des n messages attendus. */
async function spare(env, n) {
  await until(async () => await posts(env) >= n);
  await sleep(900);
  return await posts(env) - n;
}
const linked = (p, ms) => until(() => count(p, '.g-top [data-net="ok"]'), ms || 8000);
const decksOf = (p) => p.page.evaluate(() => window.GAME_DATA.match.decks.map((d) => ({ id: d.id, name: d.name, items: d.items })));
/* L'écran affiché : carte, fin (réponses à valider), passage, attente, resultat, precedent, vide (ou hors-jeu si on
   n'est plus dans la partie). Le résultat précédent porte le même nom d'écran que le résultat : son bouton le distingue. */
const kind = (p) => p.page.evaluate(() => {
  const el = document.querySelector("main.game [data-screen]");
  return el ? (el.querySelector('.match-acts [data-act="ok"]') ? "precedent" : el.getAttribute("data-screen").replace(/-[ab]$/, "")) : document.querySelector("main.game") ? "autre" : "hors-jeu";
});
const is = (p, k, ms) => until(async () => (await kind(p)) === k, ms);
/* L'écran de jeu est debout : aucune balise injectée, aucun script exécuté, aucune erreur. */
const healthy = async (p) => !p.errors.length && await p.page.evaluate(() => !!document.querySelector("main.game .match") && !document.querySelector("#app img, #app script, #app iframe") && window.__xss === undefined);
/* Les réponses d'un joueur pour la manche en cours, telles que ce téléphone les a enregistrées. */
const vec = (s, w) => (s && s.S[w].k === s.gen + ":" + s.setup.seed ? s.S[w].d.v : undefined);
/* Ce que le résultat doit lister : les idées voulues par les deux, les plus fortes d'abord, dans l'ordre du paquet. */
const shared = (items, va, vb) => items.map((t, i) => ({ t: norm(t), s: +va[i] && +vb[i] ? +va[i] + +vb[i] - 1 : 0 })).filter((x) => x.s).sort((x, y) => y.s - x.s);
/* Les réponses qu'un joueur a données carte par carte (log), remises dans l'ordre du paquet. */
const vectorOf = (items, log) => items.map((t) => String(log.a[log.t.indexOf(norm(t))] || 0)).join("");
/* Ce qui fait défiler la page de côté : renvoie une description, ou "" si rien ne dépasse. Le bloc « Passe le
   téléphone » est celui du socle, essayé avec lui : seul ce que le jeu y ajoute est mesuré ici. */
const overflow = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  document.querySelectorAll("main *").forEach((el) => {
    if (el.closest(".g-pass")) return;
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > w + 1 || r.left < -1)) out.push("." + String(el.className.baseVal == null ? el.className : "svg").split(" ")[0] + " de " + Math.round(r.left) + " à " + Math.round(r.right) + " px");
  });
  return document.documentElement.scrollWidth > w + 1 ? "page de " + document.documentElement.scrollWidth + " px pour " + w : out.length ? out[0] : "";
});
/* Boutons et liens de l'écran dont la zone tactile fait moins de 44 px de haut. */
const small = (p) => p.page.evaluate(() => Array.from(document.querySelectorAll("main button, main a, main summary"))
  .map((el) => ({ t: (el.textContent || "").trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
  .filter((x) => x.h > 0 && x.h < 44).map((x) => "« " + x.t + " » : " + x.h + " px").join(", "));
/* Typographie française : une espace ordinaire devant ? ! : ; % » ou après « est une faute. Le rappel du lien
   d'invitation est un bloc du socle, essayé avec lui : seul ce que le jeu écrit est contrôlé ici. */
const typo = (p) => p.page.evaluate(() => {
  const bad = [], walk = document.createTreeWalker(document.getElementById("app"), NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { const m = !n.parentNode.closest(".g-wait .more") && /\S* [?!:;%»]|« \S*/.exec(n.nodeValue); if (m) bad.push(m[0]); }
  return bad.join(" | ");
});
/* La carte en cours tient-elle à l'écran ? Renvoie ce qui cloche, ou "". */
const fit = (p) => p.page.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const c = r(".match-card"), t = r(".match-card .g-card-text"), g = r(".match-card .g-tag"), acts = r(".match-acts"), out = [];
  if (t.top < c.top - 1 || t.bottom > c.bottom + 1 || t.left < c.left - 1 || t.right > c.right + 1) out.push("texte hors de la carte");
  if (g.top < t.bottom - 1) out.push("nom du paquet sur le texte");
  if (t.bottom > acts.top + 1) out.push("texte sous les boutons");
  if (acts.bottom > window.innerHeight + 1) out.push("boutons hors de l'écran");
  const tops = Array.from(document.querySelectorAll(".match-acts .btn")).map((b) => Math.round(b.getBoundingClientRect().top));
  if (new Set(tops).size > 1) out.push("réponses sur plusieurs lignes");
  document.querySelectorAll(".match-acts .btn").forEach((b) => { if (b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().height > 72) out.push("bouton « " + b.textContent + " » à l'étroit"); });
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push("page trop large");
  return out.join(", ");
});

/* Quelqu'un qui découvre un écran le lit avant d'y toucher : un geste voulu attend donc un court instant
   après chaque changement d'écran. Seuls les touchers en trop (rapid, extra) arrivent sans prévenir : c'est
   ce qui permet au jeu d'ignorer ce qui tombe sur un écran tout juste apparu (une demi-seconde) sans gêner personne. */
const READ = 650;
async function pace(p) {
  const now = await p.page.evaluate(() => {
    const el = document.querySelector("main [data-screen]"), s = JSON.parse(localStorage.getItem("en:g:match") || "null");
    /* Une page tout juste (re)chargée est un nouvel écran, même si elle montre la même chose qu'avant. */
    window.__loaded = window.__loaded || Date.now() + Math.random();
    return window.__loaded + "|" + location.hash + "|" + (el ? el.getAttribute("data-screen") : "") + "|" + (s ? s.gen + ":" + s.setup.seed : "");
  }).catch(() => "");
  if (now !== p.seen) { p.seen = now; await sleep(READ); }
}
/* Au doigt, comme sur un vrai téléphone ; à la souris sur un écran d'ordinateur. Délai court : si l'écran
   a changé entre-temps (l'autre téléphone a été plus rapide), le toucher est perdu, pas l'essai. */
const hit = async (p, s) => { await pace(p); return p.touch ? p.page.tap(s, { timeout: 4000 }) : p.page.click(s, { timeout: 4000 }); };
const twice = async (p, s) => { await hit(p, s); await hit(p, s); };
/* Rendre le paquet avant la fin : « J'arrête là », puis « Valider mes réponses ». */
const quit = async (p) => { await hit(p, QUIT); await hit(p, SEND); };
/* L'autre a relancé un paquet : le résultat reste à l'écran jusqu'à ce qu'on passe à la suite. */
const next = async (p) => { if (!(await is(p, "precedent", 8000))) throw new Error("le résultat précédent n'est pas resté à l'écran"); await hit(p, OKAY); await p.page.waitForSelector(".match-card"); };
/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent
   sur ce qui s'affiche à cet endroit après le premier. */
async function rapid(p, selector, n) {
  await pace(p);
  const box = await p.page.locator(selector).first().boundingBox();
  for (let i = 0; i < n; i++) {
    await p.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
  }
}
/* Photo de tout ce que le site a enregistré sur ce téléphone, pour rejouer un même instant plusieurs fois.
   À deux téléphones, le relais est vidé avec : sinon il rendrait au téléphone ce qu'il a envoyé « plus tard ». */
const dump = (p) => p.page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
async function restore(p, snap, env) {
  if (env) await env.ctl("reset=1");
  await p.page.evaluate((j) => { const o = JSON.parse(j); localStorage.clear(); Object.keys(o).forEach((k) => localStorage.setItem(k, o[k])); }, snap);
  await p.page.reload();
  await p.page.waitForSelector("main.game");
}
/* Où en est le téléphone : l'écran, et tout ce que le jeu a enregistré. */
const outcome = (p) => p.page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("en:g:match")), list = JSON.parse(localStorage.getItem("en:match:liste")) || [], scr = document.querySelector("main.game [data-screen]");
  const v = (w) => (s && s.S[w].k === s.gen + ":" + s.setup.seed && s.S[w].d.v) || "";
  return { "écran": scr ? scr.getAttribute("data-screen") : "hors-jeu", partie: s ? "en cours" : "disparue", manche: s ? s.gen : 0, paquet: s ? s.setup.deck : "", brouillon: (s && s.local.d) || "",
    "passage fait": !!(s && s.local.go), "réponses de a": v("a"), "réponses de b": v("b"), "cochées": list.filter((x) => x.f).length };
});
/* Touche `base` fois le bouton (ce qu'il faut pour l'effet voulu), puis rejoue le même instant avec `n` touchers
   au même endroit : les touchers en trop ne doivent rien changer de plus. Renvoie "" ou ce qui diffère, et ce
   que les touchers en trop ont atteint. Laisse le téléphone là où mène le geste voulu. */
async function extra(p, sel, n, base, env) {
  const snap = await dump(p), went = [];
  const taps = async (k, log) => {
    await p.page.locator(sel).first().scrollIntoViewIfNeeded();
    await sleep(READ);
    const box = await p.page.locator(sel).first().boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    for (let i = 0; i < k; i++) {
      if (log && i >= (base || 1)) went.push(await p.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y), b = el && el.closest("button, a, summary"); return b ? "« " + b.textContent.trim().slice(0, 32) + " »" : "rien"; }, [x, y]));
      await p.page.touchscreen.tap(x, y);
      await sleep(120);
    }
    await sleep(600);
  };
  await taps(base || 1);
  const ref = await outcome(p);
  await restore(p, snap, env);
  await taps(n, true);
  const got = await outcome(p);
  await restore(p, snap, env);
  await taps(base || 1);
  const diff = Object.keys(ref).filter((k) => ref[k] !== got[k]).map((k) => k + " : " + JSON.stringify(got[k]) + " au lieu de " + JSON.stringify(ref[k]));
  return diff.length ? diff.join(", ") + " ; touchers en trop sur " + went.join(" puis ") : "";
}
/* Répond aux cartes des positions from à to - 1 (ordre d'affichage) et attend chaque fois que la suivante
   soit là ; log retient la carte vue et la réponse donnée. */
async function answer(p, f, from, to, log) {
  for (let i = from; i < to; i++) {
    const t = await card(p);
    if (log) { log.t[i] = t; log.a[i] = f(i); }
    await hit(p, ans(f(i)));
    await until(async () => (await kind(p)) !== "carte" || (await pos(p)).indexOf((i + 1) + " /") !== 0, 3000);
  }
}
/* Répond à tout ce qu'il reste du paquet pour le joueur en cours, puis valide. */
async function rest(p, f, log) {
  const m = /^(\d+) \/ (\d+)$/.exec(await pos(p));
  await answer(p, f, +m[1] - 1, +m[2], log);
  await hit(p, SEND);
}
/* Un glisser à la souris depuis le milieu de la carte ; renvoie de quoi relâcher. */
async function grab(p, dx, dy) {
  const box = await p.page.locator(".match-card").boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await pace(p);
  await p.page.mouse.move(x, y);
  await p.page.mouse.down();
  await p.page.mouse.move(x + dx, y + dy, { steps: 5 });
  return () => p.page.mouse.up();
}
async function intro(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-match");
  await p.page.fill("#name-a", o.a != null ? o.a : "Alex");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  if (o.deck) await hit(p, '[data-act="g-opt"][data-val="' + o.deck + '"]');
}
async function solo(p, env, o) {
  await intro(p, env, o);
  await hit(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector(".match-card");
}
async function join(p, link) {
  await p.page.goto(link);
  await hit(p, '[data-act="g-join"]');
  await p.page.waitForSelector("main.game");
}
/* Deux téléphones dans la même partie, tous deux devant la première carte. o : prénoms et paquet (voir intro),
   o.phone : options des deux téléphones. */
async function duo(env, tag, o) {
  o = o || {};
  const a = await phone(env, "a-" + tag, o.phone), b = await phone(env, "b-" + tag, o.phone);
  await intro(a, env, o);
  await hit(a, '[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await hit(a, '[data-act="g-go"]');
  await join(b, link);
  await Promise.all([a.page.waitForSelector(".match-card"), b.page.waitForSelector(".match-card")]);
  return { a, b, link };
}
/* Sur un seul téléphone, pose d'un coup la même réponse à tout le paquet pour les deux joueurs, puis recharge :
   un résultat entier sans jouer les cartes une à une (utile quand chaque carte s'envole). */
async function settle(p, k) {
  await p.page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem("en:g:match")), n = window.GAME_DATA.match.decks.find((d) => d.id === s.setup.deck).items.length;
    s.S.a = s.S.b = { k: s.gen + ":" + s.setup.seed, d: { v: String(k).repeat(n) } };
    localStorage.setItem("en:g:match", JSON.stringify(s));
  }, k);
  await p.page.reload();
  await p.page.waitForSelector(".match-venn");
}
/* Le pirate modifie sa partie enregistrée puis recharge : le socle redépose alors cet état sur le relais. */
async function inject(p, x) {
  await p.page.evaluate((x) => {
    const s = JSON.parse(localStorage.getItem("en:g:match")), now = Date.now();
    if (x.h) { Object.assign(s, x.h); s.st = (s.st || 0) + 1; s.sw = s.me; s.seq[s.me].h = now; }
    if ("d" in x) { s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d: x.d }; s.seq[s.me].d = now; }
    if (x.local) s.local = x.local;
    localStorage.setItem("en:g:match", JSON.stringify(s));
  }, x);
  await p.page.reload();
}
const token = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
const focused = (p, s) => p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), s);
async function tabTo(p, selector, max) {
  await pace(p);
  for (let i = 1; i <= (max || 30); i++) {
    await p.page.keyboard.press("Tab");
    if (await focused(p, selector)) return i;
  }
  return -1;
}
const ring = (p) => p.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });

const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push({ name, fn });

/* ====================================================================== Un seul téléphone */

scenario("Un téléphone : recharger, quitter et revenir à chaque étape", async (env) => {
  const p = await phone(env, "seul");
  await solo(p, env, { deck: "maison" });
  const items = (await decksOf(p)).find((d) => d.id === "maison").items, N = items.length;
  const A = { t: [], a: [] }, B = { t: [], a: [] };
  const fa = (i) => [2, 0, 1, 2, 2, 1, 0][i % 7], fb = (i) => [1, 2, 0, 2][i % 4];
  const bad = [];
  const look = async (label) => { const t = await typo(p); if (t) bad.push(label + " : " + t); };

  await answer(p, fa, 0, 5, A);
  const at = await card(p);
  await look("carte");
  await p.page.reload();
  await p.page.waitForSelector(".match-card");
  check(await pos(p) === "6 / " + N && await card(p) === at, "rechargement en plein paquet : même carte, même avancement");
  await hit(p, HOME);
  await p.page.waitForSelector(".banner");
  await hit(p, RESUME);
  await p.page.waitForSelector(".match-card");
  check(await pos(p) === "6 / " + N && await card(p) === at, "aller à l'accueil puis « Reprendre » : même carte");
  await p.page.goBack();
  await p.page.waitForSelector(".banner");
  await p.page.goForward();
  await p.page.waitForSelector(".match-card");
  check(await pos(p) === "6 / " + N && await card(p) === at, "bouton retour du navigateur puis avance : même carte");
  await twice(p, UNDO);
  await p.page.reload();
  await p.page.waitForSelector(".match-card");
  check(await pos(p) === "4 / " + N && await card(p) === A.t[3] && (await saved(p)).local.d.length === 3, "deux retours en arrière puis un rechargement : la quatrième carte revient, ses réponses effacées");
  /* Alex change d'avis sur les deux cartes reprises. */
  await answer(p, (i) => (fa(i) + 1) % 3, 3, 5, A);
  check(await card(p) === at, "les cartes reprises reviennent dans le même ordre");
  await rest(p, fa, A);
  const va = (await saved(p)).S.a.d.v;
  check(await is(p, "passage") && va === vectorOf(items, A), "paquet fini : chaque réponse d'Alex, reprises comprises, est rangée à la place de son idée");
  check(new Set(A.t).size === N && items.every((t) => A.t.indexOf(norm(t)) >= 0), "Alex a vu les " + N + " idées du paquet, chacune une seule fois");

  const secret = async () => !(await html(p)).includes(va) && await count(p, ".match-card") === 0 && await count(p, ".match-list") === 0 && await count(p, UNDO) === 0;
  await look("passage");
  check(await secret(), "au passage du téléphone, rien des réponses d'Alex n'est dans la page");
  await p.page.reload();
  check(await is(p, "passage") && await secret(), "rechargement sur le passage : toujours le passage");
  await hit(p, HOME);
  await p.page.waitForSelector(".banner");
  check(!(await html(p)).includes(va), "à l'accueil, la partie en cours ne montre rien des réponses");
  await hit(p, RESUME);
  check(await is(p, "passage") && await secret(), "« Reprendre » depuis l'accueil : toujours le passage");
  await p.page.goBack();
  await p.page.waitForSelector(".banner");
  await p.page.goForward();
  check(await is(p, "passage") && await secret(), "retour puis avance du navigateur : toujours le passage");

  await hit(p, GO);
  await p.page.waitForSelector(".match-card");
  check(await count(p, ".match.as-b") === 1 && await pos(p) === "1 / " + N && await card(p) === A.t[0] && await count(p, UNDO) === 0 && await count(p, REVIEW) === 0, "Inès commence à la première carte, la même, sans rien à reprendre");
  await answer(p, fb, 0, 3, B);
  await p.page.reload();
  await p.page.waitForSelector(".match-card");
  check(await count(p, ".match.as-b") === 1 && await pos(p) === "4 / " + N && await card(p) === A.t[3], "rechargement pendant le tour d'Inès : toujours à elle, quatrième carte, sans repasser par le passage");
  await hit(p, HOME);
  await p.page.waitForSelector(".banner");
  await hit(p, RESUME);
  await p.page.waitForSelector(".match-card");
  check(await count(p, ".match.as-b") === 1 && await pos(p) === "4 / " + N, "accueil puis « Reprendre » pendant le tour d'Inès : toujours à elle");
  for (let i = 0; i < 3; i++) await hit(p, UNDO);
  check(await pos(p) === "1 / " + N && await count(p, UNDO) === 0 && (await saved(p)).S.a.d.v === va, "Inès revient à sa première carte, pas plus loin : les réponses d'Alex sont intactes");
  await rest(p, fb, B);
  await p.page.waitForSelector(".match-venn");
  const vb = (await saved(p)).S.b.d.v, want = shared(items, va, vb).map((x) => x.t);
  check(vb === vectorOf(items, B) && JSON.stringify(B.t) === JSON.stringify(A.t), "Inès a vu les mêmes cartes dans le même ordre, et ses réponses sont à leur place");
  check(want.length > 3 && JSON.stringify(await ideas(p)) === JSON.stringify(want), "le résultat liste exactement les " + want.length + " envies communes, les plus fortes d'abord");
  await look("résultat");
  await hit(p, ".match-done >> nth=1");
  await p.page.reload();
  await p.page.waitForSelector(".match-list");
  let list = await kept(p);
  check(JSON.stringify(await ideas(p)) === JSON.stringify(want) && list.length === want.length && list.filter((it) => it.f).length === 1 && await count(p, ".match-list li.is-done") === 1, "rechargement sur le résultat : même liste, rien en double, la coche « Fait » est restée");
  await hit(p, HOME);
  await p.page.waitForSelector('a.card-link[href="#jeu-match"]');
  check(await count(p, ".banner") === 0, "paquet fini : l'accueil ne propose pas de reprendre");
  await p.page.click('a.card-link[href="#jeu-match"]');
  check(await is(p, "resultat") && (await ideas(p)).length === want.length, "revenir par la carte du jeu : le résultat est toujours là");

  /* Le même paquet rejoué : autre tirage, et la liste gardée ne se dédouble pas. */
  await p.page.locator(again("maison")).scrollIntoViewIfNeeded();
  await hit(p, again("maison"));
  await p.page.waitForSelector(".match-card");
  const C = { t: [], a: [] };
  check(await count(p, ".match.as-b") === 1, "le paquet suivant commence par Inès, qui tient le téléphone");
  await look("carte du paquet suivant");
  await rest(p, () => 2, C);
  check(new Set(C.t).size === N && C.t.join("|") !== A.t.join("|"), "le même paquet rejoué arrive dans un autre ordre");
  check(await is(p, "passage") && await count(p, ".g-pass.as-a") === 1 && (await text(p, ".g-pass h1")).includes("d'Alex"), "puis le téléphone passe à Alex");
  await hit(p, GO);
  await rest(p, () => 2);
  await p.page.waitForSelector(".match-venn");
  list = await kept(p);
  check(list.length === N && new Set(list.map((it) => it.t)).size === N && list.every((it) => it.s === 3) && list.filter((it) => it.f).length === 1 && await count(p, ".match-duo") === N,
    "tout en « carrément » : les " + N + " idées sont gardées une seule fois, toutes en coup de cœur, et la coche d'avant est restée");
  await p.page.locator(again("maison")).scrollIntoViewIfNeeded();
  await hit(p, again("maison"));
  await rest(p, () => 1);
  await hit(p, GO);
  await rest(p, () => 1);
  await p.page.waitForSelector(".match-venn");
  list = await kept(p);
  check(await count(p, ".match-duo") === 0 && list.length === N && list.every((it) => it.s === 3), "rejoué en « pourquoi pas » : le résultat n'a plus de coup de cœur, la liste gardée ne perd pas les siens");
  check(!bad.length, "typographie : aucune espace ordinaire devant une ponctuation double" + (bad.length ? " (" + bad.join(" ; ") + ")" : ""));
  const c = (await env.ctl()).count;
  check(c.post + c.poll + c.sse === 0, "trois paquets sur un seul téléphone : le relais n'a jamais été contacté");
});

scenario("Un téléphone : chaque paquet carte par carte, sur un écran de 320 × 568", async (env) => {
  const p = await phone(env, "petit", { viewport: { width: 320, height: 568 } });
  await solo(p, env, { deck: "sorties" });
  const decks = await decksOf(p), wrong = [], tiny = [], wide = [];
  let shuffled = 0;
  for (let k = 0; k < decks.length; k++) {
    const d = decks[k], seen = [];
    if (k) {
      await p.page.locator(again(d.id)).scrollIntoViewIfNeeded();
      await hit(p, again(d.id));
      await p.page.waitForSelector(".match-card");
    }
    for (let i = 0; i < d.items.length; i++) {
      const t = await card(p), f = await fit(p);
      seen.push(t);
      if (f) wrong.push(d.id + ", carte " + (i + 1) + " « " + t.slice(0, 30) + "… » : " + f);
      if (i === 1) { const s = await small(p); if (s && tiny.indexOf(s) < 0) tiny.push(s); }
      await hit(p, ans(2));
    }
    await hit(p, SEND);
    if (seen.join("|") !== d.items.map(norm).join("|")) shuffled++;
    if (new Set(seen).size !== d.items.length || !d.items.every((t) => seen.indexOf(norm(t)) >= 0)) wrong.push(d.id + " : les cartes vues ne sont pas exactement celles du paquet");
    await p.page.waitForSelector(".g-pass");
    let o = await overflow(p), s = await small(p);
    if (o) wide.push("passage : " + o);
    if (s && tiny.indexOf(s) < 0) tiny.push(s);
    await hit(p, GO);
    await rest(p, () => 1);
    await p.page.waitForSelector(".match-venn");
    o = await overflow(p);
    s = await small(p);
    if (o) wide.push("résultat " + d.id + " : " + o);
    if (s && tiny.indexOf(s) < 0) tiny.push(s);
    if ((await ideas(p)).length !== d.items.length) wrong.push(d.id + " : le résultat ne liste pas toutes les idées voulues par les deux");
  }
  await p.shot("match-extra-320-resultat");
  check(!wrong.length, "320 × 568 : les " + decks.length + " paquets défilent en entier, chaque carte lisible au-dessus des trois réponses" + (wrong.length ? " (" + wrong.length + " défauts ; le premier : " + wrong[0] + ")" : ""));
  check(shuffled === decks.length, "chaque paquet arrive mélangé");
  check(!wide.length, "rien ne dépasse en largeur sur le passage ni sur un résultat de 36 lignes" + (wide.length ? " (" + wide[0] + ")" : ""));
  check(!tiny.length, "toutes les zones tactiles font au moins 44 px" + (tiny.length ? " (" + tiny.join(" ; ") + ")" : ""));
  const list = await kept(p), total = decks.reduce((n, d) => n + d.items.length, 0);
  check(list.length === total && decks.every((d) => list.filter((it) => it.d === d.id).length === d.items.length), "les " + total + " envies des six paquets sont gardées, chacune avec son paquet");
  await twice(p, END);
  await p.page.waitForSelector(".match-keep");
  await hit(p, ".match-keep summary");
  const o = await overflow(p), s = await small(p);
  await p.shot("match-extra-320-nos-envies");
  check(await count(p, ".match-keep li") === total && !o && !s, "« Nos envies » avec " + total + " lignes : tout tient en largeur, tout se touche" + (o || s ? " (" + (o || s) + ")" : ""));
});

/* Les touchers en trop tombent sur ce qui s'affiche au même endroit à l'écran suivant : tout dépend donc de la
   mise en page. Pour qu'elle soit la même d'un essai à l'autre malgré le tirage des cartes, les résultats sont
   soit complets (tout le paquet en commun), soit vides (rien en commun). */
scenario("Un téléphone : touchers répétés sur chaque bouton", async (env) => {
  const probe = async (q, label, sel, n, base) => { const d = await extra(q, sel, n, base); check(!d, label + (d ? " (" + d + ")" : "")); };
  let decks = [];
  const choices = async (q, label) => {
    const snap = await dump(q), bad = [];
    for (const d of decks) { const x = await extra(q, again(d.id), 2); if (x) bad.push("« " + d.name + " » : " + x); await restore(q, snap); }
    check(!bad.length, label + (bad.length ? " (" + bad.length + " paquets sur " + decks.length + " ; " + bad.join(" | ") + ")" : ""));
  };

  /* Grand téléphone (390 × 844), résultat complet. */
  const p = await phone(env, "rafale");
  await solo(p, env, { deck: "sorties" });
  decks = await decksOf(p);
  const N = decks[0].items.length;
  await answer(p, () => 2, 0, N - 1);
  await probe(p, "trois touchers sur la dernière réponse du premier joueur : l'écran de validation attend, rien n'est rendu", ans(1), 3);
  await probe(p, "trois touchers sur « Valider mes réponses » : le passage de téléphone reste à l'écran, rien d'autre ne bouge", SEND, 3);
  await probe(p, "trois touchers sur « Je suis …, à moi » : la première carte attend, sans réponse", GO, 3);
  await answer(p, () => 2, 0, N - 1);
  await probe(p, "trois touchers sur la dernière réponse du second joueur : l'écran de validation attend, rien n'est rendu", ans(2), 3);
  await probe(p, "trois touchers sur « Valider mes réponses » (second joueur) : le résultat reste à l'écran, rien de coché, rien de relancé", SEND, 3);
  await choices(p, "deux touchers sur un autre paquet, sous un résultat complet : sa première carte attend, sans réponse");
  await p.page.locator(again("table")).scrollIntoViewIfNeeded();
  await hit(p, again("table"));
  await p.page.waitForSelector(".match-card");
  await answer(p, () => 1, 0, 2);
  await probe(p, "quatre touchers sur « Revenir à la précédente » depuis la troisième carte : retour à la première carte, rien d'autre", UNDO, 4, 2);
  await probe(p, "trois touchers sur « Revoir le résultat précédent » : il s'ouvre, et rien d'autre", REVIEW, 3);
  await probe(p, "trois touchers sur « Passer au paquet suivant », sous un résultat complet : la première carte attend, la partie est toujours là", OKAY, 3);

  /* 390 × 664 : ce qu'un téléphone courant laisse à la page, barres du navigateur affichées. Résultat vide. */
  const q = await phone(env, "rafale-barres", { viewport: { width: 390, height: 664 } });
  await solo(q, env, { deck: "maison" });
  await probe(q, "390 × 664, quatre touchers sur « J'arrête là » (premier joueur) : l'écran de validation attend, rien n'est rendu", QUIT, 4);
  await probe(q, "390 × 664, quatre touchers sur « Valider mes réponses » : le paquet est rendu, le passage reste à l'écran", SEND, 4);
  await hit(q, GO);
  await q.page.waitForSelector(".match-card");
  await probe(q, "390 × 664, trois touchers sur « J'arrête là » (second joueur) : l'écran de validation attend, rien n'est rendu", QUIT, 3);
  await probe(q, "390 × 664, cinq touchers sur « Valider mes réponses » (second joueur) : le résultat reste à l'écran, aucun paquet lancé ni rendu", SEND, 5);
  /* Un doigt resté sur le rythme des cartes (un toucher toutes les 350 ms) : tant qu'il ne s'arrête pas, le résultat ne l'écoute pas. */
  const beat = await dump(q), spot = await q.page.locator(again("voyages")).boundingBox();
  await restore(q, beat);
  for (let i = 0; i < 6; i++) { await q.page.touchscreen.tap(spot.x + spot.width / 2, spot.y + spot.height / 2); await sleep(350); }
  check(await kind(q) === "resultat" && (await saved(q)).gen === 1, "390 × 664, six touchers en rythme sur un paquet dès l'apparition du résultat : aucun ne le lance");
  await choices(q, "390 × 664, deux touchers sur un autre paquet, sous un résultat vide : sa première carte attend, sans réponse");
  await hit(q, again("fous"));
  await q.page.waitForSelector(".match-card");
  await hit(q, REVIEW);
  await q.page.waitForSelector(OKAY);
  await probe(q, "390 × 664, trois touchers sur « Passer au paquet suivant », sous un résultat vide : la première carte attend, la partie est toujours là", OKAY, 3);

  /* Petit écran (320 × 568) : la fin du paquet, pour chacune des trois réponses. */
  const r = await phone(env, "rafale-petit", { viewport: { width: 320, height: 568 } });
  await solo(r, env, { deck: "voyages" });
  await answer(r, () => 2, 0, N - 1);
  const last = await dump(r);
  for (const k of [0, 1, 2]) {
    await probe(r, "320 × 568, trois touchers sur « " + ["Non", "Pourquoi pas", "Carrément"][k] + " » à la dernière carte du premier joueur : l'écran de validation attend, la partie est toujours là", ans(k), 3);
    if (k < 2) await restore(r, last);
  }
  await probe(r, "320 × 568, trois touchers sur « Valider mes réponses » : le passage reste à l'écran, la partie est toujours là", SEND, 3);
  await hit(r, GO);
  await answer(r, () => 2, 0, N);
  await probe(r, "320 × 568, trois touchers sur « Valider mes réponses » (second joueur) : le résultat reste à l'écran, rien de coché", SEND, 3);

  /* Avec les animations, comme chez la plupart des gens. */
  const m = await phone(env, "rafale-animee", { motion: true });
  await solo(m, env, { deck: "table" });
  await settle(m, 2);
  await choices(m, "animations actives, deux touchers sur un autre paquet, sous un résultat complet : sa première carte attend, sans réponse");
  await m.page.locator(again("couette")).scrollIntoViewIfNeeded();
  await hit(m, again("couette"));
  await m.page.waitForSelector(".match-card");
  await hit(m, REVIEW);
  await m.page.waitForSelector(OKAY);
  await probe(m, "animations actives, trois touchers sur « Passer au paquet suivant » : la première carte attend, la partie est toujours là", OKAY, 3);
});

scenario("Deux téléphones : touchers répétés à la fin du paquet", async (env) => {
  for (const [w, h] of [[390, 844], [320, 568]]) {
    /* L'hôte joue seul, avant que l'invité n'arrive : la fin du paquet mène à l'écran d'attente. */
    const a = await phone(env, "hote-" + w);
    await intro(a, env, { deck: "fous" });
    await hit(a, '[data-act="g-start"][data-mode="duo"]');
    await hit(a, '[data-act="g-go"]');
    await a.page.waitForSelector(".match-card");
    await a.page.setViewportSize({ width: w, height: h });
    const N = (await decksOf(a))[0].items.length, bad = [];
    await answer(a, () => 1, 0, 3);
    const early = await dump(a);
    let d = await extra(a, QUIT, 4, 1, env);
    if (d) bad.push("« J'arrête là » quatre fois : " + d);
    d = await extra(a, SEND, 3, 1, env);
    if (d) bad.push("« Valider mes réponses » trois fois : " + d);
    await restore(a, early, env);
    await answer(a, () => 2, 3, N - 1);
    const last = await dump(a);
    for (const k of [0, 1, 2]) {
      d = await extra(a, ans(k), 3, 1, env);
      if (d) bad.push("« " + ["Non", "Pourquoi pas", "Carrément"][k] + " » trois fois à la dernière carte : " + d);
      if (k < 2) await restore(a, last, env);
    }
    d = await extra(a, SEND, 3, 1, env);
    if (d) bad.push("« Valider mes réponses » trois fois après la dernière carte : " + d);
    check(!bad.length, w + " × " + h + " : les touchers en trop à la fin du paquet ne rendent rien d'eux-mêmes et laissent l'écran d'attente intact" + (bad.length ? " (" + bad.join(" | ") + ")" : ""));
  }
  /* Le second à finir : le résultat s'ouvre sous son doigt, et ce qu'il y touche part chez l'autre.
     390 × 664, résultat vide : la mise en page ne dépend pas du tirage. */
  const { a, b } = await duo(env, "second", { deck: "table", phone: { viewport: { width: 390, height: 664 } } });
  await quit(a);
  await a.page.waitForSelector(".g-wait");
  await until(async () => typeof vec(await saved(b), "a") === "string");
  await hit(b, QUIT);
  await rapid(b, SEND, 3);
  await sleep(1500);
  const sa = await saved(a), sb = await saved(b);
  check(await kind(b) === "resultat" && await kind(a) === "resultat" && sa.gen === 1 && sb.gen === 1,
    "390 × 664, trois touchers sur « Valider mes réponses » quand on finit le second : le résultat reste à l'écran des deux côtés, aucun paquet relancé (chez lui : " + await kind(b) + ", manche " + sb.gen + ", paquet « " + sb.setup.deck +
    " » ; chez l'autre : " + await kind(a) + ", manche " + sa.gen + ")");
});

scenario("Un téléphone : gestes au doigt, cas limites", async (env) => {
  const p = await phone(env, "doigt", { viewport: { width: 320, height: 568 } });
  await solo(p, env, { deck: "sorties" });
  const cdp = await p.ctx.newCDPSession(p.page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((q, id) => ({ x: Math.round(q[0]), y: Math.round(q[1]), id })) });
  const center = async () => { const b = await p.page.locator(".match-card").boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const draft = async () => (await saved(p)).local.d || "";
  const rested = () => p.page.evaluate(() => { const c = document.querySelector(".match-card"); return c.style.transform === "" && !document.querySelector(".match-stamp.is-on"); });
  await pace(p);
  /* Un glisser d'un doigt, point par point (écarts depuis le centre de la carte) ; fin : "touchEnd" ou "touchCancel". */
  const swipe = async (path, end) => {
    const c = await center();
    await touch("touchStart", [c]);
    for (const q of path) await touch("touchMove", [[c[0] + q[0], c[1] + q[1]]]);
    await touch(end || "touchEnd", []);
    await sleep(80);
  };

  await swipe([[-40, 0], [-90, 0], [-140, 0], [-90, 0], [-30, 0]]);
  check(await draft() === "" && await rested(), "la carte tirée loin à gauche puis ramenée avant de lâcher : pas de réponse, elle reprend sa place");
  await swipe([[150, 0]], "touchCancel");
  check(await draft() === "" && await rested(), "geste annulé par le téléphone (appel, bord de l'écran) : pas de réponse, la carte reprend sa place");
  await swipe([]);
  check(await draft() === "" && await rested(), "un simple toucher sur la carte : rien");
  await swipe([[110, 6]]);
  check(await draft() === "1", "un coup de doigt vif vers la droite, d'un seul mouvement : pourquoi pas");
  await swipe([[-70, -40], [-140, -90]]);
  check(await draft() === "10", "en diagonale, plus large que haut : non");
  await swipe([[0, 60], [10, 150]]);
  check(await draft() === "10" && await rested(), "vers le bas : rien");

  /* Ici la page est plus haute que l'écran : le pouce posé sur la carte doit pouvoir la faire défiler,
     et ce geste ne vaut jamais « carrément ». */
  const tall = await p.page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight && !!document.querySelector(".match.is-flat"));
  await swipe([[0, -30], [0, -60], [2, -90], [4, -120]]);
  await sleep(300);
  check(tall && await draft() === "10" && await p.page.evaluate(() => window.scrollY > 0), "page plus haute que l'écran : glisser vers le haut sur la carte la fait défiler et ne répond rien");
  await swipe([[-30, -40], [-50, -90], [-60, -140]]);
  await sleep(300);
  check(await draft() === "10" && await kind(p) === "carte", "en diagonale, plus haut que large : rien non plus");
  await p.page.evaluate(() => window.scrollTo(0, 0));
  while (await count(p, UNDO)) await hit(p, UNDO);
  check(await p.page.evaluate(() => getComputedStyle(document.querySelector(".match-up")).display === "none") && !(await p.page.locator(".match .hint").innerText()).includes("vers le haut"), "et l'aide de la première carte ne promet pas ce geste");
  await answer(p, (i) => [1, 0][i], 0, 2);

  /* Deux doigts : le premier tient la carte, le second se pose ailleurs puis se relève. */
  const c = await center(), n = await p.page.locator(ans(0)).boundingBox(), spare = [n.x + n.width / 2, n.y + n.height / 2];
  await touch("touchStart", [c]);
  await touch("touchMove", [[c[0] + 120, c[1]]]);
  await touch("touchStart", [[c[0] + 120, c[1]], spare]);
  await touch("touchEnd", [[c[0] + 120, c[1]]]);
  await sleep(150);
  const mid = await draft();
  await touch("touchEnd", []);
  await sleep(150);
  check(mid.length <= 3 && (await draft()).length === 3 && await kind(p) === "carte", "un second doigt posé sur « Non » pendant que le premier tient la carte : une seule réponse en tout (brouillon : " + await draft() + ")");
  check(await p.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth) && !p.errors.length, "aucun de ces gestes n'élargit la page ni ne lève d'erreur");

  /* Grand téléphone : tout tient à l'écran, la page ne défile pas, le geste vers le haut répond. */
  const g = await phone(env, "doigt-grand");
  await solo(g, env, { deck: "sorties" });
  await pace(g);
  const gc = await g.ctx.newCDPSession(g.page), box = await g.page.locator(".match-card").boundingBox(), x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  check(await g.page.evaluate(() => !document.querySelector(".match.is-flat")) && (await text(g, ".match .hint")).includes("vers le haut, carrément"), "390 × 844 : la page tient à l'écran, l'aide annonce le geste vers le haut");
  await gc.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (const dy of [-40, -80, -130]) await gc.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 4, y: y + dy }] });
  await gc.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(150);
  check((await saved(g)).local.d === "2", "et ce geste répond « carrément »");
});

scenario("Un téléphone : toute la partie au clavier", async (env) => {
  const p = await phone(env, "clavier", { viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1 });
  await p.page.goto(env.base + "#jeu-match");
  const picked = await tabTo(p, '[data-act="g-opt"][data-val="voyages"]') > 0;
  await p.page.keyboard.press("Enter");
  await tabTo(p, "#name-a");
  await p.page.keyboard.type("Alex");
  await p.page.keyboard.press("Tab");
  await p.page.keyboard.type("Inès");
  await tabTo(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.keyboard.press("Enter");
  check(picked && await is(p, "carte") && (await saved(p)).setup.deck === "voyages", "au clavier : choisir le paquet, saisir les prénoms, lancer la partie");
  const N = (await decksOf(p)).find((d) => d.id === "voyages").items.length;
  check(await p.page.evaluate(() => getComputedStyle(document.querySelector(".match-keys")).display !== "none"), "sur un ordinateur, l'aide de la carte mentionne les flèches");
  check(await p.page.evaluate(() => { const c = document.querySelector(".match-card"); c.classList.add("is-out"); const d = getComputedStyle(c).transitionDuration; c.classList.remove("is-out"); return /^0s/.test(d) && getComputedStyle(c.querySelector(".g-card-text")).animationName === "none"; }),
    "animations réduites demandées : la carte ne s'envole pas et son texte n'est pas animé");
  await pace(p);
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight"]) await p.page.keyboard.press(k);
  check((await saved(p)).local.d === "021" && await focused(p, ".match-card .g-card-text"), "flèches gauche, haut, droite : non, carrément, pourquoi pas ; le focus suit la nouvelle carte");
  const tabs = await tabTo(p, ans(0), 6), seen = await ring(p);
  await p.page.keyboard.press("Enter");
  check(tabs > 0 && tabs <= 2 && seen && (await saved(p)).local.d === "0210", "« Non » s'atteint en deux tabulations au plus, avec un focus visible, et Entrée répond");
  await tabTo(p, ans(2), 6);
  await p.page.keyboard.press("Space");
  check((await saved(p)).local.d === "02102", "Espace sur « Carrément » répond aussi");
  await p.page.keyboard.down("Shift");
  await p.page.keyboard.press("Tab");
  await p.page.keyboard.up("Shift");
  await p.page.keyboard.press("ArrowDown");
  check((await saved(p)).local.d === "02102", "flèche vers le bas : aucune réponse");
  await tabTo(p, UNDO, 8);
  await p.page.keyboard.press("Enter");
  check((await saved(p)).local.d === "0210" && await pos(p) === "5 / " + N, "« Revenir à la précédente » au clavier");
  await tabTo(p, QUIT, 8);
  await p.page.keyboard.press("Enter");
  check(await is(p, "fin") && await focused(p, ".match .g-title") && vec(await saved(p), "a") === undefined, "« J'arrête là » au clavier : l'écran de validation prend le focus, rien n'est rendu");
  const send = await tabTo(p, SEND, 4), lit = await ring(p);
  await p.page.keyboard.press("Enter");
  check(send > 0 && lit && await is(p, "passage"), "« Valider mes réponses » s'atteint au clavier, avec un focus visible : le paquet est rendu");
  await pace(p);
  await p.page.keyboard.press("ArrowUp");
  await p.page.keyboard.press("ArrowLeft");
  check(await kind(p) === "passage" && !vec(await saved(p), "b"), "sur le passage, les flèches ne répondent pour personne");
  const reach = await tabTo(p, GO, 4);
  await p.page.keyboard.press("Enter");
  check(reach > 0 && await is(p, "carte") && await count(p, ".match.as-b") === 1, "« Je suis Inès, à moi » au clavier");
  await pace(p);
  for (let i = 0; i < N; i++) await p.page.keyboard.press(["ArrowUp", "ArrowRight", "ArrowLeft"][i % 3]);
  await p.page.keyboard.press("ArrowUp");
  check(await is(p, "fin") && (await saved(p)).local.d.length === N, "tout le paquet d'Inès aux flèches : l'écran de validation, où les flèches ne répondent plus");
  await tabTo(p, SEND, 4);
  await p.page.keyboard.press("Enter");
  /* Alex n'a répondu qu'à quatre cartes (non, carrément, pourquoi pas, non) : une seule croise un oui d'Inès. */
  check(await is(p, "resultat") && await title(p) === "1 envie en commun", "Entrée sur « Valider mes réponses » : le résultat s'ouvre, avec la seule envie commune");
  const prevented = await p.page.evaluate(() => { const e = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; });
  check(!prevented, "sur le résultat, les flèches servent de nouveau à faire défiler la page");
  await tabTo(p, ".match-done", 6);
  await p.page.keyboard.press("Enter");
  check(await focused(p, '.match-done[aria-pressed="true"]') && (await kept(p)).filter((it) => it.f).length === 1, "« Fait » au clavier : coché, et le focus ne bouge pas");
  const far = await tabTo(p, again("table"), 12);
  await p.page.keyboard.press("Enter");
  check(far > 0 && await is(p, "carte") && (await saved(p)).gen === 2 && await focused(p, ".match-card .g-card-text"), "un autre paquet au clavier : la première carte prend le focus");
  await pace(p);
  await p.page.keyboard.press("ArrowUp");
  check((await saved(p)).local.d === "2", "et les flèches répondent");
});

scenario("Un téléphone : prénoms extrêmes, petit et grand écran", async (env) => {
  const A = "D'Ar<img src=x>&\"é\"", B = "W".repeat(20), LONG = "W".repeat(40);
  const p = await phone(env, "prenoms", { viewport: { width: 320, height: 568 } });
  await solo(p, env, { a: A, b: B, deck: "couette" });
  const wide = [], tiny = [], cramped = [];
  const look = async (label) => {
    const o = await overflow(p), t = await small(p);
    if (o) wide.push(label + " : " + o);
    if (t && tiny.indexOf(t) < 0) tiny.push(t);
    if (await count(p, ".match-card")) { const f = await fit(p); if (f) cramped.push(label + " : " + f); }
  };
  check((await text(p, ".match-head .g-who")).includes(A) && await healthy(p), "un prénom avec apostrophe, balise et guillemets s'affiche tel quel");
  await look("carte du premier");
  await hit(p, ans(1));
  await hit(p, QUIT);
  await p.page.waitForSelector(SEND);
  await look("écran de validation");
  check((await text(p, ".g-lead")).includes("Les 35 idées que tu n'as pas vues compteront comme un non") && await healthy(p), "320 px : l'écran de validation dit combien d'idées compteront comme un non");
  await hit(p, SEND);
  await p.page.waitForSelector(".g-pass");
  await look("passage");
  check((await text(p, ".g-pass h1")).includes("Au tour de " + B) && (await text(p, ".match .hint")).includes("Les réponses de " + A) && await healthy(p), "passage : « de » devant une consonne, prénom à balise affiché comme du texte");
  await p.shot("match-extra-320-passage");
  await hit(p, GO);
  await p.page.waitForSelector(".match-card");
  await look("carte du second");
  await p.shot("match-extra-320-carte");
  const row = await p.page.evaluate(() => { const c = document.querySelector(".match-count").getBoundingClientRect(); return c.right <= document.documentElement.clientWidth + 1 && c.left >= 0; });
  check(row, "prénom de 20 lettres : le compteur de cartes reste visible");
  await rest(p, () => 2);
  await p.page.waitForSelector(".match-venn");
  await look("résultat");
  await p.page.locator(again("fous")).scrollIntoViewIfNeeded();
  await hit(p, again("fous"));
  await p.page.waitForSelector(".match-card");
  await look("carte suivante, avec « Revoir le résultat précédent »");
  await hit(p, REVIEW);
  await p.page.waitForSelector(OKAY);
  await look("résultat précédent");
  /* Un prénom plus long que ce que le champ accepte, écrit directement dans le stockage. */
  await p.page.evaluate((n) => localStorage.setItem("en:names", JSON.stringify({ a: n, b: n })), LONG);
  await p.page.reload();
  await p.page.waitForSelector(OKAY);
  await hit(p, OKAY);
  await p.page.waitForSelector(".match-card");
  await look("carte, prénom de 40 lettres");
  await quit(p);
  await p.page.waitForSelector(".g-pass");
  await look("passage, prénom de 40 lettres");
  check(!wide.length, "320 px, prénoms sans espace : rien ne dépasse en largeur" + (wide.length ? " (" + wide.length + " écrans ; le premier : " + wide[0] + ")" : ""));
  check(!cramped.length, "et la carte reste lisible au-dessus des réponses" + (cramped.length ? " (" + cramped[0] + ")" : ""));
  check(!tiny.length, "toutes les zones tactiles du jeu font au moins 44 px" + (tiny.length ? " (" + tiny.join(" ; ") + ")" : ""));

  const q = await phone(env, "sans-prenom");
  await solo(q, env, { a: "", b: "   " });
  check((await text(q, ".match-head .g-who")).includes("Partenaire 1"), "sans prénom : « Partenaire 1 » répond");
  await quit(q);
  await q.page.waitForSelector(".g-pass");
  check((await text(q, ".g-pass h1")).includes("Au tour de Partenaire 2") && (await text(q, ".match .hint")).includes("Les réponses de Partenaire 1"), "et le téléphone passe à « Partenaire 2 »");

  const v = await phone(env, "voyelles");
  await solo(v, env, { a: "Tom", b: "Élodie" });
  await quit(v);
  await v.page.waitForSelector(".g-pass");
  check((await text(v, ".g-pass h1")).includes("Au tour d'Élodie") && (await text(v, ".match .hint")).includes("Les réponses de Tom"), "élision devant une voyelle accentuée : « d'Élodie », « de Tom »");

  const g = await phone(env, "grand", { viewport: { width: 1440, height: 900 }, mobile: false, touch: false, scale: 1 });
  await solo(g, env, { a: A, b: B, deck: "table" });
  const out = [];
  const see = async (label) => {
    const o = await overflow(g), w = await g.page.evaluate(() => document.querySelector("main.game").getBoundingClientRect().width);
    if (o || w > 46 * 16 + 1) out.push(label + " : " + (o || "colonne de " + Math.round(w) + " px"));
    if (await count(g, ".match-card")) { const f = await fit(g); if (f) out.push(label + " : " + f); }
  };
  await see("carte");
  const release = await grab(g, -160, 10);
  check(await text(g, ".match-stamp") === "Non", "grand écran : la carte se saisit à la souris et annonce « Non »");
  await release();
  check((await saved(g)).local.d === "0", "et le glisser répond");
  await rest(g, () => 2);
  await see("passage");
  await hit(g, GO);
  await rest(g, () => 2);
  await g.page.waitForSelector(".match-venn");
  await see("résultat");
  await g.shot("match-extra-1440-resultat");
  check(!out.length, "1440 × 900 : une seule colonne étroite, rien ne dépasse" + (out.length ? " (" + out[0] + ")" : ""));
});

scenario("Un téléphone : ouvert depuis un fichier, sans réseau", async (env) => {
  const p = await phone(env, "fichier");
  await p.page.goto(pathToFileURL(path.join(ROOT, "index.html")).href + "#jeu-match");
  await p.page.waitForSelector('[data-act="g-start"]');
  check(await count(p, '[data-act="g-start"][data-mode="duo"]') === 0 && await count(p, '[data-act="g-start"][data-mode="solo"]') === 1, "depuis un fichier, seul le jeu sur un téléphone est proposé");
  await hit(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector(".match-card");
  await rest(p, () => 2);
  await hit(p, GO);
  await rest(p, (i) => i % 2);
  await p.page.waitForSelector(".match-venn");
  await p.page.reload();
  check(await is(p, "resultat") && (await ideas(p)).length === 18 && (await kept(p)).length === 18, "une partie entière s'y joue, et le résultat survit au rechargement");
});

/* ====================================================================== Deux téléphones */

scenario("Deux téléphones : l'invité arrive après que l'hôte a tout joué", async (env) => {
  const a = await phone(env, "a-tard"), b = await phone(env, "b-tard");
  await intro(a, env, { deck: "fous" });
  await hit(a, '[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await hit(a, '[data-act="g-go"]');
  await a.page.waitForSelector(".match-card");
  const items = (await decksOf(a)).find((d) => d.id === "fous").items, N = items.length, A = { t: [], a: [] }, B = { t: [], a: [] };
  await rest(a, (i) => [2, 1, 0][i % 3], A);
  check(await is(a, "attente") && await count(a, ".g-wait > details") === 1 && (await text(a, ".g-lead")).includes("dès qu'Inès aura fini"), "l'hôte joue tout le paquet seul : il attend, avec le rappel du lien d'invitation");
  const slip = await typo(a);
  check(!slip, "typographie de l'écran d'attente, rappel du lien compris : aucune espace ordinaire devant une ponctuation double" + (slip ? " (" + slip + ")" : ""));
  await a.page.reload();
  check(await is(a, "attente") && await count(a, ".match-card") === 0, "il recharge : toujours en attente, sans carte à refaire");
  await join(b, link);
  await b.page.waitForSelector(".match-card");
  const more = await spare(env, 3);
  check(await count(b, ".match.as-b") === 1 && await pos(b) === "1 / " + N && await card(b) === A.t[0], "l'invité arrive ensuite : il commence à la première carte, la même");
  check(await count(b, ".match-list") === 0 && !(await html(b)).includes((await saved(a)).S.a.d.v), "sans rien voir des réponses de l'hôte, pourtant déjà sur son téléphone");
  await answer(b, (i) => [1, 2, 2, 0][i % 4], 0, 20, B);
  await b.page.reload();
  await b.page.waitForSelector(".match-card");
  check(await pos(b) === "21 / " + N, "il recharge en plein paquet et reprend à la vingt et unième carte");
  await rest(b, (i) => [1, 2, 2, 0][i % 4], B);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "quand il finit, le résultat s'ouvre des deux côtés");
  const want = shared(items, vectorOf(items, A), vectorOf(items, B)).map((x) => x.t);
  check(JSON.stringify(await ideas(a)) === JSON.stringify(want) && JSON.stringify(await ideas(b)) === JSON.stringify(want), "avec les mêmes " + want.length + " envies communes, dans le même ordre");
  check(more <= 1 && await posts(env) === 4 + more, "quatre messages en tout : deux arrivées, deux paquets rendus (" + await posts(env) + (more ? ", dont une arrivée déposée deux fois par le socle" : "") + ")");

  /* L'hôte reste sur l'écran d'invitation pendant que l'invité joue tout. */
  const c = await phone(env, "c-tard"), d = await phone(env, "d-tard");
  await intro(c, env, { deck: "table" });
  await hit(c, '[data-act="g-start"][data-mode="duo"]');
  await join(d, await c.page.locator(".share[data-url]").getAttribute("data-url"));
  await d.page.waitForSelector(".match-card");
  await rest(d, () => 2);
  check(await is(d, "attente") && await until(() => count(c, ".sync.is-here")), "l'invité joue tout pendant que l'hôte est encore sur l'invitation : l'hôte voit qu'il est là");
  await hit(c, '[data-act="g-go"]');
  await c.page.waitForSelector(".match-card");
  check(await pos(c) === "1 / " + N && await count(c, ".match-list") === 0, "l'hôte touche « Commencer » : sa première carte, rien du résultat");
  await rest(c, () => 1);
  check(await is(c, "resultat", 8000) && await is(d, "resultat", 8000) && (await ideas(c)).length === N, "il finit : le résultat s'ouvre des deux côtés");
});

scenario("Deux téléphones : rechargement à chaque étape, sur chaque téléphone", async (env) => {
  const a = await phone(env, "a-recharge"), b = await phone(env, "b-recharge");
  await intro(a, env, { deck: "voyages" });
  await hit(a, '[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.reload();
  check(await until(() => count(a, '[data-act="g-go"]')) && await a.page.locator(".share[data-url]").getAttribute("data-url") === link, "A recharge sur l'invitation : même lien");
  await b.page.goto(link);
  await b.page.waitForSelector('[data-act="g-join"]');
  await b.page.reload();
  check(await until(() => count(b, '[data-act="g-join"]')), "B recharge avant de rejoindre : l'invitation est toujours là");
  await hit(b, '[data-act="g-join"]');
  await b.page.waitForSelector(".match-card");
  const more = await spare(env, 2);
  await hit(a, '[data-act="g-go"]');
  await a.page.waitForSelector(".match-card");
  const decks = await decksOf(a), items = decks.find((d) => d.id === "voyages").items, N = items.length, A = { t: [], a: [] }, B = { t: [], a: [] };
  const fa = (i) => [2, 2, 1, 0, 1][i % 5], fb = (i) => [0, 2, 1][i % 3];
  await answer(a, fa, 0, 4, A);
  await a.page.reload();
  await a.page.waitForSelector(".match-card");
  await answer(b, fb, 0, 10, B);
  await b.page.reload();
  await b.page.waitForSelector(".match-card");
  check(await pos(a) === "5 / " + N && await pos(b) === "11 / " + N && await card(a) === B.t[4], "chacun recharge en plein paquet et retrouve sa carte");
  await rest(b, fb, B);
  check(await is(b, "attente"), "B finit le premier et attend");
  await b.page.reload();
  check(await is(b, "attente") && await count(b, ".match-card") === 0, "B recharge en attente : toujours en attente");
  check(await until(async () => typeof vec(await saved(a), "b") === "string"), "(les réponses de B sont sur le téléphone de A)");
  const vb = vec(await saved(a), "b");
  await a.page.reload();
  await a.page.waitForSelector(".match-card");
  check(await pos(a) === "5 / " + N && await count(a, ".match-list") === 0 && await count(a, ".match-venn") === 0 && !(await html(a)).includes(vb), "A recharge avec les réponses de B en poche : sa carte, et rien d'autre");
  await rest(a, fa, A);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "A finit : le résultat s'ouvre des deux côtés");
  const want = shared(items, vectorOf(items, A), vectorOf(items, B)).map((x) => x.t);
  await hit(a, ".match-done >> nth=0");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await Promise.all([a.page.waitForSelector(".match-list"), b.page.waitForSelector(".match-list")]);
  check(JSON.stringify(await ideas(a)) === JSON.stringify(want) && JSON.stringify(await ideas(b)) === JSON.stringify(want), "les deux rechargent sur le résultat : les mêmes " + want.length + " envies");
  check((await kept(a)).length === want.length && (await kept(b)).length === want.length && await count(a, ".match-list li.is-done") === 1 && await count(b, ".match-list li.is-done") === 0, "rien en double dans « Nos envies », la coche de A est restée chez A");
  await sleep(800);
  check(more <= 1 && await posts(env) === 4 + more, "tous ces rechargements n'ont rien renvoyé : quatre messages (" + await posts(env) + (more ? ", dont une arrivée déposée deux fois par le socle" : "") + ")");

  await b.page.locator(again("table")).scrollIntoViewIfNeeded();
  await hit(b, again("table"));
  check(await is(a, "precedent", 8000) && JSON.stringify(await ideas(a)) === JSON.stringify(want) && await count(a, ".match-list li.is-done") === 1, "B relance un paquet : A garde le résultat à l'écran, coche comprise");
  await a.page.reload();
  check(await is(a, "precedent"), "A recharge : le résultat est toujours là");
  await next(a);
  check(await is(a, "carte") && await is(b, "carte") && await tag(a) === norm(decks.find((d) => d.id === "table").name), "« Passer au paquet suivant » : le paquet de B démarre chez A");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await Promise.all([a.page.waitForSelector(".match-card"), b.page.waitForSelector(".match-card")]);
  check(await card(a) === await card(b) && await pos(a) === "1 / " + N && await count(a, OKAY) === 0 && await count(a, REVIEW) === 1, "les deux rechargent : même première carte, le résultat précédent reste à portée sans s'imposer");
  await answer(a, () => 2, 0, 2);
  await a.page.reload();
  await a.page.waitForSelector(".match-card");
  await quit(a);
  await a.page.waitForSelector(".g-wait");
  await a.page.reload();
  check(await is(a, "attente"), "A s'arrête à la troisième carte, recharge : en attente");
  await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000) && (await title(a)).includes("Rien en commun") && (await title(b)).includes("Rien en commun"), "B s'arrête sans répondre : « Rien en commun » des deux côtés");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "resultat") && await is(b, "resultat") && (await kept(a)).length === want.length, "rechargement sur ce résultat vide : il reste, et la liste gardée ne bouge pas");
  await sleep(800);
  check(await posts(env) === 7 + more, "deux paquets joués : sept messages (" + await posts(env) + (more ? ", dont une arrivée déposée deux fois par le socle" : "") + ")");
});

scenario("Deux téléphones : quitter vers l'accueil, fermer la page, et revenir", async (env) => {
  const { a, b } = await duo(env, "accueil", { deck: "fous" });
  const decks = await decksOf(a), N = decks[0].items.length;
  await answer(a, () => 2, 0, 6);
  const at = await card(a);
  await hit(a, HOME);
  await a.page.waitForSelector(".banner");
  await rest(b, () => 1);
  await b.page.waitForSelector(".g-wait");
  await sleep(800);
  check(await count(a, RESUME) === 1 && await count(a, ".match-list") === 0, "A est à l'accueil quand B finit : la partie reste « en cours »");
  await hit(a, RESUME);
  await a.page.waitForSelector(".match-card");
  check(await pos(a) === "7 / " + N && await card(a) === at, "A revient : sa septième carte, pas le résultat");
  await rest(a, () => 2);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000) && (await ideas(a)).length === N, "A finit : le résultat s'ouvre des deux côtés");

  await b.page.locator(again("sorties")).scrollIntoViewIfNeeded();
  await hit(b, again("sorties"));
  await next(a);
  await rest(b, () => 2);
  await b.page.waitForSelector(".g-wait");
  await answer(a, () => 1, 0, N);
  await pace(a);
  const before = await posts(env);
  /* A valide ses réponses et ferme la page dans la foulée, avant que rien n'ait pu partir. */
  await a.page.evaluate(() => { document.querySelector('[data-act="send"]').click(); window.stop(); location.replace("about:blank"); });
  await sleep(1500);
  const lost = await posts(env) === before;
  check(await kind(b) === (lost ? "attente" : "resultat"), lost ? "A ferme la page à l'instant où il finit : rien n'est parti, B attend" : "A ferme la page juste après avoir fini : ses réponses sont parties quand même");
  await a.page.goto(env.base + "#jeu-match");
  check(await is(a, "resultat", 10000) && await is(b, "resultat", 10000) && (await ideas(a)).length === N && (await ideas(b)).length === N, "A rouvre la page : ses réponses partent, le résultat s'ouvre des deux côtés");

  await hit(a, HOME);
  await a.page.waitForSelector('a.card-link[href="#jeu-match"]');
  check(await count(a, ".banner") === 0, "résultat vu : l'accueil de A ne propose rien à reprendre");
  await b.page.locator(again("table")).scrollIntoViewIfNeeded();
  await hit(b, again("table"));
  await answer(b, () => 2, 0, 3);
  await sleep(800);
  await a.page.click('a.card-link[href="#jeu-match"]');
  check(await is(a, "precedent", 8000) && (await ideas(a)).length === N, "B relance pendant que A est à l'accueil : en revenant, A retrouve d'abord le résultat qu'il n'avait pas quitté lui-même");
  await next(a);
  check(await tag(a) === norm(decks.find((d) => d.id === "table").name) && await pos(a) === "1 / " + N && await count(a, REVIEW) === 1, "puis la première carte du nouveau paquet");

  /* A a fini et quitté ; B finit, voit le résultat et relance : A ne l'a jamais vu. */
  await rest(a, () => 2);
  await a.page.waitForSelector(".g-wait");
  await until(async () => typeof vec(await saved(b), "a") === "string");
  await hit(a, HOME);
  await rest(b, () => 2);
  await b.page.waitForSelector(".match-venn");
  await b.page.locator(again("maison")).scrollIntoViewIfNeeded();
  await hit(b, again("maison"));
  await b.page.waitForSelector(".match-card");
  await sleep(800);
  await a.page.click('a.card-link[href="#jeu-match"]');
  check(await is(a, "precedent", 8000) && (await ideas(a)).length === N && await count(a, ".match-duo") === N, "A revient après un résultat manqué : il le trouve d'abord, au complet");
  await hit(a, HOME);
  await a.page.waitForSelector('a.card-link[href="#jeu-match"]');
  check(await count(a, RESUME) === 1, "l'accueil propose alors de reprendre : le nouveau paquet attend");
  await hit(a, RESUME);
  check(await is(a, "precedent"), "« Reprendre » : toujours le résultat manqué");
  await hit(a, OKAY);
  await a.page.waitForSelector(".match-card");
  check(await tag(a) === norm(decks.find((d) => d.id === "maison").name) && await card(a) === await card(b), "puis la première carte du paquet en cours, la même que chez B");
});

scenario("Deux téléphones : tout au même instant, plusieurs paquets de suite", async (env) => {
  const { a, b } = await duo(env, "instant", { deck: "sorties" });
  const more = await spare(env, 2);
  const decks = await decksOf(a), picks = [["maison", "voyages"], ["fous", "table"], ["couette", "sorties"]];
  const fa = (i) => [2, 1, 0, 2][i % 4], fb = (i) => [1, 2, 2, 0, 0][i % 5];
  let results = true, same = true, fresh = true, quiet = true;
  for (const pick of picks) {
    await Promise.all([rest(a, fa), rest(b, fb)]);
    const open = await is(a, "resultat", 8000) && await is(b, "resultat", 8000);
    const sa = await saved(a), sb = await saved(b), items = (decks.find((d) => d.id === sa.setup.deck) || decks[0]).items;
    const want = open ? shared(items, vec(sa, "a"), vec(sa, "b")).map((x) => x.t) : [];
    results = results && open && vec(sa, "a") === vec(sb, "a") && vec(sa, "b") === vec(sb, "b") && JSON.stringify(await ideas(a)) === JSON.stringify(want) && JSON.stringify(await ideas(b)) === JSON.stringify(want);
    await Promise.all([a.page.locator(again(pick[0])).scrollIntoViewIfNeeded(), b.page.locator(again(pick[1])).scrollIntoViewIfNeeded()]);
    await Promise.all([hit(a, again(pick[0])).catch(() => {}), hit(b, again(pick[1])).catch(() => {})]);
    const met = await until(async () => { const x = await saved(a), y = await saved(b); return x.gen === y.gen && JSON.stringify(x.setup) === JSON.stringify(y.setup) && x.gen > sa.gen; }, 8000);
    await sleep(600);
    same = same && met && await kind(a) === "carte" && await kind(b) === "carte" && await card(a) === await card(b) && await tag(a) === await tag(b);
    fresh = fresh && !(await saved(a)).local.d && !(await saved(b)).local.d && await pos(a) === "1 / " + items.length && await pos(b) === await pos(a);
    quiet = quiet && await count(a, OKAY) === 0 && await count(b, OKAY) === 0;
  }
  check(results, "trois paquets finis au même instant : chaque fois le même résultat des deux côtés, conforme aux réponses");
  check(same, "trois fois deux paquets différents choisis au même instant : les deux téléphones finissent sur le même paquet et la même carte");
  check(fresh, "à sa première carte, sans brouillon hérité");
  check(quiet, "et aucun des deux ne se voit resservir un résultat qu'il a déjà vu");
  await sleep(800);
  check(more <= 1 && await posts(env) <= 14 + more, "au plus quatre messages par paquet, arrivées en plus (" + await posts(env) + ")");
  check(await healthy(a) && await healthy(b), "aucune erreur en route");
});

scenario("Deux téléphones : l'autre relance un paquet à l'instant où je touche l'écran", async (env) => {
  /* 360 × 640, résultat vide : la mise en page ne dépend pas du tirage (voir les touchers répétés). */
  const { a, b } = await duo(env, "croise", { deck: "sorties", phone: { viewport: { width: 360, height: 640 } } });
  const decks = await decksOf(a), bad = [];
  for (const id of ["table", "couette", "voyages"]) {
    await quit(a);
    await quit(b);
    if (!(await is(a, "resultat", 8000) && await is(b, "resultat", 8000))) throw new Error("le résultat ne s'est pas ouvert des deux côtés");
    /* A descend en bas du résultat et vise un paquet ; celui que B vient de choisir s'ouvre juste avant que son doigt ne touche l'écran. */
    await a.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const box = await a.page.locator(again(id)).boundingBox(), gen = (await saved(a)).gen;
    await b.page.locator(again("maison")).scrollIntoViewIfNeeded();
    await hit(b, again("maison"));
    await a.page.waitForFunction((g) => JSON.parse(localStorage.getItem("en:g:match")).gen > g && !!document.querySelector('[data-act="ok"]'), gen, { timeout: 8000 });
    await a.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(400);
    const s = await saved(a), k = await kind(a), name = decks.find((d) => d.id === id).name;
    if (s.gen !== gen + 1 || s.local.d || k !== "precedent") bad.push("en visant « " + name + " » : " + (s.gen !== gen + 1 ? "manche " + s.gen : s.local.d ? "première carte répondue" : "écran « " + k + " »"));
    if (k === "precedent") await next(a);
  }
  check(!bad.length, "l'autre relance un paquet sous un doigt qui en visait un autre : ce toucher ne lance rien, ne répond à aucune carte, et le résultat reste à l'écran" + (bad.length ? " (" + bad.length + " fois sur 3 ; " + bad.join(" ; ") + ")" : ""));
  check(await healthy(a) && await healthy(b), "aucune erreur en route");
});

scenario("Deux téléphones : un paquet relancé pendant que l'autre a une carte en main", async (env) => {
  const { a, b } = await duo(env, "geste", { deck: "sorties" });
  const decks = await decksOf(a), name = (id) => norm(decks.find((d) => d.id === id).name), N = decks[0].items.length;
  const cross = async (da, db) => {
    await Promise.all([a.page.locator(again(da)).scrollIntoViewIfNeeded(), b.page.locator(again(db)).scrollIntoViewIfNeeded()]);
    /* Le relais met une seconde et demie à transmettre : les deux choix se croisent, celui d'Alex l'emportera. */
    await env.ctl("delay=1500");
    await Promise.all([hit(a, again(da)), hit(b, again(db))]);
    await b.page.waitForSelector(".match-card");
  };
  await quit(a);
  await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(les deux sont devant le résultat)");

  await cross("table", "voyages");
  const held = await card(b), release = await grab(b, 150, 0);
  const came = await until(async () => (await saved(b)).setup.deck === "table", 8000);
  check(came && await card(b) === held && await tag(b) === name("voyages"), "le paquet choisi par Alex arrive pendant qu'Inès tient sa carte : rien ne bouge sous son doigt");
  await release();
  await sleep(500);
  let s = await saved(b);
  check(await kind(b) === "carte" && await tag(b) === name("table") && await pos(b) === "1 / " + N && !s.local.d,
    "au lâcher, le nouveau paquet s'ouvre à sa première carte : le geste fait sur l'ancienne ne répond pas à une carte jamais vue (carte " + await pos(b) + ", brouillon : " + JSON.stringify(s.local.d || "") + ")");
  await env.ctl("delay=0");

  await quit(a);
  if (await kind(b) === "carte") await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(les deux reviennent devant un résultat)");
  await cross("maison", "fous");
  await hit(b, QUIT);
  await b.page.waitForSelector(SEND);
  const send = await b.page.locator(SEND).boundingBox();
  const came2 = await b.page.waitForFunction(() => JSON.parse(localStorage.getItem("en:g:match")).setup.deck === "maison" && !!document.querySelector(".match-card"), null, { timeout: 8000 }).then(() => true, () => false);
  await b.page.touchscreen.tap(send.x + send.width / 2, send.y + send.height / 2);
  await sleep(500);
  s = await saved(b);
  check(came2 && await kind(b) === "carte" && await tag(b) === name("maison") && !vec(s, "b") && !s.local.d,
    "le paquet d'Alex arrive quand Inès allait valider son arrêt : son toucher ne rend pas, tout en « non », un paquet qu'elle n'a jamais vu, et ne répond à rien (écran : " + await kind(b) + ", réponses envoyées : " + JSON.stringify(vec(s, "b") || "") + ")");
  /* Au clavier aussi : la carte est tenue à la souris quand le paquet change, puis une flèche est pressée. */
  await env.ctl("delay=0");
  await quit(a);
  await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(les deux reviennent encore devant un résultat)");
  await cross("couette", "sorties");
  const drop = await grab(b, 30, 0);
  const came3 = await until(async () => (await saved(b)).setup.deck === "couette", 8000);
  await b.page.keyboard.press("ArrowUp");
  await sleep(400);
  await drop();
  s = await saved(b);
  check(came3 && await kind(b) === "carte" && await tag(b) === name("couette") && !s.local.d, "une flèche pressée pendant que la carte est tenue, après l'arrivée du paquet d'Alex : aucune réponse sur la carte jamais vue");
  await env.ctl("delay=0");
  check(await healthy(a) && await healthy(b), "aucune erreur en route");
});

scenario("Deux téléphones : hors ligne, puis relais en panne", async (env) => {
  const { a, b } = await duo(env, "panne", { deck: "table" });
  const decks = await decksOf(a), items = decks.find((d) => d.id === "table").items, N = items.length;
  await linked(a);
  await a.ctx.setOffline(true);
  await rest(a, (i) => [2, 1, 0][i % 3]);
  await rest(b, (i) => [1, 0, 2, 2][i % 4]);
  await sleep(2500);
  /* Selon le navigateur, le flux déjà ouvert de A survit ou non à la coupure : A peut voir le résultat avant B. */
  check(await kind(b) === "attente" && await kind(a) !== "carte" && await count(a, '.g-top [data-net="ok"]') === 0, "A joue tout son paquet hors ligne : ses réponses sont gardées, B attend, la pastille de A ne dit plus « Connecté »");
  await a.page.reload().catch(() => {});
  await a.ctx.setOffline(false);
  await a.page.goto(env.base + "#jeu-match");
  check(await is(a, "resultat", 45000) && await is(b, "resultat", 45000), "A recharge hors ligne, puis le réseau revient : le résultat s'ouvre des deux côtés");
  const sa = await saved(a), sb = await saved(b), want = shared(items, vec(sa, "a"), vec(sa, "b")).map((x) => x.t);
  check(vec(sa, "a") === vec(sb, "a") && vec(sa, "b") === vec(sb, "b") && JSON.stringify(await ideas(a)) === JSON.stringify(want) && JSON.stringify(await ideas(b)) === JSON.stringify(want), "mêmes réponses et mêmes " + want.length + " envies sur les deux téléphones");

  /* Sans liaison, relancer est refusé : l'autre a peut-être déjà relancé, et son paquet serait écrasé. */
  await env.ctl("down=1");
  await until(async () => await count(b, '.g-top [data-net="ok"]') === 0, 8000);
  await b.page.locator(again("maison")).scrollIntoViewIfNeeded();
  await hit(b, again("maison"));
  check(await kind(b) === "resultat" && (await saved(b)).gen === 1 && (await text(b, ".g-opts .hint")).includes("connexion") && !(await typo(b)), "relais en panne : relancer un paquet est refusé, avec un mot d'explication");
  await env.ctl("down=0");
  check(await linked(a, 45000) && await linked(b, 45000), "le relais revient : les deux pastilles reviennent à « Connecté »");
  await hit(b, again("maison"));
  check(await is(b, "carte") && await is(a, "precedent", 8000), "la liaison revenue, le même toucher lance le paquet");
  await next(a);

  /* A perd le relais devant le résultat ; pendant ce temps B relance un paquet et le joue en entier. */
  await quit(a);
  await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(les deux reviennent devant un résultat)");
  const cut = (r) => r.abort();
  await a.ctx.route(env.relayUrl + "**", cut);
  await a.page.reload();
  await a.page.waitForSelector(".match-venn");
  await b.page.locator(again("fous")).scrollIntoViewIfNeeded();
  await hit(b, again("fous"));
  await b.page.waitForSelector(".match-card");
  await rest(b, () => 2);
  check(await is(b, "attente"), "B relance et joue tout un paquet pendant que A, sans liaison, est resté sur l'ancien résultat");
  const vb = vec(await saved(b), "b");
  await a.page.locator(again("voyages")).scrollIntoViewIfNeeded();
  await hit(a, again("voyages"));
  check(await kind(a) === "resultat" && (await saved(a)).gen === 2, "A touche un paquet sur son résultat périmé : rien n'est relancé");
  await a.ctx.unroute(env.relayUrl + "**", cut);
  await a.page.evaluate(() => window.dispatchEvent(new Event("online")));
  check(await is(a, "precedent", 45000) && await kind(b) === "attente" && vec(await saved(b), "b") === vb, "la liaison revient : A apprend la relance de B, dont les réponses comptent toujours");
  await next(a);
  await rest(a, () => 1);
  check(await is(a, "resultat", 10000) && await is(b, "resultat", 10000) && (await ideas(a)).length === N && (await ideas(b)).length === N, "et la partie se termine normalement des deux côtés");
});

scenario("Deux téléphones : le relais oublie tout en pleine partie", async (env) => {
  const { a, b } = await duo(env, "oubli", { deck: "maison" });
  const N = (await decksOf(a))[0].items.length;
  await rest(a, () => 2);
  await a.page.waitForSelector(".g-wait");
  await answer(b, () => 1, 0, 4);
  await sleep(600);
  await env.ctl("reset=1");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "attente") && await is(b, "carte") && await pos(b) === "5 / " + N, "le relais oublie tout, les deux rechargent : A attend toujours, B retrouve sa cinquième carte");
  await rest(b, () => 1);
  check(await is(a, "resultat", 15000) && await is(b, "resultat", 15000) && (await ideas(a)).length === N && (await ideas(b)).length === N, "B finit : le résultat s'ouvre des deux côtés");
  await b.page.locator(again("table")).scrollIntoViewIfNeeded();
  await hit(b, again("table"));
  await next(a);
  await answer(a, () => 2, 0, 10);
  await env.ctl("reset=1");
  await sleep(300);
  await Promise.all([rest(a, () => 2), rest(b, () => 2)]);
  check(await is(a, "resultat", 30000) && await is(b, "resultat", 30000) && (await ideas(a)).length === N, "nouvel oubli sans recharger, pendant que les deux jouent : le résultat s'ouvre quand même");
  check((await kept(a)).length === 2 * N && (await kept(b)).length === 2 * N, "et chaque téléphone a gardé les envies des deux paquets, sans doublon");
  const t = (await env.ctl()).topics, room = Object.keys(t)[0];
  check(!!room && t[room].messages <= 6, "chacun n'a redéposé que son dernier état (" + (room ? t[room].messages : 0) + " messages dans le salon)");
});

scenario("Deux téléphones : l'invité arrête la partie par erreur, puis rouvre le lien", async (env) => {
  const { a, b, link } = await duo(env, "retour", { deck: "voyages" });
  const items = (await decksOf(a)).find((d) => d.id === "voyages").items, N = items.length;
  await rest(b, (i) => [2, 1][i % 2]);
  await b.page.waitForSelector(".g-wait");
  await until(async () => typeof vec(await saved(a), "b") === "string");
  const vb = vec(await saved(a), "b");
  await twice(b, END);
  await b.page.waitForSelector("main.intro");
  await join(b, link);
  check(await is(b, "attente", 8000) && vec(await saved(b), "b") === vb, "B arrête la partie par erreur après avoir fini, puis rouvre le lien : ses réponses reviennent, il attend sans rejouer le paquet (écran : " + await kind(b) + ")");
  await rest(a, () => 2);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000) && (await ideas(a)).length === N && JSON.stringify(await ideas(a)) === JSON.stringify(await ideas(b)), "A finit : le résultat s'ouvre des deux côtés, identique");
  /* Autre navigateur (lien ouvert depuis une messagerie) : rien en mémoire, même joueur. */
  const b2 = await phone(env, "b2-retour");
  await join(b2, link);
  check(await is(b2, "resultat", 8000) && (await ideas(b2)).length === N && (await kept(b2)).length === N, "le lien rouvert dans un autre navigateur retrouve le résultat et regarnit « Nos envies »");
});

scenario("Deux téléphones : rien ne part sans un geste", async (env) => {
  const { a, b } = await duo(env, "compte", { deck: "sorties" });
  const base = 2 + await spare(env, 2);
  check(base === 2 || base === 3, "deux arrivées : deux messages, trois si le socle redépose celle de l'invité (" + base + ")");
  await answer(a, () => 2, 0, 10);
  for (let i = 0; i < 3; i++) await hit(a, UNDO);
  await answer(a, () => 0, 7, 12);
  for (let i = 0; i < 4; i++) { const release = await grab(b, i % 2 ? 140 : -140, 0); await release(); }
  await hit(b, QUIT);
  await Promise.all([a.page.reload(), b.page.reload()]);
  await sleep(1200);
  check(await posts(env) === base && await kind(b) === "fin" && (await saved(b)).local.d.length === 4, "répondre, revenir en arrière, glisser, toucher « J'arrête là » sans valider, recharger : aucun message de plus");
  await hit(b, UNDO);
  await b.page.waitForSelector(".match-card");
  await rest(a, () => 2);
  await a.page.waitForSelector(".g-wait");
  check(await until(async () => await posts(env) === base + 1) && await kind(b) === "carte", "A finit : un message, et B reste sur sa carte");
  await sleep(1200);
  check(await posts(env) === base + 1, "recevoir les réponses de A ne fait rien renvoyer à B");
  await rest(b, () => 1);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000) && await until(async () => await posts(env) === base + 2), "B finit : un message, le résultat s'ouvre");
  await hit(a, ".match-done >> nth=0");
  await hit(b, ".match-done >> nth=2");
  await sleep(1500);
  check(await posts(env) === base + 2, "afficher le résultat et cocher « Fait » ne coûtent rien");
  await a.page.locator(again("fous")).scrollIntoViewIfNeeded();
  await hit(a, again("fous"));
  await next(b);
  await hit(b, REVIEW);
  await b.page.waitForSelector(OKAY);
  await hit(b, OKAY);
  await sleep(1500);
  check(await posts(env) === base + 3, "relancer : un message ; passer à la suite puis revoir le résultat précédent chez l'autre : aucun");
  await quit(a);
  await quit(b);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(les deux s'arrêtent : résultat)");
  await sleep(1500);
  check(await posts(env) === base + 5, "deux paquets à deux téléphones : cinq messages après les arrivées, sept en tout (" + await posts(env) + ")");
  const sa = await saved(a), raw = await (await fetch(env.relayUrl + "entrenous-" + sa.room.r + "/json?poll=1&since=all")).text();
  check(raw.split("\n").filter(Boolean).length === base + 5 && ["sorties", "fous", "Alex", "Inès", "seed", "deck", vec(sa, "a").slice(0, 12)].every((x) => raw.indexOf(x) < 0) && (await env.ctl()).count.rejected === 0,
    "ce que le relais a reçu est illisible (ni prénoms, ni paquet, ni réponses en clair), et aucun message n'a été refusé pour sa taille");
});

scenario("Deux téléphones : prénoms extrêmes sur petit écran", async (env) => {
  const A = "Éloïse-Marie d'Armor", B = "W".repeat(20);
  const { a, b } = await duo(env, "noms", { a: A, b: B, deck: "couette" });
  /* L'invitation est un écran du socle, essayé ailleurs : on ne rétrécit les téléphones qu'une fois dans le jeu. */
  await Promise.all([a.page.setViewportSize({ width: 320, height: 568 }), b.page.setViewportSize({ width: 320, height: 568 })]);
  const wide = [], tiny = [];
  const look = async (p, label) => {
    const o = await overflow(p), t = await small(p);
    if (o) wide.push(label + " : " + o);
    if (t && tiny.indexOf(t) < 0) tiny.push(t);
  };
  await look(a, "carte de A");
  await look(b, "carte de B");
  await quit(b);
  await b.page.waitForSelector(".g-wait");
  await look(b, "attente de B");
  check((await text(b, ".g-lead")).includes("dès qu'" + A + " aura fini") && (await text(b, ".g-wait .sync")).includes("En attente des réponses d'" + A), "attente chez B : « qu' » et « d' » devant le prénom de A, qui commence par une voyelle accentuée");
  await b.shot("match-extra-320-attente");
  await hit(a, ans(2));
  await quit(a);
  check(await is(a, "resultat", 8000) && await is(b, "resultat", 8000), "(résultat des deux côtés)");
  await look(a, "résultat de A");
  check((await text(a, ".g-opts .hint")).includes("chez " + B) && (await text(b, ".g-opts .hint")).includes("chez " + A), "le résultat dit chez qui le paquet suivant démarrera aussi, avec le bon prénom de chaque côté");
  await a.page.locator(again("table")).scrollIntoViewIfNeeded();
  await hit(a, again("table"));
  await is(b, "precedent", 8000);
  await look(b, "résultat gardé chez B");
  await quit(a);
  await a.page.waitForSelector(".g-wait");
  await look(a, "attente de A");
  check((await text(a, ".g-lead")).includes("dès que " + B + " aura fini") && (await text(a, ".g-wait .sync")).includes("En attente des réponses de " + B), "attente chez A : « que » et « de » devant une consonne");
  check(!wide.length, "320 px, prénoms de 20 lettres : rien ne dépasse en largeur" + (wide.length ? " (" + wide[0] + ")" : ""));
  check(!tiny.length, "toutes les zones tactiles font au moins 44 px" + (tiny.length ? " (" + tiny.join(" ; ") + ")" : ""));
});

scenario("Deux téléphones : valeurs hostiles venues de l'autre", async (env) => {
  const { a, b } = await duo(env, "pirate", { deck: "sorties" });
  const decks = await decksOf(a), N = decks[0].items.length;
  const header = (fn, ms) => until(async () => fn(await saved(a)), ms || 8000);

  /* Le brouillon de B abîmé sur son propre téléphone : il doit retrouver une carte jouable. */
  let ok = true;
  for (const d of [12, null, ["2"], { length: 3 }, "9", "0x", "0".repeat(99)]) {
    await inject(b, { local: { d, go: "x" } });
    await b.page.waitForSelector("main.game");
    ok = ok && await kind(b) === (d === "0".repeat(99) ? "fin" : "carte") && await healthy(b) && await pos(b) === (d === "0".repeat(99) ? N : 1) + " / " + N;
  }
  check(ok, "un brouillon abîmé (nombre, tableau, lettres, cent réponses) : un écran jouable, sans erreur");
  await hit(b, UNDO);
  await hit(b, ans(2));
  await hit(b, SEND);
  const vb = (await is(b, "attente")) ? vec(await saved(b), "b") : "";
  check(vb.length === N && vb.replace(/0/g, "") === "2", "depuis un brouillon de cent réponses, la dernière carte reprise puis validée rend un paquet de la bonne longueur, avec la seule réponse donnée");

  /* Réponses de B de toutes les formes : pour A, B n'a simplement pas fini. */
  ok = true;
  for (const v of ["２".repeat(N), "1".repeat(N - 1) + "\n", " " + "1".repeat(N - 1), "1".repeat(N + 1), "1".repeat(N).split(""), { 0: "1", length: N }, true, 1e35, "1".repeat(N - 1) + "3", HOSTILE]) {
    await inject(b, { d: { v } });
    ok = ok && await header((s) => JSON.stringify(s.S.b.d.v) === JSON.stringify(v)) && await kind(a) === "carte" && await healthy(a);
  }
  check(ok, "réponses de B malformées (chiffres pleine largeur, saut de ligne, trop longues, tableau, objet, booléen…) : A garde sa carte, sans erreur");
  await quit(a);
  await a.page.waitForSelector(".g-wait");
  await inject(b, { d: { v: "2".repeat(N), junk: "x".repeat(3000), w: HOSTILE } });
  check(await is(a, "resultat", 8000) && await healthy(a), "des réponses valides accompagnées de champs en trop : le résultat s'ouvre, sans dégât");
  await inject(b, { d: { v: HOSTILE } });
  check(await is(a, "attente", 8000) && await healthy(a), "B retire ses réponses après coup : A repasse en attente au lieu de casser");
  await inject(b, { d: { v: "1".repeat(N) } });
  check(await is(a, "resultat", 8000), "puis les rend : le résultat revient");

  /* Réglages hostiles : les deux téléphones doivent rester d'accord sur la carte affichée. */
  let gen = (await saved(b)).gen, culprit = "";
  for (const su of [{ seed: "abc", deck: "__proto__" }, { seed: -5, deck: "constructor" }, { seed: 1.5, deck: null }, { seed: "9".repeat(30), deck: [] }, { seed: 0, deck: {} }, { seed: 7, deck: "x".repeat(2000) },
    { seed: 8, deck: "table", prev: "x" }, { seed: 9, deck: "table", prev: [] }, { seed: 10, deck: "table", prev: { k: {}, d: "sorties", m: "1".repeat(N) } }, { seed: 11, deck: "table", prev: { k: "k", d: "toString", m: "1".repeat(N) } },
    { seed: 12, deck: "table", prev: { k: "k", d: "sorties", m: "4".repeat(N) } }, { seed: 13, deck: "table", prev: { k: "k", d: "sorties", m: "1".repeat(N - 1) } }, { seed: 14, deck: "table", prev: { k: "k".repeat(41), d: "sorties", m: "1".repeat(N) } }]) {
    gen++;
    await inject(b, { h: { gen, setup: su, sh: { x: HOSTILE }, local: {} } });
    const got = await header((s) => s.gen === gen);
    await b.page.waitForSelector("main.game");
    const fine = got && await is(a, "carte") && await is(b, "carte") && await healthy(a) && await healthy(b) && await card(a) === await card(b) && await pos(a) === "1 / " + N;
    if (!fine && !culprit) culprit = JSON.stringify(su).slice(0, 120) + " ; A : " + await kind(a) + ", B : " + await kind(b);
  }
  check(!culprit, "réglages hostiles (tirage, paquet et résultat précédent de toutes formes) : les deux téléphones montrent la même première carte, sans faux résultat" + (culprit ? " (" + culprit + ")" : ""));

  /* Boutons forgés dans la page de A, en pleine carte. */
  const before = await saved(a);
  await a.page.evaluate((h) => {
    const push = (act, attrs) => { const x = document.createElement("button"); x.setAttribute("data-act", act); Object.keys(attrs || {}).forEach((k) => x.setAttribute(k, attrs[k])); document.querySelector("main.game .match").appendChild(x); x.click(); };
    push("again", { "data-deck": "maison" });
    push("again", { "data-deck": h });
    push("ok");
    push("review");
    push("undo");
    ["7", "-1", "abc", "", "3", "99999999999"].forEach((k) => push("rep", { "data-k": k }));
    push("fait", { "data-d": h, "data-i": "-4" });
    push("fait", { "data-d": "sorties", "data-i": "999" });
    push("fait", {});
  }, HOSTILE);
  await sleep(400);
  const after = await saved(a);
  check(after.gen === before.gen && !after.local.d && await kind(a) === "carte" && await healthy(a), "boutons forgés en pleine carte (relancer, réponses hors bornes, coches sans idée) : rien ne bouge, rien ne casse (manche " + after.gen + ", brouillon : " + JSON.stringify(after.local.d || "") + ", écran : " + await kind(a) + ")");

  const c = await phone(env, "c-pirate"), room = (await saved(a)).room;
  await join(c, env.base + "#g=" + token({ g: "match", v: 1, n: [HOSTILE, "D'Artagnan"], r: room.r, k: room.k, su: { seed: "x", deck: 12, prev: { k: HOSTILE, d: "couette", m: "3".repeat(N) } }, gen: 3 }));
  check(await until(() => healthy(c)) && ["carte", "fin", "attente", "precedent", "resultat"].indexOf(await kind(c)) >= 0, "une invitation aux prénoms et réglages hostiles s'ouvre sur un écran de jeu intact, sans rien exécuter");
  /* Le téléphone pirate a volontairement un état abîmé : ses propres erreurs ne comptent pas. */
  b.errors.length = 0;
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
