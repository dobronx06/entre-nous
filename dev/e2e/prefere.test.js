/* Essais du jeu « Tu préfères ? » : une partie complète sur un téléphone (avec retour en arrière,
   rechargement, passage du téléphone et relance sans répétition), puis sur deux, avec rechargements des
   deux côtés, relance par le second joueur, valeurs hostiles et plafond de messages.
   Le jeu n'est pas encore dans index.html : chaque téléphone reçoit ses fichiers à l'ouverture. */
const path = require("path");
const { setup, check, done, sleep } = require("./lib");

const DATA = path.join(__dirname, "../../jeux/prefere.data.js"), GAME = path.join(__dirname, "../../jeux/prefere.js");
global.window = {};
require(DATA);
const PACKS = window.GAME_DATA.prefere.packs;
/* Le texte affiché passe par l'échappement, qui met des espaces insécables dans les « » : on compare sans elles. */
const flat = (t) => t.replace(/[\u00a0\u202f]/g, " ").toLowerCase();
const ALL = new Set([].concat(...PACKS.map((p) => p.items.map((it) => flat(it.a)))));
const HOSTILE = "<u>Inès</u>";
/* Le jeu ignore les touchers pendant 350 ms après l'arrivée d'un écran : on attend, comme une personne. */
const PAUSE = 400;

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
async function phone(env, name) {
  const p = await env.phone(name);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  return p;
}
const scr = (p) => p.page.locator("main.game [data-screen]").first().getAttribute("data-screen");
const title = (p) => p.page.locator(".prefere .g-title").first().textContent();
async function tap(p, sel) { await sleep(PAUSE); await p.page.click(sel); }
/* Répond aux dilemmes from…to (indices dans la suite des 24 réponses) et renvoie le texte « a » de chaque dilemme vu. */
async function answer(p, w, v, from, to) {
  const seen = [];
  for (let j = from || 0; j < (to == null ? v.length : to); j++) {
    await p.page.waitForSelector('[data-screen="q-' + w + "-" + Math.floor(j / 2) + "-" + (j % 2) + '"]');
    if (j % 2 === 0) seen.push(await p.page.locator('[data-act="pick"][data-k="0"]').textContent());
    await tap(p, '[data-act="pick"][data-k="' + v[j] + '"]');
  }
  return seen;
}
async function send(p, w) {
  await p.page.waitForSelector('[data-screen="fin-' + w + '"]', { timeout: 5000 }).catch(async (e) => { console.log("écran : " + (await scr(p)) + " " + (await p.page.evaluate(() => localStorage.getItem("en:g:prefere")))); throw e; });
  await tap(p, '[data-act="send"]');
}
/* Ce que le jeu doit trouver : bonnes intuitions de chacun et choix communs. */
function expect(a, b) {
  let sa = 0, sb = 0, same = 0, miss = 0;
  for (let i = 0; i < 12; i++) {
    if (a[2 * i + 1] === b[2 * i]) sa++;
    if (b[2 * i + 1] === a[2 * i]) sb++;
    if (a[2 * i] === b[2 * i]) same++;
    if (a[2 * i + 1] !== b[2 * i] || b[2 * i + 1] !== a[2 * i]) miss++;
  }
  return { sa, sb, same, miss };
}
const scores = (p) => p.page.locator(".g-score b").allTextContents().then((l) => l.map((t) => t.replace(/\s+/g, "")));

