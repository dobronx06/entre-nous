/* Essais d'endurance du jeu « Dessine-moi » : ce que deux personnes font pour de vrai et que l'essai
   de base ne couvre pas (recharger à chaque étape, quitter et revenir, toucher plusieurs fois, jouer
   au même instant, perdre le réseau, poser son téléphone pendant que l'autre continue, relancer
   pendant que l'autre regarde encore), plus des valeurs hostiles injectées depuis un téléphone et
   observées sur l'autre. Un check en échec décrit un défaut du jeu (ou, pour le retour par le lien
   d'invitation, du socle tel que le jeu s'en sert).

   Usage : EN_PW=… node dev/e2e/dessin-extra.test.js [filtre]
   Le filtre ne garde que les scénarios dont le nom le contient (pratique pour en rejouer un seul) ;
   sans filtre, comptez cinq minutes.
   EN_NET=1 laisse passer les polices du site : les mesures de largeur se font alors avec elles. */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const START = '[data-act="start"]', DONE = '[data-act="done"]', NEXT = '[data-act="next"]', SHEET = ".dessin-sheet", PAIR = ".dessin-pair";
const HOME = '.g-top a[href="#accueil"]', RESUME = '.banner a[href="#jeu-dessin"]', STOP = '.g-foot [data-act="g-stop"]';
const again = (cat) => '[data-act="again"][data-v="' + cat + '"]';
/* Un écran qui vient d'apparaître ne répond pas tout de suite (voir le jeu) : une seconde pour « Sujet suivant »,
   « Enregistrer l'image », « à moi » après le passage du téléphone et une feuille rendue blanche, une petite
   demi-seconde ailleurs. On attend, comme une personne. */
const PAUSE = 450, LONG = 1100;
const LINE = [[0.2, 0.25], [0.8, 0.35]], BAR = [[0.25, 0.7], [0.75, 0.6]];

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}

/* Contenu imposé pour un scénario : servi à la place de jeux/dessin.data.js, sans toucher au fichier. */
const dataFile = (prompts) => "(window.GAME_DATA = window.GAME_DATA || {}).dessin = " + JSON.stringify({ prompts }) + ";";
/* n sujets par catégorie ; les portraits contiennent le prénom de l'autre. */
const deck = (n) => dataFile(["portrait", "souvenir", "futur", "delire"].reduce((all, c) => all.concat(Array.from({ length: n }, (_, i) =>
  ({ c, x: c === "portrait" ? (i % 2 ? "La grimace préférée {de_o} n° " + i : "{o} au réveil n° " + i) : "Sujet d'essai " + c + " n° " + i }))), []));
/* Sujets de secours : ils ne servent que si jeux/dessin.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const prompts = [];
  ["portrait", "souvenir", "futur", "delire"].forEach((c) => {
    for (let i = 0; i < 6; i++) prompts.push({ c, x: c === "portrait" ? (i % 2 ? "La grimace préférée {de_o}, version " + i : "{o} au réveil, version " + i) : "Sujet d'essai " + c + " " + i });
  });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.dessin = { prompts };
}
/* Les sujets les plus longs du vrai fichier, un par catégorie, prénom de vingt lettres compris : c'est avec eux
   que la mise en page est la plus à l'étroit. Sans le fichier, des sujets d'essai de la même longueur. */
function longest() {
  let list = null;
  try {
    const w = {};
    new Function("window", fs.readFileSync(path.join(ROOT, "jeux", "dessin.data.js"), "utf8"))(w);
    list = w.GAME_DATA.dessin.prompts.filter((p) => p && typeof p.x === "string" && p.x);
  } catch (e) { list = null; }
  const size = (p) => p.x.replace(/\{de_o\}/g, "de " + "W".repeat(20)).replace(/\{o\}/g, "W".repeat(20)).length;
  const cats = ["portrait", "souvenir", "futur", "delire"];
  if (!list || !cats.every((c) => list.some((p) => p.c === c))) return cats.map((c) => ({ c, x: (c === "portrait" ? "{o} à la chasse au moustique, en pleine nuit" : "Le plus petit endroit où vous avez tenu à deux") }));
  return cats.map((c) => list.filter((p) => p.c === c).sort((x, y) => size(y) - size(x))[0]);
}

/* o.data : contenu imposé ; o.init : script lancé avant ceux de la page ; le reste va à lib.phone. */
async function phone(env, name, o) {
  o = o || {};
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  if (o.init) await p.ctx.addInitScript(o.init);
  if (o.data) await p.ctx.route(/\/jeux\/dessin\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: o.data }));
  return p;
}

const count = (p, s) => p.page.locator(s).count();
const text = (p, s) => p.page.locator(s).first().textContent();
const title = (p) => text(p, ".dessin .g-title");
const subject = (p) => text(p, ".dessin-subject");
const tip = (p) => text(p, ".dessin > .hint");
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:dessin")));
/* La tranche d'un joueur telle que le jeu la voit : celle d'une pile précédente ne compte plus. */
const slice = (s, w) => (s.S[w].k === s.gen + ":" + s.setup.seed ? s.S[w].d : {});
const gallery = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:dessin:galerie") || "[]"));
const posts = async (env) => (await env.ctl()).count.post;
const linked = (p) => until(() => count(p, '.g-top [data-net="ok"]'), 8000);
/* L'écran affiché, par son nom : pret-0-a, dessin-0-a, passe-0, attente-0, revelation-0, fin, vide
   (ou hors-jeu si on n'est plus dans la partie, panne si le jeu n'a rien pu afficher). */
const kind = (p) => p.page.evaluate(() => {
  const el = document.querySelector("main.game [data-screen]");
  return el ? el.getAttribute("data-screen") : document.querySelector("main.game") ? "panne" : "hors-jeu";
});
const is = (p, k, ms) => until(async () => (await kind(p)) === k, ms);
/* L'écran de jeu est debout : pas de panne, aucune balise injectée, aucun script exécuté, aucune erreur. */
const healthy = async (p) => !p.errors.length && await p.page.evaluate(() => !!document.querySelector("main.game .dessin") && !document.querySelector("#app img, #app script, #app iframe") && window.__xss === undefined);
/* Ce qui fait défiler la page de côté : renvoie une description, ou "" si rien ne dépasse. */
const overflow = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  document.querySelectorAll("#app *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > w + 1) out.push("." + String(el.className.baseVal == null ? el.className : "svg").split(" ")[0] + " jusqu'à " + Math.round(r.right) + " px");
  });
  return document.documentElement.scrollWidth > w + 1 ? "page de " + document.documentElement.scrollWidth + " px pour " + w + (out.length ? " (" + out[0] + ")" : "") : "";
});
/* Boutons et liens du jeu dont la zone tactile fait moins de 44 px de large ou de haut. */
const small = (p) => p.page.evaluate(() => Array.from(document.querySelectorAll("main.game .dessin button, main.game .dessin a, main.game .dessin summary"))
  .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; })
  .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)).map((x) => "« " + x.t + " » : " + x.w + " × " + x.h + " px").join(", "));
/* Espaces ordinaires là où le français veut une insécable : avant ? ! : ; » et après «. */
const typo = (p, sel) => p.page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => (el.textContent.match(/\S+ [?!:;»]|« \S+/g) || []).join(" | ")).filter(Boolean).join(" | "), sel || "main.game");
/* Sur l'écran de dessin, sans défiler : les outils qu'on ne peut pas toucher (leur centre est sous la barre
   « J'ai fini » ou hors de l'écran), et ce qui n'est pas visible en entier. */
const covered = (p, low) => p.page.evaluate((low) => {
  const hid = Array.from(document.querySelectorAll(".dessin-tools button")).filter((el) => {
    const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !top || !el.contains(top);
  }).map((el) => (el.getAttribute("aria-label") || el.textContent).trim());
  const bar = document.querySelector('[data-act="done"]').getBoundingClientRect(), sheet = document.querySelector(".dessin-sheet").getBoundingClientRect(), out = [];
  if (hid.length) out.push("outils cachés : " + hid.join(", "));
  /* low : écran trop bas pour tout montrer, « J'ai fini » a le droit d'être plus bas dans la page. */
  if (!low && bar.bottom > window.innerHeight + 1) out.push("« J'ai fini » sort de l'écran");
  const under = sheet.left < bar.right - 1 && sheet.right > bar.left + 1 && sheet.bottom > bar.top + 1 && sheet.top < bar.bottom - 1;
  if (sheet.top < 0 || sheet.bottom > window.innerHeight + 1 || under) out.push("la feuille (" + Math.round(sheet.width) + " px) n'est pas visible en entier");
  return out.join(" ; ");
}, !!low);

