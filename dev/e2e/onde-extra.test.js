/* Essais d'endurance du jeu « Sur la même longueur d'onde » : ce que deux personnes font pour de
   vrai et que l'essai de base ne couvre pas (recharger à chaque étape, quitter et revenir, toucher
   plusieurs fois, jouer au même instant, perdre le réseau, relancer pendant que l'autre joue), plus
   des valeurs hostiles injectées depuis un téléphone et observées sur l'autre.

   Usage : EN_PW=… node dev/e2e/onde-extra.test.js [filtre]
   Le filtre ne garde que les scénarios dont le nom le contient (pratique pour en rejouer un seul).
   EN_NET=1 laisse passer les polices du site : les mesures de largeur se font alors avec elles. */
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const FIELD = ".onde-form .g-field", SUBMIT = ".onde-form button[type=submit]", NEXT = '[data-act="next"]', FORCE = '[data-act="force"]';
const HOME = '.g-top a[href="#accueil"]', RESUME = '.banner a[href="#jeu-onde"]', STOP = '.g-foot [data-act="g-stop"]';
const again = (pack) => '[data-act="again"][data-pack="' + pack + '"]';
/* Le jeu ignore un toucher qui suit de moins d'une seconde un changement de décision : on attend, comme une personne. */
const PAUSE = 1100;

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}

/* Thèmes de secours : ils ne servent que si jeux/onde.data.js est absent (le vrai fichier les remplace).
   Quarante par paquet, pour que plusieurs parties de suite puissent ne jamais resservir un thème. */
function fixture() {
  const mk = (id, name, f) => ({ id, name, hint: "Paquet d'essai.", themes: Array.from({ length: 40 }, (_, i) => f(i)) });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.onde = { packs: [mk("classique", "Classique", (i) => "Thème classique " + i), mk("nous", "Spécial nous", (i) => (i % 2 ? "Le plat préféré {de_a} " : "Ce que {b} oublie ") + i), mk("absurde", "Absurde", (i) => "Thème absurde " + i)] };
}
/* Contenu imposé pour un scénario : servi à la place de jeux/onde.data.js, sans toucher au fichier. */
const dataFile = (packs) => "(window.GAME_DATA = window.GAME_DATA || {}).onde = " + JSON.stringify({ packs }) + ";";
/* Trois paquets dont chaque thème contient un prénom. */
const NAMED = dataFile(["classique", "nous", "absurde"].map((id) => ({
  id, name: id === "nous" ? "Spécial nous" : id, hint: "Paquet d'essai.",
  themes: Array.from({ length: 12 }, (_, i) => ["Le plat préféré {de_a} n° ", "Ce que {b} oublie toujours n° ", "Le talent caché {de_b} n° ", "L'animal qui fait craquer {a} n° "][i % 4] + i)
})));

/* o.data : contenu imposé ; o.init : script lancé avant ceux de la page ; le reste va à lib.phone. */
async function phone(env, name, o) {
  o = o || {};
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  if (o.init) await p.ctx.addInitScript(o.init);
  if (o.data) await p.ctx.route(/\/jeux\/onde\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: o.data }));
  return p;
}

