/* Essais « pour casser » le jeu « Les cartes à piocher », en complément de cartes.test.js : ce que
   deux personnes font pour de vrai et que l'essai de base ne couvre pas (recharger à chaque carte,
   quitter et revenir, toucher deux ou trois fois, poser deux doigts, piocher au même instant, perdre
   le réseau, changer de paquet pendant que l'autre joue), sur des écrans de plusieurs tailles, plus
   des valeurs hostiles écrites par un téléphone et observées sur l'autre. Les essais lisent le
   contenu dans la page : ils valent pour le vrai fichier jeux/cartes.data.js comme pour les cartes
   de secours. Ce qui appartient au socle (écrans d'invitation, compteurs poussés au plafond) est
   laissé à ses propres essais : ici, on vérifie seulement que le jeu reste debout.

   Usage : EN_PW=… node dev/e2e/cartes-extra.test.js [filtre]
   Le filtre ne garde que les scénarios dont le nom le contient (pratique pour en rejouer un seul).
   EN_NET=1 laisse passer les polices du site : les mesures de mise en page se font alors avec elles. */
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const KINDS = { q: "Question", d: "Défi", 2: "À deux" };
const NEXT = '[data-act="next"]', PREV = '.g-actions [data-act="prev"]', PICK = '.cartes-step [data-act="pick"]', BACK = ".cartes-end .g-actions [data-act]", TEXT = ".cartes-text";
const HOME = '.g-top a[href="#accueil"]', RESUME = '.banner a[href="#jeu-cartes"]', OPEN = 'a.card-link[href="#jeu-cartes"]', STOP = '.g-foot [data-act="g-stop"]';
const deckBtn = (id) => '[data-act="deck"][data-deck="' + id + '"]';
/* 390 × 664 : un iPhone courant dans Safari, barres du navigateur affichées. */
const SIZES = [["390 × 844", { width: 390, height: 844 }], ["390 × 664", { width: 390, height: 664 }], ["375 × 667", { width: 375, height: 667 }], ["320 × 568", { width: 320, height: 568 }]];
const DESKTOP = { viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1 };

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}

/* Cartes de secours : elles ne servent que si jeux/cartes.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const mk = (id, name, adult) => ({ id, name, hint: "Paquet d'essai.", adult, cards: Array.from({ length: 12 }, (_, i) => ({
    t: i % 4 === 3 ? "2" : i % 4 === 1 ? "d" : "q",
    x: i % 4 === 3 ? "Carte à deux " + id + " " + i + "." : (i % 4 === 1 ? "Défi " : "Question ") + id + " " + i + " : {o}, l'idée {de_o}, mieux {que_o} ?",
    near: i % 5 === 2
  })) });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.cartes = { decks: [mk("leger", "Léger"), mk("profond", "Profond"), mk("coquin", "Coquin", true)] };
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  return p;
}

const count = (p, s) => p.page.locator(s).count();
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:cartes")));
const posts = async (env) => (await env.ctl()).count.post;
const linked = (p) => until(() => count(p, '.g-top [data-net="ok"]'), 8000);
const focused = (p, s) => p.page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), s);
const outlined = (p) => p.page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0; });
/* Juste après un changement d'écran ou une carte piochée par l'autre, le jeu a le droit d'ignorer un toucher
   pendant une demi-seconde : un geste réfléchi (press) laisse passer ce délai, comme une personne qui lit l'écran. */
const settle = () => sleep(650);
const press = async (p, s) => { await settle(); await p.page.click(s); };
const decksOf = (p) => p.page.evaluate(() => window.GAME_DATA.cartes.decks.map((d) => ({ id: d.id, cards: d.cards.map((c) => ({ t: c.t, x: c.x.replace(/\u00a0/g, " "), near: !!c.near })) })));
const cardsOf = (decks, id, far) => decks.find((d) => d.id === id).cards.filter((c) => !(far && c.near));

/* Ce que le téléphone affiche (carte, paquets, fin, vide, hors-jeu) et ce qu'il a enregistré. */
const look = (p) => p.page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\u00a0/g, " ").trim() : "");
  const root = document.querySelector("main.game .cartes"), c = root && root.querySelector(".cartes-card");
  let s = null;
  try { s = JSON.parse(localStorage.getItem("en:g:cartes")); } catch (e) { /* partie illisible */ }
  const o = {
    screen: !document.querySelector("main.game") ? "hors-jeu" : !root ? "panne" : c ? "carte" : root.getAttribute("data-screen"),
    gen: s ? s.gen : 0, deck: s ? String(s.setup.deck) : "", shi: s ? s.sh.i : null, armed: !!document.querySelector("[data-armed]")
  };
  if (c) {
    Object.assign(o, {
      i: Number(c.getAttribute("data-i")), n: Number(txt(root.querySelector(".cartes-count [aria-hidden]")).replace(/ /g, "").split("/")[1]), t: c.getAttribute("data-t"),
      w: c.classList.contains("a") ? "a" : c.classList.contains("b") ? "b" : "", me: c.classList.contains("me"), text: txt(c.querySelector(".cartes-text")), whose: txt(c.querySelector(".cartes-for"))
    });
  }
  return o;
});
const say = (s) => (s.screen === "carte" ? "carte " + (s.i + 1) + " sur " + s.n : "écran « " + s.screen + " »") + ", paquet " + s.deck + ", manche " + s.gen;
const is = (p, screen, ms) => until(async () => (await look(p)).screen === screen, ms);
/* Les deux téléphones montrent la même carte de la même manche (celle de rang i, s'il est donné). */
const same = (a, b, i, ms) => until(async () => {
  const u = await look(a), v = await look(b);
  return u.screen === "carte" && v.screen === "carte" && u.gen === v.gen && u.i === v.i && u.text === v.text && (i == null || u.i === i);
}, ms);
/* Pareil, mais une égalité de passage ne compte pas : elle doit tenir. */
async function agreed(a, b, ms) {
  if (!await same(a, b, null, ms)) return false;
  await sleep(900);
  return same(a, b, null, 3000);
}
/* L'écran de jeu est debout : pas de panne, aucune balise injectée, aucun script exécuté, aucune erreur. */
const healthy = async (p) => !p.errors.length && await p.page.evaluate(() => !!document.querySelector("main.game .cartes") && !document.querySelector("#app img, #app script, #app iframe") && window.__xss === undefined);

async function intro(p, env, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-cartes");
  await p.page.fill("#name-a", o.a != null ? o.a : "Tom");
  await p.page.fill("#name-b", o.b != null ? o.b : "Inès");
  await p.page.click('[data-act="g-opt"][data-val="' + (o.deck || "leger") + '"]');
  await p.page.click('[data-act="g-opt"][data-val="' + (o.lieu || "ensemble") + '"]');
}
async function solo(p, env, o) {
  await intro(p, env, o);
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector(".cartes-card");
}
/* Crée une partie à deux téléphones et renvoie le lien d'invitation ; o.go : commencer sans attendre l'invité. */
async function host(p, env, o) {
  await intro(p, env, o);
  await p.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await p.page.locator(".share[data-url]").getAttribute("data-url");
  if (o && o.go) { await p.page.evaluate(() => document.querySelector('[data-act="g-go"]').click()); await p.page.waitForSelector(".cartes-card"); }
  return link;
}
async function join(p, link) {
  await p.page.goto(link);
  await p.page.click('[data-act="g-join"]');
  await p.page.waitForSelector("main.game");
}
/* Deux téléphones reliés, devant la première carte. o : prénoms et réglages (voir intro), o.phone : options des deux téléphones. */
async function duo(env, tag, o) {
  o = o || {};
  const a = await phone(env, "a-" + tag, o.phone), b = await phone(env, "b-" + tag, o.phone);
  const link = await host(a, env, o);
  await join(b, link);
  await Promise.all([a.page.waitForSelector(".cartes-card"), b.page.waitForSelector(".cartes-card")]);
  await linked(a);
  await linked(b);
  await until(async () => await count(a, ".g-wait") + await count(b, ".g-wait") === 0);
  await settle();
  return { a, b, link };
}