/* Trace un trait à la souris. Les points sont des fractions de la feuille ; held laisse le « doigt » posé. */
async function stroke(p, pts, held, steps) {
  const b = await p.page.locator(SHEET).boundingBox(), at = (q) => [b.x + q[0] * b.width, b.y + q[1] * b.height];
  await p.page.mouse.move(...at(pts[0]));
  await p.page.mouse.down();
  for (const q of pts.slice(1)) await p.page.mouse.move(...at(q), { steps: steps || 4 });
  if (!held) await p.page.mouse.up();
}
/* Les mêmes gestes avec de vrais doigts (événements tactiles). lists : un tracé par doigt, tous de même longueur. */
async function fingers(p, lists, box) {
  const b = box || await p.page.locator(SHEET).boundingBox(), cdp = await p.ctx.newCDPSession(p.page);
  const touch = (type, i) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: i == null ? [] : lists.map((pts, id) => ({ id, x: Math.round(b.x + pts[i][0] * b.width), y: Math.round(b.y + pts[i][1] * b.height) })) });
  await touch("touchStart", 0);
  for (let i = 1; i < lists[0].length; i++) await touch("touchMove", i);
  await touch("touchEnd");
  await cdp.detach();
}
const ring = (cx, cy, r) => Array.from({ length: 25 }, (_, i) => [cx + r * Math.cos(i / 4), cy + r * Math.sin(i / 4)]);
/* Un trait tremblé, comme celui d'un vrai doigt : une courbe dont chaque point est décalé d'un rien. */
const shaky = (k, n) => Array.from({ length: n }, (_, i) => [0.12 + 0.76 * (((k * 0.37) % 1) * 0.6 + 0.4 * i / n), 0.15 + 0.7 * ((k * 0.61) % 1) + 0.07 * Math.sin(i / 3 + k) + 0.004 * (((i * 7919 + k * 31) % 5) - 2)]);
/* Un trait de n points tel que le jeu le range, pour fabriquer un dessin démesuré. */
function scribble(n, k) {
  let x = 60 + (k * 37) % 390, y = 60 + (k * 91) % 390, out = "A" + ABC[x >> 3] + ABC[(x & 7) << 3 | y >> 6] + ABC[y & 63];
  for (let i = 1; i < n; i++) {
    const nx = Math.max(0, Math.min(511, x + ((k * (i + 3) * 7919) % 41) - 20)), ny = Math.max(0, Math.min(511, y + ((k * (i + 5) * 104729) % 41) - 20));
    if (nx === x && ny === y) continue;
    out += ABC[nx - x + 32] + ABC[ny - y + 32];
    x = nx;
    y = ny;
  }
  return out;
}
const pixels = (p) => p.page.evaluate(() => document.querySelector(".dessin-sheet").toDataURL());
const blank = (p) => p.page.evaluate(() => {
  const c = document.querySelector(".dessin-sheet"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  return d.every((v) => v === 255);
});
const seconds = async (p) => { const m = /(\d+):(\d+)/.exec(await text(p, ".dessin-time")); return m[1] * 60 + Number(m[2]); };
const paths = (p, w) => count(p, ".dessin-fig.as-" + w + " .dessin-art path");
/* Les points d'un trait tel que le jeu le range (voir l'en-tête de jeux/dessin.js), dans la grille de 512. */
function points(s) {
  const v = s.split("").map((ch) => ABC.indexOf(ch)), pt = (i) => [v[i] << 3 | v[i + 1] >> 3, (v[i + 1] & 7) << 6 | v[i + 2]];
  let [x, y] = pt(1);
  const out = [[x, y]];
  for (let i = 4; i + 1 < v.length;) {
    if (v[i]) { x += v[i] - 32; y += v[i + 1] - 32; i += 2; } else { [x, y] = pt(i + 1); i += 4; }
    out.push([x, y]);
  }
  return out;
}
const near = (pt, fx, fy, tol) => Math.abs(pt[0] - fx * 511) <= (tol || 4) && Math.abs(pt[1] - fy * 511) <= (tol || 4);

/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent
   sur ce qui s'affiche à cet endroit après le premier. */
async function rapid(p, selector, n) {
  const box = await p.page.locator(selector).first().boundingBox();
  for (let i = 0; i < n; i++) {
    await p.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
  }
}
/* o : prénoms (a, b), chrono ("60", "30", "0" ; sans chrono par défaut, pour ne pas dépendre de la vitesse de l'essai) et sujets. */
async function intro(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-dessin");
  await p.page.fill("#name-a", o.a != null ? o.a : "Alex");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  await p.page.click('[data-act="g-opt"][data-val="' + (o.chrono || "0") + '"]');
  if (o.sujets) await p.page.click('[data-act="g-opt"][data-val="' + o.sujets + '"]');
}
async function solo(p, env, o) {
  await intro(p, env, o);
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector("main.game");
}
async function join(p, link) {
  await p.page.goto(link);
  await p.page.click('[data-act="g-join"]');
  await p.page.waitForSelector("main.game");
}
/* Deux téléphones dans la même partie, tous deux devant le départ du premier sujet.
   o : prénoms, chrono et sujets (voir intro), o.phone : options des deux téléphones, o.guest : celles de l'invité. */
async function duo(env, tag, o) {
  o = o || {};
  const a = await phone(env, "a-" + tag, o.phone), b = await phone(env, "b-" + tag, o.guest || o.phone);
  await intro(a, env, o);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await join(b, link);
  await Promise.all([a.page.waitForSelector(START), b.page.waitForSelector(START)]);
  return { a, b, link };
}
/* « Voir le sujet » (ou « à moi » après le passage du téléphone), puis la feuille prête à recevoir un trait. */
async function begin(p) {
  await p.page.waitForSelector(START);
  await sleep(await count(p, ".g-pass") ? LONG : PAUSE);
  await p.page.click(START);
  await p.page.waitForSelector(SHEET);
  await sleep(PAUSE);
}
/* Un joueur dessine un trait et rend sa feuille. */
async function sheet(p, pts) {
  await begin(p);
  await stroke(p, pts || LINE);
  await p.page.click(DONE);
}
async function next(p) {
  await sleep(LONG);
  await p.page.click(NEXT);
}
/* Un téléphone : un sujet complet, jusqu'à la révélation. */
async function soloRound(p) {
  await sheet(p, LINE);
  await sheet(p, BAR);
  await p.page.waitForSelector(PAIR);
}
/* Deux téléphones : un sujet complet, les deux dessinant en même temps. */
async function duoRound(a, b) {
  await Promise.all([begin(a), begin(b)]);
  await stroke(a, LINE);
  await stroke(b, BAR);
  await Promise.all([a.page.click(DONE), b.page.click(DONE)]);
  if (!await until(async () => await count(a, PAIR) && await count(b, PAIR), 10000)) throw new Error("la révélation ne s'est pas ouverte des deux côtés");
}
/* Les deux quittent la révélation, A le premier, et se retrouvent au départ du sujet suivant. */
async function advance(a, b) {
  await sleep(LONG);
  await a.page.click(NEXT);
  await b.page.click(NEXT);
  await Promise.all([a.page.waitForSelector(START), b.page.waitForSelector(START)]);
}
/* Récrit la partie enregistrée puis recharge la page : pour vieillir le chrono ou sauter à un sujet. */
async function rewrite(p, change, arg) {
  await p.page.evaluate(({ code, arg }) => {
    const s = JSON.parse(localStorage.getItem("en:g:dessin"));
    (0, eval)("(" + code + ")")(s, arg);
    localStorage.setItem("en:g:dessin", JSON.stringify(s));
  }, { code: change.toString(), arg });
  await p.page.reload();
}
/* Le pirate modifie sa partie enregistrée puis recharge : le socle redépose alors cet état sur le relais. */
async function inject(p, x) {
  await p.page.evaluate((x) => {
    const s = JSON.parse(localStorage.getItem("en:g:dessin")), now = Date.now();
    if (x.h) { Object.assign(s, x.h); s.st = (s.st || 0) + 1; s.sw = s.me; s.seq[s.me].h = now; }
    if ("d" in x) { s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d: x.d }; s.seq[s.me].d = now; }
    localStorage.setItem("en:g:dessin", JSON.stringify(s));
  }, x);
  await p.page.reload();
}
/* Un bouton forgé dans la page, puis cliqué : ce que ferait quelqu'un qui appelle le jeu à la main. */
const forge = (p, act, v) => p.page.evaluate(([act, v]) => {
  const x = document.createElement("button");
  x.setAttribute("data-act", act);
  if (v != null) x.setAttribute("data-v", v);
  document.querySelector("main.game .dessin").appendChild(x);
  x.click();
  x.remove();
}, [act, v]);
const token = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/* Le PNG que donne « Enregistrer l'image » (ou une vignette de la galerie). */
async function image(p, selector) {
  if (!selector) await sleep(LONG);
  const [file] = await Promise.all([p.page.waitForEvent("download"), p.page.locator(selector || '[data-act="image"]').first().click()]);
  return fs.readFileSync(await file.path());
}
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
const focused = (p, s) => p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), s);
const ringed = (p) => p.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });
async function tabTo(p, selector, max) {
  for (let i = 1; i <= (max || 30); i++) {
    await p.page.keyboard.press("Tab");
    if (await focused(p, selector)) return i;
  }
  return -1;
}

const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push({ name, fn });

/* ====================================================================== Un seul téléphone */

scenario("Un téléphone : la feuille du premier reste secrète, à chaque étape", async (env) => {
  const p = await phone(env, "secret");
  await solo(p, env, { sujets: "portrait" });
  await begin(p);
  await stroke(p, ring(0.5, 0.45, 0.3));
  await stroke(p, [[0.2, 0.85], [0.8, 0.85]]);
  const mine = await pixels(p), topic = await subject(p);
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await p.page.click(RESUME);
  await p.page.waitForSelector(SHEET);
  check(await pixels(p) === mine && await subject(p) === topic, "Alex quitte vers l'accueil en plein dessin puis reprend : même sujet, feuille intacte");
  await p.page.goBack();
  await p.page.waitForSelector(".banner");
  await p.page.goForward();
  await p.page.waitForSelector(SHEET);
  check(await pixels(p) === mine, "bouton retour du navigateur puis avance : feuille intacte");
  await p.page.click(DONE);
  const hidden = async () => await count(p, "#app .dessin-art, #app canvas") === 0;
  check(await is(p, "passe-0") && await hidden(), "après « J'ai fini », la feuille d'Alex n'est plus nulle part à l'écran");
  await p.page.reload();
  await p.page.waitForSelector(".g-pass");
  check(await hidden(), "après rechargement, toujours rien");
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  check(await hidden(), "à l'accueil, la partie en cours ne montre pas la feuille");
  await p.page.click(RESUME);
  check(await is(p, "passe-0") && await hidden(), "« Reprendre » depuis l'accueil : on retrouve le passage du téléphone, feuille cachée");
  await begin(p);
  check(await count(p, ".dessin.as-b") === 1 && await blank(p) && await count(p, ".dessin-art") === 0 && (await subject(p)).replace(/Alex/g, "#") === topic.replace(/Inès/g, "#"), "Inès prend l'appareil : même sujet, feuille vierge");
  await stroke(p, LINE);
  const hers = await pixels(p);
  await p.page.reload();
  await p.page.waitForSelector(SHEET);
  check(await pixels(p) === hers && await count(p, ".dessin-art") === 0, "Inès recharge en plein dessin : sa feuille seule, intacte");
  await sleep(PAUSE);
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await p.page.click(RESUME);
  await p.page.waitForSelector(SHEET);
  check(await count(p, ".dessin.as-b") === 1 && await pixels(p) === hers, "Inès quitte vers l'accueil et reprend : c'est toujours son tour, sa feuille intacte");
  await p.page.click('[data-act="undo"]');
  check(await blank(p), "« Annuler » jusqu'au bout chez Inès : la feuille redevient blanche, rien du dessin d'Alex n'apparaît dessous");
  await stroke(p, BAR);
  await p.page.click(DONE);
  check(await is(p, "revelation-0") && await paths(p, "a") === 2 && await paths(p, "b") === 1, "à la révélation seulement, les deux feuilles s'affichent, chacune du côté de son auteur");
});

scenario("Un téléphone : touchers répétés sur chaque bouton", async (env) => {
  const p = await phone(env, "rafale-voir");
  await solo(p, env);
  await p.page.waitForSelector(START);
  await sleep(PAUSE);
  await rapid(p, START, 3);
  await sleep(400);
  let s = await saved(p), k = await kind(p);
  check(k === "dessin-0-a" && s.S.a.d.r === undefined, "trois touchers sur « Voir le sujet » : le sujet s'affiche et la feuille reste à dessiner (écran : " + k + ", feuille " + (s.S.a.d.r === undefined ? "non rendue" : "rendue, blanche") + ")");

  const q = await phone(env, "rafale", { data: deck(2) });
  await solo(q, env, { sujets: "delire" });
  await begin(q);
  await stroke(q, LINE);
  await rapid(q, DONE, 3);
  await sleep(400);
  s = await saved(q);
  check(await kind(q) === "passe-0" && s.S.a.d.r === 0 && !s.local.cur && s.S.b.d.r === undefined, "trois touchers sur « J'ai fini » : la feuille part une fois, et le tour de l'autre n'est pas lancé à sa place");
  await sleep(PAUSE);
  await rapid(q, START, 3);
  await sleep(500);
  s = await saved(q);
  check(await kind(q) === "dessin-0-b" && !!s.local.cur && s.local.cur.s.length === 0 && s.S.b.d.r === undefined, "trois touchers sur « Je suis Inès, à moi » : sa feuille s'ouvre, vierge, et n'est pas rendue");
  if (await kind(q) === "dessin-0-b") { await stroke(q, BAR); await q.page.click(DONE); }
  await is(q, "revelation-0");
  await sleep(LONG);
  await rapid(q, NEXT, 3);
  await sleep(500);
  s = await saved(q);
  check(await kind(q) === "pret-1-a" && s.sh.r === 1 && !s.local.cur, "trois touchers sur « Sujet suivant » : un seul sujet d'avance, et le chrono du suivant n'est pas lancé");
  await begin(q);
  for (let i = 0; i < 5; i++) await stroke(q, [[0.2, 0.15 + 0.15 * i], [0.8, 0.2 + 0.15 * i]]);
  await rapid(q, '[data-act="undo"]', 3);
  await rapid(q, '[data-act="ink"][data-v="3"]', 3);
  s = await saved(q);
  check(s.local.cur.s.length === 2 && s.local.cur.c === 3 && await q.page.getAttribute('[data-act="ink"][data-v="3"]', "aria-pressed") === "true" && await count(q, '[data-act="ink"][aria-pressed="true"]') === 1,
    "trois touchers sur « Annuler » retirent trois traits ; trois touchers sur une encre la choisissent, une seule est cochée");
  await q.page.click(DONE);
  await sheet(q, BAR);
  await is(q, "revelation-1");
  await sleep(LONG);
  await rapid(q, NEXT, 3);
  await sleep(400);
  s = await saved(q);
  check(await kind(q) === "fin" && s.gen === 1, "trois touchers sur « Terminer » : l'écran de fin s'affiche, aucune pile n'est relancée");
  await rapid(q, again("delire"), 3);
  await sleep(500);
  s = await saved(q);
  check(!!s && s.gen === 2 && await kind(q) === "pret-0-a" && !s.local.cur && await count(q, "[data-armed]") === 0, "trois touchers sur « Rejouer avec » : une seule nouvelle pile, toujours en cours, chrono non lancé");

  /* Arrêter puis relancer : le nouveau « Sujet 1 » porte le même nom que l'ancien, mais c'est un nouvel écran. */
  const z = await phone(env, "rafale-relance");
  await solo(z, env);
  await z.page.waitForSelector(START);
  await z.page.click(STOP);
  await z.page.click(STOP);
  await z.page.waitForSelector("main.intro");
  await z.page.click('[data-act="g-start"][data-mode="solo"]');
  await z.page.waitForSelector(START);
  await z.page.click(START);
  await sleep(300);
  check(await kind(z) === "pret-0-a" && !(await saved(z)).local.cur, "partie arrêtée puis relancée : un toucher aussitôt sur « Voir le sujet » ne lance pas le chrono (écran : " + await kind(z) + ")");

  /* On efface, on recommence un trait, on efface de nouveau deux secondes plus tard. */
  const c = await phone(env, "rafale-effacer");
  await solo(c, env);
  await begin(c);
  await stroke(c, LINE);
  const t0 = Date.now(), CLEAR = '[data-act="clear"]';
  await c.page.click(CLEAR);
  const armed = await text(c, CLEAR);
  await c.page.click(CLEAR);
  check(armed.includes("Tout effacer\u00a0?") && (await saved(c)).local.cur.s.length === 0, "« Effacer » puis sa confirmation effacent la feuille");
  await stroke(c, BAR);
  await sleep(Math.max(0, 2300 - (Date.now() - t0)));
  await c.page.click(CLEAR);
  await sleep(Math.max(0, 3400 - (Date.now() - t0)));
  const label = (await text(c, CLEAR)).trim();
  await c.page.click(CLEAR);
  const left = (await saved(c)).local.cur.s.length;
  check(left === 0, "un trait, puis « Effacer » de nouveau deux secondes après, confirmé une seconde plus tard : la feuille est effacée (traits restants : " + left + " ; une seconde après le toucher, le bouton disait déjà « " + label + " »)");
});

