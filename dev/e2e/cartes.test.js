/* Essais du jeu « Les cartes à piocher » : un paquet entier sur un téléphone, puis sur deux
   (à distance, par le faux relais), avec rechargements, départ et retour, relance par l'invité,
   valeurs hostiles et décompte des messages. Les essais lisent le contenu dans la page : ils
   valent pour le vrai fichier jeux/cartes.data.js comme pour les cartes de secours. */
const { setup, check, done, sleep } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const NAMES = { a: "Tom", b: "Inès" };
const KINDS = { q: "Question", d: "Défi", 2: "À deux" };

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Juste après un changement d'écran (carte piochée par l'autre, passage d'une carte au choix d'un paquet ou l'inverse),
   le jeu ignore les touchers pendant une demi-seconde (voir plus bas) : les essais laissent passer ce délai,
   comme une personne qui lit l'écran. */
const settle = () => sleep(650);
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
async function phone(env, name) {
  const p = await env.phone(name);
  await p.ctx.addInitScript(fixture);
  return p;
}
/* Ce que le téléphone affiche : la carte du dessus, ou l'écran de fin. */
const state = (p) => p.page.evaluate(() => {
  const c = document.querySelector(".cartes-card"), txt = (el) => (el ? el.textContent.replace(/\u00a0/g, " ") : "");
  if (!c) return { end: !!document.querySelector('.cartes[data-screen="fin"]') };
  const pos = txt(document.querySelector(".cartes-count [aria-hidden]")).replace(/ /g, "");
  return {
    pos, i: Number(c.getAttribute("data-i")), n: Number(pos.split("/")[1]), t: c.getAttribute("data-t"),
    w: c.classList.contains("a") ? "a" : c.classList.contains("b") ? "b" : "", me: c.classList.contains("me"), dir: c.classList.contains("next") ? "next" : c.classList.contains("back") ? "back" : "",
    text: txt(c.querySelector(".cartes-text")), whose: txt(c.querySelector(".cartes-for")), tag: txt(c.querySelector(".g-tag")), left: c.parentNode.getAttribute("data-left"),
    prev: !document.querySelector('[data-act="prev"]').disabled, next: txt(document.querySelector('[data-act="next"]')), page: txt(document.getElementById("app"))
  };
});
const decksOf = (p) => p.page.evaluate(() => window.GAME_DATA.cartes.decks.map((d) => ({ id: d.id, name: d.name, cards: d.cards.map((c) => ({ t: c.t, x: c.x.replace(/\u00a0/g, " "), near: !!c.near })) })));
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:cartes")));
const tap = (p, act) => p.page.click('[data-act="' + act + '"]');
const posts = async (env) => (await env.ctl()).count.post;
const clean = async (p) => await p.page.locator("#app img").count() === 0 && await p.page.evaluate(() => window.__xss === undefined);

/* Les textes attendus : chaque carte telle qu'elle doit s'afficher selon la personne à qui elle s'adresse
   (la clé « texte|a » vaut pour une carte adressée au premier prénom, donc remplie avec le second). */
const el = (n, word) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? word.slice(0, -1) + "'" : word + " ") + n;
function expected(cards) {
  const map = new Map();
  cards.forEach((c, k) => (c.t === "2" ? [""] : ["a", "b"]).forEach((w) => {
    const o = NAMES[w === "a" ? "b" : "a"];
    map.set(c.x.replace(/\{o\}/g, o).replace(/\{de_o\}/g, el(o, "de")).replace(/\{que_o\}/g, el(o, "que")) + "|" + w, Object.assign({ k }, c));
  }));
  return map;
}
/* Parcourt la pile jusqu'à l'écran de fin. advance(p, s) pioche la carte suivante et renvoie le téléphone à lire ensuite. */
async function walk(p, advance) {
  const seen = [];
  await settle();
  for (let s = await state(p); s.i != null && seen.length < 400; s = await state(p)) {
    seen.push(s);
    p = await advance(p, s);
  }
  return seen;
}
/* Vérifie un parcours complet : les bonnes cartes, une fois chacune, pour la bonne personne, sans rien montrer d'avance.
   Renvoie, dans l'ordre, les numéros des cartes du contenu qui ont été affichées. */