const count = (p, s) => p.page.locator(s).count();
const text = (p, s) => p.page.locator(s).first().textContent();
const title = (p) => text(p, ".onde .g-title");
const step = (p) => text(p, ".onde-step");
const big = async (p) => (await text(p, ".g-big")).replace(/\s+/g, "");
const score = async (p) => (await text(p, ".onde-score")).replace(/\s+/g, " ");
const won = async (p) => (await title(p)).includes("Même longueur d'onde");
const html = (p) => p.page.evaluate(() => document.getElementById("app").innerHTML);
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:onde")));
const best = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:onde:best")));
const posts = async (env) => (await env.ctl()).count.post;
const linked = (p) => until(() => count(p, '.g-top [data-net="ok"]'), 8000);
/* L'écran affiché : ecrire, attente, revele, fin (ou hors-jeu si on n'est plus dans la partie). */
const kind = (p) => p.page.evaluate(() => {
  const q = (s) => document.querySelector("main.game " + s);
  return !document.querySelector("main.game") ? "hors-jeu" : q(".g-big") ? "fin" : q(".onde-pair") ? "revele" : q(".g-wait") ? "attente" : q(".onde-form") ? "ecrire" : "autre";
});
const is = (p, k, ms) => until(async () => (await kind(p)) === k, ms);
/* L'écran de jeu est debout : pas de panne, aucune balise injectée, aucun script exécuté, aucune erreur. */
const healthy = async (p) => !p.errors.length && await p.page.evaluate(() => !!document.querySelector("main.game .onde") && !document.querySelector("#app img, #app script, #app iframe") && window.__xss === undefined);
/* Ce qui fait défiler la page de côté : renvoie une description, ou "" si rien ne dépasse. */
const overflow = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  document.querySelectorAll("main.game *").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth) out.push("." + String(el.className.baseVal == null ? el.className : "svg").split(" ")[0] + " : " + el.scrollWidth + " px dans " + el.clientWidth);
  });
  return document.documentElement.scrollWidth > w + 1 ? "page de " + document.documentElement.scrollWidth + " px pour " + w + (out.length ? " (" + out[out.length - 1] + ")" : "") : "";
});
/* Boutons, liens et champs du jeu dont la zone tactile fait moins de 44 px de haut. */
const small = (p) => p.page.evaluate(() => Array.from(document.querySelectorAll("main.game .onde button, main.game .onde a, main.game .onde input"))
  .map((el) => ({ t: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
  .filter((x) => x.h > 0 && x.h < 44).map((x) => "« " + x.t + " » : " + x.h + " px").join(", "));

async function write(p, word) {
  await p.page.waitForSelector(FIELD);
  await p.page.fill(FIELD, word);
  await p.page.press(FIELD, "Enter");
}
/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent
   sur ce qui s'affiche à cet endroit après le premier. */
async function rapid(p, selector, n) {
  const box = await p.page.locator(selector).first().boundingBox();
  for (let i = 0; i < n; i++) {
    await p.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(120);
  }
}
async function intro(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-onde");
  await p.page.fill("#name-a", o.a != null ? o.a : "Alex");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  if (o.pack) await p.page.click('[data-act="g-opt"][data-val="' + o.pack + '"]');
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
/* Deux téléphones dans la même partie, tous deux devant le premier thème.
   o : prénoms et paquet (voir intro), o.phone : options des deux téléphones. */
async function duo(env, tag, o) {
  o = o || {};
  const a = await phone(env, "a-" + tag, o.phone), b = await phone(env, "b-" + tag, o.phone);
  await intro(a, env, o);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await join(b, link);
  await Promise.all([a.page.waitForSelector(FIELD), b.page.waitForSelector(FIELD)]);
  return { a, b, link };
}
/* Un téléphone : une manche complète, chaque mot allant à son joueur quel que soit celui qui commence. */
async function soloRound(p, wa, wb) {
  for (let i = 0; i < 2; i++) {
    await p.page.waitForSelector(FIELD);
    await write(p, await count(p, ".onde.as-b") ? wb : wa);
  }
  await p.page.waitForSelector(".onde-pair");
}
/* Deux téléphones : une manche complète, les deux écrivant en même temps. */
async function duoRound(a, b, wa, wb) {
  await Promise.all([write(a, wa), write(b, wb)]);
  if (!(await is(a, "revele") && await is(b, "revele"))) throw new Error("la révélation ne s'est pas ouverte des deux côtés");
}
const both = (a, b, s) => Promise.all([a.page.click(s), b.page.click(s)]);
/* Une partie entière à deux, sans s'arrêter : n manches gagnées, les autres perdues. */
async function duoGame(a, b, n, tag) {
  for (let r = 0; r < 10; r++) { await duoRound(a, b, tag + r, r < n ? tag + r : "autre" + r); await both(a, b, NEXT); }
  if (!(await is(a, "fin") && await is(b, "fin"))) throw new Error("le résultat ne s'est pas affiché des deux côtés");
}
/* Le pirate modifie sa partie enregistrée puis recharge : le socle redépose alors cet état sur le relais. */
async function inject(p, x) {
  await p.page.evaluate((x) => {
    const s = JSON.parse(localStorage.getItem("en:g:onde")), now = Date.now();
    if (x.h) { Object.assign(s, x.h); s.st = (s.st || 0) + 1; s.sw = s.me; s.seq[s.me].h = now; }
    if ("d" in x) { s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d: x.d }; s.seq[s.me].d = now; }
    localStorage.setItem("en:g:onde", JSON.stringify(s));
  }, x);
  await p.page.reload();
}
const token = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
const focused = (p, s) => p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), s);
async function tabTo(p, selector, max) {
  for (let i = 1; i <= (max || 30); i++) {
    await p.page.keyboard.press("Tab");
    if (await focused(p, selector)) return i;
  }
  return -1;
}

const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push({ name, fn });

/* ====================================================================== Les règles */

scenario("Règles : ce qui compte pour le même mot", async (env) => {
  const p = await phone(env, "regles");
  await solo(p, env, { pack: "classique" });
  const cases = [
    ["Week-end", "weekend", true, "trait d'union"],
    ["L’été", "ETE", true, "apostrophe courbe du clavier, article, accents, casse"],
    ["Cœur", "coeurs", true, "ligature et pluriel"],
    ["Rome", "Riga", false, "deux mots courts différents"],
    ["au cinéma", "cinéma", true, "article contracté"],
    ["à la bibliothèque", "bibliothèque", true, "le même article, non contracté"],
    ["de la glace", "glace", true, "article partitif"],
    ["de l'eau", "l'eau", true, "article partitif élidé"],
    ["❤️", "❤️", true, "deux réponses identiques faites d'un emoji"],
    ["Привет", "привет", true, "le même mot dans un autre alphabet"],
    ["❤️", "☀️", false, "deux emoji différents"],
    ["mon téléphone", "son téléphone", true, "le même objet, dit par l'un et par l'autre"],
    ["17 ans", "12 ans", false, "un chiffre d'écart n'est pas une faute de frappe"],
    ["22h30", "23h30", false, "une heure d'écart non plus"]
  ];
  for (const [a, b, want, why] of cases) {
    await soloRound(p, a, b);
    check(await won(p) === want, "« " + a + " » et « " + b + " » : " + (want ? "le même mot" : "deux mots différents") + " (" + why + ")");
    await p.page.click(NEXT);
    if (await kind(p) === "fin") await p.page.click(again("classique"));
  }
});

/* ====================================================================== Un seul téléphone */

scenario("Un téléphone : le mot du premier reste secret, à chaque étape", async (env) => {
  const p = await phone(env, "secret");
  await solo(p, env, { pack: "classique" });
  const theme = await title(p);
  const hidden = async () => !/zanzibar/i.test(await html(p)) && await p.page.evaluate(() => Array.from(document.querySelectorAll("input, textarea")).every((el) => !/zanzibar/i.test(el.value)));
  const turnB = async () => await count(p, ".onde.as-b") === 1 && await title(p) === theme && await p.page.inputValue(FIELD) === "";

  await p.page.fill(FIELD, "brouillon");
  await p.page.reload();
  await p.page.waitForSelector(FIELD);
  check(await count(p, ".onde.as-a") === 1 && await title(p) === theme && !(await saved(p)).S.a.d.w, "rechargement en pleine saisie : même thème, toujours à Alex, rien d'enregistré");
  await write(p, "Zanzibar");
  check(await turnB() && await hidden(), "après « Valider », c'est à Inès et le mot d'Alex n'est nulle part dans la page");
  await p.page.reload();
  await p.page.waitForSelector(FIELD);
  check(await turnB() && await hidden(), "après rechargement, c'est toujours à Inès et le mot reste caché");
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  check(await hidden(), "à l'accueil, la partie en cours ne montre pas le mot");
  await p.page.click(RESUME);
  await p.page.waitForSelector(FIELD);
  check(await turnB() && await hidden(), "« Reprendre » depuis l'accueil : toujours à Inès, mot caché");
  await p.page.goBack();
  await p.page.waitForSelector(".banner");
  await p.page.goForward();
  await p.page.waitForSelector(FIELD);
  check(await turnB() && await hidden(), "bouton retour du navigateur puis avance : toujours à Inès, mot caché");

  await write(p, "zanzibar");
  await p.page.reload();
  await p.page.waitForSelector(".onde-pair");
  check(await won(p) && (await score(p)).includes("1 sur 1"), "rechargement sur la révélation : même verdict, même score");
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await p.page.click(RESUME);
  check(await is(p, "revele") && (await step(p)).includes("Manche 1 "), "aller à l'accueil et revenir : la révélation est toujours là");
  await p.page.click(NEXT);
  for (let r = 1; r < 10; r++) {
    await soloRound(p, "mot" + r, r < 4 ? "mot" + r : "autre" + r);
    if (r === 5) { await p.page.reload(); await p.page.waitForSelector(".onde-pair"); }
    await p.page.click(NEXT);
  }
  await p.page.waitForSelector(".onde-list");
  const s = await saved(p);
  check(s.S.a.d.w.length === 10 && s.S.b.d.w.length === 10 && s.S.a.d.w[0] === "Zanzibar" && s.S.b.d.w[9] === "autre9", "dix mots par joueur, ni perdus ni doublés malgré les rechargements");
  await p.page.reload();
  await p.page.waitForSelector(".onde-list");
  check(await big(p) === "4/10" && await count(p, ".onde-list li") === 10 && (await text(p, ".g-lead")).includes("Nouveau record"), "rechargement sur le résultat : 4 sur 10, dix lignes, toujours « Nouveau record »");
  await p.page.click(HOME);
  await p.page.waitForSelector('a.card-link[href="#jeu-onde"]');
  await p.page.click('a.card-link[href="#jeu-onde"]');
  check(await is(p, "fin") && await big(p) === "4/10", "revenir par la carte du jeu après la fin : le résultat est toujours là");
});

scenario("Un téléphone : touchers répétés sur chaque bouton", async (env) => {
  const p = await phone(env, "rafale");
  await solo(p, env, { pack: "classique" });
  await p.page.fill(FIELD, "tortue");
  await rapid(p, SUBMIT, 3);
  let s = await saved(p);
  check(await count(p, ".onde.as-b") === 1 && s.S.a.d.w.length === 1 && !s.S.b.d.w && await p.page.inputValue(FIELD) === "", "trois touchers sur « Valider » (premier joueur) : un seul mot enregistré, rien pour l'autre");
  await p.page.fill(FIELD, "lièvre");
  await rapid(p, SUBMIT, 2);
  check(await kind(p) === "revele" && (await step(p)).includes("Manche 1 "), "deux touchers sur « Valider » (second joueur) : la révélation reste à l'écran");
  if (await kind(p) !== "revele") await soloRound(p, "pareil", "pareil");
  const r = parseInt((await step(p)).replace(/\D+/, ""), 10);
  await sleep(700);
  await rapid(p, NEXT, 3);
  s = await saved(p);
  check(await kind(p) === "ecrire" && (await step(p)).includes("Manche " + (r + 1) + " ") && s.S.a.d.w.length === r && s.S.b.d.w.length === r, "trois touchers sur « Manche suivante » : une seule manche d'avance, aucun mot écrit");
  for (let i = r; i < 9; i++) { await soloRound(p, "x" + i, "x" + i); await p.page.click(NEXT); }
  await soloRound(p, "fin", "autre");
  await sleep(700);
  await rapid(p, NEXT, 3);
  s = await saved(p);
  check(await kind(p) === "fin" && s.gen === 1, "trois touchers sur « Voir le résultat » : le résultat s'affiche, aucune partie relancée");
  await p.page.locator(again("absurde")).scrollIntoViewIfNeeded();
  await rapid(p, again("absurde"), 3);
  s = await saved(p);
  check(!!s && s.gen === 2 && s.setup.pack === "absurde" && await kind(p) === "ecrire" && (await step(p)).includes("Manche 1 ") && await count(p, "[data-armed]") === 0, "trois touchers sur « Rejouer » : une seule nouvelle partie, toujours en cours");
});

scenario("Un téléphone : toute la partie au clavier", async (env) => {
  const p = await phone(env, "clavier", { viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1 });
  await p.page.goto(env.base + "#jeu-onde");
  const picked = await tabTo(p, '[data-act="g-opt"][data-val="classique"]') > 0;
  await p.page.keyboard.press("Enter");
  await tabTo(p, "#name-a");
  await p.page.keyboard.type("Alex");
  await p.page.keyboard.press("Tab");
  await p.page.keyboard.type("Inès");
  await tabTo(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.keyboard.press("Enter");
  check(picked && await is(p, "ecrire") && (await saved(p)).setup.pack === "classique", "au clavier : choisir le paquet, saisir les prénoms, lancer la partie");
  let inField = true, tabs = 0, ring = true, forced = false;
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < 2; i++) {
      inField = inField && await focused(p, FIELD);
      await p.page.keyboard.type(r < 5 ? "mot" + r : i ? "bleu" : "rouge");
      await p.page.keyboard.press("Enter");
    }
    /* Si le jeu désarme un instant « Manche suivante » pour parer un double toucher, on attend comme le ferait quelqu'un. */
    await p.page.waitForSelector(NEXT + ":enabled");
    if (r === 5) {
      await tabTo(p, FORCE, 4);
      await p.page.keyboard.press("Enter");
      forced = await won(p);
    }
    tabs = Math.max(tabs, await tabTo(p, NEXT, 6));
    ring = ring && await p.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });
    await p.page.keyboard.press("Enter");
  }
  check(inField, "à chaque tour, le champ de saisie a le focus sans tabuler");
  check(tabs > 0 && tabs <= 2 && ring, "sur la révélation, « Manche suivante » s'atteint en deux tabulations au plus, avec un focus visible");
  check(forced, "« On compte quand même » fonctionne au clavier");
  check(await is(p, "fin") && await big(p) === "6/10", "la partie se termine au clavier sur le bon score");
  const reached = await tabTo(p, again("classique"), 8);
  await p.page.keyboard.press("Enter");
  check(reached > 0 && await is(p, "ecrire") && await focused(p, FIELD) && (await saved(p)).gen === 2, "« Rejouer » au clavier : nouvelle partie, focus dans le champ");
});