scenario("Un téléphone : toute la partie au clavier", async (env) => {
  const p = await phone(env, "clavier", { viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1, data: deck(1) });
  await p.page.goto(env.base + "#jeu-dessin");
  const picked = await tabTo(p, '[data-act="g-opt"][data-val="0"]') > 0;
  await p.page.keyboard.press("Enter");
  await tabTo(p, '[data-act="g-opt"][data-val="delire"]');
  await p.page.keyboard.press("Enter");
  await tabTo(p, "#name-a");
  await p.page.keyboard.type("Alex");
  await p.page.keyboard.press("Tab");
  await p.page.keyboard.type("Inès");
  await tabTo(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.keyboard.press("Enter");
  const s0 = await saved(p);
  check(picked && await is(p, "pret-0-a") && s0.setup.chrono === "0" && s0.setup.sujets === "delire", "au clavier : choisir le temps et les sujets, saisir les prénoms, lancer la partie");
  let halo = true, tabs = 0;
  check(await focused(p, ".dessin .g-title"), "à l'ouverture d'un écran, le focus est sur son titre");
  await sleep(PAUSE);
  tabs = await tabTo(p, START, 4);
  halo = halo && await ringed(p);
  await p.page.keyboard.press("Enter");
  check(tabs === 1 && await is(p, "dessin-0-a") && await focused(p, ".dessin-subject"), "« Voir le sujet » s'atteint en une tabulation ; le sujet s'affiche et reçoit le focus");
  await tabTo(p, '[data-act="ink"][data-v="2"]', 6);
  halo = halo && await ringed(p);
  await p.page.keyboard.press("Space");
  await tabTo(p, '[data-act="size"][data-v="1"]', 8);
  halo = halo && await ringed(p);
  await p.page.keyboard.press("Enter");
  let s = await saved(p);
  check(s.local.cur.c === 2 && s.local.cur.z === 1 && await focused(p, '[data-act="size"][data-v="1"]') && await p.page.getAttribute('[data-act="ink"][data-v="2"]', "aria-pressed") === "true",
    "encre et épaisseur se choisissent au clavier, sans faire perdre le focus");
  await sleep(PAUSE);
  await stroke(p, LINE);
  await stroke(p, BAR);
  await tabTo(p, '[data-act="undo"]', 14);
  await p.page.keyboard.press("Enter");
  s = await saved(p);
  check(s.local.cur.s.length === 1 && s.local.cur.s[0][0] === ABC[2 * 2 + 1] && await focused(p, '[data-act="undo"]'), "« Annuler » au clavier retire le dernier trait, tracé à l'encre choisie, et garde le focus");
  await tabTo(p, '[data-act="clear"]', 2);
  await p.page.keyboard.press("Enter");
  await p.page.keyboard.press("Enter");
  check((await saved(p)).local.cur.s.length === 0 && await focused(p, '[data-act="clear"]'), "« Effacer » puis sa confirmation, au clavier");
  await tabTo(p, DONE, 2);
  halo = halo && await ringed(p);
  await sleep(PAUSE);
  await p.page.keyboard.press("Enter");
  check(await kind(p) === "dessin-0-a" && await focused(p, DONE) && (await text(p, DONE)).includes("feuille blanche\u00a0?"), "« J'ai fini » sur une feuille blanche demande confirmation, focus gardé");
  await p.page.keyboard.press("Enter");
  check(await is(p, "passe-0") && await focused(p, ".g-pass h1"), "la confirmation rend la feuille : passage du téléphone, focus sur son titre");
  await sleep(LONG);
  tabs = await tabTo(p, START, 4);
  halo = halo && await ringed(p);
  await p.page.keyboard.press("Enter");
  await is(p, "dessin-0-b");
  await sleep(LONG);
  await tabTo(p, DONE, 14);
  await p.page.keyboard.press("Enter");
  await p.page.keyboard.press("Enter");
  check(tabs === 1 && await is(p, "revelation-0") && await focused(p, ".dessin .g-title"), "le second joueur joue de même ; la révélation s'ouvre, focus sur le sujet");
  await sleep(LONG);
  tabs = await tabTo(p, NEXT, 4);
  halo = halo && await ringed(p);
  await p.page.keyboard.press("Enter");
  check(tabs > 0 && tabs <= 2 && await is(p, "fin"), "« Terminer » s'atteint en deux tabulations au plus");
  check(halo, "chaque bouton atteint au clavier porte un contour de focus visible");
  const reached = await tabTo(p, again("delire"), 8);
  await p.page.keyboard.press("Enter");
  check(reached > 0 && await is(p, "pret-0-a") && (await saved(p)).gen === 2 && await focused(p, ".dessin .g-title"), "« Rejouer avec » au clavier : nouvelle pile, focus sur le titre");
});

scenario("Un téléphone : prénoms extrêmes, petit et grand écran", async (env) => {
  const A = "D'Art<img src=x>&\"é\"", B = "W".repeat(20), LONGEST = dataFile(longest());
  const p = await phone(env, "petit", { viewport: { width: 320, height: 568 }, data: LONGEST });
  await solo(p, env, { a: A, b: B, chrono: "60" });
  const wide = [], tiny = [], spaces = [];
  const look = async (q, label) => {
    const o = await overflow(q), t = await small(q), y = await typo(q);
    if (o) wide.push(label + " : " + o);
    if (t && tiny.indexOf(t) < 0) tiny.push(t);
    if (y) spaces.push(label + " : " + y);
  };
  let side = true;
  for (let r = 0; r < 4; r++) {
    await p.page.waitForSelector(START);
    await look(p, "départ");
    if (!r) check((await text(p, ".dessin-who")).includes(A) && await healthy(p), "un prénom avec apostrophe, balise et guillemets s'affiche tel quel");
    await begin(p);
    const topic = await subject(p);
    await look(p, "dessin, « " + topic + " »");
    if (!r) await p.shot("dessin-extra-320-dessin");
    await stroke(p, ring(0.5, 0.5, 0.3));
    await p.page.click(DONE);
    await p.page.waitForSelector(".g-pass");
    await look(p, "passage du téléphone");
    await begin(p);
    await look(p, "dessin du second, « " + await subject(p) + " »");
    await stroke(p, LINE);
    await p.page.click(DONE);
    await p.page.waitForSelector(PAIR);
    await look(p, "révélation");
    side = side && await p.page.evaluate(() => {
      const [x, y] = Array.from(document.querySelectorAll(".dessin-fig .dessin-art")).map((el) => el.getBoundingClientRect());
      return x.right < y.left && Math.abs(x.top - y.top) < 1 && x.width >= 120 && Math.abs(x.width - x.height) < 1 && Math.abs(x.width - y.width) < 1;
    });
    if (!r) { check(await healthy(p), "à la révélation, les prénoms sont toujours du texte"); await p.shot("dessin-extra-320-revelation"); }
    await next(p);
  }
  await p.page.waitForSelector('[data-act="again"]');
  await look(p, "fin de pile");
  check(side, "320 px : à la révélation, les deux feuilles sont côte à côte, carrées, de même taille et alignées");
  check(!wide.length, "320 px, prénom de 20 lettres sans espace, sujets les plus longs : rien ne dépasse en largeur" + (wide.length ? " (" + wide.length + " écrans : " + wide.join(" | ") + ")" : ""));
  check(!tiny.length, "320 px : toutes les zones tactiles du jeu font au moins 44 px" + (tiny.length ? " (" + tiny.join(" ; ") + ")" : ""));
  check(!spaces.length, "espace insécable devant ? ! : ; sur tous les écrans du jeu" + (spaces.length ? " (espaces ordinaires : " + spaces.join(" ; ") + ")" : ""));
  await p.page.click(STOP);
  await p.page.click(STOP);
  await p.page.waitForSelector(".dessin-gal");
  await p.page.click(".dessin-gal summary");
  /* Les textes du jeu sur sa présentation : accroche, paragraphes, galerie (le reste appartient au socle). */
  const o = await overflow(p), y = await typo(p, "main.intro > h1, main.intro > p:not(.hint), [data-extra]");
  check(!o && await count(p, ".dessin-thumb") === 4 && await p.page.evaluate(() => !document.querySelector("#app img") && window.__xss === undefined), "320 px : la présentation, galerie ouverte, ne dépasse pas non plus" + (o ? " (" + o + ")" : ""));
  check(!y, "espace insécable devant ? ! : ; sur la présentation et dans la galerie" + (y ? " (espaces ordinaires : " + y + ")" : ""));
  await p.shot("dessin-extra-320-galerie");

  /* La hauteur utile de petits iPhone dans Safari, barres comprises. */
  for (const [w, h, b] of [[375, 548], [320, 568], [320, 568, "Jean-Baptiste"], [320, 454], [844, 390], [1280, 800, "Jean-Baptiste"]]) {
    const s = await phone(env, "court-" + w + "x" + h + (b ? "-long" : ""), { viewport: { width: w, height: h }, data: LONGEST });
    await solo(s, env, { chrono: "60", sujets: "portrait", b });
    await begin(s);
    /* Sous 540 px de haut en portrait, tout ne tient pas : la feuille et les outils d'abord, « J'ai fini » juste en dessous. */
    const low = h < 540 && w < h, c = await covered(s, low);
    await s.shot("dessin-extra-" + w + "x" + h + (b ? "-long" : "") + "-dessin");
    check(!c, w + " × " + h + ", " + (b ? "« " + b + " »" : "prénoms courts") + ", « " + await subject(s) + " » : la feuille est entière et chaque outil peut être touché sans défiler" + (c ? " (" + c + ")" : ""));
    if (low) {
      await s.page.evaluate(() => window.scrollTo(0, 9999));
      const reach = await s.page.evaluate(() => { const r = document.querySelector('[data-act="done"]').getBoundingClientRect(), t = document.querySelector(".dessin-tools").getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top >= t.bottom - 1; });
      check(reach, w + " × " + h + " : « J'ai fini » est juste sous les outils, sans les recouvrir, à un défilement de là");
    }
  }
  /* 320 px : le bouton « Effacer » armé ne bouge pas, et son second toucher tombe au même endroit. */
  const e = await phone(env, "court-effacer", { viewport: { width: 320, height: 568 }, data: LONGEST });
  await solo(e, env, { sujets: "portrait" });
  await begin(e);
  await stroke(e, LINE);
  await stroke(e, BAR);
  const spot = async () => JSON.stringify(await Promise.all(['[data-act="undo"]', '[data-act="clear"]'].map((q) => e.page.locator(q).boundingBox())));
  const rest = await spot(), at = await e.page.locator('[data-act="clear"]').boundingBox();
  await e.page.touchscreen.tap(at.x + at.width / 2, at.y + at.height / 2);
  const same = await spot() === rest && (await text(e, '[data-act="clear"]')).includes("Tout effacer");
  await e.page.touchscreen.tap(at.x + at.width / 2, at.y + at.height / 2);
  const kept = (await saved(e)).local.cur.s.length;
  check(same && kept === 0, "320 px : « Effacer » armé garde sa place, « Annuler » aussi, et deux touchers au même endroit effacent la feuille (traits restants : " + kept + ")");

  const q = await phone(env, "sans-prenom", { data: deck(2) });
  await solo(q, env, { a: "", b: "   ", sujets: "portrait" });
  await q.page.waitForSelector(START);
  const who = await text(q, ".dessin-who"), hint = await tip(q);
  await begin(q);
  const topic = await subject(q);
  check(who.includes("Partenaire 1") && hint.includes("Partenaire 2") && /Partenaire 2/.test(topic) && !/\{|undefined/.test(topic), "sans prénom : « Partenaire 1 » dessine « " + topic + " »");
  await sleep(LONG);
  await q.page.click(DONE);
  await q.page.click(DONE);
  await sheet(q, LINE);
  await q.page.waitForSelector(PAIR);
  check((await text(q, ".dessin-fig.as-a figcaption")).includes("Partenaire 1") && (await text(q, ".dessin-fig.as-b figcaption")).includes("Partenaire 2") && await paths(q, "a") === 0, "et la révélation nomme « Partenaire 1 » et « Partenaire 2 », feuille blanche comprise");

  const g = await phone(env, "grand", { viewport: { width: 1440, height: 900 }, mobile: false, touch: false, scale: 1, data: LONGEST });
  await solo(g, env, { a: A, chrono: "60" });
  const out = [];
  const see = async (label) => {
    const v = await overflow(g), w = await g.page.evaluate(() => document.querySelector("main.game").getBoundingClientRect().width);
    if (v || w > 46 * 16 + 1) out.push(label + " : " + (v || "colonne de " + Math.round(w) + " px"));
  };
  await see("départ");
  await begin(g);
  await see("dessin");
  const c = await covered(g);
  check(!c, "grand écran : sujet, feuille, outils et « J'ai fini » tiennent ensemble à l'écran" + (c ? " (" + c + ")" : ""));
  await stroke(g, ring(0.5, 0.5, 0.3));
  await g.page.click(DONE);
  await see("passage");
  await sheet(g, LINE);
  await g.page.waitForSelector(PAIR);
  await see("révélation");
  await g.shot("dessin-extra-1440-revelation");
  check(!out.length && await healthy(g), "grand écran : une colonne étroite, rien ne dépasse" + (out.length ? " (" + out[0] + ")" : ""));
});

scenario("Un téléphone : le chrono", async (env) => {
  const p = await phone(env, "chrono");
  await solo(p, env, { chrono: "30" });
  await begin(p);
  const t0 = await seconds(p);
  await stroke(p, ring(0.5, 0.5, 0.25));
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await sleep(2200);
  await p.page.click(RESUME);
  await p.page.waitForSelector(SHEET);
  const t1 = await seconds(p);
  check(t0 <= 30 && t0 >= 28 && t1 <= t0 - 2 && t1 >= 20, "trente secondes au chrono ; quitter vers l'accueil ne l'arrête pas et ne le relance pas (" + t0 + " s puis " + t1 + " s)");
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await rewrite(p, (s) => { s.local.cur.t -= 31000; });
  await p.page.waitForSelector(".banner");
  await sleep(700);
  check((await saved(p)).S.a.d.r === undefined, "le temps s'écoule pendant qu'Alex est à l'accueil : rien ne part tant qu'il n'est pas revenu");
  await p.page.click(RESUME);
  check(await is(p, "passe-0", 3000) && points((await saved(p)).S.a.d.d).length > 5, "il revient après la fin du temps : sa feuille part telle quelle, et le téléphone passe à l'autre");
  await begin(p);
  await rewrite(p, (s) => { s.local.cur.t -= 26000; });
  await p.page.waitForSelector(SHEET);
  await sleep(PAUSE);
  await stroke(p, [[0.2, 0.2], [0.5, 0.6], [0.8, 0.3]], true);
  check(await is(p, "revelation-0", 6000), "le temps finit pendant qu'Inès a le doigt posé : la révélation s'ouvre");
  const s = await saved(p), mine = (s.S.b.d.d || "").split(".").filter(Boolean);
  check(mine.length === 1 && near(points(mine[0])[0], 0.2, 0.2) && points(mine[0]).length >= 3, "et le trait en cours est dans la feuille rendue");
  await p.page.mouse.up();
  await sleep(300);
  check(await kind(p) === "revelation-0" && (await saved(p)).sh.r === undefined, "le doigt se lève sur la révélation : elle reste à l'écran");

  const q = await phone(env, "sans-chrono");
  await solo(q, env, { chrono: "0" });
  await begin(q);
  await stroke(q, LINE);
  await rewrite(q, (s) => { s.local.cur.t -= 3600000; });
  await q.page.waitForSelector(SHEET);
  await sleep(1000);
  check(await kind(q) === "dessin-0-a" && await count(q, ".dessin-time, .dessin-clock") === 0 && (await saved(q)).local.cur.s.length === 1, "sans chrono, une feuille commencée il y a une heure attend toujours « J'ai fini »");
});

scenario("Un téléphone : le trait suit le doigt", async (env) => {
  const p = await phone(env, "trait");
  await solo(p, env);
  await begin(p);
  await stroke(p, [[0.1, 0.1], [0.9, 0.9]]);
  let cur = (await saved(p)).local.cur, pts = points(cur.s[0]);
  check(near(pts[0], 0.1, 0.1) && near(pts[pts.length - 1], 0.9, 0.9), "un trait à la souris commence et finit où le pointeur l'a tracé (" + pts[0].join(",") + " → " + pts[pts.length - 1].join(",") + ")");
  await fingers(p, [[[0.9, 0.1], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.1, 0.9]]]);
  cur = (await saved(p)).local.cur;
  pts = points(cur.s[1] || "AAAA");
  check(cur.s.length === 2 && near(pts[0], 0.9, 0.1) && near(pts[pts.length - 1], 0.1, 0.9), "un trait au doigt aussi");
  await stroke(p, [[0.5, 0.3], [0.5, -0.2]]);
  cur = (await saved(p)).local.cur;
  pts = points(cur.s[2] || "AAAA");
  check(cur.s.length === 3 && pts[pts.length - 1][1] === 0 && Math.abs(pts[pts.length - 1][0] - 255) <= 4, "un trait qui sort de la feuille s'arrête à son bord");
  await fingers(p, [[[0.2, 0.3], [0.3, 0.3], [0.4, 0.3]], [[0.6, 0.7], [0.7, 0.7], [0.8, 0.7]]]);
  cur = (await saved(p)).local.cur;
  check(cur.s.length === 4 && near(points(cur.s[3])[0], 0.2, 0.3), "deux doigts posés ensemble : un seul trait, celui du premier doigt");
  await fingers(p, [[[0.5, 0.15]]]);
  cur = (await saved(p)).local.cur;
  check(cur.s.length === 5 && cur.s[4].length === 4 && near(points(cur.s[4])[0], 0.5, 0.15), "un doigt posé sans bouger laisse un point");
  /* Le pouce de la main qui tient le téléphone repose sur le sujet, au-dessus de la feuille ; l'autre main dessine. */
  await fingers(p, [[[0.5, -0.12], [0.5, -0.12], [0.5, -0.12]], [[0.3, 0.55], [0.5, 0.6], [0.7, 0.55]]]);
  cur = (await saved(p)).local.cur;
  check(cur.s.length === 6 && near(points(cur.s[5])[0], 0.3, 0.55), "un pouce posé ailleurs sur l'écran n'empêche pas de dessiner");
  await p.page.click('[data-act="undo"]');
  const tools = [];
  for (let c = 0; c < 7; c++) for (let z = 0; z < 2; z++) {
    await p.page.click('[data-act="ink"][data-v="' + c + '"]');
    await p.page.click('[data-act="size"][data-v="' + z + '"]');
    await stroke(p, [[0.1 + 0.05 * c, 0.9], [0.15 + 0.05 * c, 0.95 - 0.02 * z]], false, 1);
    tools.push(ABC[2 * c + z]);
  }
  cur = (await saved(p)).local.cur;
  check(cur.s.slice(5).map((x) => x[0]).join("") === tools.join(""), "six encres et la gomme, en deux épaisseurs : chaque trait garde son outil");
  const before = cur.s.join(".");
  await p.page.setViewportSize({ width: 844, height: 390 });
  await sleep(300);
  await p.page.evaluate(() => document.querySelector(".dessin-sheet").scrollIntoView({ block: "center" }));
  await stroke(p, [[0.5, 0.5], [0.7, 0.5]]);
  cur = (await saved(p)).local.cur;
  pts = points(cur.s[cur.s.length - 1]);
  check(cur.s.slice(0, -1).join(".") === before && near(pts[0], 0.5, 0.5, 6) && near(pts[pts.length - 1], 0.7, 0.5, 6), "téléphone tourné en plein dessin : rien n'est perdu, et le trait suivant tombe toujours sous le doigt");
  await p.page.setViewportSize({ width: 390, height: 844 });
  await p.page.click(DONE);
  await sheet(p, BAR);
  await p.page.waitForSelector(PAIR);
  const shown = await p.page.evaluate(() => Array.from(document.querySelectorAll(".dessin-fig.as-a .dessin-art path")).map((el) => el.getAttribute("stroke") + "/" + el.getAttribute("stroke-width")));
  check(shown.length === 20 && shown.slice(5, 19).join() === ["#141829", "#2a78d6", "#eb6834", "#d6294a", "#1e9e5a", "#fab219", "#ffffff"].reduce((all, c, i) => all.concat(c + "/" + (i === 6 ? 22 : 6), c + "/" + (i === 6 ? 44 : 15)), []).join(),
    "à la révélation, les vingt traits sont là, chacun dans son encre et son épaisseur");

  /* Le doigt glisse sur la feuille : la page ne doit pas défiler dessous. Vérifié seulement si l'essai sait faire défiler. */
  const s = await phone(env, "glisse", { viewport: { width: 320, height: 454 } });
  await solo(s, env, { chrono: "60" });
  await begin(s);
  const view = { x: 0, y: 0, width: 320, height: 454 };
  await fingers(s, [[[0.03, 0.9], [0.03, 0.7], [0.03, 0.5], [0.03, 0.3]]], view);
  await sleep(1500);
  const moved = await s.page.evaluate(() => window.scrollY);
  if (moved > 0) {
    await s.page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await fingers(s, [[[0.5, 0.8], [0.5, 0.6], [0.5, 0.4], [0.5, 0.2]]]);
    await sleep(600);
    const y = await s.page.evaluate(() => window.scrollY), n = (await saved(s)).local.cur.s.length;
    check(y === 0 && n === 1, "petit écran : un doigt qui remonte sur la feuille trace un trait, la page ne défile pas (défilement : " + y + " px, traits : " + n + " ; dans la marge, le même geste fait défiler de " + moved + " px)");
  }
});

scenario("Un téléphone : sujets absents, pile d'un seul sujet, page intégrée, fichier local", async (env) => {
  const v = await phone(env, "vide", { data: dataFile([]) });
  await v.page.goto(env.base + "#jeu-dessin");
  await v.page.click('[data-act="g-start"][data-mode="solo"]');
  check(await is(v, "vide") && (await text(v, "main.game .dessin")).includes("Recharge la page") && await count(v, '[data-act="again"], [data-act="start"]') === 0, "sans aucun sujet, le jeu dit de recharger la page : ni départ, ni fausse fin de pile");
  await v.page.goto(env.base + "#accueil");
  check(await count(v, ".banner") === 1, "et l'accueil propose toujours de reprendre cette partie");

  const bad = await phone(env, "abime", { data: dataFile([null, 12, { c: "delire" }, { c: "delire", x: "" }, { c: "delire", x: 7 }, { x: "Le seul sujet lisible" }]) });
  await solo(bad, env, { sujets: "delire" });
  await begin(bad);
  check(await subject(bad) === "Le seul sujet lisible" && await healthy(bad), "un fichier de sujets abîmé : seul le sujet lisible est proposé, même si sa catégorie manque");
  await sleep(LONG);
  await bad.page.click(DONE);
  await bad.page.click(DONE);
  await sheet(bad, LINE);
  await bad.page.waitForSelector(PAIR);
  check((await text(bad, NEXT)).includes("Terminer"), "pile d'un seul sujet : la première révélation propose de terminer");
  await next(bad);
  await bad.page.waitForSelector('[data-act="again"]');
  await bad.page.click(again("portrait"));
  check(await is(bad, "pret-0-a") && (await saved(bad)).gen === 2, "et « Rejouer avec » relance une pile, même dans une catégorie vide");

  /* Sur deux téléphones, le fichier des sujets n'arrive pas chez l'invité. */
  const a = await phone(env, "a-vide"), b = await phone(env, "b-vide", { data: dataFile([]) });
  await intro(a, env);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  await join(b, await a.page.locator(".share[data-url]").getAttribute("data-url"));
  await begin(a);
  const topic = await subject(a);
  await stroke(a, LINE);
  await a.page.click(DONE);
  await is(a, "attente-0");
  await sleep(600);
  check(await kind(b) === "vide" && await count(b, '[data-act="again"]') === 0 && (await saved(b)).gen === 1, "à deux, celui chez qui les sujets manquent ne voit ni fin de pile ni « Rejouer » : il ne peut pas relancer la partie de l'autre");
  await b.ctx.unroute(/\/jeux\/dessin\.data\.js/);
  await b.page.reload();
  await begin(b);
  check((await subject(b)).replace(/Alex/g, "#") === topic.replace(/Inès/g, "#"), "il recharge, les sujets arrivent : il retrouve la partie, au même sujet");
  await stroke(b, BAR);
  await b.page.click(DONE);
  check(await is(a, "revelation-0") && await paths(a, "a") === 1 && await paths(a, "b") === 1, "et la révélation s'ouvre : la feuille de l'autre n'a pas été perdue");

  const f = await phone(env, "cadre");
  await f.page.setContent('<iframe src="' + env.base + '#jeu-dessin" style="width:380px;height:800px;border:0"></iframe>');
  const fr = f.page.frameLocator("iframe");
  await fr.locator('[data-act="g-opt"][data-val="0"]').click();
  await fr.locator('[data-act="g-start"][data-mode="solo"]').click();
  for (let i = 0; i < 2; i++) {
    await fr.locator(START).waitFor();
    await sleep(i ? LONG : PAUSE);
    await fr.locator(START).click();
    await fr.locator(SHEET).waitFor();
    await sleep(PAUSE);
    const box = await fr.locator(SHEET).boundingBox();
    await f.page.mouse.move(box.x + 0.2 * box.width, box.y + 0.3 * box.height);
    await f.page.mouse.down();
    await f.page.mouse.move(box.x + 0.8 * box.width, box.y + 0.6 * box.height, { steps: 4 });
    await f.page.mouse.up();
    await fr.locator(DONE).click();
  }
  check(await until(async () => await fr.locator(".dessin-fig .dessin-art path").count() === 2) && await fr.locator('[data-act="g-start"][data-mode="duo"]').count() === 0, "dans une page intégrée, un sujet se joue sur un téléphone, un trait par feuille");

  const l = await phone(env, "fichier");
  await l.page.goto(pathToFileURL(path.join(ROOT, "index.html")).href + "#jeu-dessin");
  await l.page.click('[data-act="g-opt"][data-val="0"]');
  await l.page.click('[data-act="g-start"][data-mode="solo"]');
  await soloRound(l);
  const png = await image(l);
  check(await paths(l, "a") === 1 && await count(l, ".g-net") === 0 && png.slice(1, 4).toString() === "PNG", "ouvert comme un fichier (file://), un sujet se joue sur un téléphone et l'image s'enregistre");
});

scenario("Un téléphone : la galerie", async (env) => {
  const p = await phone(env, "galerie", { data: deck(4) });
  await solo(p, env);
  await soloRound(p);
  const first = await image(p), name0 = await title(p);
  /* Seize révélations de suite : la partie enregistrée est avancée d'un sujet à la fois, chaque feuille déjà rendue. */
  const seen = [name0];
  for (let r = 1; r < 16; r++) {
    await rewrite(p, (s, r) => { const k = s.gen + ":" + s.setup.seed; s.sh = { r }; s.local = { p: r }; s.S.a = { k, d: { r, d: "AKAK" + "ii".repeat(r) } }; s.S.b = { k, d: { r, d: "DgAg" + "iY".repeat(r) } }; }, r);
    await p.page.waitForSelector(PAIR);
    seen.push(await title(p));
  }
  let g = await gallery(p);
  check(g.length === 12 && g[11].x === seen[15] && g[0].x === seen[4], "seize révélations : la galerie garde les douze dernières");
  await p.page.reload();
  await p.page.waitForSelector(PAIR);
  await p.page.goto(env.base + "#accueil");
  await p.page.goto(env.base + "#jeu-dessin");
  await p.page.waitForSelector(PAIR);
  check((await gallery(p)).length === 12 && JSON.stringify(await gallery(p)) === JSON.stringify(g), "recharger la révélation, quitter et revenir : aucun doublon, rien ne bouge");
  check(await count(p, ".dessin-gal") === 0, "tant qu'une partie est en cours, la galerie ne s'affiche pas par-dessus");
  await p.page.click(STOP);
  await p.page.click(STOP);
  await p.page.waitForSelector(".dessin-gal");
  check((await text(p, ".dessin-gal summary")).includes("12") && await count(p, ".dessin-thumb") === 12 && (await text(p, ".dessin-thumb span")) === seen[15], "partie arrêtée : la présentation montre douze paires, la plus récente en premier");
  await p.page.click(".dessin-gal summary");
  const last = await image(p, ".dessin-thumb");
  check(last.slice(1, 4).toString() === "PNG" && last.readUInt32BE(16) === 1200 && !last.equals(first), "toucher la première vignette enregistre l'image de cette paire-là");
  await p.page.click('.dessin-gal [data-act="empty"]');
  await sleep(3300);
  check((await gallery(p)).length === 12 && (await text(p, '.dessin-gal [data-act="empty"]')).includes("Vider la galerie"), "« Vider la galerie » touché une fois : au bout de trois secondes, le bouton reprend son libellé et rien n'est vidé");
  await p.page.click('.dessin-gal [data-act="empty"]');
  check((await gallery(p)).length === 12, "un nouveau toucher, bien plus tard, ne vide toujours rien");
  await p.page.click('.dessin-gal [data-act="empty"]');
  check(await until(async () => await count(p, ".dessin-gal") === 0) && (await gallery(p)).length === 0, "le second toucher, lui, la vide");

  /* La première paire, enregistrée depuis la révélation puis depuis la galerie : la même image. */
  const q = await phone(env, "galerie-image", { data: deck(1) });
  await solo(q, env, { sujets: "portrait" });
  await begin(q);
  await stroke(q, ring(0.5, 0.5, 0.3));
  await q.page.click('[data-act="ink"][data-v="2"]');
  await stroke(q, LINE);
  await q.page.click(DONE);
  await sheet(q, BAR);
  await q.page.waitForSelector(PAIR);
  const live = await image(q);
  await q.page.click(STOP);
  await q.page.click(STOP);
  await q.page.waitForSelector(".dessin-gal");
  await q.page.click(".dessin-gal summary");
  check(live.equals(await image(q, ".dessin-thumb")), "l'image enregistrée depuis la galerie est la même que celle de la révélation");
  await solo(q, env, { sujets: "portrait" });
  await soloRound(q);
  g = await gallery(q);
  check(g.length === 2 && g[0].k !== g[1].k, "une nouvelle partie, même sujet : sa paire s'ajoute à la galerie sans remplacer la précédente");
});

/* ====================================================================== Deux téléphones */

scenario("Deux téléphones : l'invité arrive après que l'hôte a dessiné", async (env) => {
  const a = await phone(env, "a-tard"), b = await phone(env, "b-tard");
  await intro(a, env);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await begin(a);
  const topic = await subject(a);
  await stroke(a, ring(0.5, 0.5, 0.3));
  await stroke(a, LINE);
  await a.page.click(DONE);
  check(await is(a, "attente-0") && await count(a, ".g-wait details .share[data-url]") === 1 && await count(a, ".dessin-mine .dessin-art path") === 2 && (await text(a, ".g-wait .sync")).includes("dessin d'Inès"),
    "l'hôte commence sans attendre : sa feuille est rendue, il attend « le dessin d'Inès », le lien d'invitation reste à portée");
  await sleep(600);
  await a.page.goto("about:blank");
  await join(b, link);
  check(await until(async () => await kind(b) === "pret-0-b" && (await tip(b)).includes("a déjà rendu sa feuille")) && await count(b, ".dessin-art") === 0, "l'invité arrive ensuite : il apprend que l'hôte a déjà rendu sa feuille, sans la voir");
  await begin(b);
  check((await subject(b)).replace(/Alex/g, "#") === topic.replace(/Inès/g, "#") && await blank(b), "même sujet, feuille vierge");
  await stroke(b, BAR);
  await b.page.click(DONE);
  check(await is(b, "revelation-0") && await paths(b, "a") === 2 && await paths(b, "b") === 1, "l'invité rend sa feuille : la révélation s'ouvre chez lui, bien que l'hôte ait fermé la page");
  await a.page.goto(env.base + "#accueil");
  await a.page.click(RESUME);
  check(await is(a, "revelation-0") && await paths(a, "a") === 2 && await paths(a, "b") === 1, "l'hôte rouvre le site et reprend : la révélation l'attend");
  const n = await posts(env);
  await b.page.goto(link);
  await a.page.goto(link);
  await sleep(800);
  const sa = await saved(a), sb = await saved(b);
  check(await is(a, "revelation-0") && await is(b, "revelation-0") && sa.me === "a" && sb.me === "b" && await posts(env) === n, "chacun retouche le lien d'invitation : il retrouve sa partie et son rôle, sans rien renvoyer");
  check(sa.S.a.d.d === sb.S.a.d.d && sa.S.b.d.d === sb.S.b.d.d && (await gallery(a)).length === 1 && (await gallery(b)).length === 1, "les mêmes feuilles sur les deux téléphones, une paire dans chaque galerie");
});

scenario("Deux téléphones : rechargement à chaque étape, sur chaque téléphone", async (env) => {
  const { a, b } = await duo(env, "recharge", { chrono: "60" });
  const reload = async (p, k) => { await p.page.reload(); await p.page.waitForSelector("main.game"); return is(p, k); };
  check(await reload(a, "pret-0-a") && await reload(b, "pret-0-b"), "avant de commencer : les deux rechargent, chacun retrouve son départ");
  await begin(a);
  await stroke(a, ring(0.5, 0.5, 0.3));
  const t = await seconds(a), px = await pixels(a), topic = await subject(a);
  check(await reload(a, "dessin-0-a") && await pixels(a) === px && await seconds(a) <= t && await subject(a) === topic, "A recharge en plein dessin : même sujet, feuille intacte, chrono non remis à zéro");
  await a.page.click(DONE);
  check(await reload(a, "attente-0") && await count(a, ".dessin-mine .dessin-art path") === 1, "A recharge en attendant : sa feuille est toujours rendue");
  await sleep(500);
  check(await reload(b, "pret-0-b") && await until(async () => (await saved(b)).S.a.d.r === 0) && await count(b, ".dessin-art") === 0, "B recharge avant de commencer : la feuille de A est arrivée sur son téléphone, mais ne s'affiche pas");
  await begin(b);
  await stroke(b, BAR);
  check(await reload(b, "dessin-0-b") && await count(b, ".dessin-art") === 0 && (await saved(b)).local.cur.s.length === 1, "B recharge en plein dessin : son trait est là, la feuille de A toujours cachée");
  await b.page.click(DONE);
  check(await is(a, "revelation-0") && await is(b, "revelation-0"), "la révélation s'ouvre des deux côtés");
  const both = await a.page.locator(PAIR).innerHTML();
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "revelation-0") && await is(b, "revelation-0") && await a.page.locator(PAIR).innerHTML() === both && await b.page.locator(PAIR).innerHTML() === both, "les deux rechargent sur la révélation : les mêmes dessins");
  await next(a);
  check(await reload(a, "pret-1-a") && await reload(b, "revelation-0") && await until(async () => (await tip(b)).includes("t'attend")), "A passe au sujet suivant et recharge : il y est ; B recharge : il relit la révélation et apprend qu'on l'attend");
  await sheet(a, LINE);
  check(await reload(a, "attente-1") && await until(async () => (await saved(b)).S.a.d.r === 1) && await reload(b, "revelation-0") && await b.page.locator(PAIR).innerHTML() === both, "A rend la feuille suivante ; B recharge encore : toujours la première révélation, inchangée");
  await next(b);
  check(await reload(b, "pret-1-b") && (await tip(b)).includes("a déjà rendu sa feuille"), "B la quitte et recharge : il est au sujet 2, où A a déjà rendu sa feuille");
  await sheet(b, BAR);
  check(await is(a, "revelation-1") && await is(b, "revelation-1"), "B rend la sienne : la seconde révélation s'ouvre des deux côtés");
  await Promise.all([a.page.reload(), b.page.reload()]);
  const sa = await saved(a), sb = await saved(b), ga = await gallery(a), gb = await gallery(b);
  check(await is(a, "revelation-1") && await is(b, "revelation-1") && sa.S.a.d.d === sb.S.a.d.d && sa.S.b.d.d === sb.S.b.d.d && sa.sh.r === 1 && sb.sh.r === 1, "après un dernier rechargement, les deux téléphones ont les mêmes feuilles, au même sujet");
  check(ga.length === 2 && gb.length === 2 && JSON.stringify(ga) === JSON.stringify(gb), "deux paires dans chaque galerie, les mêmes, sans doublon");
});

