/* Essais du jeu « Qui de nous deux ? » : une partie complète sur un téléphone (avec retour en arrière,
   double toucher, rechargement, passage du téléphone et relance sans redite), puis sur deux téléphones,
   chacun à son rythme, avec rechargements, secret gardé, relance par le second joueur et données hostiles. */
const path = require("path");
const { setup, check, done, sleep } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const DATA = path.join(__dirname, "../../jeux/quiest.data.js"), GAME = path.join(__dirname, "../../jeux/quiest.js");
const N = 15;

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Le jeu n'est pas encore dans index.html : chaque téléphone le charge lui-même, styles compris. */
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/quiest.css";
    document.head.appendChild(l);
  }));
  return p;
}
const step = (p) => p.page.locator(".quiest-step").textContent();
const question = (p) => p.page.locator(".quiest-card .g-title").textContent();
const screen = (p) => p.page.locator("main.game [data-screen]").first().getAttribute("data-screen");
/* Un toucher par question, au rythme d'une personne pressée (le jeu ignore un second toucher dans le quart de seconde). */
async function answer(p, codes, seen) {
  for (const c of codes) {
    await p.page.waitForSelector(".quiest-card");
    if (seen) seen.push(await question(p));
    await p.page.click('[data-act="pick"][data-val="' + c + '"]');
    await sleep(270);
  }
}
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:quiest")));
const pdata = () => { global.window = {}; require(DATA); return window.GAME_DATA.quiest; };