scenario("Un téléphone : prénoms extrêmes, petit et grand écran", async (env) => {
  const A = "D'Art<img src=x>&\"é\"", B = "W".repeat(20), LONG = "W".repeat(40);
  const p = await phone(env, "petit", { viewport: { width: 320, height: 568 }, data: NAMED });
  await solo(p, env, { a: A, b: B, pack: "nous" });
  const wide = [], tiny = [];
  const look = async (label) => {
    const o = await overflow(p), t = await small(p);
    if (o) wide.push(label + " : " + o);
    if (t && tiny.indexOf(t) < 0) tiny.push(t);
  };
  await p.page.waitForSelector(FIELD);
  check((await text(p, ".onde-who")).includes(A) && await healthy(p), "un prénom avec apostrophe, balise et guillemets s'affiche tel quel");
  const box = await p.page.locator(SUBMIT).boundingBox();
  check(box.y + box.height <= 568 + 1 && await p.page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize) >= 16, FIELD), "« Valider » est visible sans défiler et le champ fait au moins 16 px");
  await p.shot("onde-extra-320-ecrire");
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < 2; i++) {
      await p.page.waitForSelector(FIELD);
      await look("écriture, thème « " + await title(p) + " »");
      await write(p, r === 0 && i ? HOSTILE : r % 2 || !i ? LONG : "mot");
    }
    await p.page.waitForSelector(".onde-pair");
    await look("révélation");
    if (r === 0) {
      check(await healthy(p) && (await text(p, ".g-card.b .g-card-text")).includes("<img"), "un mot fait de balises et un mot de 40 lettres se révèlent comme du texte");
      await p.shot("onde-extra-320-revele");
    }
    await p.page.click(NEXT);
  }
  await p.page.waitForSelector(".onde-list");
  await look("résultat");
  await p.shot("onde-extra-320-resultat");
  check(await healthy(p), "le récapitulatif n'exécute rien et n'injecte aucune balise");
  check(!wide.length, "320 px, prénom de 20 lettres sans espace : rien ne dépasse en largeur" + (wide.length ? " (" + wide.length + " écrans ; le premier : " + wide[0] + ")" : ""));
  check(!tiny.length, "toutes les zones tactiles du jeu font au moins 44 px" + (tiny.length ? " (" + tiny.join(" ; ") + ")" : ""));

  /* La hauteur utile d'un petit iPhone dans Safari, barres comprises. */
  const s = await phone(env, "court", { viewport: { width: 375, height: 553 } });
  await solo(s, env, { pack: "classique" });
  await soloRound(s, "Tiramisu", "Fondant");
  const cover = await s.page.evaluate((sel) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el ? "" : "à " + Math.round(r.top) + " px, sous « " + (top ? top.textContent.trim().slice(0, 20) : "") + " »";
  }, FORCE);
  await s.page.screenshot({ path: path.join(ROOT, "dev", "e2e", "shots", "onde-extra-375x553-revele.png") });
  check(!cover, "375 × 553 : « On compte quand même » n'est pas caché par la barre « Manche suivante » à l'ouverture de la révélation" + (cover ? " (" + cover + ")" : ""));
  await s.page.click(NEXT);
  await soloRound(s, "Champignons", "champignons");
  const lines = await s.page.evaluate(() => Array.from(document.querySelectorAll(".onde-pair .g-card-text")).map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))));
  check(lines.join() === "1,1", "375 px : « Champignons » tient sur une ligne dans chaque carte, sans lettre orpheline (lignes : " + lines.join(" et ") + ")");

  const q = await phone(env, "sans-prenom", { data: NAMED });
  await solo(q, env, { a: "", b: "   ", pack: "nous" });
  await q.page.waitForSelector(FIELD);
  check((await text(q, ".onde-who")).includes("Partenaire 1") && /Partenaire [12]/.test(await title(q)) && (await text(q, ".onde-form .hint")).includes("Partenaire 2"), "sans prénom : « Partenaire 1 » et « Partenaire 2 » partout, thème compris");

  const g = await phone(env, "grand", { viewport: { width: 1440, height: 900 }, mobile: false, touch: false, scale: 1, data: NAMED });
  await solo(g, env, { a: A, b: B, pack: "nous" });
  const out = [];
  const see = async (label) => {
    const o = await overflow(g), w = await g.page.evaluate(() => document.querySelector("main.game").getBoundingClientRect().width);
    if (o || w > 46 * 16 + 1) out.push(label + " : " + (o || "colonne de " + Math.round(w) + " px"));
  };
  for (let r = 0; r < 10; r++) {
    await see("écriture");
    await soloRound(g, LONG, r ? "mot" : HOSTILE);
    await see("révélation");
    await g.page.click(NEXT);
  }
  await g.page.waitForSelector(".onde-list");
  await see("résultat");
  check(!out.length && await healthy(g), "grand écran : une colonne étroite, rien ne dépasse" + (out.length ? " (" + out[0] + ")" : ""));
});