scenario("Deux téléphones : quitter vers l'accueil et revenir", async (env) => {
  const { a, b } = await duo(env, "accueil");
  await begin(a);
  await stroke(a, ring(0.5, 0.5, 0.3));
  const px = await pixels(a);
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  await sheet(b, BAR);
  await is(b, "attente-0");
  await sleep(600);
  await a.page.click(RESUME);
  check(await is(a, "dessin-0-a") && await pixels(a) === px && await count(a, ".dessin-art") === 0, "A quitte en plein dessin, B rend sa feuille, A reprend : sa feuille en cours est intacte, celle de B reste cachée");
  await a.page.click(DONE);
  check(await is(a, "revelation-0") && await is(b, "revelation-0"), "A rend la sienne : la révélation s'ouvre des deux côtés");
  await advance(a, b);

  await sheet(a, LINE);
  await is(a, "attente-1");
  await sleep(600);
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  await sheet(b, BAR);
  await is(b, "revelation-1");
  await next(b);
  await is(b, "pret-2-b");
  await sleep(600);
  await a.page.click(RESUME);
  check(await is(a, "revelation-1") && await until(async () => (await tip(a)).includes("t'attend")), "A attend à l'accueil ; B rend sa feuille, regarde, passe au sujet suivant ; A reprend : la révélation l'attend");
  await next(a);

  await sheet(a, LINE);
  await is(a, "attente-2");
  await sleep(600);
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  await sheet(b, BAR);
  await is(b, "revelation-2");
  await next(b);
  await sheet(b, ring(0.5, 0.5, 0.2));
  await is(b, "attente-3");
  await sleep(600);
  await a.page.click(RESUME);
  await a.page.waitForSelector("main.game");
  await until(async () => (await saved(a)).S.b.d.r === 3);
  await sleep(500);
  const k = await kind(a), g = await gallery(a);
  check(k === "revelation-2", "A pose son téléphone à l'accueil ; B rend sa feuille, regarde, passe au sujet suivant et le dessine ; A reprend : il voit d'abord la révélation qu'il attendait (écran de A : " + k + ")");
  check(g.length === 3, "et cette paire est dans sa galerie comme dans celle de B (galerie de A : " + g.length + " paires, celle de B : " + (await gallery(b)).length + ")");
});