(async () => {
  const env = await setup();
  const packs = pdata().packs, inPack = (id, q) => packs.find((x) => x.id === id).items.indexOf(q) >= 0;
  check(packs.length === 3 && packs.every((x) => x.items.length === 45 && new Set(x.items).size === 45) && packs[2].adult === true, "trois paquets de 45 questions différentes, le coquin réservé aux adultes");

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-quiest");
  check(await one.page.locator('[data-act="g-opt"][data-val="coquin"] .g-tag').textContent() === "Adultes", "le paquet coquin est marqué « Adultes » sur la présentation");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="quotidien"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector(".quiest-card");
  check((await step(one)).includes("Question 1 sur 15") && await one.page.locator(".quiest.as-a").count() === 1 && (await one.page.locator(".quiest-shh").textContent()).includes("Inès ne regarde pas"),
    "Alex répond en premier, Inès est priée de ne pas regarder");
  check(inPack("quotidien", await question(one)), "la question vient du paquet choisi");
  check(await one.page.locator('[data-act="pick"][data-val="a"]').textContent() === "Alex" && await one.page.locator('[data-act="pick"][data-val="b"]').textContent() === "Inès" &&
    await one.page.locator('[data-act="back"]').count() === 0, "deux grands prénoms, « Les deux », « Personne », et pas de retour sur la première question");
  const q1 = await question(one);
  await one.page.click('[data-act="pick"][data-val="a"]');
  await one.page.click('[data-act="pick"][data-val="a"]');
  await sleep(300);
  check((await step(one)).includes("Question 2 sur 15"), "un double toucher ne répond qu'à une question");
  await one.page.click('[data-act="back"]');
  check((await step(one)).includes("Question 1") && await question(one) === q1, "« Revenir à la question précédente » ramène à la première");
  const PA = "aab2a0bbaab22bb", PB = "abb2b0aba2020ab";
  const game1 = [];
  await answer(one, PA.slice(0, 6), game1);
  await one.page.reload();
  await one.page.waitForSelector(".quiest-card");
  check((await step(one)).includes("Question 7 sur 15"), "après rechargement, on reprend à la septième question");
  await answer(one, PA.slice(6), game1);
  await one.page.waitForSelector(".g-pass");
  check(await screen(one) === "passe" && (await one.page.locator(".g-pass h1").textContent()).includes("Au tour d'Inès") && await one.page.locator(".quiest-chip").count() === 0,
    "les quinze réponses d'Alex données : on passe le téléphone, sans rien montrer");
  await one.page.click('[data-act="moi"]');
  check(await one.page.locator(".quiest.as-b").count() === 1 && (await step(one)).includes("Question 1") && await question(one) === game1[0], "Inès reçoit les mêmes questions, dans le même ordre");
  await answer(one, PB);
  await one.page.waitForSelector('[data-screen="resultat"]');
  const agree = [...PA].filter((c, i) => c === PB[i]).length;
  check((await one.page.locator(".g-big").textContent()).replace(/\s+/g, "") === agree + "/15", "le résultat compte les accords (" + agree + " sur 15)");
  check(await one.page.locator(".quiest-row.ok").count() === agree && await one.page.locator(".quiest-row.gap").count() === N - agree, "chaque question apparaît une fois, rangée en accord ou en désaccord");
  check(await one.page.evaluate(() => { const r = [...document.querySelectorAll(".quiest-row")]; const k = r.findIndex((x) => x.classList.contains("gap")); return k > 0 && r.slice(k).every((x) => x.classList.contains("gap")); }), "les accords d'abord, les désaccords ensuite");
  const tags = await one.page.locator(".quiest-tag").allTextContents();
  check(tags.length === N - agree && tags.includes("Chacun lève la main") && tags.includes("Vous vous renvoyez la balle") && tags.includes("À moitié d'accord") && tags.includes("Quelqu'un est dans le déni") && tags.includes("Tout ou rien"),
    "chaque désaccord porte une étiquette selon sa nature");
  check((await one.page.locator(".quiest-row").first().locator(".quiest-by").allTextContents()).join("|") === "Selon Alex|Selon Inès", "les deux réponses côte à côte, Alex puis Inès");
  check(await one.page.locator('[data-act="again"]').count() === 4 && await one.page.getAttribute('[data-act="again"][aria-current]', "data-pack") === "quotidien", "« Rejouer avec » propose les paquets, celui qu'on vient de jouer repéré");
  await one.page.click('[data-act="again"][data-pack="quotidien"]');
  await one.page.waitForSelector(".quiest-card");
  check((await step(one)).includes("Nouvelle partie") && (await step(one)).includes("Question 1") && await one.page.locator(".quiest.as-a").count() === 1, "rejouer repart à la première question, Alex en premier");
  const game2 = [];
  await answer(one, "a".repeat(N), game2);
  check(game2.every((q) => inPack("quotidien", q)) && game2.every((q) => game1.indexOf(q) < 0) && new Set(game2).size === N, "la nouvelle partie continue le paquet : aucune question déjà posée");
  await one.page.click('[data-act="moi"]');
  await answer(one, "2".repeat(N));
  await one.page.waitForSelector('[data-screen="resultat"]');
  check((await one.page.locator(".g-big").textContent()).replace(/\s+/g, "") === "0/15" && (await one.page.locator(".quiest-tag").first().textContent()) === "À moitié d'accord", "aucun accord : zéro sur quinze");

  console.log("Valeurs hostiles");
  const s = await saved(one);
  const tok = s.gen + ":" + s.setup.seed;
  await one.page.evaluate(([k, h]) => {
    const x = JSON.parse(localStorage.getItem("en:g:quiest"));
    x.n = ["<i>Al</i>", "<b>In</b>"]; /* 20 caractères au plus, sinon le socle jette la partie */
    x.setup.pack = "<b>x</b>";
    x.setup.at = { quotidien: "x", caractere: -4 };
    x.S.b = { k, d: { r: h + "aaaaaaa", fin: "1" } };
    x.local.pass = 0;
    localStorage.setItem("en:g:quiest", JSON.stringify(x));
  }, [tok, HOSTILE]);
  await one.page.reload();
  await one.page.waitForSelector(".g-pass");
  check(await one.page.locator("#app img, .g-pass b").count() === 0 && await one.page.evaluate(() => window.__xss === undefined) && (await one.page.locator(".g-pass h1").textContent()).includes("<b>In</b>"),
    "des prénoms et des réponses piégés s'affichent comme du texte");
  check(await screen(one) === "passe", "des réponses mal formées comptent pour « pas encore répondu »");
  await one.page.click('[data-act="moi"]');
  check(inPack("quotidien", await question(one)) || inPack("caractere", await question(one)), "un paquet inconnu retombe sur le mélange");
  await one.page.evaluate(([k]) => {
    const x = JSON.parse(localStorage.getItem("en:g:quiest"));
    x.S.b = { k, d: { r: ["a"], fin: 1 } };
    x.local.d = { b: 12 };
    localStorage.setItem("en:g:quiest", JSON.stringify(x));
  }, [tok]);
  await one.page.reload();
  await one.page.waitForSelector(".quiest-card");
  check((await step(one)).includes("Question 1") && await one.page.locator(".quiest.as-b").count() === 1, "une réponse de mauvais type et un brouillon abîmé ne bloquent pas l'écran");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-quiest");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-opt"][data-val="caractere"]');
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector(".quiest-card");
  check(await a.page.locator(".quiest-shh").count() === 0 && inPack("caractere", await question(a)), "A commence sans attendre B, sans consigne de détourner les yeux");
  const before = (await env.ctl()).count.post, qa = [];
  await answer(a, PA.slice(0, 7), qa);
  await a.page.reload();
  await a.page.waitForSelector(".quiest-card");
  check((await step(a)).includes("Question 8"), "A recharge : reprise à la huitième question");
  await answer(a, PA.slice(7), qa);
  await a.page.waitForSelector('[data-screen="attente"]');
  check((await a.page.locator(".g-title").textContent()).includes("C'est envoyé") && await a.page.locator(".g-wait").count() === 1, "A a fini : on attend les réponses de B");
  check(await until(async () => (await env.ctl()).count.post === before + 1), "les quinze réponses partent en un seul message (" + ((await env.ctl()).count.post - before) + ")");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector(".quiest-card");
  check(await b.page.locator(".quiest.as-b").count() === 1 && await question(b) === qa[0], "B rejoint : mêmes questions, sous sa couleur");
  check(await until(async () => (await b.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:quiest")).S.a.d.r || "")) === PA), "les réponses de A sont arrivées chez B");
  check(await b.page.locator(".quiest-chip").count() === 0 && !(await b.page.locator("#app").textContent()).includes("Selon"), "B ne voit rien des réponses de A avant d'avoir répondu");
  await answer(b, PB.slice(0, 8));
  await b.page.reload();
  await b.page.waitForSelector(".quiest-card");
  check((await step(b)).includes("Question 9"), "B recharge : reprise à la neuvième question");
  await answer(b, PB.slice(8, 14));
  await b.page.click('[data-act="back"]');
  await sleep(270);
  await answer(b, PB.slice(13));
  await b.page.waitForSelector('[data-screen="resultat"]');
  check((await b.page.locator(".g-big").textContent()).replace(/\s+/g, "") === agree + "/15", "B finit en second et voit aussitôt le résultat");
  check(await b.page.locator('[data-act="again"]').count() === 0 && (await b.page.locator(".g-wait").textContent()).includes("dès qu'Alex aura vu le résultat"), "B ne peut pas relancer avant que A ait vu le résultat");
  check(await until(() => a.page.locator('[data-screen="pret"]').count()) && (await a.page.locator(".g-title").textContent()).includes("Les réponses d'Inès sont arrivées"), "chez A, les réponses de B sont annoncées");
  await a.page.reload();
  await a.page.waitForSelector('[data-screen="pret"]');
  await a.page.click('[data-act="voir"]');
  await a.page.waitForSelector('[data-screen="resultat"]');
  check((await a.page.locator(".g-big").textContent()).replace(/\s+/g, "") === agree + "/15" && await a.page.locator('[data-act="again"]').count() === 4, "A voit le même résultat, et peut rejouer");
  check(await until(() => b.page.locator('[data-act="again"]').count()), "A a vu le résultat : « Rejouer avec » apparaît chez B");
  await b.page.click('[data-act="again"][data-pack="melange"]');
  check(await until(async () => (await a.page.locator(".quiest-card").count()) && (await step(a)).includes("Nouvelle partie")), "B relance : A repart aussi à la première question");
  await b.page.waitForSelector(".quiest-card");
  const m1 = await question(a);
  check(m1 === await question(b) && (inPack("quotidien", m1) || inPack("caractere", m1)), "la même question des deux côtés, tirée du mélange");
  const posts = (await env.ctl()).count.post;
  check(posts <= 12, "une partie complète à deux, relance comprise, coûte au plus douze messages (" + posts + ")");
  await a.page.click('[data-act="g-stop"]');
  await sleep(500);
  await a.page.click('[data-act="g-stop"]');
  await a.page.waitForSelector("main.intro");
  check(await until(() => b.page.locator(".g-gone").count(), 8000), "A arrête la partie : B en est prévenu");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