const middle = async (p, s) => { const box = await p.page.locator(s).first().boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
/* Amène la pile à la carte de rang i, un toucher par carte, d'une traite (depuis l'écran de fin aussi). */
async function jump(p, i) {
  await settle();
  if (await count(p, '.cartes-end .g-actions [data-act="prev"]')) { await p.page.click('.cartes-end .g-actions [data-act="prev"]'); await settle(); }
  await p.page.evaluate((i) => {
    for (let k = 0; k < 400; k++) {
      const c = document.querySelector(".cartes-card"), at = c ? Number(c.getAttribute("data-i")) : i;
      if (at === i) return;
      document.querySelector(at < i ? '[data-act="next"]' : '.g-actions [data-act="prev"]').click();
    }
  }, i);
}
/* Amène ce téléphone à l'écran de fin du paquet en cours, et l'y laisse un instant. */
async function toEnd(p) {
  let s = await look(p);
  if (s.screen === "paquets") { await press(p, BACK); s = await look(p); }
  if (s.screen === "carte") { await jump(p, s.n - 1); await p.page.click(NEXT); }
  await p.page.waitForSelector('.cartes[data-screen="fin"]');
  await settle();
}
/* Plusieurs touchers de suite au même endroit, comme un doigt impatient : les suivants tombent
   sur ce qui s'affiche à cet endroit après le premier. Avec follow, le doigt suit le bouton s'il se déplace ;
   gap : le temps entre deux touchers, en millisecondes. */
async function rapid(p, selector, n, follow, gap) {
  await settle();
  /* Un paquet à demi caché sous la rangée du bas est d'abord amené au milieu de l'écran, comme le ferait un pouce. */
  await p.page.evaluate((s) => { const el = document.querySelector(s); if (!el.closest(".g-actions")) el.scrollIntoView({ block: "center" }); }, selector);
  let at = await middle(p, selector);
  for (let i = 0; i < n; i++) {
    if (follow && i) at = await middle(p, selector);
    await p.page.touchscreen.tap(at[0], at[1]);
    await sleep(gap || 120);
  }
  await sleep(200);
}
/* De vrais doigts sur l'écran : set() donne les points de contact du moment (un de plus : un doigt se pose), lift() les lève tous. */
async function fingers(p) {
  const cdp = await p.ctx.newCDPSession(p.page);
  let n = 0;
  return {
    async set(pts) {
      await cdp.send("Input.dispatchTouchEvent", { type: pts.length > n ? "touchStart" : "touchMove", touchPoints: pts.map((q, id) => ({ x: q[0], y: q[1], id })) });
      n = pts.length;
    },
    async lift() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await sleep(150);
    }
  };
}
/* Glisse un doigt sur la carte, de dx pixels. */
async function swipe(p, dx) {
  const [cx, cy] = await middle(p, ".cartes-card"), f = await fingers(p);
  for (let k = 0; k <= 5; k++) await f.set([[cx - dx / 2 + (dx * k) / 5, cy + k]]);
  await f.lift();
}
/* Clavier seul : on tabule jusqu'à l'élément voulu. Renvoie le nombre d'appuis, -1 si on ne l'atteint pas. */
async function tabTo(p, selector, max, key) {
  for (let i = 1; i <= (max || 30); i++) {
    await p.page.keyboard.press(key || "Tab");
    if (await focused(p, selector)) return i;
  }
  return -1;
}
/* Le pirate modifie sa partie enregistrée puis recharge : le socle redépose alors cet état sur le relais.
   h : ce qui change dans l'en-tête (manche, réglages, état commun, compteur) ; d : sa tranche. */
async function forge(p, h, d) {
  await p.page.evaluate((x) => {
    const s = JSON.parse(localStorage.getItem("en:g:cartes")), now = Date.now();
    if (x.h) { Object.assign(s, x.h); if (!("st" in x.h)) s.st += 1; s.sw = s.me; s.seq[s.me].h = now; }
    if (x.d) { s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d: x.d }; s.seq[s.me].d = now; }
    localStorage.setItem("en:g:cartes", JSON.stringify(s));
  }, { h, d });
  await p.page.reload();
  await p.page.waitForSelector("main.game");
}
const token = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* Parcourt le paquet dans la page, de la carte affichée jusqu'à la fin (ou jusqu'à la première carte
   si back), et mesure chaque carte : ce qui dépasse, ce qui se chevauche, ce qui est trop petit. */
const survey = async (p, back) => { await settle(); return p.page.evaluate((back) => {
  const out = [], doc = document.documentElement, clean = (el) => el.textContent.replace(/\u00a0/g, " ").trim(), box = (el) => el.getBoundingClientRect();
  /* La hauteur de la zone de toucher d'un bouton : sa boîte, ou son ::after quand la zone déborde autour du mot (« changer »). */
  const tall = (el) => Math.max(box(el).height, parseFloat(getComputedStyle(el, "::after").height) || 0);
  for (let k = 0; k < 400; k++) {
    const c = document.querySelector(".cartes-card");
    if (!c) break;
    const text = c.querySelector(".cartes-text"), next = document.querySelector('[data-act="next"]');
    const cb = box(c), tb = box(text), hb = box(c.querySelector(".cartes-head")), nb = box(next), sb = box(document.querySelector('.g-foot [data-act="g-stop"]'));
    out.push({
      next: [nb.left, nb.top, nb.right, nb.bottom].map(Math.round), stop: [sb.left, sb.top, sb.right, sb.bottom].map(Math.round),
      i: Number(c.getAttribute("data-i")), t: c.getAttribute("data-t"), w: c.classList.contains("a") ? "a" : c.classList.contains("b") ? "b" : "", me: c.classList.contains("me"),
      text: clean(text), raw: text.textContent + " | " + c.querySelector(".cartes-for").textContent, whose: clean(c.querySelector(".cartes-for")), tag: clean(c.querySelector(".g-tag")),
      wide: doc.scrollWidth > doc.clientWidth + 1 || c.scrollWidth > c.clientWidth + 1,
      spill: tb.left < cb.left - 1 || tb.right > cb.right + 1 || tb.bottom > cb.bottom + 1 || hb.right > cb.right + 1 || hb.bottom > tb.top + 1,
      low: nb.top < 0 || nb.bottom > window.innerHeight + 1, tall: cb.bottom > window.innerHeight + 1, font: parseFloat(getComputedStyle(text).fontSize),
      under: tb.bottom > box(next.parentNode).top + 1,
      small: Array.from(document.querySelectorAll(".cartes button")).map((el) => Math.round(tall(el))).filter((h) => h > 0 && h < 44).length
    });
    const btn = back ? document.querySelector('.g-actions [data-act="prev"]') : next;
    if (btn.disabled) break;
    btn.click();
    if (document.querySelector(".cartes-card") === c) break; /* le toucher n'a rien fait : inutile d'insister */
  }
  return out;
}, !!back); };
/* Le texte attendu d'une carte, selon la personne à qui elle s'adresse : il parle de l'autre. */
const elide = (word, n) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? word.slice(0, -1) + "'" : word + " ") + n;
const filled = (x, o) => x.replace(/\{(o|de_o|que_o)\}/g, (m, k) => (k === "o" ? o : elide(k === "de_o" ? "de" : "que", o)));
/* Ce qui cloche dans un parcours : carte étrangère au paquet, en double, mal remplie, mal étiquetée, ou pour la mauvaise personne. */
function wrong(seen, cards, names) {
  const want = new Map(), used = new Set(), out = [], solo = seen.filter((s) => s.t !== "2");
  cards.forEach((c, k) => (c.t === "2" ? [""] : ["a", "b"]).forEach((w) => want.set(c.t + "|" + w + "|" + (w ? filled(c.x, names[w === "a" ? "b" : "a"]) : c.x), k)));
  seen.forEach((s, k) => {
    const id = want.get(s.t + "|" + s.w + "|" + s.text);
    if (s.i !== k) out.push("rang " + s.i + " à la place " + k);
    if (id == null) out.push("carte " + (k + 1) + " inattendue : « " + s.text + " »");
    else if (used.has(id)) out.push("carte " + (k + 1) + " en double");
    used.add(id);
    if (/[{}]/.test(s.text) || / [?!:;%»]|« /.test(s.raw)) out.push("carte " + (k + 1) + " mal composée : « " + s.raw + " »");
    if (s.tag !== KINDS[s.t]) out.push("carte " + (k + 1) + " étiquetée « " + s.tag + " »");
  });
  solo.forEach((s, k) => { if (k && s.w === solo[k - 1].w) out.push("deux cartes de suite pour la même personne (carte " + (s.i + 1) + ")"); });
  return out;
}
const few = (list) => (list.length ? " : " + list.slice(0, 3).join(" ; ") + (list.length > 3 ? " ; et " + (list.length - 3) + " de plus" : "") : "");
/* Les défauts de mise en page relevés par survey, en clair. */
const layout = (seen) => ["wide", "spill", "low", "under", "small"].map((k) => [k, seen.filter((s) => s[k]).map((s) => s.i + 1)]).filter((x) => x[1].length)
  .map((x) => ({ wide: "défilement de côté", spill: "texte qui sort de la carte ou chevauche son en-tête", low: "« Carte suivante » hors de l'écran", under: "texte caché sous les boutons", small: "bouton de moins de 44 px" }[x[0]] + " (cartes " + x[1].slice(0, 5).join(", ") + ")"));

/* Impose la seed et le paquet de la manche, comme si le hasard les avait tirés, puis mesure toute la pile. */
async function deal(p, seed, deck) {
  await p.page.evaluate((o) => {
    const s = JSON.parse(localStorage.getItem("en:g:cartes"));
    s.setup = Object.assign({}, s.setup, o);
    s.sh = {};
    localStorage.setItem("en:g:cartes", JSON.stringify(s));
  }, { seed, deck });
  await p.page.reload();
  await p.page.waitForSelector(".cartes-card");
  return survey(p);
}

/* De combien de pixels la page dépasse de l'écran, en largeur. */
const excess = (p) => p.page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));

const SCENARIOS = [];
const scenario = (name, fn) => SCENARIOS.push({ name, fn });

/* ====================================================================== Un seul téléphone */