scenario("Un téléphone : paquet vide, page intégrée, fichier local", async (env) => {
  const v = await phone(env, "vide", { data: dataFile([]) });
  await solo(v, env);
  check(await kind(v) !== "fin" && !(await text(v, "main.game")).includes("record"), "sans aucun thème, le jeu n'affiche pas un faux résultat « 0 sur 10, nouveau record »");
  check(await best(v) === null, "sans aucun thème, aucun record n'est enregistré");
  check((await text(v, "main.game .onde")).includes("Recharge la page") && await count(v, '[data-act="again"]') === 0, "le jeu dit de recharger la page et ne propose pas de rejouer");
  const short = ["classique", "nous", "absurde"].map((id) => ({ id, name: id, hint: "Paquet d'essai.", themes: ["Thème un", "Thème deux", "Thème trois"] }));
  const c = await phone(env, "court-paquet", { data: dataFile(short) });
  await solo(c, env, { pack: "classique" });
  check(await kind(c) === "autre" && (await text(c, "main.game .onde")).includes("Recharge la page"), "un paquet de trois thèmes ne lance pas une partie qui finirait à la manche 3 sur un faux résultat");

  /* Sur deux téléphones, le fichier des thèmes n'arrive pas chez l'invité. */
  const a = await phone(env, "a-vide"), b = await phone(env, "b-vide", { data: dataFile([]) });
  await intro(a, env);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  await join(b, await a.page.locator(".share[data-url]").getAttribute("data-url"));
  await write(a, "Fraise");
  await is(a, "attente");
  check(await kind(b) === "autre" && await count(b, '[data-act="again"]') === 0 && (await saved(b)).gen === 1, "à deux, celui chez qui les thèmes manquent ne voit ni résultat ni « Rejouer » : il ne peut pas relancer la partie de l'autre");
  await b.ctx.unroute(/\/jeux\/onde\.data\.js/);
  await b.page.reload();
  check(await is(b, "ecrire") && await title(b) === await title(a), "il recharge, les thèmes arrivent : il retrouve la partie, au même thème");
  await write(b, "fraises");
  check(await is(a, "revele") && await won(a) && (await saved(a)).S.a.d.w[0] === "Fraise", "et la manche se révèle : le mot de l'autre n'a pas été perdu");

  const f = await phone(env, "cadre");
  await f.page.setContent('<iframe src="' + env.base + '#jeu-onde" style="width:380px;height:800px;border:0"></iframe>');
  const fr = f.page.frameLocator("iframe");
  await fr.locator('[data-act="g-start"][data-mode="solo"]').click();
  for (const w of ["Poire", "poires"]) { await fr.locator(FIELD).fill(w); await fr.locator(FIELD).press("Enter"); }
  check(await until(async () => (await fr.locator(".onde .g-title").textContent()).includes("Même longueur d'onde")), "dans une page intégrée, une manche se joue sur un téléphone");

  const l = await phone(env, "fichier");
  await l.page.goto(pathToFileURL(path.join(ROOT, "index.html")).href + "#jeu-onde");
  await l.page.click('[data-act="g-start"][data-mode="solo"]');
  await soloRound(l, "Poire", "poires");
  check(await won(l) && await count(l, ".g-net") === 0, "ouvert comme un fichier (file://), une manche se joue sur un téléphone");
});

scenario("Un téléphone : rejouer ne ressert pas les thèmes qu'on vient de voir", async (env) => {
  const p = await phone(env, "rejouer");
  await solo(p, env, { pack: "absurde" });
  const games = [];
  for (let game = 0; game < 3; game++) {
    games.push([]);
    for (let r = 0; r < 10; r++) {
      await p.page.waitForSelector(FIELD);
      games[game].push(await title(p));
      await soloRound(p, "mot", "mot");
      await p.page.click(NEXT);
    }
    await p.page.waitForSelector(".onde-list");
    if (game < 2) await p.page.click(again("absurde"));
  }
  const twice = [1, 2].map((i) => games[i].filter((t) => games[i - 1].indexOf(t) >= 0).length);
  check(twice[0] + twice[1] === 0, "« Rejouer avec Absurde » (40 thèmes), deux fois de suite : aucun thème de la partie précédente n'est resservi (" + twice[0] + " puis " + twice[1] + " sur 10)");
});

/* ====================================================================== Deux téléphones */

scenario("Deux téléphones : l'invité arrive après que l'hôte a joué", async (env) => {
  const a = await phone(env, "a-tard"), b = await phone(env, "b-tard");
  await intro(a, env);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await write(a, "Fraise");
  check(await is(a, "attente") && await count(a, ".g-wait details .share[data-url]") === 1, "l'hôte commence sans attendre : son mot est pris, le lien d'invitation reste à portée");
  const theme = await title(a);
  await sleep(600);
  await a.page.goto("about:blank");
  await join(b, link);
  await sleep(800);
  check(await kind(b) === "ecrire" && await title(b) === theme && !/fraise/i.test(await html(b)), "l'invité arrive ensuite : même thème, le mot de l'hôte ne s'affiche pas");
  await write(b, "fraises");
  check(await is(b, "revele") && await won(b), "l'invité écrit : la révélation s'ouvre chez lui, bien que l'hôte ait fermé la page");
  await a.page.goto(env.base + "#accueil");
  await a.page.click(RESUME);
  check(await is(a, "revele") && await won(a), "l'hôte rouvre le site et reprend : la révélation l'attend");
  const n = await posts(env);
  await b.page.goto(link);
  await a.page.goto(link);
  await sleep(800);
  const sa = await saved(a), sb = await saved(b);
  check(await is(a, "revele") && await is(b, "revele") && sa.me === "a" && sb.me === "b" && await posts(env) === n, "chacun retouche le lien d'invitation : il retrouve sa partie et son rôle, sans rien renvoyer");
  check(JSON.stringify(sa.S.a.d.w) === '["Fraise"]' && JSON.stringify(sb.S.a.d.w) === '["Fraise"]' && JSON.stringify(sa.S.b.d.w) === '["fraises"]', "aucun mot perdu ni doublé");
});