function audit(label, seen, cards, size, whose) {
  const map = expected(cards), hit = seen.map((s) => map.get(s.text + "|" + s.w)), solo = seen.filter((s) => s.t !== "2"), last = seen[seen.length - 1] || {};
  check(seen.length === size && seen.every((s, k) => s.i === k && s.n === size), label + " : " + size + " cartes, comptées de 1 à " + size + " (" + seen.length + ")");
  check(hit.every((c, k) => c && c.t === seen[k].t) && new Set(hit.map((c) => c && c.k)).size === seen.length, label + " : chaque carte vient du bon paquet, une seule fois, avec le prénom de l'autre à sa place");
  check(seen.every((s) => s.tag === KINDS[s.t] && (s.t === "2") === (s.w === "") && !/[{}]/.test(s.text)), label + " : l'étiquette dit le type de carte, les cartes à deux sont neutres");
  check(solo.length > 1 && solo.every((s, k) => !k || s.w !== solo[k - 1].w), label + " : les cartes pour une personne alternent de l'une à l'autre");
  check(seen.every((s) => s.whose === whose(s)), label + " : chaque carte dit à qui elle s'adresse");
  check(seen.every((s, k) => k === seen.length - 1 || s.page.indexOf(seen[k + 1].text) < 0), label + " : la carte suivante n'est jamais dans la page avant d'être piochée");
  check(seen.length > 2 && seen[0].left === "2" && !seen[0].prev && last.left === "0" && last.next === "Finir le paquet", label + " : la première et la dernière carte sont signalées");
  return hit.map((c) => (c ? c.k : -1));
}
/* Glisse le doigt sur la carte, avec de vrais événements tactiles. */
async function swipe(p, dx, dy) {
  const box = await p.page.locator(".cartes-card").boundingBox(), cdp = await p.ctx.newCDPSession(p.page);
  const x = box.x + box.width / 2 - dx / 2, y = box.y + box.height / 2 - dy / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let k = 1; k <= 5; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * k) / 5, y: y + (dy * k) / 5 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await sleep(150);
}
/* Fait écrire à ce téléphone un état trafiqué : sa partie enregistrée est modifiée, et il la redépose en rechargeant. */
async function forge(p, patch) {
  await p.page.evaluate((o) => {
    const s = JSON.parse(localStorage.getItem("en:g:cartes"));
    Object.assign(s, o, { st: s.st + 5, sw: s.me });
    s.seq[s.me].h += 5;
    localStorage.setItem("en:g:cartes", JSON.stringify(s));
    location.reload();
  }, patch).catch(() => { /* la page se recharge pendant l'appel */ });
  await p.page.waitForSelector("main.game");
}