scenario("Un téléphone : recharger, quitter et revenir à chaque étape", async (env) => {
  const p = await phone(env, "etapes");
  await solo(p, env, { deck: "profond" });
  const first = await look(p), n = first.n;
  await p.page.reload();
  await p.page.waitForSelector(".cartes-card");
  let s = await look(p);
  check(s.i === 0 && s.text === first.text && s.gen === 1, "rechargement sur la première carte : la même carte");
  await jump(p, 3);
  const fourth = await look(p);
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  check(await count(p, RESUME) === 1 && await count(p, 'a.card-state[href="#jeu-cartes"]') === 1, "à l'accueil, la partie en cours est proposée");
  await p.page.click(RESUME);
  await p.page.waitForSelector(".cartes-card");
  s = await look(p);
  check(s.i === 3 && s.text === fourth.text, "« Reprendre » depuis l'accueil : la quatrième carte est toujours là");
  await p.page.goBack();
  await p.page.waitForSelector(".banner");
  await p.page.goForward();
  await p.page.waitForSelector(".cartes-card");
  check((await look(p)).text === fourth.text, "bouton retour du navigateur puis avance : la même carte");
  await press(p, PICK);
  await p.page.click(HOME);
  await p.page.waitForSelector(".banner");
  await p.page.click(RESUME);
  check(await is(p, "paquets"), "choix du paquet ouvert, aller à l'accueil et revenir : le choix est toujours ouvert");
  await p.page.reload();
  await p.page.waitForSelector(".cartes-end");
  await p.page.click(BACK);
  s = await look(p);
  check(s.screen === "carte" && s.text === fourth.text, "« Revenir à la carte » après un rechargement : la même carte");
  await jump(p, n - 1);
  await p.page.reload();
  await p.page.waitForSelector(".cartes-card");
  const lastCard = await look(p);
  check(lastCard.i === n - 1, "rechargement sur la dernière carte : toujours la dernière");
  await p.page.click(NEXT);
  await p.page.click(HOME);
  await p.page.waitForSelector(OPEN);
  check(await count(p, ".banner") === 0, "paquet fini : l'accueil ne propose plus de reprendre");
  await p.page.click(OPEN);
  check(await is(p, "fin"), "revenir par la carte du jeu : l'écran de fin est toujours là, pas la présentation");
  await press(p, BACK);
  s = await look(p);
  check(s.screen === "carte" && s.i === n - 1 && s.text === lastCard.text, "« Revenir à la dernière carte » la retrouve");
  await p.page.click(HOME);
  check(await until(() => count(p, RESUME)), "revenu sur la dernière carte : l'accueil propose de nouveau de reprendre");
  await p.page.click(RESUME);
  await press(p, NEXT);
  await press(p, deckBtn("profond"));
  await p.page.reload();
  await p.page.waitForSelector(".cartes-card");
  s = await look(p);
  check(s.gen === 2 && s.i === 0 && s.n === n, "paquet rebattu puis rechargement : la première carte de la deuxième manche, une seule relance (" + say(s) + ")");
});

scenario("Un téléphone : touchers répétés sur chaque bouton, sur quatre tailles d'écran", async (env) => {
  for (const [size, viewport] of SIZES) {
    const p = await phone(env, "rafale-" + viewport.width + "-" + viewport.height, { viewport });
    await solo(p, env);
    await deal(p, 7, "leger");
    await jump(p, 0);
    const n = (await look(p)).n;
    /* Remet le téléphone dans une partie jouable si un toucher de trop l'en a sorti. */
    const mend = async () => {
      const s = await look(p);
      if (s.armed) await sleep(4200);
      if (s.screen === "hors-jeu") await solo(p, env);
    };
    await rapid(p, NEXT, 3, true);
    let s = await look(p);
    check(s.screen === "carte" && s.i === 3 && s.gen === 1, size + " : trois touchers sur « Carte suivante » : trois cartes plus loin, pas une de plus (" + say(s) + ")");
    await jump(p, 2);
    await rapid(p, PREV, 4, true);
    s = await look(p);
    check(s.screen === "carte" && s.i === 0 && s.gen === 1, size + " : quatre touchers sur « Précédente » depuis la troisième carte : la première carte, rien d'autre (" + say(s) + ")");
    await jump(p, 5);
    await rapid(p, PICK, 2);
    s = await look(p);
    check(s.gen === 1 && s.shi === 5 && !s.armed, size + " : deux touchers sur « changer » : ni paquet relancé ni carte piochée (" + say(s) + ")");
    if (s.screen !== "paquets") await press(p, PICK);
    await rapid(p, BACK, 2);
    s = await look(p);
    check(s.screen === "carte" && s.i === 5 && s.gen === 1 && !s.armed, size + " : deux touchers sur « Revenir à la carte » : la même carte (" + say(s) + ")");
    await mend();
    await toEnd(p);
    await rapid(p, BACK, 2);
    s = await look(p);
    check(s.screen === "carte" && s.i === n - 1 && s.gen === 1 && !s.armed, size + " : deux touchers sur « Revenir à la dernière carte » : la dernière carte (" + say(s) + ")");
    await mend();
    await jump(p, n - 1);
    /* Ce qu'il y a, sur un écran de choix, là où le pouce touchait « Précédente » et « Carte suivante ». */
    const spots = [await middle(p, PREV), await middle(p, NEXT)];
    const under = () => p.page.evaluate((spots) => spots.map((q) => { const el = document.elementFromPoint(q[0], q[1]); return !!el && !!el.closest(".cartes-end .g-actions") && !el.closest("[data-deck]"); }), spots);
    await rapid(p, NEXT, 2);
    s = await look(p);
    check(s.screen === "fin" && s.gen === 1, size + " : deux touchers sur « Finir le paquet » : l'écran de fin, aucun paquet relancé (" + say(s) + ")");
    const atEnd = await under();
    await press(p, BACK);
    await press(p, PICK);
    const atPick = await under();
    check(atEnd.concat(atPick).every(Boolean) && await is(p, "paquets"), size + " : à la fin du paquet comme au changement de paquet, la rangée du bas reste à la place de « Précédente » et « Carte suivante » : jamais un paquet sous le pouce");
    await press(p, BACK);
    /* On passe les dernières cartes sans regarder, trois touchers par seconde, et on en fait trois de trop. */
    await mend();
    await jump(p, n - 3);
    await rapid(p, NEXT, 6, false, 300);
    s = await look(p);
    check(s.gen === 1 && (s.screen === "fin" || (s.screen === "carte" && s.i === n - 1)) && !s.armed, size + " : six touchers au même endroit, trois par seconde, sur les trois dernières cartes : le paquet se termine, aucun autre n'est lancé (" + say(s) + ")");
    const bad = [];
    for (const id of ["leger", "profond", "melange", "coquin"]) {
      await mend();
      await toEnd(p);
      const gen = (await look(p)).gen;
      await rapid(p, deckBtn(id), 2);
      s = await look(p);
      if (!(s.screen === "carte" && s.gen === gen + 1 && s.deck === id && s.i === 0 && !s.armed)) bad.push(id + " → " + say(s) + (s.armed ? ", « Arrêter la partie » armé" : ""));
    }
    check(!bad.length, size + " : deux touchers sur un paquet, à la fin : il s'ouvre une fois, sur sa première carte" + few(bad));
    await mend();
    await toEnd(p);
    await rapid(p, deckBtn("profond"), 3);
    s = await look(p);
    check(s.screen === "carte" && s.deck === "profond", size + " : trois touchers sur un paquet, à la fin : la partie est toujours là (" + say(s) + ")");
  }
});

scenario("Un téléphone : « Carte suivante » reste sous le pouce d'une carte à l'autre", async (env) => {
  /* 375 × 553 : un iPhone SE ou 8 dans Safari, barres du navigateur affichées. */
  const short = { width: 375, height: 553 }, tiny = { width: 320, height: 568 };
  /* D'une carte à la suivante, le milieu de « Carte suivante » tombe-t-il encore sur le bouton, ou sur « Arrêter la partie » ? */
  const drift = (seen) => {
    const o = { miss: 0, stop: 0, span: Math.max(...seen.map((s) => s.next[1])) - Math.min(...seen.map((s) => s.next[1])) };
    for (let k = 0; k + 1 < seen.length; k++) {
      const r = seen[k].next, x = (r[0] + r[2]) / 2, y = (r[1] + r[3]) / 2, inside = (q) => x >= q[0] && x <= q[2] && y >= q[1] && y <= q[3];
      if (!inside(seen[k + 1].next)) o.miss++;
      if (inside(seen[k + 1].stop)) o.stop++;
    }
    return o;
  };
  /* 320 × 454 : un petit iPhone, ou l'affichage agrandi, dans Safari. 740 × 340 : un téléphone couché. */
  for (const [size, viewport] of [SIZES[0], ["375 × 553", short], ["320 × 568", tiny], ["320 × 454", { width: 320, height: 454 }], ["740 × 340", { width: 740, height: 340 }]]) {
    const p = await phone(env, "pouce-" + viewport.width + "-" + viewport.height, { viewport });
    await solo(p, env, { a: "Maximilien-Alexandre", b: "Inès" });
    const seen = await deal(p, 7, "leger"), d = drift(seen), ugly = layout(seen);
    check(!d.miss && d.span <= 4, size + " : d'une carte à l'autre, « Carte suivante » reste au même endroit (le bouton bouge de " + d.span + " px ; " + d.miss + " cartes sur 59 où un toucher au même endroit le manque)");
    check(!ugly.length && seen.every((s) => s.stop[1] >= viewport.height), size + " : la carte entière tient au-dessus des boutons, et « Arrêter la partie » reste sous le bas de l'écran" + few(ugly));
  }
  const p = await phone(env, "pouce-reel", { viewport: short });
  await solo(p, env);
  await deal(p, 7, "leger");
  await jump(p, 0);
  const [x, y] = await middle(p, NEXT);
  for (let k = 0; k < 20; k++) { await p.page.touchscreen.tap(x, y); await sleep(250); }
  let s = await look(p);
  check(s.screen === "carte" && s.i === 20, "375 × 553 : vingt touchers au même endroit, sans se presser, piochent vingt cartes (" + say(s) + ")");
  const q = await phone(env, "pouce-long", { viewport: tiny });
  await solo(q, env, { a: "Maximilien-Alexandre", b: "Marie-Antoinette-Lou" });
  const d = drift(await deal(q, 7, "leger"));
  check(!d.stop, "320 × 568, prénoms de vingt lettres : « Arrêter la partie » ne vient jamais se placer là où était « Carte suivante » (" + d.stop + " cartes sur 59, le bouton bouge de " + d.span + " px)");
});