scenario("Deux téléphones : rechargement à chaque étape, sur chaque téléphone", async (env) => {
  const { a, b } = await duo(env, "recharge");
  const reload = async (p, k) => { await p.page.reload(); await p.page.waitForSelector("main.game"); return is(p, k); };
  check(await reload(a, "ecrire") && await reload(b, "ecrire") && await title(a) === await title(b), "avant d'écrire : les deux rechargent, même thème");
  await write(a, "Marmotte");
  check(await reload(a, "attente") && (await text(a, ".g-lead")).includes("Marmotte"), "A recharge en attendant : son mot est toujours pris");
  await sleep(500);
  check(await reload(b, "ecrire") && !/marmotte/i.test(await html(b)), "B recharge avant d'écrire : le mot de A ne s'affiche pas");
  await write(b, "marmottes");
  check(await is(a, "revele") && await is(b, "revele"), "la révélation s'ouvre des deux côtés");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "revele") && await is(b, "revele") && await won(a) && await won(b), "les deux rechargent sur la révélation : même verdict");
  await a.page.click(NEXT);
  await write(a, "Chalet");
  check(await reload(a, "attente") && (await step(a)).includes("Manche 2 ") && await reload(b, "revele") && (await step(b)).includes("Manche 1 "), "chacun à son rythme : A attend en manche 2, B relit la manche 1, même après rechargement");
  await b.page.click(NEXT);
  check(await reload(b, "ecrire") && (await step(b)).includes("Manche 2 "), "B recharge après « Manche suivante » : il est bien en manche 2");
  await write(b, "Igloo");
  await is(a, "revele");
  await b.page.click(FORCE);
  check(await until(() => won(a)), "B accorde le point : A le voit");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "revele") && await is(b, "revele") && await won(a) && await won(b) && (await score(b)).includes("2 sur 2"), "le point accordé survit au rechargement des deux");
  await both(a, b, NEXT);
  for (let r = 2; r < 10; r++) {
    await duoRound(a, b, "mot" + r, r < 6 ? "mot" + r : "autre" + r);
    if (r % 3 === 0) await Promise.all([a.page.reload(), b.page.reload()]);
    await both(a, b, NEXT);
  }
  check(await is(a, "fin") && await is(b, "fin") && await big(a) === "6/10" && await big(b) === "6/10", "fin de partie : 6 sur 10 des deux côtés");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "fin") && await is(b, "fin") && await big(a) === "6/10" && await big(b) === "6/10" && (await text(a, ".g-lead")).includes("Nouveau record"), "les deux rechargent sur le résultat : rien ne bouge");
  const sa = await saved(a), sb = await saved(b);
  check(["a", "b"].every((w) => sa.S[w].d.w.length === 10 && JSON.stringify(sa.S[w].d.w) === JSON.stringify(sb.S[w].d.w)), "dix mots par joueur, les mêmes sur les deux téléphones");
  const n = await posts(env);
  check(n <= 30, "une partie complète coupée d'une quinzaine de rechargements ne coûte pas plus de messages (" + n + ")");
});

scenario("Deux téléphones : quitter vers l'accueil et revenir", async (env) => {
  const { a, b } = await duo(env, "accueil");
  await write(a, "Girafe");
  await is(a, "attente");
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  await write(b, "girafe");
  check(await is(b, "revele"), "A est à l'accueil : son mot était parti, B voit la révélation");
  await a.page.click(RESUME);
  check(await is(a, "revele") && await won(a), "A revient : la révélation l'attend");
  await both(a, b, NEXT);
  await b.page.fill(FIELD, "brouillon");
  await b.page.click(HOME);
  await write(a, "Volcan");
  await sleep(700);
  await b.page.click(RESUME);
  check(await is(b, "ecrire") && (await step(b)).includes("Manche 2 ") && !/volcan/i.test(await html(b)), "B revient en pleine manche : il doit encore écrire, le mot de A ne s'affiche pas");
  await write(b, "Geyser");
  check(await is(a, "revele") && await is(b, "revele"), "et la manche se révèle des deux côtés");
  await both(a, b, NEXT);
  for (let r = 2; r < 10; r++) { await duoRound(a, b, "mot" + r, "mot" + r); await both(a, b, NEXT); }
  await is(a, "fin");
  await is(b, "fin");
  await a.page.click(HOME);
  await a.page.waitForSelector('a.card-link[href="#jeu-onde"]');
  await b.page.click(again("nous"));
  await is(b, "ecrire");
  await sleep(700);
  await a.page.click('a.card-link[href="#jeu-onde"]');
  check(await is(a, "ecrire") && (await step(a)).includes("Manche 1 ") && await title(a) === await title(b), "A était à l'accueil quand B a relancé : en revenant, il arrive dans la nouvelle partie, même thème");
  await duoRound(a, b, "Encore", "encore");
  check(await won(a) && (await saved(a)).S.a.d.w.length === 1, "et la nouvelle partie se joue normalement");
});

scenario("Deux téléphones : tout au même instant, dix manches de suite", async (env) => {
  const { a, b } = await duo(env, "instant", { a: "D'Artagnan", b: "Élodie", phone: { data: NAMED }, pack: "nous" });
  let agreed = true, stable = true, themes = true;
  for (let r = 0; r < 10; r++) {
    themes = themes && await title(a) === await title(b) && /D'Artagnan|d'Élodie|Élodie/.test(await title(a));
    await duoRound(a, b, "pareil" + r, r % 2 ? "pareil" + r : "autre" + r);
    if (r % 2 === 0) {
      await both(a, b, FORCE);
      agreed = agreed && await until(async () => await won(a) && await won(b), 4000);
      await sleep(900);
      stable = stable && await won(a) && await won(b);
    }
    await both(a, b, NEXT);
  }
  check(themes, "prénoms à apostrophe et à voyelle : le thème est le même des deux côtés, prénom compris, à chaque manche");
  check(agreed && stable, "les deux touchent « On compte quand même » au même instant : le point est accordé des deux côtés et le reste");
  check(await is(a, "fin") && await is(b, "fin") && await big(a) === "10/10" && await big(b) === "10/10", "dix manches écrites et validées en même temps : 10 sur 10 des deux côtés");
  await Promise.all([a.page.click(again("classique")), b.page.click(again("absurde"))]);
  check(await until(async () => {
    const x = await saved(a), y = await saved(b);
    return x.gen === 2 && y.gen === 2 && x.setup.seed === y.setup.seed && x.setup.pack === y.setup.pack && await kind(a) === "ecrire" && await kind(b) === "ecrire" && await title(a) === await title(b);
  }, 6000), "les deux relancent au même instant avec deux paquets différents : une seule partie, le même thème");
  await duoRound(a, b, "Phare", "phares");
  check(await won(a) && await won(b) && (await step(a)).includes("Manche 1 "), "et elle se joue normalement");
});

scenario("Deux téléphones : le mot de l'autre arrive pendant que j'écris", async (env) => {
  const { a, b } = await duo(env, "saisie");
  await a.page.click(FIELD);
  await a.page.keyboard.type("Lun");
  await write(b, "lundi");
  await until(async () => ((await saved(a)).S.b.d.w || []).length === 1);
  await sleep(300);
  check(await kind(a) === "ecrire" && await a.page.inputValue(FIELD) === "Lun" && await a.page.evaluate(() => document.activeElement.name === "mot" && document.activeElement.selectionStart === 3) && !/lundi/i.test(await html(a)),
    "B valide pendant que A écrit : le début de mot de A, le focus et le curseur restent en place, le mot de B ne s'affiche pas");
  await a.page.keyboard.type("di");
  await a.page.keyboard.press("Enter");
  check(await is(a, "revele") && await is(b, "revele") && await won(a) && (await saved(a)).S.a.d.w[0] === "Lundi", "A finit son mot et valide : la révélation s'ouvre des deux côtés");
});