scenario("Deux téléphones : tout au même instant, cinq sujets de suite", async (env) => {
  const { a, b } = await duo(env, "ensemble", { sujets: "delire", phone: { data: deck(5) } });
  await linked(a);
  await linked(b);
  await sleep(1000);
  const n = await posts(env);
  let same = true, shown = true, moved = true;
  for (let r = 0; r < 5; r++) {
    await Promise.all([begin(a), begin(b)]);
    same = same && await subject(a) === await subject(b);
    await Promise.all([stroke(a, [[0.2, 0.2 + 0.1 * r], [0.8, 0.3]]), stroke(b, [[0.2, 0.8 - 0.1 * r], [0.8, 0.7]])]);
    await Promise.all([a.page.click(DONE), b.page.click(DONE)]);
    shown = shown && await is(a, "revelation-" + r) && await is(b, "revelation-" + r) && await a.page.locator(PAIR).innerHTML() === await b.page.locator(PAIR).innerHTML();
    await sleep(LONG);
    await Promise.all([a.page.click(NEXT), b.page.click(NEXT)]);
    moved = moved && await is(a, r < 4 ? "pret-" + (r + 1) + "-a" : "fin") && await is(b, r < 4 ? "pret-" + (r + 1) + "-b" : "fin");
  }
  check(same, "cinq sujets : à chaque fois le même sujet sur les deux téléphones");
  check(shown, "les deux rendent leur feuille au même instant : la révélation s'ouvre des deux côtés, avec les mêmes dessins");
  check(moved, "les deux touchent « Sujet suivant » au même instant : un seul sujet d'avance, jusqu'à la fin de la pile");
  await sleep(1200);
  const cost = await posts(env) - n, ga = await gallery(a), gb = await gallery(b);
  check(cost <= 20, "cinq sujets joués à l'unisson coûtent au plus quatre messages chacun (" + cost + " en tout)");
  check(ga.length === 5 && JSON.stringify(ga) === JSON.stringify(gb), "cinq paires dans chaque galerie, les mêmes");
  /* Le relais ralenti laisse à B le temps de commencer à dessiner avant que la relance de A ne l'emporte. */
  await env.ctl("delay=2500");
  await Promise.all([a.page.click(again("portrait")), b.page.click(again("souvenir"))]);
  await begin(b);
  await stroke(b, LINE);
  const ok = await until(async () => { const sa = await saved(a), sb = await saved(b); return sa.gen === 2 && sb.gen === 2 && sb.setup.seed === sa.setup.seed && sb.setup.sujets === sa.setup.sujets; }, 12000);
  await env.ctl("delay=0");
  check(ok && await is(b, "pret-0-b") && slice(await saved(b), "b").r === undefined && !b.errors.length, "les deux relancent au même instant, B commence à dessiner : une seule pile l'emporte, B revient à son départ sans rien avoir rendu");
  await duoRound(a, b);
  check(await a.page.locator(PAIR).innerHTML() === await b.page.locator(PAIR).innerHTML() && await title(a) === await title(b), "et la nouvelle pile se joue normalement, même sujet des deux côtés");
});