(async () => {
  const env = await setup();
  const VA = "011010011100101001110100", VB = "100110011100010100111001";

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-prefere");
  check(await one.page.locator('[data-act="g-opt"][data-val="coquin"] .g-tag').textContent() === "Adultes", "le paquet coquin est marqué « Adultes » sur la présentation");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="absurde"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector('[data-screen="q-a-0-0"]');
  check((await title(one)) === "Tu préfères…" && (await one.page.locator(".prefere-head").textContent()).includes("Alex") && (await one.page.locator(".prefere-count").textContent()) === "1 / 12",
    "dilemme 1 sur 12 : Alex choisit pour soi");
  check(await one.page.locator('[data-act="pick"]').count() === 2 && await one.page.locator('[data-act="undo"]').count() === 0, "deux grandes options, rien à défaire au début");
  const optA = await one.page.locator('[data-act="pick"][data-k="0"]').textContent();
  await one.page.click('[data-act="pick"][data-k="0"]');
  check(await scr(one) === "q-a-0-0", "un toucher qui suit l'arrivée de l'écran de trop près est ignoré (double toucher)");
  await tap(one, '[data-act="pick"][data-k="0"]');
  await one.page.waitForSelector('[data-screen="q-a-0-1"]');
  check((await title(one)) === "Et Inès ?" && (await one.page.locator(".prefere .hint b").textContent()) === optA, "puis devine : « Et Inès ? », en rappelant son propre choix");
  check(await one.page.locator(".prefere.is-guess").count() === 1, "l'écran de devinette se distingue de celui du choix");
  await tap(one, '[data-act="undo"]');
  check(await until(async () => (await scr(one)) === "q-a-0-0"), "« Revenir en arrière » rouvre son propre choix");
  await answer(one, "a", VA, 0, 5);
  await one.page.reload();
  await one.page.waitForSelector("main.game [data-screen]");
  check(await scr(one) === "q-a-2-1", "après rechargement, on reprend au même dilemme, à la même étape");
  await answer(one, "a", VA, 5);
  await send(one, "a");
  await one.page.waitForSelector('[data-screen="passage"]');
  const passText = await one.page.locator("#app").textContent();
  check(passText.includes("Au tour d'Inès") && !passText.includes("Surprise") && await one.page.locator(".prefere-opt").count() === 0, "passage du téléphone : rien des réponses d'Alex n'est visible");
  await tap(one, '[data-act="go"]');
  await one.page.waitForSelector('[data-screen="q-b-0-0"]');
  check((await one.page.locator(".prefere-head").textContent()).includes("Inès") && await one.page.locator(".as-b").count() > 0, "Inès choisit à son tour, sous son encre");
  await answer(one, "b", VB);
  await send(one, "b");
  await one.page.waitForSelector('[data-screen="resultat"]');
  const e1 = expect(VA, VB), s1 = await scores(one);
  check(s1[0] === e1.sa + "/12" && s1[1] === e1.sb + "/12", "score de chacun : " + s1.join(" et "));
  check((await one.page.locator(".prefere .g-lead").first().textContent()).includes(e1.same + " fois sur 12"), "le nombre de choix communs est annoncé (" + e1.same + ")");
  check(await one.page.locator(".prefere-part").first().evaluate((el) => el.classList.contains("is-miss")) && await one.page.locator(".is-miss .prefere-list li").count() === e1.miss,
    "les surprises viennent en premier (" + e1.miss + ")");
  check(await one.page.locator(".prefere-list li").count() === 12, "chaque dilemme apparaît une fois dans le récapitulatif");
  check(await one.page.locator(".is-same .prefere-line .sr").first().textContent().then((t) => t.includes("tous les deux")), "un choix commun le dit à l'oreille");
  const firstList = (await one.page.locator(".prefere-list li .prefere-line:first-child > span:last-child").allTextContents()).map((t) => t.replace(/^.*?: /, ""));
  check(firstList.length === 12 && firstList.every((t) => ALL.has(flat(t))), "le récapitulatif reprend les dilemmes du paquet");
  await tap(one, '[data-act="again"][data-pack="absurde"]');
  await one.page.waitForSelector('[data-screen="q-b-0-0"]');
  check(true, "rejouer : Inès, qui tient le téléphone, commence la nouvelle partie");
  const seen2 = (await answer(one, "b", VB)).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  check(seen2.length === 12 && seen2.every((t) => firstList.indexOf(t) < 0), "« Rejouer » sur le même paquet ne ressert aucun dilemme");
  await send(one, "b");
  await tap(one, '[data-act="go"]');
  await answer(one, "a", VA);
  await send(one, "a");
  await one.page.waitForSelector('[data-screen="resultat"]');
  check(await one.page.locator(".eyebrow").first().textContent() === "Résultat", "seconde partie : résultat direct, sans repasser par l'ancien");

  console.log("Valeurs hostiles");
  await one.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("en:g:prefere"));
    s.S.b.d = { v: "<img src=x onerror=window.__xss=1>" };
    s.setup.pack = { evil: 1 };
    s.setup.at = { absurde: "x", nous: -4 };
    s.setup.prev = { k: "z", q: ["constructor.1"], a: 5, b: null };
    s.local = { d: "01<b>", go: "oui" };
    localStorage.setItem("en:g:prefere", JSON.stringify(s));
  });
  await one.page.reload();
  await one.page.waitForSelector("main.game [data-screen]");
  check(await one.page.locator("#app img").count() === 0 && await one.page.evaluate(() => window.__xss === undefined), "des réponses mal formées sont ignorées, rien ne s'exécute");
  check(/^q-/.test(await scr(one)), "l'écran reste jouable (" + (await scr(one)) + ")");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-prefere");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", HOSTILE);
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector('[data-screen="q-a-0-0"]');
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector('[data-screen="q-b-0-0"]');
  check(await a.page.locator('[data-act="pick"][data-k="0"]').textContent() === await b.page.locator('[data-act="pick"][data-k="0"]').textContent(), "les deux téléphones posent le même premier dilemme");
  check(await a.page.locator("#app u").count() === 0 && (await a.page.locator(".prefere-head").textContent()).length > 0, "un prénom hostile s'affiche comme du texte");
  await answer(a, "a", VA);
  await send(a, "a");
  await a.page.waitForSelector('[data-screen="attente"]');
  check(await a.page.locator(".g-wait").count() === 1, "A a fini : écran d'attente");
  await answer(b, "b", VB, 0, 7);
  await b.page.reload();
  await b.page.waitForSelector("main.game [data-screen]");
  check(await scr(b) === "q-b-3-1", "B recharge en pleine partie : reprise au même dilemme");
  check(await b.page.locator(".g-score, .prefere-list").count() === 0, "B ne voit rien des réponses de A avant d'avoir fini");
  await a.page.reload();
  await a.page.waitForSelector("main.game [data-screen]");
  check(await scr(a) === "attente", "A recharge pendant l'attente : toujours en attente");
  await answer(b, "b", VB, 7);
  await send(b, "b");
  check(await until(async () => (await scr(a)) === "resultat" && (await scr(b)) === "resultat"), "le résultat s'ouvre sur les deux téléphones");
  const sa = await scores(a), sb = await scores(b);
  check(sa.join() === sb.join() && sa[0] === e1.sa + "/12", "même résultat des deux côtés (" + sa.join(" et ") + ")");
  check(await a.page.locator("#app u").count() === 0 && await b.page.locator("#app u").count() === 0, "le prénom hostile reste du texte jusqu'au résultat");
  await tap(b, '[data-act="again"][data-pack="coquin"]');
  await b.page.waitForSelector('[data-screen="q-b-0-0"]');
  check(await until(async () => (await a.page.locator(".eyebrow").first().textContent()) === "Partie précédente"), "B relance : A garde le résultat à l'écran, annoncé comme la partie précédente");
  check(await a.page.locator('[data-act="ok"]').count() === 1 && await a.page.locator('[data-act="again"]').count() === 0, "A peut passer à la suite, pas relancer une seconde fois");
  await tap(a, '[data-act="ok"]');
  await a.page.waitForSelector('[data-screen="q-a-0-0"]');
  check(await a.page.locator('[data-act="pick"][data-k="0"]').textContent() === await b.page.locator('[data-act="pick"][data-k="0"]').textContent(), "puis rejoint la nouvelle partie, même dilemme que B");
  await a.page.reload();
  await a.page.waitForSelector("main.game [data-screen]");
  check(await scr(a) === "q-a-0-0", "le résultat quitté ne revient pas après rechargement");
  const posts = (await env.ctl()).count.post;
  check(posts <= 10, "une partie à deux, relance comprise, coûte au plus dix messages (" + posts + ")");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