scenario("Deux téléphones : touchers répétés", async (env) => {
  const { a, b } = await duo(env, "rafale2");
  await write(a, "Sorbet");
  await is(a, "attente");
  await sleep(600);
  await b.page.fill(FIELD, "sorbets");
  await rapid(b, SUBMIT, 2);
  check(await kind(b) === "revele" && (await step(b)).includes("Manche 1 "), "B écrit en second et touche deux fois « Valider » : la révélation reste à l'écran");
  await is(a, "revele");
  if (await kind(b) === "revele") await b.page.click(NEXT);
  await sleep(700);
  await rapid(a, NEXT, 3);
  check(await kind(a) === "ecrire" && (await step(a)).includes("Manche 2 ") && (await saved(a)).S.a.d.w.length === 1, "trois touchers sur « Manche suivante » : A est en manche 2, sans mot écrit");
  await duoRound(a, b, "Canapé", "sofa");
  /* D'accord à voix haute, chacun touche « On compte quand même » : le doigt de B arrive juste après la mise à jour venue de A. */
  const spot = await b.page.locator(FORCE).boundingBox();
  await sleep(900);
  const sent = await posts(env);
  await a.page.click(FORCE);
  await until(async () => (await text(b, FORCE)).includes("Finalement"));
  await b.page.touchscreen.tap(spot.x + spot.width / 2, spot.y + spot.height / 2);
  await sleep(1200);
  check(await won(a) && await won(b), "A puis B touchent « On compte quand même » l'un après l'autre : le point reste accordé (A : " + (await won(a) ? "accordé" : "retiré") + ", B : " + (await won(b) ? "accordé" : "retiré") + ")");
  check(await posts(env) - sent === 1, "et le toucher de B, arrivé trop tard pour changer quoi que ce soit, n'a rien envoyé");
  const after = await b.page.locator(FORCE).boundingBox();
  check(Math.abs(after.y - spot.y) < 1 && Math.abs(after.x - spot.x) < 1 && after.height >= 44, "le bouton n'a pas bougé en changeant de texte, et fait 44 px de haut");
  await both(a, b, NEXT);
  for (let r = 2; r < 10; r++) { await duoRound(a, b, "mot" + r, "mot" + r); await both(a, b, NEXT); }
  await is(a, "fin");
  await is(b, "fin");
  await a.page.locator(again("nous")).scrollIntoViewIfNeeded();
  await sleep(900);
  const n = await posts(env);
  await rapid(a, again("nous"), 3);
  await sleep(1200);
  const sa = await saved(a), sb = await saved(b);
  check(!!sa && sa.gen === 2 && sb.gen === 2 && await kind(a) === "ecrire" && await kind(b) === "ecrire" && await posts(env) - n === 1, "trois touchers sur « Rejouer » : une seule nouvelle partie pour les deux, un seul message");
});

scenario("Deux téléphones : un téléphone hors ligne, puis le relais en panne", async (env) => {
  const { a, b } = await duo(env, "panne");
  await duoRound(a, b, "Radio", "radio");
  await both(a, b, NEXT);
  await a.ctx.setOffline(true);
  await write(a, "Tempête");
  await write(b, "tempete");
  await sleep(2500);
  /* Selon le navigateur, le flux déjà ouvert de A survit ou non à la coupure : A peut donc voir la révélation avant B. */
  check(await kind(b) === "attente" && await kind(a) !== "ecrire" && await count(a, '.g-top [data-net="ok"]') === 0, "A hors ligne : son mot est gardé, B l'attend, la pastille de A ne dit plus « Connecté »");
  await a.ctx.setOffline(false);
  check(await is(a, "revele", 45000) && await is(b, "revele", 45000) && await won(a) && await won(b), "le réseau revient : la révélation s'ouvre des deux côtés");
  await both(a, b, NEXT);
  await env.ctl("down=1");
  await Promise.all([write(a, "Orage"), write(b, "orages")]);
  await sleep(3000);
  check(await kind(a) === "attente" && await kind(b) === "attente", "relais en panne : chacun garde son mot et attend");
  await env.ctl("down=0");
  check(await is(a, "revele", 45000) && await is(b, "revele", 45000), "le relais revient : la révélation s'ouvre des deux côtés");
  const sa = await saved(a), sb = await saved(b);
  check(["a", "b"].every((w) => sa.S[w].d.w.length === 3 && JSON.stringify(sa.S[w].d.w) === JSON.stringify(sb.S[w].d.w)), "trois mots par joueur, les mêmes sur les deux téléphones : rien de perdu ni de doublé");
  check(await linked(a) && await linked(b), "et les deux pastilles reviennent à « Connecté »");
});

scenario("Deux téléphones : le relais oublie tout en pleine partie", async (env) => {
  const { a, b } = await duo(env, "oubli");
  await duoRound(a, b, "Canapé", "sofa");
  await a.page.click(FORCE);
  await until(() => won(b));
  await both(a, b, NEXT);
  await write(a, "Lampe");
  await is(a, "attente");
  await sleep(600);
  await env.ctl("reset=1");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "attente") && await is(b, "ecrire") && (await step(b)).includes("Manche 2 "), "le relais oublie tout, les deux rechargent : A attend toujours, B doit toujours écrire");
  await write(b, "lampes");
  check(await is(a, "revele", 15000) && await is(b, "revele", 15000) && (await score(a)).includes("2 sur 2") && (await score(b)).includes("2 sur 2"), "B écrit : la révélation s'ouvre des deux côtés, le point accordé avant l'oubli est toujours compté");
  await both(a, b, NEXT);
  await env.ctl("reset=1");
  await sleep(300);
  await Promise.all([write(a, "Tapis"), write(b, "tapis")]);
  check(await is(a, "revele", 30000) && await is(b, "revele", 30000), "nouvel oubli sans recharger, pendant que les deux écrivent : la manche se révèle quand même");
  const t = (await env.ctl()).topics, room = Object.keys(t)[0];
  check(!!room && t[room].messages <= 8, "chacun n'a redéposé que son dernier état (" + (room ? t[room].messages : 0) + " messages dans le salon)");
});

scenario("Deux téléphones : l'invité perd sa partie et rouvre le lien d'invitation", async (env) => {
  const { a, b, link } = await duo(env, "retour");
  await duoRound(a, b, "Canapé", "sofa");
  await b.page.click(FORCE);
  await until(() => won(a));
  await both(a, b, NEXT);
  await write(b, "Mésange");
  await is(b, "attente");
  await sleep(600);
  await b.page.click(STOP);
  await sleep(500);
  await b.page.click(STOP);
  await b.page.waitForSelector("main.intro");
  await join(b, link);
  check(await until(async () => { const s = await saved(b); return (s.S.b.d.w || []).length === 2 && (s.S.a.d.w || []).length === 1; }, 8000) && await is(b, "revele") && (await step(b)).includes("Manche 1 "),
    "B arrête par erreur puis rouvre le lien : il retrouve ses deux mots et celui de A, et repart de la première révélation");
  await b.page.click(NEXT);
  check(await is(b, "attente") && (await text(b, ".g-lead")).includes("Mésange"), "une « Manche suivante » plus tard, B attend A en manche 2, son mot toujours pris");
  await write(a, "mesanges");
  check(await is(a, "revele") && await is(b, "revele") && await won(a) && await won(b), "A écrit : la manche 2 se révèle des deux côtés");
  await sleep(1500);
  const pa = await score(a), pb = await score(b);
  check(pa.includes("2 sur 2") && pb.includes("2 sur 2"), "le point que B avait accordé avant de partir compte toujours des deux côtés (A : « " + pa.trim() + " », B : « " + pb.trim() + " »)");
  /* Le cas voisin (B avait lancé la partie en cours par « Rejouer », puis revient par le lien du début) ne dépend
     que du socle, qui rejette alors son propre en-tête : il est essayé dans dev/e2e/kit-extra.test.js. */
});

scenario("Deux téléphones : deux décisions au même instant, sur deux manches différentes", async (env) => {
  const { a, b } = await duo(env, "croise");
  await duoRound(a, b, "Canapé", "sofa");
  await both(a, b, NEXT);
  await duoRound(a, b, "Vélo", "bicyclette");
  /* B a perdu son avancement (comme en revenant par le lien d'invitation) : il relit la manche 1 pendant que A lit la manche 2. */
  await b.page.evaluate(() => { const s = JSON.parse(localStorage.getItem("en:g:onde")); s.local = {}; localStorage.setItem("en:g:onde", JSON.stringify(s)); });
  await b.page.reload();
  check(await is(b, "revele") && (await step(b)).includes("Manche 1 ") && (await step(a)).includes("Manche 2 "), "A lit la manche 2, B relit la manche 1");
  await linked(b);
  await sleep(900);
  const n = await posts(env);
  await both(a, b, FORCE);
  check(await until(async () => (await score(a)).includes("2 sur 2") && await won(b)), "chacun accorde au même instant le point de la manche qu'il lit : les deux décisions arrivent chez A");
  await sleep(PAUSE);
  await b.page.click(NEXT);
  check(await is(b, "revele") && await won(a) && await won(b) && (await score(a)).includes("2 sur 2") && (await score(b)).includes("2 sur 2"), "aucune n'a écrasé l'autre : 2 sur 2 des deux côtés");
  check(await posts(env) - n === 2, "pour deux messages en tout");
  await a.page.click(FORCE);
  check(await until(async () => !(await won(b)) && (await score(b)).includes("1 sur 2")), "« Finalement non » touché par A retire le point chez B aussi");
});