scenario("Deux téléphones : la feuille de l'autre arrive pendant que je dessine", async (env) => {
  const { a, b } = await duo(env, "pendant", { chrono: "60" });
  await Promise.all([begin(a), begin(b)]);
  await stroke(a, LINE);
  await stroke(b, ring(0.5, 0.5, 0.3));
  await b.page.click('[data-act="ink"][data-v="4"]');
  await b.page.click('[data-act="size"][data-v="1"]');
  await stroke(b, BAR);
  const px = await pixels(b);
  await b.page.evaluate(() => { document.querySelector(".dessin-sheet").same = true; window.scrollTo(0, 40); });
  const y = await b.page.evaluate(() => window.scrollY);
  await a.page.click(DONE);
  check(await until(() => b.page.evaluate(() => document.querySelector(".dessin-sheet").same !== true)), "la feuille de A arrive chez B, qui ne touche à rien : son écran est redessiné");
  check(await pixels(b) === px && await b.page.getAttribute('[data-act="ink"][data-v="4"]', "aria-pressed") === "true" && await b.page.getAttribute('[data-act="size"][data-v="1"]', "aria-pressed") === "true" && await b.page.evaluate(() => window.scrollY) === y && await count(b, ".dessin-art") === 0,
    "à l'identique : même dessin, même encre, même épaisseur, même défilement, et rien de la feuille de A");
  await b.page.click('[data-act="undo"]');
  check((await saved(b)).local.cur.s.length === 1, "« Annuler » marche toujours après ce réaffichage");

  /* B a touché « Effacer » et s'apprête à confirmer quand un message de A arrive. */
  await advanceAfter(a, b);
  await Promise.all([begin(a), begin(b)]);
  await stroke(a, LINE);
  await stroke(b, ring(0.5, 0.5, 0.3));
  await stroke(b, BAR);
  await b.page.click('[data-act="clear"]');
  await a.page.click(DONE);
  await until(async () => (await saved(b)).S.a.d.r === 1);
  await sleep(150);
  const label = await text(b, '[data-act="clear"]');
  await b.page.click('[data-act="clear"]');
  const left = (await saved(b)).local.cur.s.length;
  check(left === 0, "B touche « Effacer », la feuille de A arrive, B confirme dans la seconde : sa feuille est effacée (traits restants : " + left + ", le bouton disait « " + label.trim() + " »)");

  /* Le temps de B finit pendant qu'il trace, alors que la feuille de A est déjà là. */
  if (left) await stroke(b, LINE);
  await rewrite(b, (s) => { s.local.cur.t -= 56000; });
  await b.page.waitForSelector(SHEET);
  await sleep(PAUSE);
  await stroke(b, [[0.3, 0.3], [0.6, 0.6]], true);
  check(await is(b, "revelation-1", 6000) && await is(a, "revelation-1"), "le temps de B finit pendant qu'il a le doigt posé : la révélation s'ouvre des deux côtés");
  await b.page.mouse.up();
  await sleep(1300);
  check(await kind(b) === "revelation-1" && (await saved(b)).sh.r === 1, "le doigt se lève sur la révélation, là où était « J'ai fini » : elle reste à l'écran");
});
/* Les deux ont rendu leur feuille (B la sienne si ce n'est pas fait), puis quittent la révélation. */
async function advanceAfter(a, b) {
  if (await count(b, DONE)) await b.page.click(DONE);
  if (!await until(async () => await count(a, PAIR) && await count(b, PAIR), 8000)) throw new Error("la révélation ne s'est pas ouverte des deux côtés");
  await advance(a, b);
}

scenario("Deux téléphones : touchers répétés", async (env) => {
  const { a, b } = await duo(env, "rafale2");
  await linked(a);
  await linked(b);
  await sleep(1000);
  let n = await posts(env);
  await rapid(a, START, 3);
  await sleep(900);
  let s = await saved(a), k = await kind(a);
  check(k === "dessin-0-a" && s.S.a.d.r === undefined && await posts(env) === n, "trois touchers sur « Voir le sujet » : le sujet s'affiche, la feuille reste à dessiner et rien ne part (écran de A : " + k + ", messages : " + (await posts(env) - n) + ")");
  if (k === "dessin-0-a") { await stroke(a, LINE); await a.page.click(DONE); }
  await is(a, "attente-0");
  await begin(b);
  await stroke(b, BAR);
  await until(async () => (await saved(b)).S.a.d.r === 0);
  await rapid(b, DONE, 3);
  await sleep(500);
  check(await kind(b) === "revelation-0" && (await saved(b)).sh.r === undefined, "B rend sa feuille en dernier et touche trois fois « J'ai fini » : la révélation reste à l'écran");
  await is(a, "revelation-0");
  await sleep(LONG);
  n = await posts(env);
  await rapid(a, NEXT, 3);
  await sleep(900);
  s = await saved(a);
  check(await kind(a) === "pret-1-a" && !s.local.cur && s.sh.r === 1 && await posts(env) - n === 1, "trois touchers de A sur « Sujet suivant » : sujet 2, chrono non lancé, un seul message");
  await rapid(b, NEXT, 3);
  await sleep(900);
  s = await saved(b);
  check(await kind(b) === "pret-1-b" && !s.local.cur && await posts(env) - n === 1, "trois touchers de B, qui relisait la révélation : il rejoint A au sujet 2, chrono non lancé, sans rien envoyer");
});