(async () => {
  const env = await setup();
  const soloWhose = (s) => (s.w ? "Pour " + NAMES[s.w] : "Pour vous deux");
  const step = async (p) => { await tap(p, "next"); return p; };

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-cartes");
  await one.page.fill("#name-a", NAMES.a);
  await one.page.fill("#name-b", NAMES.b);
  await one.page.click('[data-act="g-opt"][data-val="profond"]');
  await one.page.click('[data-act="g-opt"][data-val="distance"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector(".cartes-card");
  const decks = await decksOf(one), deck = (id) => decks.find((d) => d.id === id), far = (id) => deck(id).cards.filter((c) => !c.near);
  const size = (id) => deck(id).cards.length;
  check(decks.length === 3 && decks.every((d) => far(d.id).length >= 6), "le contenu a de quoi jouer : trois paquets (" + decks.map((d) => d.cards.length + " cartes dont " + (d.cards.length - far(d.id).length) + " à faire ensemble").join(", ") + ")");
  let s = await state(one);
  const first = s.text;
  check(s.pos === "1/" + size("profond"), "le paquet choisi s'ouvre en entier : sur un seul téléphone, « À distance » ne retire rien (" + s.pos + ")");
  await tap(one, "next");
  s = await state(one);
  check(s.i === 1 && s.dir === "next" && s.prev, "« Carte suivante » pioche la deuxième carte, qui entre par la droite");
  await tap(one, "prev");
  s = await state(one);
  check(s.i === 0 && s.text === first && s.dir === "back", "« Précédente » revient à la même première carte, qui entre par la gauche");
  await swipe(one, -140, 10);
  check((await state(one)).i === 1, "glisser la carte vers la gauche pioche la suivante");
  await swipe(one, -140, -6);
  check((await state(one)).i === 2, "et encore la suivante");
  await swipe(one, 140, 8);
  check((await state(one)).i === 1, "glisser vers la droite revient d'une carte");
  await swipe(one, -30, 0);
  await swipe(one, -70, 170);
  check((await state(one)).i === 1, "un geste trop court ou un défilement vertical ne pioche rien");
  await one.page.keyboard.press("ArrowRight");
  await one.page.keyboard.press("ArrowRight");
  await one.page.keyboard.press("ArrowLeft");
  s = await state(one);
  check(s.i === 2, "les flèches du clavier font avancer et reculer");
  await one.page.reload();
  await one.page.waitForSelector(".cartes-card");
  const again = await state(one);
  check(again.i === 2 && again.text === s.text && again.dir === "", "après rechargement, la même carte est là");
  await tap(one, "pick");
  check(await one.page.locator('.cartes[data-screen="paquets"]').count() === 1 && await one.page.locator(".cartes-card").count() === 0 && await one.page.locator('[data-act="deck"][aria-pressed="true"]').getAttribute("data-deck") === "profond", "« changer » ouvre le choix d'un paquet, à la place de la carte");
  await one.page.keyboard.press("ArrowRight");
  await one.page.reload();
  await one.page.waitForSelector('.cartes[data-screen="paquets"]');
  await tap(one, "pick");
  check((await state(one)).text === s.text, "« Revenir à la carte » retrouve la même carte, malgré un rechargement et une flèche du clavier");
  await settle();
  await tap(one, "prev");
  await tap(one, "prev");
  const run1 = await walk(one, step), order1 = audit("un téléphone", run1, deck("profond").cards, size("profond"), soloWhose);
  check((await state(one)).end && (await one.page.locator(".cartes-end .g-title").textContent()).includes("vidé le paquet"), "après la dernière carte, l'écran de fin");
  check(await one.page.locator('.cartes-end [data-act="deck"]').count() === 4 && await one.page.locator('[data-act="deck"][aria-pressed="true"]').getAttribute("data-deck") === "profond", "il propose les trois paquets et le mélange, et repère celui qu'on vient de finir");
  await one.page.reload();
  await one.page.waitForSelector(".cartes-end");
  await one.page.goto(env.base + "#accueil");
  check(await one.page.locator('a.card-link[href="#jeu-cartes"]').count() === 1 && await one.page.locator('a.card-state[href="#jeu-cartes"]').count() === 0, "paquet fini, même après rechargement : l'accueil ne propose plus de reprendre la partie");
  await one.page.goto(env.base + "#jeu-cartes");
  await one.page.click('.cartes-end [data-act="prev"]');
  s = await state(one);
  check(s.i === s.n - 1 && s.text === run1[run1.length - 1].text, "« Revenir à la dernière carte » la retrouve");
  await settle();
  await tap(one, "next");
  await settle();
  await one.page.click('[data-act="deck"][data-deck="profond"]');
  const order2 = audit("paquet rebattu", await walk(one, step), deck("profond").cards, size("profond"), soloWhose);
  check(order2.join() !== order1.join(), "rebattre le même paquet redonne ses cartes dans un autre ordre");
  await settle();
  await one.page.click('[data-act="deck"][data-deck="melange"]');
  const half = (id) => Math.ceil(size(id) / 2);
  const mix = audit("mélange", await walk(one, step), deck("leger").cards.concat(deck("profond").cards), half("leger") + half("profond"), soloWhose);
  check(mix.filter((k) => k < size("leger")).length === half("leger"), "le mélange prend la moitié du paquet léger et la moitié du profond, rien du paquet pour adultes");

  console.log("Deux téléphones, à distance");
  const a = await phone(env, "a"), b = await phone(env, "b");
  const duoWhose = (z) => (!z.w ? "Pour vous deux" : (z.w === z.on ? "À toi" : "À " + NAMES[z.w]) + (z.t === "d" ? " de jouer" : " de répondre"));
  const same = (i) => until(async () => { const u = await state(a), v = await state(b); return u.i === i && v.i === i && u.text === v.text; });
  await a.page.goto(env.base + "#jeu-cartes");
  await a.page.fill("#name-a", NAMES.a);
  await a.page.fill("#name-b", NAMES.b);
  await a.page.click('[data-act="g-opt"][data-val="distance"]');
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector(".cartes-card");
  check(await a.page.locator(".g-wait .share[data-url]").count() === 1, "partie commencée sans attendre : la carte est là, avec le rappel du lien d'invitation");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector(".cartes-card");
  check(await same(0) && await until(async () => await a.page.locator(".g-wait").count() + await b.page.locator(".g-wait").count() === 0), "l'invité arrive : la même première carte des deux côtés, plus d'attente");
  const N = far("leger").length, p0 = await posts(env);
  check((await state(a)).pos === "1/" + N && (await state(b)).pos === "1/" + N, "à distance, les cartes à faire ensemble sont retirées de la pile (" + N + " cartes sur " + size("leger") + ")");
  await tap(a, "next");
  check(await until(async () => (await state(b)).i === 1, 2000), "A pioche : la carte arrive chez B en moins de deux secondes");
  await settle();
  await tap(b, "next");
  check(await same(2), "B pioche à son tour : les deux téléphones montrent la troisième carte");
  await settle();
  await tap(a, "prev");
  check(await same(1), "« Précédente » ramène aussi l'autre téléphone");
  await settle();
  /* B touche « Carte suivante » à l'instant même où la carte piochée par A s'affiche chez lui. */
  await b.page.evaluate(() => {
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.cartes-card[data-i="2"]')) return;
      obs.disconnect();
      document.querySelector('[data-act="next"]').click();
      window.__late = true;
    });
    obs.observe(document.getElementById("app"), { childList: true, subtree: true });
  });
  await tap(a, "next");
  check(await until(() => b.page.evaluate(() => window.__late === true)) && !await until(async () => (await state(a)).i !== 2 || (await state(b)).i !== 2, 1500), "un toucher parti juste après la pioche de l'autre ne fait pas sauter de carte");
  await tap(b, "next");
  check(await same(3), "une fois la carte affichée depuis un instant, B pioche normalement");
  await a.page.reload();
  await a.page.waitForSelector(".cartes-card");
  check((await state(a)).i === 3, "A recharge la page : la même carte");
  await tap(b, "next");
  check(await same(4), "et A continue de recevoir");
  await b.page.reload();
  await b.page.waitForSelector(".cartes-card");
  await settle();
  await tap(a, "next");
  check(await same(5), "B recharge la page : il suit toujours");
  await a.page.goto("about:blank");
  await settle();
  await tap(b, "prev");
  await sleep(500);
  await tap(b, "prev");
  await a.page.goto(env.base + "#jeu-cartes");
  check(await same(3), "A quitte la page puis revient : il retrouve la carte où B en est");
  await settle();
  const p1 = await posts(env);
  await a.page.evaluate(() => { for (let k = 0; k < 3; k++) document.querySelector('[data-act="prev"]').click(); });
  check(await same(0) && await posts(env) - p1 <= 2, "trois « Précédente » coup sur coup : retour à la première carte des deux côtés, en deux messages au plus");

  console.log("Un paquet entier à deux");
  const p2 = await posts(env);
  /* Cinq cartes d'affilée chacun : l'autre téléphone rattrape, puis c'est lui qui pioche. */
  const run = await walk(a, async (p, z) => {
    const q = p === a ? b : a;
    z.on = p === a ? "a" : "b";
    await tap(p, "next");
    if ((z.i + 1) % 5) return p;
    await until(async () => { const v = await state(q); return v.i === z.i + 1 || (v.end && z.i === N - 1); });
    await settle();
    return q;
  });
  audit("deux téléphones", run, far("leger"), N, duoWhose);
  check(run.every((z) => z.me === (z.w === z.on)) && run.some((z) => z.on === "b" && z.me) && run.some((z) => z.on === "a" && z.me), "un liseré marque, sur chaque téléphone, les cartes qui sont pour soi");
  const near = Array.from(expected(deck("leger").cards.filter((c) => c.near)).keys()).map((k) => k.split("|")[0]);
  check(run.every((z) => near.every((x) => z.page.indexOf(x) < 0)), "aucune des " + (size("leger") - N) + " cartes à faire ensemble n'apparaît à distance");
  check(await until(async () => (await state(a)).end && (await state(b)).end), "la fin du paquet s'affiche sur les deux téléphones");
  const cost = await posts(env) - p2;
  check(cost <= N, "un paquet de " + N + " cartes coûte au plus un message par carte (" + cost + ")");
  check((await b.page.locator(".cartes-end .g-lead").textContent()).includes("vos deux téléphones"), "l'écran de fin dit que le choix vaut pour les deux");

  console.log("Nouvelle manche lancée par B");
  await settle();
  await b.page.click('[data-act="deck"][data-deck="profond"]');
  check(await same(0) && (await state(a)).pos === "1/" + far("profond").length, "B choisit un autre paquet : A repart aussi à la première carte, toujours sans les cartes à faire ensemble");
  check((await a.page.locator(".cartes-step").textContent()).indexOf(deck("profond").name + " · ") === 0, "le nom du nouveau paquet s'affiche chez A");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await Promise.all([a.page.waitForSelector(".cartes-card"), b.page.waitForSelector(".cartes-card")]);
  check(await same(0), "les deux rechargent : la nouvelle manche est toujours là, identique");
  await tap(a, "next");
  check(await same(1), "et elle se joue comme la première");

  console.log("Changer de paquet en route");
  const p3 = await posts(env);
  await tap(a, "pick");
  await a.page.waitForSelector('.cartes[data-screen="paquets"]');
  await settle();
  await tap(b, "next");
  check(await until(async () => (await saved(a)).sh.i === 2) && await a.page.locator(".cartes-card").count() === 0 && await posts(env) - p3 === 1, "A ouvre le choix d'un paquet : rien n'est envoyé, et B continue de piocher sans le lui refermer");
  await tap(a, "pick");
  check(await same(2), "A referme le choix : il retrouve la carte où B en est");
  await settle();
  await tap(a, "pick");
  await settle();
  await a.page.click('[data-act="deck"][data-deck="melange"]');
  const M = Math.ceil(far("leger").length / 2) + Math.ceil(far("profond").length / 2);
  check(await same(0) && (await state(b)).pos === "1/" + M, "A choisit le mélange : les deux repartent à la première carte, toujours sans les cartes à faire ensemble (" + M + " cartes)");

  console.log("Valeurs hostiles écrites par B");
  const got = (sh) => until(async () => JSON.stringify((await saved(a)).sh) === JSON.stringify(sh));
  await settle();
  await tap(b, "next");
  check(await same(1), "B pioche dans le mélange");
  await forge(b, { sh: { i: 9999 } });
  check(await got({ i: 9999 }) && await same(0) && (await state(a)).n === M, "position hors de la pile : retour à la première carte, sans erreur");
  await settle();
  await tap(a, "next");
  check(await same(1), "et la partie continue");
  for (const [label, i] of [["négative", -3], ["décimale", 1.5], ["en texte", "1"], ["en HTML", HOSTILE], ["en objet", { i: 1 }], ["absente", null]]) {
    await forge(b, { sh: { i, x: HOSTILE } });
    check(await got({ i, x: HOSTILE }) && await same(0) && await clean(a) && await clean(b), "position " + label + " : première carte, rien d'exécuté");
  }
  await forge(b, { setup: { seed: HOSTILE, deck: HOSTILE, lieu: 42 }, sh: { i: 1 } });
  check(await got({ i: 1 }) && await same(1) && (await state(a)).pos === "2/" + size("leger") && await clean(a), "réglages trafiqués : le paquet inconnu retombe sur le paquet léger, la même carte des deux côtés");
  await forge(b, { setup: { seed: 7, deck: ["coquin"], lieu: "distance" }, sh: { i: 2 } });
  check(await got({ i: 2 }) && await same(2) && (await state(a)).pos === "3/" + N, "paquet en tableau : toujours le paquet léger");
  await forge(b, { setup: { seed: 7, deck: "constructor", lieu: "distance" }, sh: { i: 0 } });
  check(await got({ i: 0 }) && await same(0) && (await state(a)).pos === "1/" + N, "paquet « constructor » : toujours le paquet léger");
  await settle();
  await tap(a, "next");
  check(await same(1), "après tout cela, A pioche et B suit");
  const total = await posts(env) - p0;
  check(total <= N + 36, "toute la séance à deux (un paquet entier, deux relances, rechargements, états trafiqués) tient en " + (N + 36) + " messages au plus (" + total + ")");

  console.log("Deux téléphones, côte à côte, sans prénoms");
  const c = await phone(env, "c"), d = await phone(env, "d");
  await c.page.goto(env.base + "#jeu-cartes");
  await c.page.click('[data-act="g-opt"][data-val="coquin"]');
  await c.page.click('[data-act="g-start"][data-mode="duo"]');
  await d.page.goto(await c.page.locator(".share[data-url]").getAttribute("data-url"));
  await d.page.click('[data-act="g-join"]');
  await Promise.all([c.page.waitForSelector(".cartes-card"), d.page.waitForSelector(".cartes-card")]);
  check(await until(async () => { const u = await state(c), v = await state(d); return u.text === v.text && u.pos === "1/" + size("coquin") && v.pos === u.pos; }), "dans la même pièce, le paquet reste entier sur les deux téléphones");
  for (let k = 0; k < 20 && !(await state(c)).w; k++) await tap(c, "next");
  s = await state(c);
  check(await until(async () => (await state(d)).i === s.i) && (await state(s.w === "a" ? d : c)).whose.indexOf("À Partenaire " + (s.w === "a" ? 1 : 2) + " de ") === 0 && (await state(s.w === "a" ? c : d)).whose.indexOf("À toi de ") === 0, "sans prénoms, la carte est « à toi » chez l'un et « à Partenaire " + (s.w === "a" ? 1 : 2) + " » chez l'autre");

  console.log("Prénoms hostiles, paquet vide");
  const h = await phone(env, "hostile");
  await h.page.goto(env.base + "#accueil");
  await h.page.evaluate((v) => localStorage.setItem("en:names", JSON.stringify({ a: v, b: v })), HOSTILE);
  await h.page.goto(env.base + "#jeu-cartes");
  await h.page.reload();
  await h.page.click('[data-act="g-start"][data-mode="solo"]');
  await h.page.waitForSelector(".cartes-card");
  const shown = await walk(h, step);
  check(shown.length === size("leger") && shown.some((z) => z.whose.includes("<img")) && shown.some((z) => z.text.includes("<img")) && await clean(h), "des prénoms en HTML s'affichent comme du texte, sur toutes les cartes");
  const e = await env.phone("vide");
  await e.ctx.route(/jeux\/cartes\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await e.ctx.addInitScript(() => {
    window.GAME_DATA = { cartes: { decks: [{ id: "leger", name: "Léger", hint: "Paquet vide.", cards: [] },
      { id: "profond", name: "Profond", hint: "Deux cartes lisibles.", cards: [{ t: "q", x: "Une question ?" }, { t: "x", x: "Type inconnu." }, { t: "2" }, null, { t: "2", x: "À deux." }] }] } };
  });
  await e.page.goto(env.base + "#jeu-cartes");
  await e.page.click('[data-act="g-start"][data-mode="solo"]');
  await e.page.waitForSelector('.cartes[data-screen="vide"]');
  check((await e.page.locator(".g-title").textContent()).includes("vide") && await e.page.locator('[data-act="deck"]').count() === 3, "un paquet vide donne un écran clair, qui propose les autres");
  await e.page.click('[data-act="deck"][data-deck="profond"]');
  await e.page.waitForSelector(".cartes-card");
  check((await state(e)).pos === "1/2", "un paquet abîmé ne garde que ses cartes lisibles");
  const z = await env.phone("rien");
  await z.ctx.route(/jeux\/cartes\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await z.page.goto(env.base + "#jeu-cartes");
  await z.page.click('[data-act="g-start"][data-mode="solo"]');
  check(await until(() => z.page.locator('.cartes[data-screen="vide"]').count()) && await z.page.locator('[data-act="deck"]').count() === 0, "sans aucun contenu, le jeu s'ouvre quand même, sur un écran clair");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