scenario("Un téléphone : deux doigts sur la carte", async (env) => {
  const p = await phone(env, "doigts");
  await solo(p, env);
  await jump(p, 4);
  const [cx, cy] = await middle(p, ".cartes-card");
  let f = await fingers(p);
  await f.set([[cx - 110, cy]]);
  await f.set([[cx - 110, cy], [cx + 110, cy + 12]]);
  await f.lift();
  let s = await look(p);
  check(s.i === 4, "deux doigts posés côte à côte sur la carte puis levés, sans glisser : la carte ne change pas (" + say(s) + ")");
  await jump(p, 4);
  f = await fingers(p);
  await f.set([[cx - 25, cy]]);
  await f.set([[cx - 25, cy], [cx + 25, cy]]);
  for (let k = 1; k <= 4; k++) await f.set([[cx - 25 - 22 * k, cy], [cx + 25 + 22 * k, cy]]);
  await f.lift();
  s = await look(p);
  check(s.i === 4, "écarter deux doigts sur la carte, comme pour agrandir le texte : la carte ne change pas (" + say(s) + ")");
  await jump(p, 4);
  await swipe(p, -140);
  check((await look(p)).i === 5, "un seul doigt glissé vers la gauche pioche toujours la carte suivante");
  await swipe(p, 140);
  check((await look(p)).i === 4, "et vers la droite, revient d'une carte");
  check(/pinch-zoom/.test(await p.page.evaluate(() => getComputedStyle(document.querySelector(".cartes-card")).touchAction)), "le navigateur garde le zoom à deux doigts sur la carte");
  /* « changer » : un mot de la taille de la ligne, avec une zone de toucher qui déborde autour de lui. */
  const [px, py] = await middle(p, PICK), word = await p.page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().height), PICK);
  await settle();
  await p.page.touchscreen.tap(px, py - 19);
  check(word < 24 && await is(p, "paquets", 2000), "un toucher 19 px au-dessus du mot « changer » (" + word + " px de haut) ouvre encore le choix d'un paquet");
});

scenario("Un téléphone : toute la partie au clavier", async (env) => {
  const p = await phone(env, "clavier", DESKTOP);
  await p.page.goto(env.base + "#jeu-cartes");
  const picked = await tabTo(p, '[data-act="g-opt"][data-val="profond"]') > 0;
  await p.page.keyboard.press("Enter");
  await tabTo(p, "#name-a");
  await p.page.keyboard.type("Tom");
  await p.page.keyboard.press("Tab");
  await p.page.keyboard.type("Inès");
  await tabTo(p, '[data-act="g-start"][data-mode="solo"]');
  await p.page.keyboard.press("Enter");
  let s = await look(p);
  check(picked && s.screen === "carte" && s.deck === "profond" && await focused(p, TEXT), "au clavier : choisir le paquet, saisir les prénoms, lancer la partie ; le focus arrive sur la carte");
  for (const k of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowLeft"]) await p.page.keyboard.press(k);
  s = await look(p);
  check(s.i === 2 && await focused(p, TEXT), "trois flèches à droite, une à gauche : la troisième carte, le focus toujours sur la carte (" + say(s) + ")");
  for (let k = 0; k < 6; k++) await p.page.keyboard.down("ArrowRight");
  await p.page.keyboard.up("ArrowRight");
  s = await look(p);
  check(s.i === 3, "flèche droite maintenue enfoncée : une seule carte piochée (" + say(s) + ")");
  for (const k of ["Control+ArrowRight", "Alt+ArrowRight", "Meta+ArrowRight"]) await p.page.keyboard.press(k);
  s = await look(p);
  check(s.screen === "carte" && s.i === 3, "avec Ctrl, Alt ou Cmd, la flèche ne pioche pas (" + say(s) + ")");
  let tabs = await tabTo(p, NEXT, 6), ring = await outlined(p);
  await p.page.keyboard.press("Enter");
  s = await look(p);
  check(tabs > 0 && tabs <= 3 && ring && s.i === 4 && await focused(p, TEXT), "« Carte suivante » s'atteint en trois tabulations au plus, avec un focus visible ; Entrée pioche et rend le focus à la carte (" + tabs + " tabulations)");
  await tabTo(p, NEXT, 6);
  await p.page.keyboard.press("Space");
  check((await look(p)).i === 5, "la barre d'espace sur « Carte suivante » pioche aussi");
  tabs = await tabTo(p, PICK, 4, "Shift+Tab");
  ring = await outlined(p);
  /* Le contour suit la boîte du bouton : elle doit rester celle du mot, sans traverser le nom du paquet ni toucher la carte. */
  const word = await p.page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(), c = document.querySelector(".cartes-stack").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), gap: Math.round(c.top - r.bottom) }; });
  check(word.h < 24 && word.w < 90 && word.gap >= 8, "le contour du focus de « changer » reste au bord du mot, à distance de la carte (" + word.w + " × " + word.h + " px, " + word.gap + " px au-dessus de la carte)");
  await p.page.keyboard.press("Enter");
  check(tabs > 0 && ring && await is(p, "paquets") && await focused(p, ".g-title"), "« changer » s'atteint en remontant d'une tabulation ou deux, avec un focus visible, et ouvre le choix d'un paquet");
  await p.page.keyboard.press("ArrowRight");
  await p.page.keyboard.press("ArrowLeft");
  s = await look(p);
  check(s.screen === "paquets" && s.shi === 5, "pendant le choix d'un paquet, les flèches ne déplacent pas la pile");
  tabs = await tabTo(p, deckBtn("leger"), 8);
  ring = await outlined(p);
  await settle();
  await p.page.keyboard.press("Enter");
  s = await look(p);
  check(tabs > 0 && ring && s.screen === "carte" && s.gen === 2 && s.deck === "leger" && s.i === 0 && await focused(p, TEXT), "choisir un paquet au clavier : sa première carte s'ouvre, le focus dessus (" + say(s) + ")");
  await settle();
  for (let k = 0; k < s.n; k++) await p.page.keyboard.press("ArrowRight");
  await settle();
  for (let k = 0; k < 3; k++) await p.page.keyboard.press("ArrowRight");
  s = await look(p);
  check(s.screen === "fin" && s.gen === 2, "flèche droite jusqu'au bout du paquet, et trois fois de plus : l'écran de fin, rien de relancé (" + say(s) + ")");
  await p.page.keyboard.press("ArrowLeft");
  s = await look(p);
  check(s.screen === "carte" && s.i === s.n - 1, "flèche gauche depuis l'écran de fin : la dernière carte");
  await settle();
  await p.page.keyboard.press("ArrowRight");
  tabs = await tabTo(p, deckBtn("melange"), 8);
  await settle();
  await p.page.keyboard.press("Enter");
  s = await look(p);
  check(tabs > 0 && s.screen === "carte" && s.gen === 3 && s.deck === "melange" && s.i === 0, "à la fin, choisir le mélange au clavier ouvre sa première carte (" + say(s) + ")");
});