scenario("Deux téléphones : une nouvelle partie pendant que l'autre joue encore", async (env) => {
  const { a, b } = await duo(env, "relance");
  for (let r = 0; r < 10; r++) {
    await duoRound(a, b, "mot" + r, r < 7 ? "mot" + r : "autre" + r);
    await a.page.click(NEXT);
    if (r < 9) await b.page.click(NEXT);
  }
  check(await is(a, "fin") && await kind(b) === "revele" && (await step(b)).includes("Manche 10"), "A est au résultat, B lit encore la dernière révélation");
  check(await count(a, '[data-act="again"]') === 0 && (await text(a, ".g-wait")).includes("dès qu'Inès aura vu le résultat"), "A ne peut pas encore relancer : le jeu lui dit d'attendre que B ait vu le résultat");
  check(await until(async () => { const r = await best(b); return !!r && r.n === 7; }, 2000), "sur le téléphone de B, le record est noté dès la dernière révélation");
  /* A relance dès qu'il le peut. Si le jeu fait attendre que B ait vu le résultat, B finit d'abord. */
  if (await count(a, again("absurde"))) await a.page.click(again("absurde"));
  await sleep(1500);
  const seen = await kind(b) !== "ecrire";
  if (await kind(b) === "revele") { await b.page.click(NEXT); await is(b, "fin"); }
  const ra = await best(a), rb = await best(b);
  check(seen && !!ra && ra.n === 7 && !!rb && rb.n === 7, "A veut rejouer tout de suite : B voit quand même le résultat de la partie finie à 7 sur 10, et elle compte pour son record (B " + (seen ? "a vu le résultat" : "est passé d'un coup à la partie suivante") + " ; record chez A : " + (ra ? ra.n : "aucun") + ", chez B : " + (rb ? rb.n : "aucun") + ")");
  if (await kind(a) === "fin") await a.page.click(again("absurde"));
  check(await is(a, "ecrire") && await is(b, "ecrire") && (await step(b)).includes("Manche 1 ") && await title(a) === await title(b), "la nouvelle partie démarre des deux côtés, même thème");

  await duoGame(a, b, 10, "x");
  /* Le relais ralenti laisse à B le temps de commencer à écrire avant que la relance de A ne l'emporte. */
  await env.ctl("delay=700");
  await Promise.all([a.page.click(again("classique")), b.page.click(again("absurde"))]);
  await b.page.waitForSelector(FIELD);
  const mine = await title(b);
  await b.page.fill(FIELD, "brouillon");
  const moved = await until(async () => (await saved(b)).setup.seed === (await saved(a)).setup.seed && await title(b) === await title(a), 8000);
  await env.ctl("delay=0");
  check(moved && await title(b) !== mine, "les deux relancent, B commence à écrire : la partie de A l'emporte et B change de thème");
  check(await b.page.inputValue(FIELD) === "", "le début de mot écrit pour l'ancien thème ne reste pas dans le champ sous le nouveau");
  await duoRound(a, b, "Cabane", "cabanes");
  check(await won(a) && await won(b), "et la partie se joue normalement");
});

scenario("Deux téléphones : record et points accordés après coup", async (env) => {
  const { a, b } = await duo(env, "record");
  for (let r = 0; r < 10; r++) {
    await duoRound(a, b, "mot" + r, r < 6 ? "mot" + r : "autre" + r);
    await a.page.click(NEXT);
    if (r < 9) await b.page.click(NEXT);
  }
  check(await is(a, "fin") && await big(a) === "6/10" && (await best(a)).n === 6, "A termine à 6 sur 10 : record de 6 sur son téléphone");
  await b.page.click(FORCE);
  check(await until(async () => await big(a) === "7/10"), "B, encore sur la dernière révélation, accorde le point : A passe à 7");
  check(await until(async () => (await best(a)).n === 7, 2000), "le record de A suit : 7");
  await sleep(PAUSE);
  await b.page.click(FORCE);
  check(await until(async () => await big(a) === "6/10"), "B se ravise : A revient à 6");
  await sleep(300);
  check((await best(a)).n === 6, "le record gardé sur le téléphone de A est le score final, 6 (trouvé : " + (await best(a)).n + ")");
  await b.page.click(NEXT);
  await is(b, "fin");
  await a.page.click(again("classique"));
  await is(b, "ecrire");
  await duoGame(a, b, 6, "x");
  const lead = await text(a, ".g-lead");
  check(await big(a) === "6/10" && !lead.includes("7"), "partie suivante à 6 sur 10 : A ne se voit pas annoncer un record de 7 jamais atteint (affiché : « " + lead + " »)");
  check(lead.includes("record\u00a0:") || !lead.includes(":"), "espace insécable avant « : » dans la ligne du record");
});

scenario("Deux téléphones : rien ne part sans un geste, et la typographie", async (env) => {
  const { a, b } = await duo(env, "cout");
  await linked(a);
  await linked(b);
  await sleep(900);
  let n = await posts(env);
  const spent = async () => { const m = await posts(env), d = m - n; n = m; return d; };
  await sleep(2500);
  check(await spent() === 0, "personne ne touche à rien : aucun message ne part");
  await write(a, "Lundi");
  await is(a, "attente");
  const lead = await text(a, ".g-lead");
  await sleep(900);
  check(await spent() === 1, "un mot écrit coûte un message");
  await write(b, "Mardi");
  await is(a, "revele");
  await is(b, "revele");
  await sleep(1200);
  check(await spent() === 1, "le mot de B arrive chez A : un seul message de plus, A ne répond rien de lui-même");
  const hint = await text(a, ".onde .hint"), points = await text(a, ".onde-score");
  await a.page.click(FORCE);
  await until(() => won(b));
  await sleep(900);
  check(await spent() === 1, "« On compte quand même » coûte un message");
  await both(a, b, NEXT);
  await sleep(900);
  check(await spent() === 0, "« Manche suivante » ne coûte rien");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await linked(a);
  await linked(b);
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  await a.page.click(RESUME);
  await linked(a);
  await sleep(900);
  check(await spent() === 0, "recharger les deux téléphones, aller à l'accueil et revenir : aucun message");
  const bad = [[lead, "Tu as écrit\u00a0:"], [hint, "chose\u00a0?"], [points, "Score\u00a0:"]].filter((x) => !x[0].includes(x[1])).map((x) => "« " + x[0].trim().slice(0, 36) + " »");
  check(!bad.length, "espace insécable avant « : » et « ? » dans les textes du jeu" + (bad.length ? " (espace ordinaire dans " + bad.join(", ") + ")" : ""));
});