scenario("Deux téléphones : un téléphone hors ligne, puis le relais en panne", async (env) => {
  const { a, b } = await duo(env, "panne");
  await duoRound(a, b);
  await advance(a, b);
  await a.ctx.setOffline(true);
  await sheet(a, LINE);
  await sheet(b, BAR);
  await sleep(2500);
  /* Selon le navigateur, le flux déjà ouvert de A survit ou non à la coupure : A peut donc voir la révélation avant B. */
  check(await kind(b) === "attente-1" && ["attente-1", "revelation-1"].indexOf(await kind(a)) >= 0 && await count(a, '.g-top [data-net="ok"]') === 0, "A hors ligne : sa feuille est gardée, B l'attend, la pastille de A ne dit plus « Connecté »");
  await a.ctx.setOffline(false);
  check(await is(a, "revelation-1", 45000) && await is(b, "revelation-1", 45000), "le réseau revient : la révélation s'ouvre des deux côtés");
  await advance(a, b);
  await env.ctl("down=1");
  await Promise.all([sheet(a, LINE), sheet(b, BAR)]);
  await sleep(3000);
  check(await kind(a) === "attente-2" && await kind(b) === "attente-2", "relais en panne : chacun garde sa feuille et attend");
  await env.ctl("down=0");
  check(await is(a, "revelation-2", 45000) && await is(b, "revelation-2", 45000), "le relais revient : la révélation s'ouvre des deux côtés");
  const sa = await saved(a), sb = await saved(b);
  check(sa.S.a.d.d === sb.S.a.d.d && sa.S.b.d.d === sb.S.b.d.d && (await gallery(a)).length === 3 && (await gallery(b)).length === 3, "les mêmes feuilles sur les deux téléphones, trois paires dans chaque galerie : rien de perdu ni de doublé");
  check(await linked(a) && await linked(b), "et les deux pastilles reviennent à « Connecté »");

  /* A a rendu sa feuille et verrouille son téléphone ; B rend la sienne, regarde, passe au sujet suivant et le dessine. */
  await advance(a, b);
  await sheet(a, LINE);
  await is(a, "attente-3");
  await sleep(600);
  await a.ctx.setOffline(true);
  await env.ctl("drop=1");
  await sheet(b, BAR);
  await is(b, "revelation-3");
  await next(b);
  await sheet(b, ring(0.5, 0.5, 0.2));
  await is(b, "attente-4");
  await sleep(600);
  await a.ctx.setOffline(false);
  const back = await until(async () => (await saved(a)).S.b.d.r === 4, 45000);
  await sleep(500);
  const k = await kind(a);
  check(back && k === "revelation-3", "A éteint son écran en attendant B ; B rend sa feuille, regarde, passe au sujet suivant et le dessine ; A rallume : il voit d'abord la révélation qu'il attendait (écran de A : " + k + ")");
});

scenario("Deux téléphones : le relais oublie tout en pleine partie", async (env) => {
  const { a, b } = await duo(env, "oubli");
  await duoRound(a, b);
  const both = await b.page.locator(PAIR).innerHTML();
  await next(a);
  await sheet(a, LINE);
  await is(a, "attente-1");
  await sleep(600);
  await env.ctl("reset=1");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "attente-1") && await is(b, "revelation-0") && await b.page.locator(PAIR).innerHTML() === both, "le relais oublie tout, les deux rechargent : A attend toujours au sujet 2, B relit la révélation du sujet 1");
  await next(b);
  await sheet(b, BAR);
  check(await is(a, "revelation-1", 15000) && await is(b, "revelation-1", 15000), "B dessine le sujet 2 : la révélation s'ouvre des deux côtés");
  await advance(a, b);
  await Promise.all([begin(a), begin(b)]);
  await env.ctl("reset=1");
  await sleep(300);
  await stroke(a, LINE);
  await stroke(b, BAR);
  await Promise.all([a.page.click(DONE), b.page.click(DONE)]);
  check(await is(a, "revelation-2", 30000) && await is(b, "revelation-2", 30000), "nouvel oubli sans recharger, pendant que les deux dessinent : le sujet se révèle quand même");
  const t = (await env.ctl()).topics, room = Object.keys(t)[0];
  check(!!room && t[room].messages <= 8, "chacun n'a redéposé que son dernier état (" + (room ? t[room].messages : 0) + " messages dans le salon)");
});

scenario("Deux téléphones : l'invité perd sa partie et rouvre le lien d'invitation", async (env) => {
  const { a, b, link } = await duo(env, "retour");
  await duoRound(a, b);
  await advance(a, b);
  await duoRound(a, b);
  await advance(a, b);
  await sheet(b, BAR);
  await is(b, "attente-2");
  await sleep(600);
  const mine = (await saved(b)).S.b.d.d;
  await b.page.click(STOP);
  await sleep(300);
  await b.page.click(STOP);
  await b.page.waitForSelector("main.intro");
  await join(b, link);
  const back = await until(async () => { const s = await saved(b); return s.S.b.d.r === 2 && s.S.b.d.d === mine && s.sh.r === 2; }, 8000);
  await sleep(500);
  const k = await kind(b);
  check(back, "B arrête par erreur puis rouvre le lien : son téléphone retrouve la feuille qu'il avait rendue et le sujet en cours");
  check(k === "attente-2", "et B reprend là où il en était, à attendre A au sujet 3, sans repasser par les révélations déjà quittées (écran de B : " + k + ")");
  for (let i = 0; i < 3 && /^revelation-[01]$/.test(await kind(b)); i++) await next(b);
  await sheet(a, LINE);
  check(await is(a, "revelation-2") && await is(b, "revelation-2") && await a.page.locator(PAIR).innerHTML() === await b.page.locator(PAIR).innerHTML(), "A rend sa feuille : le sujet 3 se révèle des deux côtés, avec les mêmes dessins");

  /* Le cas voisin : B avait ouvert le lien dans le navigateur d'une messagerie, il le rouvre dans le vrai (autre
     stockage, même joueur), et c'est lui qui avait touché « Sujet suivant » le premier. */
  const two = await duo(env, "ailleurs");
  await duoRound(two.a, two.b);
  await sleep(LONG);
  await two.b.page.click(NEXT);
  await until(async () => (await saved(two.a)).sh.r === 1);
  await two.a.page.click(NEXT);
  await sheet(two.a, LINE);
  await is(two.a, "attente-1");
  await sleep(600);
  await two.b.page.goto("about:blank");
  const b2 = await phone(env, "b-ailleurs-bis");
  await join(b2, two.link);
  await until(async () => (await saved(b2)).S.a.d.r === 1);
  await sleep(800);
  const where = await kind(b2);
  check(where === "pret-1-b", "B, qui avait touché « Sujet suivant » le premier, rouvre le lien dans un autre navigateur : il arrive au sujet 2, que A a déjà dessiné (écran de B : " + where + ", écran de A : " + await kind(two.a) + ")");
  if (/^pret-/.test(where)) await sheet(b2, BAR);
  const met = await until(async () => /^revelation-/.test(await kind(two.a)) && await kind(b2) === await kind(two.a), 5000);
  check(met, "et la partie continue : chacun fait ce que son écran lui demande, une révélation s'ouvre des deux côtés (A : " + await kind(two.a) + ", B : " + await kind(b2) + (await count(b2, ".dessin button") + await count(two.a, ".dessin button") === 0 ? ", sans aucun bouton pour en sortir" : "") + ")");
  await next(two.a);
  await is(two.a, "pret-2-a");
  await sheet(two.a, LINE);
  await until(async () => (await saved(b2)).S.a.d.r === 2);
  await sleep(400);
  check(await kind(b2) === "revelation-1" && (await tip(b2)).includes("t'attend"), "A passe à la suite et rend déjà sa feuille : B, arrivé en cours de pile, garde la révélation qu'il regarde (écran de B : " + await kind(b2) + ")");
  await next(b2);
  check(await is(b2, "pret-2-b"), "puis rejoint A au sujet 3, sur son propre toucher");
});

scenario("Deux téléphones : une nouvelle pile pendant que l'autre regarde encore", async (env) => {
  const { a, b } = await duo(env, "relance", { sujets: "delire", phone: { data: deck(2) } });
  await duoRound(a, b);
  await advance(a, b);
  await duoRound(a, b);
  const both = await b.page.locator(PAIR).innerHTML();
  await next(a);
  check(await is(a, "fin") && await until(async () => await kind(b) === "revelation-1" && (await tip(b)).includes("t'attend")), "A termine la pile ; B regarde encore la dernière révélation et apprend qu'on l'attend");
  await a.page.click(again("delire"));
  await is(a, "pret-0-a");
  await until(async () => (await saved(b)).gen === 2);
  await sleep(500);
  const k = await kind(b);
  check(k === "revelation-1" && await b.page.locator(PAIR).innerHTML() === both, "A relance aussitôt une pile : B garde la dernière révélation sous les yeux jusqu'à son propre toucher (écran de B : " + k + ")");
  check((await tip(b)).includes("Alex a relancé une pile") && (await text(b, NEXT)).includes("nouvelle pile") && await b.page.evaluate(() => window.scrollY) === 0, "son écran lui dit qu'Alex a relancé une pile, et le bouton y mène");
  await b.page.reload();
  await b.page.waitForSelector(PAIR);
  check(await kind(b) === "revelation-1" && await b.page.locator(PAIR).innerHTML() === both, "après rechargement aussi");
  const before = await posts(env);
  check((await gallery(b)).length === 2, "dans tous les cas, la dernière paire est dans la galerie de B");
  if (await kind(b) === "revelation-1") await next(b);
  check(await is(b, "pret-0-b") && (await text(b, ".dessin-step")).includes("Nouvelle pile") && await posts(env) === before && !(await saved(b)).local.cur, "B arrive ensuite au départ de la nouvelle pile, sans rien envoyer, chrono non lancé");
  await duoRound(a, b);
  check(await title(a) === await title(b), "qui se joue normalement, même sujet des deux côtés");
});

scenario("Deux téléphones : rien ne part sans un geste, et le poids d'un dessin", async (env) => {
  const { a, b } = await duo(env, "cout", { chrono: "30" });
  await linked(a);
  await linked(b);
  await sleep(1200);
  let n = await posts(env);
  const spent = async () => { const m = await posts(env), d = m - n; n = m; return d; };
  await sleep(2500);
  check(await spent() === 0, "personne ne touche à rien : aucun message ne part");
  await Promise.all([begin(a), begin(b)]);
  /* Un dessin d'une minute bien remplie : quarante traits tremblés de quarante points. */
  for (let k = 0; k < 40; k++) {
    if (k % 8 === 0) await a.page.click('[data-act="ink"][data-v="' + (k / 8) + '"]');
    await stroke(a, shaky(k + 1, 40), false, 1);
  }
  await a.page.click('[data-act="undo"]');
  await a.page.click('[data-act="size"][data-v="1"]');
  await stroke(b, LINE);
  await sleep(900);
  check(await spent() === 0, "voir le sujet, dessiner, changer d'outil, annuler : rien ne part avant « J'ai fini »");
  await a.page.click(DONE);
  await is(a, "attente-0");
  await sleep(1500);
  const d = (await saved(a)).S.a.d.d, c = await spent();
  check(d.split(".").length === 39 && d.length < 8000 && c <= 4, "un dessin de 39 traits tremblés pèse " + d.length + " caractères et part en " + c + " message" + (c > 1 ? "s" : ""));
  await rewrite(b, (s) => { s.local.cur.t -= 28000; });
  check(await is(b, "revelation-0", 8000) && await is(a, "revelation-0"), "le chrono de B arrive à zéro : sa feuille part, la révélation s'ouvre des deux côtés");
  await sleep(1500);
  const c2 = await spent();
  check(c2 === 1, "rendue par le chrono, la feuille de B coûte un message (" + c2 + ")");
  await image(a);
  await Promise.all([a.page.reload(), b.page.reload()]);
  await linked(a);
  await linked(b);
  await sleep(1500);
  check(await spent() === 0, "regarder la révélation, enregistrer l'image, recharger les deux téléphones : aucun message");
  await next(a);
  await sleep(900);
  const c3 = await spent();
  await next(b);
  await sleep(900);
  check(c3 === 1 && await spent() === 0, "« Sujet suivant » coûte un message au premier qui le touche, rien au second");
  const room = Object.keys((await env.ctl()).topics)[0], total = (await env.ctl()).topics[room].messages;
  check(total <= 9, "un sujet complet, arrivées comprises : " + total + " messages dans le salon");
  /* Un dessin démesuré (mille traits, 120 ko avant de partir) traverse le relais. */
  await Promise.all([begin(a), begin(b)]);
  await rewrite(a, (s, list) => { s.local.cur.s = list; }, Array.from({ length: 1000 }, (_, k) => scribble(60, k + 1)));
  await a.page.waitForSelector(SHEET);
  await a.page.click(DONE);
  await stroke(b, LINE);
  await b.page.click(DONE);
  const big = await is(a, "revelation-1", 15000) && await is(b, "revelation-1", 15000);
  await sleep(1500);
  const c4 = await spent(), sa = await saved(a), sb = await saved(b);
  check(big && sa.S.a.d.d.length <= 10000 && sb.S.a.d.d === sa.S.a.d.d && await paths(b, "a") === 1000 && await a.page.locator(PAIR).innerHTML() === await b.page.locator(PAIR).innerHTML(),
    "un dessin démesuré de A arrive entier chez B : " + sa.S.a.d.d.length + " caractères, mille traits, les mêmes des deux côtés");
  check(c4 <= 5 && (await env.ctl()).count.rejected === 0, "il coûte quatre messages au plus, dont aucun n'est refusé par le relais pour sa taille (" + c4 + " messages pour les deux feuilles)");
});