scenario("Un téléphone : prénoms extrêmes, petit et grand écran", async (env) => {
  const names = { a: "O'Brien <b>&\"é\"", b: "W".repeat(20) };
  const p = await phone(env, "petit", { viewport: { width: 320, height: 568 } });
  await solo(p, env, Object.assign({ deck: "leger" }, names));
  const decks = await decksOf(p);
  for (const id of ["leger", "profond", "coquin"]) {
    if ((await look(p)).deck !== id) { await toEnd(p); await p.page.click(deckBtn(id)); }
    const seen = await survey(p), cards = cardsOf(decks, id), bad = wrong(seen, cards, names), ugly = layout(seen);
    check(seen.length === cards.length && !bad.length, "320 × 568, paquet " + id + " : chaque carte s'affiche une fois, avec le prénom de l'autre à sa place, apostrophe, balise et élision comprises (" + seen.length + " cartes)" + few(bad));
    check(!ugly.length && seen.every((s) => s.font >= 20), "320 × 568, paquet " + id + " : avec un prénom de vingt lettres, rien ne dépasse, rien ne se chevauche, texte d'au moins 20 px" + few(ugly));
    check(seen.every((s) => s.whose === (s.w ? "Pour " + names[s.w] : "Pour vous deux")) && await healthy(p), "320 × 568, paquet " + id + " : chaque carte dit pour qui elle est, sans rien exécuter");
  }
  const end = () => p.page.evaluate(() => ({
    wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    small: Array.from(document.querySelectorAll(".cartes button")).filter((el) => el.getBoundingClientRect().height < 44).length,
    typo: / [?!:;%»]|« /.test(document.querySelector(".cartes").textContent)
  }));
  let e = await end();
  check(await is(p, "fin") && !e.wide && !e.small && !e.typo, "320 × 568 : l'écran de fin tient dans la largeur, avec des boutons d'au moins 44 px et des espaces insécables avant la ponctuation");
  await press(p, BACK);
  await press(p, PICK);
  e = await end();
  check(await is(p, "paquets") && !e.wide && !e.small && !e.typo, "320 × 568 : le choix d'un paquet en cours de route aussi");
  await press(p, BACK);
  await press(p, PREV);
  check((await p.page.evaluate(() => getComputedStyle(document.querySelector(".cartes-card")).animationName)) === "none", "avec « réduire les animations », la carte change sans animation");

  const m = await phone(env, "mouvement", { viewport: { width: 320, height: 568 }, motion: true });
  await solo(m, env, names);
  const anim = () => m.page.evaluate(() => ({ name: getComputedStyle(document.querySelector(".cartes-card")).animationName, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
  await m.page.click(NEXT);
  const moving = await anim();
  check(moving.name === "cartes-in" && !moving.wide, "avec les animations, la carte piochée glisse en place sans faire défiler la page de côté");

  const w = await phone(env, "grand", DESKTOP);
  await solo(w, env, { a: "", b: "" });
  const seen = await survey(w), blank = { a: "Partenaire 1", b: "Partenaire 2" }, bad = wrong(seen, cardsOf(decks, "leger"), blank), ugly = layout(seen);
  check(!bad.length && seen.every((s) => s.whose === (s.w ? "Pour " + blank[s.w] : "Pour vous deux")), "1280 × 800, sans prénoms : les cartes parlent de « Partenaire 1 » et « Partenaire 2 »" + few(bad));
  check(!ugly.length && seen.every((s) => !s.tall), "1280 × 800 : la carte et « Carte suivante » tiennent à l'écran sans défiler" + few(ugly));
});

scenario("Un téléphone : qui commence, et ce que contient chaque paquet", async (env) => {
  const p = await phone(env, "pile");
  await solo(p, env, { lieu: "distance" });
  const decks = await decksOf(p), names = { a: "Tom", b: "Inès" }, size = (id) => cardsOf(decks, id).length;
  const bad = [], starts = { 0: new Set(), 1: new Set() }, orders = new Set();
  for (const seed of [2, 7, 1000, 4294967295]) {
    for (const id of ["leger", "profond", "coquin", "melange"]) {
      const seen = await deal(p, seed, id), mix = id === "melange";
      const cards = mix ? cardsOf(decks, "leger").concat(cardsOf(decks, "profond")) : cardsOf(decks, id);
      const want = mix ? Math.ceil(size("leger") / 2) + Math.ceil(size("profond") / 2) : size(id);
      const err = wrong(seen, cards, names);
      if (seen.length !== want) err.push(seen.length + " cartes au lieu de " + want);
      if (mix && seen.filter((s) => cardsOf(decks, "leger").some((c) => (c.t === "2" ? c.x : filled(c.x, names[s.w === "a" ? "b" : "a"])) === s.text)).length !== Math.ceil(size("leger") / 2)) err.push("le mélange ne prend pas la moitié du paquet léger");
      if (err.length) bad.push("seed " + seed + ", " + id + few(err));
      starts[seed % 2].add((seen.find((s) => s.w) || {}).w);
      orders.add(id + ":" + seen.map((s) => s.text).join("|"));
    }
  }
  check(!bad.length, "quatre tirages de chaque paquet : toutes ses cartes, une fois chacune, en alternant, même « à distance » sur un seul téléphone ; le mélange prend la moitié de chacun, rien du paquet pour adultes" + few(bad));
  check(starts[0].size === 1 && starts[1].size === 1 && starts[0].has("a") && starts[1].has("b"), "la personne qui commence dépend du tirage : Tom pour une seed paire, Inès pour une seed impaire");
  check(orders.size === 16, "chaque tirage donne un ordre différent");
  const again = await deal(p, 7, "leger"), once = await deal(p, 7, "leger");
  check(again.map((s) => s.text + s.w).join("|") === once.map((s) => s.text + s.w).join("|"), "le même tirage redonne exactement la même pile");
});

scenario("Un téléphone : page intégrée et fichier local", async (env) => {
  const f = await phone(env, "cadre");
  await f.page.setContent('<iframe src="' + env.base + '#jeu-cartes" style="width:380px;height:800px;border:0"></iframe>');
  const fr = f.page.frameLocator("iframe"), far = /chacun le vôtre|à distance/i;
  await fr.locator('[data-act="g-start"][data-mode="solo"]').waitFor();
  check(await fr.locator('[data-act="g-opt"][data-opt="lieu"]').count() === 0 && await fr.locator('[data-act="g-opt"][data-opt="deck"]').count() === 4 && !far.test((await fr.locator("main.intro > p").allTextContents()).join(" ")),
    "dans une page intégrée, la présentation ne propose ni ne promet de jouer à distance : seul le paquet se choisit");
  await fr.locator('[data-act="g-start"][data-mode="solo"]').click();
  await fr.locator(NEXT).click();
  check(await until(async () => await fr.locator(".cartes-card").getAttribute("data-i") === "1") && await fr.locator('[data-act="g-start"][data-mode="duo"]').count() === 0, "dans une page intégrée, on pioche sur un seul téléphone");
  const l = await phone(env, "fichier");
  await l.page.goto(pathToFileURL(path.join(ROOT, "index.html")).href + "#jeu-cartes");
  await l.page.waitForSelector('[data-act="g-start"][data-mode="solo"]');
  check(await count(l, '[data-act="g-opt"][data-opt="lieu"]') === 0 && !far.test((await l.page.locator("main.intro > p").allTextContents()).join(" ")), "ouvert comme un fichier, la présentation non plus");
  await l.page.click('[data-act="g-start"][data-mode="solo"]');
  await l.page.click(NEXT);
  await l.page.reload();
  check(await until(async () => (await look(l)).i === 1) && await count(l, ".g-net") === 0, "ouvert comme un fichier (file://), on pioche, et la carte survit à un rechargement");
  const w = await phone(env, "site");
  await w.page.goto(env.base + "#jeu-cartes");
  check(await count(w, '[data-act="g-opt"][data-opt="lieu"]') === 2 && far.test((await w.page.locator("main.intro > p").allTextContents()).join(" ")) && await count(w, '[data-act="g-start"][data-mode="duo"]') === 1,
    "sur le site, la présentation propose bien de jouer chacun sur son téléphone, côte à côte ou à distance");
});

/* ====================================================================== Deux téléphones */

scenario("Deux téléphones : l'invité arrive après que l'hôte a pioché, changé de paquet ou fini le paquet", async (env) => {
  const a = await phone(env, "a-tard"), b = await phone(env, "b-tard");
  let link = await host(a, env, { lieu: "distance", go: true });
  for (let k = 0; k < 4; k++) { await a.page.click(NEXT); await sleep(200); }
  await sleep(700);
  const p0 = await posts(env);
  await join(b, link);
  check(await same(a, b, 4) && await until(async () => await count(a, ".g-wait") + await count(b, ".g-wait") === 0), "l'invité arrive quand l'hôte en est à la cinquième carte : il la voit aussi, et plus personne n'attend");
  await sleep(800);
  check(await posts(env) - p0 === 1, "son arrivée coûte un seul message (" + (await posts(env) - p0) + ")");
  await b.page.click(NEXT);
  check(await same(a, b, 5), "et il pioche la suivante pour les deux");

  const c = await phone(env, "c-tard"), d = await phone(env, "d-tard");
  link = await host(c, env, { go: true });
  await c.page.click(NEXT);
  await press(c, PICK);
  await press(c, deckBtn("profond"));
  await press(c, NEXT);
  await sleep(700);
  await join(d, link);
  let s = await look(d);
  check(await same(c, d, 1) && (s = await look(d)).deck === "profond" && s.gen === 2, "l'hôte a changé de paquet avant l'arrivée de l'invité, qui ouvre l'ancien lien : l'invité reçoit le nouveau paquet, à la bonne carte (" + say(s) + ")");

  const e = await phone(env, "e-tard", { viewport: { width: 320, height: 568 } }), f = await phone(env, "f-tard");
  link = await host(e, env, { go: true, a: "O'Brien <b>&\"é\"", b: "W".repeat(20) });
  const wide = await excess(e), low = await e.page.evaluate(() => document.querySelector('[data-act="next"]').getBoundingClientRect().bottom > window.innerHeight + 1);
  check(!wide && !low && await count(e, ".g-wait") === 1 && await healthy(e), "320 × 568, l'hôte joue en attendant un invité au prénom de vingt lettres : rien ne dépasse, « Carte suivante » reste à l'écran (" + wide + " px de trop en largeur)");
  await toEnd(e);
  await sleep(700);
  await join(f, link);
  check(await is(f, "fin") && await healthy(f), "l'hôte a fini le paquet avant l'arrivée de l'invité : l'invité voit l'écran de fin");
  await press(f, deckBtn("melange"));
  check(await same(e, f, 0) && (await look(e)).deck === "melange", "et le paquet qu'il choisit s'ouvre des deux côtés");
});

scenario("Deux téléphones : le rappel de l'invitation, en attendant l'invité, sur un écran de 390 × 664", async (env) => {
  const a = await phone(env, "a-rappel", { viewport: SIZES[1][1] });
  /* Le QR code vient d'un script que les essais ne chargent pas : un faux de la même taille le remplace. */
  await a.ctx.addInitScript(() => { window.qrcode = window.qrcode || (() => ({ addData() {}, make() {}, getModuleCount: () => 29, isDark: (r, c) => (r + c) % 2 === 0 })); });
  await host(a, env, { go: true });
  const at = () => a.page.evaluate(() => {
    const box = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
    const row = box(".cartes .g-actions"), qr = box(".g-wait .qr-box"), card = box(".cartes-card"), wait = box(".g-wait");
    return { row: Math.round(row.top), stuck: Math.round(row.bottom) === window.innerHeight, above: wait.bottom <= card.top, qr: qr && qr.height > 150 && qr.top >= 0 && qr.bottom <= row.top };
  });
  const closed = await at();
  check(closed.above && closed.stuck, "en attendant l'invité, l'attente s'affiche au-dessus de la carte, et les boutons restent en bas de l'écran");
  await a.page.click(".g-wait details.more > summary");
  const open = await at();
  check(open.qr && open.row === closed.row && open.stuck, "le rappel de l'invitation s'ouvre sans passer sous les boutons : le QR code est visible en entier, les boutons n'ont pas bougé");
  await a.page.click(NEXT);
  check((await look(a)).i === 1, "et l'on peut piocher en attendant");
});

scenario("Deux téléphones : rechargement à chaque carte, sur chaque téléphone", async (env) => {
  const { a, b } = await duo(env, "recharge", { lieu: "distance" });
  const p0 = await posts(env), lost = [];
  for (let k = 0; k < 6; k++) {
    const [x, y] = k % 2 ? [b, a] : [a, b];
    await x.page.click(NEXT);
    /* Une fois sur trois, celui qui vient de piocher recharge aussitôt, avant même que la carte soit partie. */
    if (k % 3 === 0) { await x.page.reload(); await x.page.waitForSelector(".cartes-card"); }
    if (!await same(a, b, k + 1)) lost.push("carte " + (k + 2) + " non reçue");
    await y.page.reload();
    await y.page.waitForSelector(".cartes-card");
    if (!await same(a, b, k + 1)) lost.push("carte " + (k + 2) + " perdue au rechargement");
    await settle();
  }
  check(!lost.length, "six cartes piochées à tour de rôle, un rechargement après chacune : toujours la même carte des deux côtés" + few(lost));
  const cost = await posts(env) - p0;
  check(cost <= 8, "six cartes et huit rechargements : un message par carte, les rechargements n'en coûtent pas (" + cost + " messages)");
  await toEnd(a);
  await is(b, "fin");
  await Promise.all([a.page.reload(), b.page.reload()]);
  check(await is(a, "fin") && await is(b, "fin"), "les deux rechargent sur l'écran de fin : il est toujours là");
  await press(a, deckBtn("profond"));
  await a.page.reload();
  check(await same(a, b, 0) && (await look(b)).gen === 2, "A choisit un paquet et recharge aussitôt : le nouveau paquet s'ouvre quand même des deux côtés");
});

scenario("Deux téléphones : quitter vers l'accueil et revenir", async (env) => {
  const { a, b } = await duo(env, "accueil", { lieu: "distance" });
  await a.page.click(NEXT);
  await same(a, b, 1);
  await settle();
  await a.page.click(HOME);
  await a.page.waitForSelector(".banner");
  for (let k = 0; k < 3; k++) { await b.page.click(NEXT); await sleep(450); }
  await a.page.click(RESUME);
  check(await same(a, b, 4), "A va à l'accueil, B pioche trois cartes, A revient : la carte où B en est");
  await settle();
  await a.page.click(NEXT);
  await a.page.click(HOME);
  check(await until(async () => (await look(b)).i === 5), "A pioche puis quitte aussitôt vers l'accueil : la carte arrive quand même chez B");
  await b.page.click(HOME);
  await b.page.waitForSelector(".banner");
  await a.page.click(RESUME);
  await b.page.click(RESUME);
  check(await same(a, b, 5), "les deux vont à l'accueil et reviennent : la même carte");
  await a.page.click(HOME);
  await settle();
  await toEnd(b);
  await a.page.click(RESUME);
  check(await is(a, "fin"), "B finit le paquet pendant que A est à l'accueil : A revient sur l'écran de fin");
  await a.page.click(HOME);
  await a.page.waitForSelector(OPEN);
  await press(b, deckBtn("profond"));
  await sleep(700);
  await a.page.click(OPEN);
  check(await same(a, b, 0) && (await look(a)).deck === "profond", "B lance un autre paquet pendant que A est à l'accueil : A revient sur sa première carte");
});

scenario("Deux téléphones : tout au même instant", async (env) => {
  const { a, b } = await duo(env, "instant", { lieu: "distance" });
  const tap = (p, s) => p.page.evaluate((s) => document.querySelector(s).click(), s), both = (sa, sb) => Promise.all([tap(a, sa), tap(b, sb)]);
  const n = (await look(a)).n, bad = [];
  for (let k = 1; k <= 10; k++) {
    await both(NEXT, NEXT);
    if (!await same(a, b, k)) bad.push("au toucher " + k + ", A : " + say(await look(a)) + " ; B : " + say(await look(b)));
    await settle();
  }
  check(!bad.length, "dix fois de suite, les deux touchent « Carte suivante » au même instant : une carte piochée à chaque fois, la même des deux côtés" + few(bad));
  let ok = true;
  for (let k = 0; k < 6; k++) {
    await (k % 2 ? both(PREV, NEXT) : both(NEXT, PREV));
    ok = await agreed(a, b) && ok;
    await settle();
  }
  check(ok, "six fois, l'un pioche et l'autre revient en arrière au même instant : les deux téléphones retombent sur la même carte");
  await jump(a, n - 1);
  await same(a, b, n - 1);
  await settle();
  await both(NEXT, NEXT);
  check(await is(a, "fin") && await is(b, "fin"), "les deux finissent le paquet au même instant : l'écran de fin des deux côtés");
  await settle();
  await both(deckBtn("profond"), deckBtn("melange"));
  const u = await look(a), v = await look(b);
  check(await agreed(a, b) && (await look(a)).deck === (await look(b)).deck && (await look(a)).gen === 2, "chacun choisit un paquet différent au même instant : les deux téléphones ouvrent le même (" + (await look(a)).deck + ")");
  check(u.screen === "carte" && v.screen === "carte", "et personne ne reste sur l'écran de fin");
  await settle();
  await b.page.click(NEXT);
  check(await same(a, b, 1), "puis la partie continue");
});

scenario("Deux téléphones : touchers répétés et toucher parti trop tard, sur un écran de 390 × 664", async (env) => {
  const { a, b } = await duo(env, "rafale", { lieu: "distance", phone: { viewport: SIZES[1][1] } });
  const n = (await look(a)).n, p0 = await posts(env);
  await rapid(a, NEXT, 3);
  check(await same(a, b, 3), "trois touchers sur « Carte suivante » chez A : trois cartes plus loin des deux côtés");
  await sleep(600);
  check(await posts(env) - p0 <= 3, "en trois messages au plus (" + (await posts(env) - p0) + ")");
  await jump(a, n - 1);
  await same(a, b, n - 1);
  await settle();
  await rapid(a, NEXT, 2);
  await sleep(1200);
  let u = await look(a), v = await look(b);
  check(u.screen === "fin" && v.screen === "fin" && u.gen === 1 && v.gen === 1, "deux touchers sur « Finir le paquet » chez A : l'écran de fin des deux côtés, aucun paquet relancé (A : " + say(u) + " ; B : " + say(v) + ")");

  /* B s'apprête à toucher « Carte suivante » ; A finit le paquet une fraction de seconde avant. */
  if (u.screen === "fin") { await press(a, BACK); await same(a, b, n - 1); } else { await jump(a, u.n - 1); await same(a, b, u.n - 1); }
  await settle();
  const gen = (await look(a)).gen, [x, y] = await middle(b, NEXT);
  await a.page.click(NEXT);
  await b.page.waitForSelector('.cartes[data-screen="fin"]');
  await b.page.touchscreen.tap(x, y);
  await sleep(1200);
  u = await look(a);
  v = await look(b);
  check(u.screen === "fin" && v.screen === "fin" && u.gen === gen, "A finit le paquet ; B touche « Carte suivante » un instant trop tard : l'écran de fin des deux côtés, aucun paquet relancé (A : " + say(u) + " ; B : " + say(v) + ")");
  /* Et si B touche encore le même endroit plus d'une seconde après, sans avoir regardé l'écran. */
  await b.page.touchscreen.tap(x, y);
  await sleep(1200);
  u = await look(a);
  v = await look(b);
  check(u.gen === gen && v.gen === gen && u.screen === v.screen && (u.screen === "fin" || (u.i === n - 1 && v.i === n - 1)),
    "B touche encore le même endroit une seconde plus tard, sans regarder : toujours aucun paquet relancé, au pire le retour à la dernière carte (A : " + say(u) + " ; B : " + say(v) + ")");

  /* B s'apprête à toucher un paquet ; A en choisit un autre une fraction de seconde avant. */
  await settle();
  await toEnd(a);
  await is(b, "fin");
  await settle();
  const g2 = (await look(a)).gen, [dx, dy] = await middle(b, deckBtn("melange"));
  await a.page.click(deckBtn("profond"));
  await b.page.waitForSelector(".cartes-card");
  await b.page.touchscreen.tap(dx, dy);
  await sleep(1200);
  u = await look(a);
  v = await look(b);
  check(u.gen === g2 + 1 && v.gen === g2 + 1 && u.deck === "profond" && u.i === 0 && v.i === 0, "A choisit un paquet ; B touche un autre paquet un instant trop tard : le paquet de A reste ouvert sur sa première carte (A : " + say(u) + " ; B : " + say(v) + ")");
});

scenario("Deux téléphones : un téléphone hors ligne, puis le relais en panne", async (env) => {
  const { a, b } = await duo(env, "panne", { lieu: "distance" });
  await a.page.click(NEXT);
  await same(a, b, 1);
  await settle();
  await b.ctx.setOffline(true);
  await env.ctl("drop=1"); /* une vraie coupure ferme aussi le flux déjà ouvert (A, lui, se reconnecte) */
  for (let k = 0; k < 2; k++) { await a.page.click(NEXT); await sleep(450); }
  for (let k = 0; k < 4; k++) { await b.page.click(NEXT); await sleep(200); }
  let u = await look(a), v = await look(b);
  check(u.i === 3 && v.i === 5 && await until(async () => await count(b, '.g-top [data-net="ok"]') === 0, 8000), "B sans réseau : chacun pioche sur son téléphone, et la pastille de B ne dit plus « Connecté »");
  await sleep(2500);
  await b.ctx.setOffline(false);
  check(await agreed(a, b, 45000), "le réseau revient : les deux téléphones se retrouvent sur la même carte (" + say(await look(a)) + ")");
  await settle();
  const i = (await look(a)).i;
  await env.ctl("down=1");
  await a.page.click(NEXT);
  await sleep(2500);
  u = await look(a);
  v = await look(b);
  check(u.i === i + 1 && v.i === i && await count(a, '.g-top [data-net="ok"]') === 0, "relais en panne : A pioche quand même sur son téléphone, B garde sa carte");
  await env.ctl("down=0");
  check(await same(a, b, i + 1, 45000), "le relais revient : la carte de A arrive chez B");
  check(await linked(a) && await linked(b) && !a.errors.length && !b.errors.length, "et les deux pastilles reviennent à « Connecté », sans erreur");
});

scenario("Deux téléphones : le relais oublie tout en pleine partie", async (env) => {
  const { a, b } = await duo(env, "oubli", { lieu: "distance" });
  for (let k = 0; k < 2; k++) { await a.page.click(NEXT); await sleep(450); }
  await same(a, b, 2);
  await settle();
  await env.ctl("reset=1");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await Promise.all([a.page.waitForSelector(".cartes-card"), b.page.waitForSelector(".cartes-card")]);
  check(await same(a, b, 2), "le relais oublie tout, les deux rechargent : la même troisième carte");
  await linked(a);
  await linked(b);
  await settle();
  await b.page.click(NEXT);
  check(await same(a, b, 3, 15000), "B pioche : A suit");
  await settle();
  await env.ctl("reset=1");
  await sleep(300);
  await a.page.click(NEXT);
  check(await same(a, b, 4, 30000), "nouvel oubli sans recharger, puis A pioche : B finit par suivre");
  await sleep(1500);
  const t = (await env.ctl()).topics, room = Object.keys(t)[0];
  check(!!room && t[room].messages <= 4, "chacun n'a redéposé que son dernier état (" + (room ? t[room].messages : 0) + " messages dans le salon)");
});

scenario("Deux téléphones : un changement de paquet pendant que l'autre est en plein geste", async (env) => {
  const { a, b } = await duo(env, "geste", { lieu: "distance" });
  const tap = (p, s) => p.page.evaluate((s) => document.querySelector(s).click(), s);
  await a.page.click(NEXT);
  await same(a, b, 1);
  await settle();
  const [cx, cy] = await middle(b, ".cartes-card");
  let f = await fingers(b);
  await f.set([[cx + 80, cy]]);
  await f.set([[cx + 30, cy + 2]]);
  await a.page.click(NEXT);
  await until(async () => (await look(b)).i === 2);
  await f.set([[cx - 80, cy + 4]]);
  await f.lift();
  await sleep(900);
  let u = await look(a), v = await look(b);
  check(u.i === 2 && v.i === 2, "A pioche pendant que B fait glisser la carte : une carte d'avance, pas deux (A : " + say(u) + " ; B : " + say(v) + ")");
  await press(a, PICK);
  await settle();
  f = await fingers(b);
  await f.set([[cx + 80, cy]]);
  await f.set([[cx + 30, cy + 2]]);
  await a.page.click(deckBtn("profond"));
  await until(async () => (await look(b)).gen === 2);
  await f.set([[cx - 80, cy + 4]]);
  await f.lift();
  await sleep(900);
  u = await look(a);
  v = await look(b);
  check(u.gen === 2 && v.gen === 2 && u.i === 0 && v.i === 0 && v.deck === "profond", "A change de paquet pendant que B fait glisser la carte : le nouveau paquet reste sur sa première carte (A : " + say(u) + " ; B : " + say(v) + ")");
  await press(b, PICK);
  await a.page.click(PICK);
  await press(a, deckBtn("melange"));
  check(await same(a, b, 0) && (await look(b)).deck === "melange", "B avait le choix du paquet ouvert quand A en lance un autre : B voit la première carte du nouveau paquet");
  await press(b, PICK);
  await settle();
  await Promise.all([tap(a, NEXT), tap(b, deckBtn("leger"))]);
  check(await agreed(a, b) && (u = await look(a)).deck === "leger" && u.gen === 4 && u.i === 0, "B choisit un paquet à l'instant où A pioche : le nouveau paquet s'ouvre des deux côtés, sur sa première carte (" + say(u) + ")");
  await settle();
  await toEnd(a);
  await is(b, "fin");
  await settle();
  await Promise.all([tap(a, deckBtn("profond")), tap(b, BACK)]);
  check(await agreed(a, b) && (u = await look(a)).deck === "profond" && u.gen === 5 && u.i === 0, "à la fin, A choisit un paquet à l'instant où B revient à la dernière carte : le nouveau paquet s'ouvre des deux côtés (" + say(u) + ")");
});

scenario("Deux téléphones : rien ne part sans un geste, un message par carte", async (env) => {
  const { a, b } = await duo(env, "silence", { lieu: "distance" });
  const p0 = await posts(env);
  await sleep(2500);
  await a.page.click(PICK);
  await press(a, BACK);
  await b.page.reload();
  await b.page.waitForSelector(".cartes-card");
  await linked(b);
  await a.page.reload();
  await a.page.waitForSelector(".cartes-card");
  await linked(a);
  await a.page.click(HOME);
  await a.page.click(RESUME);
  await linked(a);
  await swipe(b, -30);
  await swipe(b, 140);
  await a.page.keyboard.press("ArrowLeft");
  await a.page.evaluate(() => document.querySelector('.g-actions [data-act="prev"]').click());
  await sleep(800);
  check(await posts(env) === p0 && await same(a, b, 0), "attendre, ouvrir et refermer le choix d'un paquet, recharger, passer par l'accueil, glisser trop court, reculer avant la première carte : aucun message (" + (await posts(env) - p0) + ")");
  for (let k = 0; k < 6; k++) { await (k % 2 ? b : a).page.click(NEXT); await same(a, b, k + 1); await settle(); }
  await swipe(b, 140);
  await same(a, b, 5);
  await sleep(600);
  check(await posts(env) - p0 === 7, "six cartes piochées à tour de rôle et un retour en arrière : sept messages (" + (await posts(env) - p0) + ")");
});

scenario("Deux téléphones : au clavier pendant que l'autre pioche", async (env) => {
  const a = await phone(env, "a-clavier", DESKTOP), b = await phone(env, "b-clavier");
  const link = await host(a, env, { lieu: "distance", go: true });
  await a.page.click(".g-wait details.more > summary");
  await a.page.click(".g-wait .share-raw summary");
  await a.page.focus(".g-wait textarea");
  await a.page.keyboard.press("ArrowRight");
  await a.page.keyboard.press("ArrowLeft");
  check((await look(a)).i === 0 && await focused(a, ".g-wait textarea"), "en attendant l'invité, les flèches tapées dans le lien d'invitation ne piochent pas");
  await join(b, link);
  await same(a, b, 0);
  await linked(a);
  await linked(b);
  await settle();
  await a.page.keyboard.press("ArrowRight");
  check(await same(a, b, 1), "la flèche droite chez A pioche pour les deux");
  await settle();
  await tabTo(a, NEXT, 6);
  await b.page.click(NEXT);
  await same(a, b, 2);
  await a.page.keyboard.press("Enter");
  await sleep(900);
  const u = await look(a), v = await look(b);
  check(u.i === 2 && v.i === 2 && await focused(a, TEXT), "A allait valider « Carte suivante » au clavier quand B pioche : la carte de B s'affiche, le focus passe dessus, aucune carte n'est sautée (A : " + say(u) + " ; B : " + say(v) + ")");
  await settle();
  await tabTo(a, PICK, 4, "Shift+Tab");
  await a.page.keyboard.press("Enter");
  await is(a, "paquets");
  await tabTo(a, deckBtn("profond"), 8);
  await b.page.click(NEXT);
  await until(async () => (await saved(a)).sh.i === 3);
  await sleep(300);
  check(await focused(a, deckBtn("profond")), "A choisit un paquet au clavier pendant que B pioche : le focus reste sur le paquet où A en était");
  if (!await focused(a, deckBtn("profond"))) await tabTo(a, deckBtn("profond"), 8);
  await settle();
  await a.page.keyboard.press("Enter");
  check(await same(a, b, 0) && (await look(b)).deck === "profond", "et Entrée ouvre ce paquet des deux côtés");
});

scenario("Deux téléphones : prénoms extrêmes sur petit écran", async (env) => {
  const names = { a: "O'Brien <b>&\"é\"", b: "W".repeat(20) };
  const small = { viewport: { width: 320, height: 568 } }, a = await phone(env, "a-noms", small), b = await phone(env, "b-noms", small);
  /* Les écrans d'invitation, eux, appartiennent au socle : ses propres essais les mesurent. */
  const link = await host(a, env, Object.assign({ lieu: "distance" }, names));
  await b.page.goto(link);
  await b.page.waitForSelector('[data-act="g-join"]');
  await b.page.evaluate(() => document.querySelector('[data-act="g-join"]').click());
  await Promise.all([a.page.waitForSelector(".cartes-card"), b.page.waitForSelector(".cartes-card")]);
  await until(async () => await count(a, ".g-wait") + await count(b, ".g-wait") === 0);
  await settle();
  const cards = cardsOf(await decksOf(a), "leger", true);
  const whose = (s, me) => (!s.w ? "Pour vous deux" : (s.w === me ? "À toi" : "À " + names[s.w]) + (s.t === "d" ? " de jouer" : " de répondre"));
  const audit = (seen, me, label) => {
    const bad = wrong(seen, cards, names), ugly = layout(seen);
    check(seen.length === cards.length && !bad.length, label + " : les cartes jouables à distance, une fois chacune, remplies avec le prénom de l'autre (" + seen.length + " cartes)" + few(bad));
    check(seen.every((s) => s.whose === whose(s, me) && s.me === (s.w === me)), label + " : chaque carte dit « À toi » ou nomme l'autre, et seules les siennes portent le liseré");
    check(!ugly.length, label + " : rien ne dépasse, rien ne se chevauche, boutons d'au moins 44 px" + few(ugly));
  };
  audit(await survey(a), "a", "320 × 568, chez qui a créé la partie");
  check(await is(b, "fin", 10000), "la fin du paquet arrive chez l'invité");
  check(/vos deux téléphones/.test(await b.page.locator(".cartes-end .g-lead").textContent()) && await count(b, ".cartes-end .link") === 0, "320 × 568 : l'écran de fin dit que le choix vaut pour les deux, dans son texte, sans lien glissé dans une phrase");
  await press(b, BACK);
  audit((await survey(b, true)).reverse(), "b", "320 × 568, chez l'invité");
  check(await healthy(a) && await healthy(b), "un prénom avec apostrophe, balise et guillemets ne casse rien, d'un côté comme de l'autre");
});

scenario("Deux téléphones : l'invité perd sa partie et rouvre le lien d'invitation", async (env) => {
  const { a, b, link } = await duo(env, "retour", { lieu: "distance" });
  for (let k = 0; k < 3; k++) { await a.page.click(NEXT); await sleep(450); }
  await same(a, b, 3);
  await b.page.click(STOP);
  await b.page.click(STOP);
  await b.page.waitForSelector("main.intro");
  await a.page.click(NEXT);
  await join(b, link);
  check(await same(a, b, 4), "B arrête la partie par erreur, A pioche, B rouvre le lien : B retrouve la carte où A en est");
  await settle();
  await b.page.click(NEXT);
  check(await same(a, b, 5), "et pioche de nouveau pour les deux");
  /* Le stockage est vidé depuis une page du même site qui ne lance pas le jeu : une page ouverte garderait la partie en mémoire. */
  await b.page.goto(env.base + "assets/styles.css");
  await b.page.evaluate(() => localStorage.clear());
  await settle();
  await a.page.click(NEXT);
  await join(b, link);
  const kept = await b.page.evaluate(() => localStorage.getItem("en:names"));
  check(await same(a, b, 6) && /Tom/.test(kept) && /Inès/.test(kept), "B perd tout le stockage de son navigateur et rouvre le lien : la même carte, prénoms compris");
  await settle();
  await b.page.click(NEXT);
  check(await same(a, b, 7), "et la partie continue");
});

scenario("Deux téléphones : valeurs hostiles venues de l'autre", async (env) => {
  const { a, b } = await duo(env, "pirate", { lieu: "distance" });
  const n = (await look(a)).n, full = cardsOf(await decksOf(a), "leger").length;
  const got = (fn) => until(async () => fn(await saved(a)), 8000);
  /* Des boutons que le jeu n'affiche pas, ajoutés à la page de B puis touchés. */
  const fake = (acts) => b.page.evaluate((acts) => {
    acts.forEach((x) => { const el = document.createElement("button"); el.setAttribute("data-act", x[0]); if (x[1] != null) el.setAttribute("data-deck", x[1]); document.querySelector("main.game").appendChild(el); el.click(); });
  }, acts);

  await forge(b, { sh: { i: n } });
  check(await got((s) => s.sh.i === n) && await is(a, "fin") && await healthy(a), "position égale à la taille de la pile : A voit l'écran de fin");
  await press(a, BACK);
  check(await same(a, b, n - 1), "et peut revenir à la dernière carte, B aussi");
  await forge(b, { sh: { i: n + 1 } });
  check(await got((s) => s.sh.i === n + 1) && await same(a, b, 0) && await healthy(a), "position juste au-delà de la pile : la première carte");
  await forge(b, null, { i: 7, x: HOSTILE, list: Array(200).fill(HOSTILE) });
  check(await got((s) => s.S.b.d.i === 7) && await same(a, b, 0) && await healthy(a), "une tranche remplie de balises : ignorée, la carte ne bouge pas");

  await fake([["deck", HOSTILE]]);
  let g = (await saved(b)).gen;
  check(await got((s) => s.gen === g) && await same(a, b, 0) && (await look(a)).n === n && await healthy(a), "un bouton forgé chez B avec un paquet inconnu : A retombe sur le paquet léger, toujours sans les cartes à faire ensemble");
  await settle();
  await fake([["deck", null], ["nimporte", HOSTILE], ["prev", HOSTILE]]);
  g = (await saved(b)).gen;
  check(await got((s) => s.gen === g) && await same(a, b, 0) && await healthy(a), "des boutons forgés sans paquet ou d'un nom inconnu : la première carte du paquet léger");
  await settle();
  await b.page.evaluate(() => { for (let k = 0; k < 300; k++) { const x = document.querySelector('[data-act="next"]'); if (x) x.click(); } });
  check(await is(a, "fin") && (await saved(a)).sh.i === n && await healthy(a), "trois cents « Carte suivante » d'un coup chez B : A arrive à l'écran de fin, jamais au-delà");

  const c = await phone(env, "c-pirate"), room = (await saved(a)).room;
  await join(c, env.base + "#g=" + token({ g: "cartes", v: 1, n: [HOSTILE, "D'Artagnan"], r: room.r, k: room.k, su: { seed: "x", deck: 12, lieu: {} }, gen: g + 3 }));
  check(await until(() => healthy(c)) && await got((s) => s.gen === g + 3) && await same(a, c, 0) && (await look(a)).n === full && await healthy(a),
    "une invitation aux prénoms et réglages hostiles, ouverte sur un troisième téléphone : une première carte du paquet léger, la même partout, rien d'exécuté");
  await c.ctx.close();

  await forge(b, { gen: g + 4, setup: { seed: 11, deck: "leger", lieu: "distance" }, st: 1, sh: { i: 1, junk: "x".repeat(20000) } });
  check(await got((s) => (s.sh.junk || "").length === 20000) && await same(a, b, 1) && await healthy(a), "vingt mille caractères en trop dans l'état commun : la deuxième carte s'affiche quand même");
  await linked(b);
  await settle();
  const p0 = await posts(env);
  await a.page.click(NEXT);
  const followed = await same(a, b, 2, 10000);
  await sleep(1500);
  const cost = await posts(env) - p0;
  check(followed && cost <= 1, "ensuite, une carte piochée par A coûte toujours un seul message (" + cost + ")");

  await forge(b, { gen: g + 5, setup: { seed: 12, deck: "leger", lieu: "distance", junk: "x".repeat(20000) }, st: 1, sh: { i: 1 } });
  check(await got((s) => (s.setup.junk || "").length === 20000) && await same(a, b, 1) && await healthy(a), "vingt mille caractères en trop dans les réglages : la carte s'affiche quand même");
  await linked(b);
  await press(a, PICK);
  await press(a, deckBtn("profond"));
  const lean = await until(async () => { const s = await saved(b); return s.gen === g + 6 && Object.keys(s.setup).sort().join() === "deck,lieu,seed" && s.setup.lieu === "distance"; }, 10000);
  check(lean && await same(a, b, 0) && (await look(b)).deck === "profond", "A choisit un paquet : les réglages qui partent ne gardent que ceux du jeu, le surplus n'est pas renvoyé");
  await sleep(1500);
  const p1 = await posts(env);
  await a.page.click(NEXT);
  const next = await same(a, b, 1, 10000);
  await sleep(1500);
  check(next && await posts(env) - p1 <= 1, "et la carte suivante coûte de nouveau un seul message (" + (await posts(env) - p1) + ")");

  /* Ce que le socle fait ensuite d'un tel compteur (envois refusés par l'autre, partie perdue au rechargement) relève de ses propres essais. */
  await forge(b, { gen: g + 8, setup: { seed: 12, deck: "leger", lieu: "distance" }, st: 1e9, sh: { i: 3 } });
  check(await got((s) => s.st === 1e9) && await same(a, b, 3) && await healthy(a), "un compteur d'écritures au plafond : la carte s'affiche");
  /* Le téléphone pirate a volontairement un état abîmé : ses propres erreurs ne comptent pas. */
  b.errors.length = 0;
});

scenario("Deux téléphones : un numéro de manche au plafond", async (env) => {
  const { a, b } = await duo(env, "plafond", { lieu: "distance" });
  await forge(b, { gen: 1e6, setup: { seed: 5, deck: "leger", lieu: "distance" }, st: 0, sh: {} });
  check(await until(async () => (await saved(a)).gen === 1e6, 8000) && await same(a, b, 0) && await healthy(a), "B écrit un numéro de manche au plafond : la première carte s'affiche chez A");
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