scenario("Deux téléphones : l'entrée des deux mots ne rejoue pas à chaque mise à jour", async (env) => {
  const init = () => { window.__anim = 0; document.addEventListener("animationstart", (e) => { if (e.animationName === "onde-in") window.__anim++; }); };
  const { a, b } = await duo(env, "anime", { phone: { motion: true, init } });
  const played = (p) => p.page.evaluate(() => window.__anim);
  await duoRound(a, b, "Canapé", "sofa");
  await sleep(700);
  const n0 = await played(a);
  await b.page.click(NEXT);
  await write(b, "Lampe");
  await until(async () => ((await saved(a)).S.b.d.w || []).length === 2);
  await sleep(600);
  const n1 = await played(a);
  check(n0 === 2 && n1 === n0, "B écrit déjà son mot suivant pendant que A lit la révélation : les deux cartes de A ne rejouent pas leur entrée (" + (n1 - n0) + " animations relancées)");
  await a.page.click(FORCE);
  await sleep(600);
  const n2 = await played(a);
  check(n2 === n1, "A touche « On compte quand même » : les deux cartes ne rejouent pas leur entrée (" + (n2 - n1) + " animations relancées)");
});

scenario("Deux téléphones : un mot très long en attendant l'autre", async (env) => {
  const a = await phone(env, "a-long");
  await intro(a, env);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  await a.page.click('[data-act="g-go"]');
  await write(a, "A".repeat(39) + "H");
  await is(a, "attente");
  const o = await overflow(a);
  await a.shot("onde-extra-390-attente");
  check(!o && await healthy(a), "390 px : un cri de 40 lettres ne fait pas déborder l'écran d'attente" + (o ? " (" + o + ")" : ""));
});

scenario("Thème sombre : l'invite du champ reste lisible", async (env) => {
  const p = await phone(env, "sombre", { dark: true });
  await solo(p, env);
  const ratio = await p.page.evaluate(() => {
    const el = document.querySelector(".onde-form .g-field");
    const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const a = lum(getComputedStyle(el, "::placeholder").color), b = lum(getComputedStyle(el).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  check(ratio >= 4.5, "« Ton mot » sur le champ sombre : contraste d'au moins 4,5 (" + ratio.toFixed(2) + ")");
});

scenario("Deux téléphones : valeurs hostiles venues de l'autre", async (env) => {
  const { a, b } = await duo(env, "pirate");
  const arrive = (d) => until(async () => JSON.stringify((await saved(a)).S.b.d) === JSON.stringify(d), 8000);
  const header = (f) => until(async () => f(await saved(a)), 8000);
  const shown = () => text(a, ".g-card.b .g-card-text");
  await write(a, "Mangue");
  await is(a, "attente");
  let ok = true;
  for (const d of [{ w: "pas un tableau" }, { w: { 0: "objet", length: 3 } }, { w: [42, null, { x: 1 }, ["y"]] }, { w: [null, "futur", "plus tard"] }, { w: Array(400).fill(7) }, {}]) {
    await inject(b, { d });
    ok = ok && await arrive(d) && await healthy(a) && await kind(a) === "attente";
  }
  check(ok, "tranches mal formées (texte, objet, nombres, mots pour plus tard, tableau énorme, vide) : A attend toujours, écran intact");
  let d = { w: [HOSTILE, 42, "W".repeat(3000)], x: HOSTILE };
  await inject(b, { d });
  check(await arrive(d) && await is(a, "revele") && await healthy(a) && await shown() === HOSTILE, "un mot fait de balises se révèle comme du texte");
  d = { w: [HOSTILE, 42, "W".repeat(3000)], ok: { 0: 1e9, 1: -3, 2: "1", x: HOSTILE }, fin: { x: 1 } };
  await inject(b, { d });
  check(await arrive(d) && await healthy(a) && await kind(a) === "revele" && !(await won(a)), "compteurs de décision hors bornes ou mal formés : ignorés, la révélation tient");
  d = { w: [HOSTILE, 42, "W".repeat(3000)], ok: [3] };
  await inject(b, { d });
  check(await arrive(d) && await until(() => won(a)) && await healthy(a), "un compteur valable venu de l'autre compte, comme s'il avait touché « On compte quand même »");
  await sleep(PAUSE);
  await a.page.click(FORCE);
  check(await until(async () => !(await won(a))) && (await saved(a)).S.a.d.ok[0] === 4, "et A peut revenir dessus : son compteur passe devant");
  await a.page.click(NEXT);
  await write(a, "Litchi");
  check(await is(a, "attente") && await healthy(a), "un nombre à la place du mot suivant : A attend, écran intact");
  d = { w: [HOSTILE, "W".repeat(3000)] };
  await inject(b, { d });
  check(await arrive(d) && await is(a, "revele") && (await shown()).length === 40 && await healthy(a), "un mot de 3 000 lettres est coupé à 40");

  ok = true;
  for (const sh of [{ ok: "oui" }, { ok: [0, 0, 1] }, { ok: { 1: { a: 1 }, x: HOSTILE }, [HOSTILE]: [HOSTILE] }, { ok: null, extra: Array(50).fill(HOSTILE) }]) {
    await inject(b, { h: { sh } });
    ok = ok && await header((s) => JSON.stringify(s.sh) === JSON.stringify(sh)) && await healthy(a) && await kind(a) === "revele";
  }
  check(ok, "état commun mal formé (texte, tableau, objets imbriqués, null) : la révélation tient");
  await a.page.click(FORCE);
  check(await won(a) && await healthy(a), "et A peut encore accorder le point par-dessus");

  ok = true;
  for (const su of [{ seed: HOSTILE, pack: { x: 1 } }, { seed: 1e300, pack: 12 }, { seed: -3.7, pack: HOSTILE }, { seed: "", pack: null }]) {
    const gen = (await saved(a)).gen + 1;
    await inject(b, { h: { gen, setup: su, sh: {} } });
    ok = ok && await header((s) => s.gen === gen) && await healthy(a) && await kind(a) === "ecrire" && (await step(a)).includes("Manche 1 ") && (await title(a)).length > 5;
  }
  check(ok, "réglages hostiles (seed et paquet de toutes formes) : A retombe sur une manche 1 jouable");
  await write(a, "Kiwi");
  check(await is(a, "attente") && await healthy(a), "et peut y écrire son mot");

  await b.page.waitForSelector("main.game");
  const forged = (await saved(b)).gen;
  await b.page.evaluate((h) => {
    const x = document.createElement("button");
    x.setAttribute("data-act", "again");
    x.setAttribute("data-pack", h);
    document.querySelector("main.game").appendChild(x);
    x.click();
  }, HOSTILE);
  await sleep(900);
  const gen = (await saved(b)).gen;
  check(gen === forged && await header((s) => s.gen === gen) && await healthy(a) && ["ecrire", "attente"].indexOf(await kind(a)) >= 0, "un bouton « Rejouer » forgé en pleine manche, avec un paquet hostile, ne relance rien : A reste sur sa manche");
  await b.page.waitForSelector(FIELD);
  await b.page.evaluate(() => { const f = document.querySelector(".onde-form .g-field"); f.removeAttribute("maxlength"); f.value = "é".repeat(500); f.form.requestSubmit(); });
  if (await kind(a) === "ecrire") await write(a, "Kaki");
  check(await is(a, "revele") && (await shown()).length === 40, "un mot de 500 lettres soumis en contournant le champ est coupé à 40");

  const c = await phone(env, "c-pirate"), room = (await saved(a)).room;
  await join(c, env.base + "#g=" + token({ g: "onde", v: 1, n: [HOSTILE, "D'Artagnan"], r: room.r, k: room.k, su: { seed: "x", pack: 12 }, gen: 3 }));
  check(await until(() => healthy(c)) && ["ecrire", "attente", "revele"].indexOf(await kind(c)) >= 0, "une invitation aux prénoms et réglages hostiles s'ouvre sur un écran de jeu intact, sans rien exécuter");
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