scenario("Deux téléphones : thème clair chez l'un, sombre chez l'autre", async (env) => {
  const { a, b } = await duo(env, "sombre", { sujets: "portrait", guest: { dark: true } });
  await Promise.all([begin(a), begin(b)]);
  const white = (p, s) => p.page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, s);
  check(await blank(b) && await white(b, SHEET) === "rgb(255, 255, 255)" && await b.page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches), "en thème sombre, la feuille est blanche");
  for (const p of [a, b]) {
    for (let c = 0; c < 7; c++) {
      await p.page.click('[data-act="ink"][data-v="' + c + '"]');
      await stroke(p, [[0.15, 0.1 + 0.12 * c], [0.85, 0.14 + 0.12 * c]]);
    }
    await p.page.click(DONE);
  }
  check(await is(a, "revelation-0") && await is(b, "revelation-0") && await a.page.locator(PAIR).innerHTML() === await b.page.locator(PAIR).innerHTML(), "la révélation montre les mêmes dessins des deux côtés");
  check(await white(b, ".dessin-fig.as-a .dessin-art") === "rgb(255, 255, 255)" && await white(a, ".dessin-fig.as-a .dessin-art") === "rgb(255, 255, 255)", "sur papier blanc dans les deux thèmes");
  const ia = await image(a), ib = await image(b);
  check(ia.equals(ib) && ia.readUInt32BE(16) === 1200, "et l'image enregistrée est la même, au pixel près, sur le téléphone clair et sur le sombre");
  fs.mkdirSync(path.join(ROOT, "dev", "e2e", "shots"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "dev", "e2e", "shots", "dessin-extra-image-sombre.png"), ib);
  await b.shot("dessin-extra-revelation-sombre");
});

scenario("Deux téléphones : valeurs hostiles venues de l'autre", async (env) => {
  /* Compte les vibrations demandées par le jeu. */
  const buzzer = () => { window.__buzz = 0; try { Object.defineProperty(navigator, "vibrate", { value: () => { window.__buzz++; return true; }, configurable: true }); } catch (e) { /* sans importance */ } };
  const { a, b } = await duo(env, "pirate", { phone: { init: buzzer } });
  await sheet(a, LINE);
  await is(a, "attente-0");
  await sleep(600);
  const arrive = (pred) => until(async () => pred(await saved(a)), 8000);
  const mine = async () => JSON.stringify((await saved(a)).seq.a);
  let sent = await mine(), quiet = true, ok = true;
  for (const r of ["0", 0.5, -1, 1e9, null, true, [0], { r: 0 }, { toString: 1 }]) {
    await inject(b, { d: { r, d: "AAAAgg" } });
    ok = ok && await arrive((s) => JSON.stringify(s.S.b.d.r) === JSON.stringify(r)) && await healthy(a) && await kind(a) === "attente-0";
  }
  check(ok, "feuille au numéro de sujet mal formé (texte, décimal, négatif, énorme, null, booléen, tableau, objets) : elle ne compte pas, A attend toujours");
  ok = true;
  for (const d of [12, null, ["AAAAgg"], { 0: "A", length: 1 }, true]) {
    await inject(b, { d: { r: 0, d } });
    ok = ok && await arrive((s) => JSON.stringify(s.S.b.d.d) === JSON.stringify(d)) && await healthy(a) && await kind(a) === "attente-0";
  }
  check(ok, "dessin qui n'est pas un texte (nombre, null, tableau, objet, booléen) : A attend toujours");
  await inject(b, { d: { r: 0, d: Array.from({ length: 6000 }, () => "AAAAgg").join(".") } });
  check(await is(a, "revelation-0", 15000) && await paths(a, "b") === 1000 && await healthy(a), "six mille traits (42 ko) : la révélation s'ouvre, mille traits dessinés au plus");
  await inject(b, { d: { r: 0, d: "A" + "g".repeat(59999) } });
  check(await arrive((s) => s.S.b.d.d.length === 60000) && await until(async () => await paths(a, "b") === 1) && await healthy(a), "un seul trait de 60 ko : coupé, dessiné, rien ne casse");
  await inject(b, { d: { r: 0, d: "AAAA\" onload=\"window.__xss=1.AAAAgg.<script>window.__xss=1</script>.M0 0L9 9.\ud83d\ude00AAA" } });
  check(await arrive((s) => s.S.b.d.d.indexOf("onload") > 0) && await until(async () => await paths(a, "b") === 1) && await healthy(a), "du texte fait pour sortir du dessin (attribut, balise, tracé SVG, emoji) est jeté : seul le trait valide reste");
  const g = await gallery(a);
  check(g.length === 1 && g[0].d.every((d) => d.length <= 10000), "la galerie de A n'a gardé qu'une paire pour ce sujet, bornée en taille");

  ok = true;
  for (const sh of [{ r: "1" }, { r: 1.5 }, { r: -1 }, { r: [1] }, { r: { v: 1 } }, { r: null }, { r: true }, { r: 0, x: Array(50).fill(HOSTILE), [HOSTILE]: 1 }]) {
    await inject(b, { h: { sh } });
    ok = ok && await arrive((s) => JSON.stringify(s.sh) === JSON.stringify(sh)) && await healthy(a) && await kind(a) === "revelation-0";
  }
  check(ok, "numéro de sujet commun mal formé (texte, décimal, négatif, tableau, objet, null, booléen, clés en trop) : A reste sur la révélation du sujet 1");
  quiet = quiet && await mine() === sent;
  await next(a);
  sent = await mine();
  await begin(a);
  await stroke(a, ring(0.5, 0.5, 0.3));
  const px = await pixels(a);
  await inject(b, { h: { sh: { r: 3 } } });
  check(await arrive((s) => s.sh.r === 3) && await is(a, "pret-3-a") && await healthy(a) && (await saved(a)).S.a.d.r === 0, "B saute deux sujets pendant que A dessine : A se retrouve au départ du sujet 4, rien n'est rendu à sa place");
  await inject(b, { h: { sh: { r: 1 } } });
  check(await is(a, "dessin-1-a") && await pixels(a) === px, "B revient en arrière : A retrouve sa feuille en cours, intacte");

  ok = true;
  for (const [act, v] of [["again", HOSTILE], ["again", "tous"], ["next", null], ["start", null], ["image", null], ["ink", "99"], ["ink", "-3"], ["ink", HOSTILE], ["size", "7"], ["empty", null], ["g-nope", null]]) {
    await forge(a, act, v);
    const s = await saved(a);
    ok = ok && await kind(a) === "dessin-1-a" && s.gen === 1 && s.sh.r === 1 && s.local.cur.s.length === 1 && [0, 1, 2, 3, 4, 5, 6].indexOf(s.local.cur.c) >= 0 && [0, 1].indexOf(s.local.cur.z) >= 0 && await healthy(a);
  }
  check(ok, "des boutons forgés dans la page de A (rejouer, suivant, départ, encre et épaisseur hors palette) ne changent rien à sa partie");

  ok = true;
  for (const su of [{ seed: HOSTILE, chrono: HOSTILE, sujets: [HOSTILE] }, { seed: 1e300, chrono: 12, sujets: 12 }, { seed: -3.7, chrono: {}, sujets: null }, { seed: "", chrono: "constructor", sujets: "__proto__" }, { seed: 7, chrono: "00", sujets: "toString" }]) {
    const gen = (await saved(a)).gen + 1;
    await inject(b, { h: { gen, setup: su, sh: {} } });
    ok = ok && await arrive((s) => s.gen === gen) && await is(a, "pret-0-a") && await healthy(a) && (await title(a)).includes("une minute");
  }
  check(ok, "réglages hostiles (seed, temps et sujets de toutes formes) : A retombe sur le départ d'une pile jouable, une minute au chrono");
  await begin(a);
  check((await subject(a)).length > 5 && await seconds(a) >= 55 && await healthy(a), "et peut y dessiner");
  /* Une nouvelle pile, au même chrono, arrive pendant que A trace : c'est ce que font deux « Rejouer » au même instant. */
  const lift = async () => {
    const box = await a.page.locator(SHEET).boundingBox();
    await a.page.mouse.move(box.x + 0.8 * box.width, box.y + 0.6 * box.height, { steps: 4 });
    await a.page.mouse.up();
  };
  await stroke(a, [[0.2, 0.5], [0.5, 0.5]], true);
  let gen = (await saved(a)).gen + 1;
  await inject(b, { h: { gen, setup: { seed: 5, chrono: "60", sujets: "tous" }, sh: {} } });
  check(await arrive((s) => s.gen === gen) && await kind(a) === "dessin-0-a", "une nouvelle pile arrive pendant que A a le doigt posé : son écran ne bouge pas avant la fin du trait");
  await lift();
  check(await is(a, "pret-0-a") && await healthy(a) && slice(await saved(a), "a").r === undefined, "le doigt levé, A arrive au départ de la nouvelle pile, sans erreur");
  check(quiet && await mine() === sent, "pendant tout cela, le téléphone de A n'a rien envoyé de lui-même : son seul envoi est son propre « Sujet suivant »");

  /* La même, mais le pirate y retire le chrono : celui de A, en cours, tombe à zéro d'un coup. */
  await begin(a);
  await stroke(a, [[0.2, 0.5], [0.5, 0.5]], true);
  gen++;
  await a.page.evaluate(() => { window.__buzz = 0; });
  await inject(b, { h: { gen, setup: { seed: 6, chrono: "0", sujets: "tous" }, sh: {} } });
  await arrive((s) => s.gen === gen);
  await sleep(1500);
  await lift();
  await sleep(600);
  const buzz = await a.page.evaluate(() => window.__buzz), stuck = await kind(a);
  check(buzz <= 1 && stuck === "pret-0-a", "le pirate relance une pile sans chrono pendant que A trace : le téléphone de A ne se met pas à vibrer et à biper en boucle, et suit la partie une fois le doigt levé (vibrations en deux secondes : " + buzz + ", écran de A : " + stuck + ")");
  if (stuck !== "pret-0-a") { await stroke(a, LINE); await is(a, "pret-0-a"); }
  /* Sans changer de pile : A dessine sans chrono depuis une minute, le pirate impose trente secondes. */
  await begin(a);
  await stroke(a, LINE);
  await rewrite(a, (s) => { s.local.cur.t -= 60000; });
  await a.page.waitForSelector(SHEET);
  await linked(a);
  await inject(b, { h: { setup: Object.assign({}, (await saved(a)).setup, { chrono: "30" }) } });
  await arrive((s) => s.setup.chrono === "30");
  await sleep(1000);
  const forced = slice(await saved(a), "a").r !== undefined;
  check(!forced && await kind(a) === "dessin-0-a", "le pirate impose un chrono à une feuille commencée sans : le téléphone de A ne rend pas la feuille à la place de A (" + (forced ? "feuille rendue et envoyée" : "feuille gardée") + ", écran de A : " + await kind(a) + ")");

  const c = await phone(env, "c-pirate"), room = (await saved(a)).room;
  await join(c, env.base + "#g=" + token({ g: "dessin", v: 1, n: [HOSTILE, "D'Artagnan"], r: room.r, k: room.k, su: { seed: "x", chrono: 12, sujets: HOSTILE }, gen: 3 }));
  check(await until(() => healthy(c)) && /^(pret|dessin|attente|revelation)-/.test(await kind(c)), "une invitation aux prénoms et réglages hostiles s'ouvre sur un écran de jeu intact, sans rien exécuter");
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
