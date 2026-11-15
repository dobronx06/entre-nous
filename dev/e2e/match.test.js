/* Essais du jeu « Le match des envies » : un paquet complet sur un téléphone, puis sur deux par le
   faux relais, avec gestes, rechargements, secrets, résultat manqué, relance et données hostiles. */
const { setup, check, done, sleep } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Paquets de secours : ils ne servent que si jeux/match.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const mk = (id, name, adult) => ({ id, name, hint: "Paquet d'essai.", adult, items: Array.from({ length: 36 }, (_, i) => "Envie d'essai n° " + (i + 1) + " du paquet " + id) });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.match = { decks: [mk("sorties", "Sorties et soirées"), mk("maison", "À la maison"), mk("voyages", "Voyages et escapades"), mk("fous", "Projets fous"), mk("table", "À table"), mk("couette", "Sous la couette", true)] };
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  return p;
}
const norm = (s) => (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:match")));
const kept = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:match:liste")) || []);
const card = async (p) => norm(await p.page.locator(".match-card .g-card-text").textContent());
const count = async (p) => norm(await p.page.locator(".match-count").textContent());
const title = async (p) => norm(await p.page.locator(".match .g-title").textContent());
const ideas = async (p) => (await p.page.locator(".match-list li p").allTextContents()).map(norm);
const html = (p) => p.page.locator("#app").innerHTML();
const safe = async (p) => await p.page.locator("#app img").count() === 0 && await p.page.evaluate(() => window.__xss === undefined);
/* La plus petite hauteur, en pixels, parmi les éléments touchables désignés. */
const reach = (p, sel) => p.page.evaluate((q) => Math.min(...[...document.querySelectorAll(q)].map((el) => el.getBoundingClientRect().height)), sel);
/* Tout se touche au doigt, comme sur un vrai téléphone : un clic de souris peut se perdre si l'autre
   téléphone fait réafficher l'écran entre l'appui et le relâchement, pas un toucher. */
/* Un écran qui vient d'apparaître ignore les touchers pendant une demi-seconde (ils visaient le précédent) :
   comme quelqu'un qui lit avant de toucher, l'essai attend après chaque changement d'écran ou de paquet. */
async function pace(p) {
  const now = await p.page.evaluate(() => {
    const el = document.querySelector("main [data-screen]"), s = JSON.parse(localStorage.getItem("en:g:match") || "null");
    window.__loaded = window.__loaded || Date.now() + Math.random();
    return window.__loaded + "|" + location.hash + "|" + (el ? el.getAttribute("data-screen") : "") + "|" + (s ? s.gen + ":" + s.setup.seed : "");
  }).catch(() => "");
  if (now !== p.seen) { p.seen = now; await sleep(650); }
}
const hit = async (p, sel) => { await pace(p); await p.page.locator(sel).first().tap(); };
const tap = (p, a) => hit(p, '.match-acts [data-k="' + a + '"]');
const twice = async (p, sel) => { await hit(p, sel); await sleep(450); await hit(p, sel); };
/* Rendre le paquet : « J'arrête là » (s'il reste des cartes), puis « Valider mes réponses ». */
const SEND = '[data-act="send"]';
const quit = async (p) => { await hit(p, '[data-act="stop"]'); await hit(p, SEND); };
/* Répond aux cartes de from à to (positions dans l'ordre d'affichage) ; log garde ce qui a été vu et répondu. */
async function play(p, f, from, to, log) {
  for (let i = from; i < to; i++) {
    if (log) { log.t[i] = await card(p); log.a[i] = f(i); }
    await tap(p, f(i));
  }
}
/* Un glisser à la souris ou au doigt (événements tactiles du navigateur) ; renvoie de quoi relâcher. */
async function drag(p, dx, dy, touch) {
  const box = await p.page.locator(".match-card").boundingBox(), x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  if (!touch) {
    await p.page.mouse.move(x, y);
    await p.page.mouse.down();
    await p.page.mouse.move(x + dx, y + dy, { steps: 5 });
    return () => p.page.mouse.up();
  }
  const cdp = await p.ctx.newCDPSession(p.page), at = (k) => [{ x: Math.round(x + (dx * k) / 5), y: Math.round(y + (dy * k) / 5) }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  for (let k = 1; k <= 5; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(k) });
  return async () => { await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach(); };
}
/* Ce que le résultat doit lister : les idées voulues par les deux, les plus fortes d'abord, dans l'ordre du paquet. */
function expected(items, A, B) {
  const all = items.map((t) => { const p = A.t.indexOf(norm(t)), a = A.a[p] || 0, b = B.a[p] || 0; return { t: norm(t), s: a && b ? a + b - 1 : 0 }; });
  return { yes: all.filter((x) => x.s).sort((x, y) => y.s - x.s), no: all.filter((x) => !x.s).map((x) => x.t) };
}
/* Fait écrire à un téléphone, dans le salon, ce qu'un jeu honnête n'écrirait jamais. */
async function forge(p, change) {
  await p.page.evaluate((src) => {
    const s = JSON.parse(localStorage.getItem("en:g:match"));
    new Function("s", src)(s);
    localStorage.setItem("en:g:match", JSON.stringify(s));
  }, change);
  await p.page.reload();
}

(async () => {
  const env = await setup();
  const posts = async () => (await env.ctl()).count.post;
  /* Il arrive que le socle dépose deux fois l'arrivée de l'invité (sa première lecture du salon croise son premier
     envoi) : ce message-là ne vient pas du jeu. Les comptes partent donc de ce que les deux arrivées ont coûté. */
  let base = 2;

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-match");
  const decks = await one.page.evaluate(() => window.GAME_DATA.match.decks.map((d) => ({ id: d.id, name: d.name, items: d.items })));
  const deck = (id) => decks.find((d) => d.id === id), N = deck("maison").items.length;
  check((await one.page.locator("main.intro .eyebrow").textContent()).includes("Le match des envies"), "la présentation du jeu s'affiche");
  check(await one.page.locator('[data-act="g-opt"]').count() === decks.length && await one.page.locator('[data-act="g-opt"] .g-tag').count() === 1, "les " + decks.length + " paquets sont proposés, un seul réservé aux adultes");
  check(await one.page.locator('[data-act="g-opt"][data-val="sorties"]').getAttribute("aria-pressed") === "true", "« sorties » est le paquet par défaut");
  check(await one.page.locator(".match-keep").count() === 0, "pas de liste « Nos envies » tant qu'elle est vide");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await hit(one, '[data-act="g-opt"][data-val="maison"]');
  await hit(one, '[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector(".match-card");
  const A = { t: [], a: [] }, B = { t: [], a: [] };
  A.t[0] = await card(one);
  check(await one.page.locator(".match.as-a").count() === 1 && await count(one) === "1 / " + N, "Alex commence, carte 1 sur " + N);
  check(deck("maison").items.map(norm).includes(A.t[0]) && norm(await one.page.locator(".match-card .g-tag").textContent()) === norm(deck("maison").name), "la carte vient du paquet choisi");
  check(await one.page.locator('[data-act="undo"]').count() === 0, "rien à reprendre à la première carte");
  await tap(one, 2);
  check(await reach(one, ".match-acts button") >= 44, "boutons et liens de la carte font au moins 44 px de haut");
  check(await count(one) === "2 / " + N && await card(one) !== A.t[0], "un bouton répond et passe à la carte suivante");
  await hit(one, '[data-act="undo"]');
  check(await count(one) === "1 / " + N && await card(one) === A.t[0] && !(await saved(one)).local.d, "« Revenir à la précédente » rend la carte et efface la réponse");

  console.log("Clavier et gestes");
  const next = async (a) => { A.a.push(a); A.t[A.a.length] = await card(one); };
  await one.page.keyboard.press("ArrowLeft"); await next(0);
  await one.page.keyboard.press("ArrowUp"); await next(2);
  await one.page.keyboard.press("ArrowRight"); await next(1);
  check((await saved(one)).local.d === "021", "flèches gauche, haut, droite : non, carrément, pourquoi pas");
  await one.page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", repeat: true, bubbles: true })));
  check((await saved(one)).local.d === "021", "une touche restée enfoncée ne répond pas en rafale");
  let release = await drag(one, -120, 6);
  check(norm(await one.page.locator(".match-stamp").textContent()) === "Non" && await one.page.locator(".match-stamp.is-on").count() === 1, "pendant le glisser à gauche, la carte annonce « Non »");
  await release(); await next(0);
  check((await saved(one)).local.d === "0210", "glisser à gauche à la souris répond non");
  release = await drag(one, 50, 0);
  check(await one.page.locator(".match-stamp.is-on").count() === 0, "sous le seuil, la réponse n'est pas acquise");
  await release();
  check((await saved(one)).local.d === "0210" && await one.page.evaluate(() => document.querySelector(".match-card").style.transform === ""), "un petit glisser ne répond pas : la carte revient à sa place");
  release = await drag(one, 6, -130, true);
  check(norm(await one.page.locator(".match-stamp").textContent()) === "Carrément", "au doigt, vers le haut, la carte annonce « Carrément »");
  await release(); await next(2);
  release = await drag(one, 140, 12, true);
  check(norm(await one.page.locator(".match-stamp").textContent()) === "Pourquoi pas" && await one.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && window.scrollX === 0),
    "au doigt, vers la droite, « Pourquoi pas » s'annonce et la page ne défile pas de côté");
  await release(); await next(1);
  check((await saved(one)).local.d === "021021", "les deux glissers au doigt ont répondu carrément puis pourquoi pas");
  release = await drag(one, 10, 120, true);
  await release();
  check((await saved(one)).local.d === "021021", "glisser vers le bas ne répond rien");

  console.log("Un paquet complet, chacun son tour");
  const fa = (p) => [2, 1, 0][p % 3], fb = (p) => [2, 2, 1, 0, 1, 2, 0][p % 7];
  await play(one, fa, 6, 10, A);
  const before = await card(one);
  await one.page.reload();
  await one.page.waitForSelector(".match-card");
  check(await count(one) === "11 / " + N && await card(one) === before && (await saved(one)).local.d.length === 10, "après rechargement, Alex retrouve sa carte et son brouillon");
  await one.page.goto(env.base + "#accueil");
  check(await one.page.locator('a.card-state[href="#jeu-match"]').count() === 1, "à l'accueil, la partie en cours se propose à la reprise");
  await one.page.goto(env.base + "#jeu-match");
  await one.page.waitForSelector(".match-card");
  await play(one, fa, 10, N, A);
  await one.page.waitForSelector(SEND);
  check((await title(one)).includes("la dernière") && (await saved(one)).S.a.d.v === undefined && (await saved(one)).local.d.length === N, "après la dernière carte, rien n'est encore rendu : un écran propose de valider");
  await hit(one, '[data-act="undo"]');
  await one.page.waitForSelector(".match-card");
  check(await count(one) === N + " / " + N && await card(one) === A.t[N - 1] && (await saved(one)).local.d.length === N - 1, "la dernière réponse se reprend comme les autres");
  await tap(one, fa(N - 1));
  await one.page.reload();
  await one.page.waitForSelector(SEND);
  check(await one.page.locator(".match-card").count() === 0, "après rechargement, toujours à valider");
  await hit(one, SEND);
  await one.page.waitForSelector(".g-pass");
  const va = (await saved(one)).S.a.d.v;
  check(typeof va === "string" && va.length === N && deck("maison").items.every((t, i) => va[i] === String(A.a[A.t.indexOf(norm(t))])), "les réponses d'Alex sont rangées dans l'ordre du paquet");
  check(await one.page.locator(".g-pass.as-b").count() === 1 && (await one.page.locator(".g-pass h1").textContent()).includes("d'Inès"), "puis le téléphone passe à Inès");
  check(await one.page.locator(".match-card").count() === 0 && !(await html(one)).includes(va), "rien des réponses d'Alex n'est à l'écran");
  await one.page.keyboard.press("ArrowUp");
  check(await one.page.locator(".g-pass").count() === 1 && (await saved(one)).S.b.d.v === undefined, "et les flèches ne répondent à la place de personne");
  await one.page.reload();
  await one.page.waitForSelector(".g-pass");
  check(await one.page.locator(".g-pass.as-b").count() === 1, "après rechargement, toujours le passage de téléphone");
  await hit(one, '[data-act="go"]');
  await one.page.waitForSelector(".match-card");
  check(await one.page.locator(".match.as-b").count() === 1 && await count(one) === "1 / " + N && await card(one) === A.t[0], "Inès voit les mêmes cartes, dans le même ordre");
  check(await one.page.locator('[data-act="undo"]').count() === 0 && !(await html(one)).includes(va), "sans pouvoir revenir sur celles d'Alex ni rien en voir");
  await play(one, fb, 0, 24, B);
  const left = await card(one);
  await hit(one, '[data-act="stop"]');
  await one.page.waitForSelector(SEND);
  check((await title(one)).includes("arrêtes là") && norm(await one.page.locator(".g-lead").textContent()).includes("Les " + (N - 24) + " idées") && (await saved(one)).S.b.d.v === undefined, "« J'arrête là » ne rend rien tout de suite : il annonce ce qui comptera comme non");
  await hit(one, '[data-act="undo"]');
  await one.page.waitForSelector(".match-card");
  check(await card(one) === left && (await saved(one)).local.d.length === 24, "« Continuer le paquet » rend la carte laissée, sans défaire de réponse");
  await quit(one);
  await one.page.waitForSelector(".match-venn");
  const vb = (await saved(one)).S.b.d.v;
  check(vb.length === N && A.t.slice(24).every((t) => vb[deck("maison").items.map(norm).indexOf(t)] === "0"), "les cartes qu'Inès n'a pas vues comptent pour un non");

  console.log("Résultat");
  const want = expected(deck("maison").items, A, B), tops = want.yes.filter((x) => x.s === 3).length;
  check(want.yes.length > 3 && tops > 0 && tops < want.yes.length && want.no.length > 3, "(l'essai couvre coups de cœur, envies partagées et refus : " + tops + ", " + (want.yes.length - tops) + ", " + want.no.length + ")");
  check((await title(one)) === want.yes.length + " envies en commun", "le résultat annonce " + want.yes.length + " envies en commun");
  check(JSON.stringify(await ideas(one)) === JSON.stringify(want.yes.map((x) => x.t)), "et liste exactement ces envies, les plus fortes d'abord");
  check(await one.page.locator(".match-list li .match-duo").count() === tops && await one.page.locator(".match-list li").nth(tops - 1).locator(".match-duo").count() === 1, "les deux « carrément » sont en tête, marqués « Coup de cœur à deux »");
  const shown = norm(await one.page.locator("#app").textContent());
  check(want.no.every((t) => !shown.includes(t)), "aucune idée refusée par l'un ou l'autre n'apparaît");
  check(!shown.includes("Alex") && !shown.includes("Inès") && !(await html(one)).includes(va) && !(await html(one)).includes(vb), "ni prénom ni total par joueur : rien ne dit qui a répondu quoi");
  check((await one.page.locator(".match-venn .venn").getAttribute("aria-label")).includes(" " + Math.round((100 * want.yes.length) / N) + " %"), "les deux encres se recouvrent à la mesure du paquet");
  let list = await kept(one);
  check(list.length === want.yes.length && want.yes.every((x) => list.some((it) => norm(it.t) === x.t && it.d === "maison" && it.s === x.s && it.f === false)), "les envies communes sont gardées sur l'appareil, avec leur paquet et leur force");
  check(await reach(one, ".match-done, .g-choice") >= 44, "les coches « Fait » et les choix de paquet aussi");
  check(norm(await one.page.locator(".match-done").first().getAttribute("aria-label")) === "Fait : " + want.yes[0].t && await one.page.locator('[data-act="again"][aria-pressed]').count() === 0 && await one.page.locator('[data-act="again"][aria-current="true"]').count() === 1,
    "chaque coche porte le nom de son envie, et les choix de paquet ne s'annoncent pas comme des bascules");
  check(norm(await one.page.locator(".match-list + .hint").textContent()).startsWith("Elles sont gardées"), "la liste gardée s'annonce au pluriel");
  await hit(one, ".match-done");
  check(await one.page.locator(".match-done").first().getAttribute("aria-pressed") === "true" && await one.page.locator(".match-list li.is-done").count() === 1, "« Fait » se coche sur place");
  await one.page.reload();
  await one.page.waitForSelector(".match-list");
  list = await kept(one);
  check(list.length === want.yes.length && list.filter((it) => it.f).length === 1 && await one.page.locator(".match-list li.is-done").count() === 1, "après rechargement : même liste, sans doublon, et la coche est restée");
  await one.page.goto(env.base + "#accueil");
  check(await one.page.locator('a.card-state[href="#jeu-match"]').count() === 0 && await one.page.locator(".banner").count() === 0, "paquet fini : l'accueil ne propose plus de reprendre la partie");
  await one.page.goto(env.base + "#jeu-match");
  await one.page.waitForSelector(".match-list");

  console.log("Un autre paquet");
  await one.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await hit(one, '[data-act="again"][data-deck="table"]');
  await one.page.waitForSelector(".match-card");
  check(await one.page.evaluate(() => window.scrollY === 0), "le paquet suivant s'ouvre en haut de page");
  check(await one.page.locator(".match.as-b").count() === 1 && await count(one) === "1 / " + deck("table").items.length && norm(await one.page.locator(".match-card .g-tag").textContent()) === norm(deck("table").name),
    "le paquet suivant démarre avec Inès, qui tient déjà le téléphone");
  check(await one.page.locator('[data-act="ok"]').count() === 0, "celui qui relance a vu le résultat : il ne lui est pas remontré");
  await play(one, () => 1, 0, 2);
  check(await one.page.locator('[data-act="review"]').count() === 0, "passé la première carte, le lien vers le résultat précédent s'efface");
  for (let i = 0; i < 4; i++) { if (await one.page.locator('[data-act="undo"]').count()) await hit(one, '[data-act="undo"]'); }
  check(await one.page.locator(".match-card").count() === 1 && await count(one) === "1 / " + deck("table").items.length && await one.page.locator('.match-more [data-act="review"]').count() === 0,
    "revenir en arrière jusqu'à la première carte ne rouvre pas le résultat précédent : son lien n'est pas à la place de « Revenir »");
  await hit(one, '[data-act="review"]');
  await one.page.waitForSelector('[data-act="ok"]');
  check(JSON.stringify(await ideas(one)) === JSON.stringify(want.yes.map((x) => x.t)) && await one.page.locator(".match-list li.is-done").count() === 1, "« Revoir le résultat précédent » le rouvre, coche comprise");
  check(norm(await one.page.locator('[data-act="ok"]').textContent()) === "Revenir au paquet en cours" && !norm(await one.page.locator("#app").textContent()).includes("déjà lancé"), "sans le présenter comme un résultat manqué");
  await one.page.reload();
  await one.page.waitForSelector('[data-act="ok"]');
  await hit(one, '[data-act="ok"]');
  await one.page.waitForSelector(".match-card");
  await one.page.reload();
  await one.page.waitForSelector(".match-card");
  await quit(one);
  await one.page.waitForSelector(".g-pass.as-a");
  await hit(one, '[data-act="go"]');
  await tap(one, 2);
  await quit(one);
  await one.page.waitForSelector(".match-venn");
  check((await title(one)).includes("Rien en commun") && await one.page.locator(".match-list").count() === 0 && await one.page.locator('[data-act="again"]').count() === decks.length, "rien en commun : un mot gentil et d'autres paquets à essayer");
  check((await kept(one)).length === want.yes.length, "et rien ne s'ajoute à la liste");

  console.log("La liste « Nos envies »");
  await twice(one, '.g-foot [data-act="g-stop"]');
  await one.page.waitForSelector(".match-keep");
  check(await one.page.evaluate(() => !document.querySelector(".match-keep").open) && norm(await one.page.locator(".match-keep summary").textContent()) === "Nos envies " + want.yes.length, "la présentation range la liste, repliée, avec son compte");
  await hit(one, ".match-keep summary");
  check(await one.page.locator(".match-keep li").count() === want.yes.length && await one.page.locator(".match-keep li.is-done").count() === 1 && norm(await one.page.locator(".match-keep .match-from").first().textContent()) === norm(deck("maison").name),
    "dépliée, elle montre chaque envie, son paquet et ce qui est fait");
  check(await reach(one, ".match-keep summary, .match-keep button") >= 44, "comme le titre de la liste, ses coches et son bouton pour la vider");
  await hit(one, '.match-keep .match-done[aria-pressed="false"]');
  check(await one.page.evaluate(() => document.querySelector(".match-keep").open) && await one.page.locator(".match-keep li.is-done").count() === 2 && (await kept(one)).filter((it) => it.f).length === 2, "cocher « Fait » ne referme pas la liste et s'enregistre");
  await hit(one, '[data-act="vider"]');
  check(await one.page.locator(".match-keep li").count() === want.yes.length && (await kept(one)).length === want.yes.length, "« Vider la liste » demande un second toucher");
  await hit(one, '[data-act="vider"]');
  check(await until(() => one.page.locator(".match-keep").count().then((n) => n === 0)) && await one.page.evaluate(() => localStorage.getItem("en:match:liste") === null), "au second, la liste est vidée");
  check(await one.page.evaluate(() => { const el = document.activeElement; return el.getAttribute("role") === "status" && el.textContent === "La liste est vide." && !!el.closest("[data-extra]"); }), "et la page le dit, là où le focus reste");
  await one.page.evaluate((h) => localStorage.setItem("en:match:liste", JSON.stringify([{ t: h, d: h, s: 99, f: "oui" }, null, 5, { t: 7 }, "x"])), HOSTILE);
  await one.page.reload();
  await one.page.waitForSelector(".match-keep");
  check(await one.page.locator(".match-keep li").count() === 1 && (await one.page.locator(".match-keep li p").textContent()).includes("<img") && await safe(one), "une liste enregistrée abîmée s'affiche sans dégât, le reste est ignoré");
  await one.page.evaluate(() => localStorage.setItem("en:match:liste", JSON.stringify("pas une liste")));
  await one.page.reload();
  await one.page.waitForSelector("main.intro");
  check(await one.page.locator(".match-keep").count() === 0, "et une liste illisible est laissée de côté");

  console.log("Avec les animations");
  const anim = await phone(env, "animé", { motion: true });
  await anim.page.goto(env.base + "#jeu-match");
  await hit(anim, '[data-act="g-start"][data-mode="solo"]');
  await anim.page.waitForSelector(".match-card");
  const first = await card(anim);
  await pace(anim);
  check(await anim.page.evaluate(() => { const b = document.querySelector('.match-acts [data-k="2"]'); b.click(); b.click(); return document.querySelector(".match-card").classList.contains("is-out"); }), "la carte s'envole avant de laisser la place");
  check(await until(async () => await count(anim) === "2 / " + N) && await card(anim) !== first, "puis la suivante arrive");
  await sleep(400);
  check((await saved(anim)).local.d === "2", "deux touchers coup sur coup ne comptent qu'une réponse");
  await anim.page.evaluate(() => {
    const el = document.querySelector(".match-card"), key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const ptr = (type, x) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, isPrimary: true, button: 0, clientX: x, clientY: 300, bubbles: true }));
    key("ArrowLeft"); key("ArrowUp"); ptr("pointerdown", 100); ptr("pointermove", 260); ptr("pointerup", 260);
  });
  await sleep(600);
  check((await saved(anim)).local.d === "20" && await count(anim) === "3 / " + N, "touche et glisser pendant l'envol sont ignorés");
  release = await drag(anim, 130, 0);
  await release();
  check(await until(async () => (await saved(anim)).local.d === "201"), "le glisser répond une fois la carte posée");
  await sleep(400);
  check((await saved(anim)).local.d === "201" && await count(anim) === "4 / " + N, "et ne compte qu'une fois");
  for (let i = 3; i < N; i++) {
    await tap(anim, 1);
    await until(async () => i === N - 1 || await count(anim) === (i + 2) + " / " + N, 3000);
  }
  check(await until(() => anim.page.locator(SEND).count()), "la dernière carte s'envole aussi");
  await hit(anim, SEND);
  check(await until(() => anim.page.locator(".g-pass").count()) && (await saved(anim)).S.a.d.v.length === N, "puis le paquet est rendu");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-match");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await hit(a, '[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await hit(a, '[data-act="g-go"]');
  await a.page.waitForSelector(".match-card");
  await b.page.goto(link);
  await hit(b, '[data-act="g-join"]');
  await b.page.waitForSelector(".match-card");
  await until(async () => await posts() >= 2);
  await sleep(900);
  base = await posts();
  check(base === 2 || base === 3, "deux arrivées : deux messages, trois si le socle dépose deux fois celle de l'invité (" + base + ")");
  check(await card(a) === await card(b) && await a.page.locator(".match.as-a").count() === 1 && await b.page.locator(".match.as-b").count() === 1, "les deux téléphones montrent la même carte, chacun sous sa couleur");
  const A2 = { t: [], a: [] }, B2 = { t: [], a: [] }, S = deck("sorties").items;
  await play(a, fa, 0, 10, A2);
  const mid = await card(a);
  await a.page.reload();
  await a.page.waitForSelector(".match-card");
  check(await count(a) === "11 / " + N && await card(a) === mid, "A recharge en plein paquet et reprend où il en était");
  check(await posts() === base, "répondre ne coûte aucun message : les réponses restent un brouillon sur l'appareil");
  const box = await a.page.locator(".match-card").boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await a.page.mouse.move(cx, cy);
  await a.page.mouse.down();
  await a.page.mouse.move(cx + 30, cy, { steps: 3 });
  await a.page.evaluate(() => { document.querySelector(".match-card").held = true; });
  await play(b, fb, 0, N, B2);
  await hit(b, SEND);
  check(await until(() => b.page.locator(".g-wait").count()) && (await b.page.locator(".g-lead").textContent()).includes("qu'Alex"), "B a fini le premier et attend Alex");
  check(await b.page.locator(".match-list").count() === 0 && await b.page.locator(".match-venn").count() === 0, "sans rien voir du résultat");
  check(await until(async () => { const v = (await saved(a)).S.b.d.v; return typeof v === "string" && v.length === N; }), "les réponses de B sont arrivées sur le téléphone de A");
  const vb2 = (await saved(a)).S.b.d.v;
  check(await a.page.evaluate(() => document.querySelector(".match-card").held === true), "A tenait sa carte : rien ne s'est redessiné sous son doigt");
  await a.page.mouse.move(cx + 130, cy, { steps: 3 });
  await a.page.mouse.up();
  A2.t[10] = mid;
  A2.a[10] = 1;
  check(await count(a) === "12 / " + N && (await saved(a)).local.d.length === 11 && await a.page.evaluate(() => !document.querySelector(".match-card").held), "au lâcher, sa réponse compte et l'écran se remet à jour");
  check(await a.page.locator(".match-card").count() === 1 && await a.page.locator(".match-list").count() === 0 && !(await html(a)).includes(vb2), "mais A ne voit rien des réponses de B tant qu'il n'a pas fini");
  await b.page.reload();
  await b.page.waitForSelector(".g-wait");
  check(await b.page.locator(".match-card").count() === 0, "B recharge pendant l'attente : toujours en attente, sans carte à refaire");
  await play(a, fa, 11, N, A2);
  await hit(a, SEND);
  check(await until(async () => (await a.page.locator(".match-list").count()) && (await b.page.locator(".match-list").count())), "quand A finit, le résultat s'ouvre sur les deux téléphones");
  const want2 = expected(S, A2, B2);
  check(JSON.stringify(await ideas(a)) === JSON.stringify(want2.yes.map((x) => x.t)) && JSON.stringify(await ideas(b)) === JSON.stringify(await ideas(a)) && await title(a) === await title(b), "avec les mêmes " + want2.yes.length + " envies communes");
  const sa = norm(await a.page.locator("#app").textContent()), sb = norm(await b.page.locator("#app").textContent());
  check(want2.no.every((t) => !sa.includes(t) && !sb.includes(t)), "et aucune des idées refusées, d'un côté comme de l'autre");
  check((await kept(a)).length === want2.yes.length && (await kept(b)).length === want2.yes.length, "chaque téléphone garde les envies communes");
  await hit(a, ".match-done");
  await sleep(500);
  check(await b.page.locator(".match-list li.is-done").count() === 0, "« Fait » reste sur l'appareil où il est coché");
  check(await posts() === base + 2, "un paquet à deux coûte deux messages, un par joueur, en plus des arrivées (" + await posts() + ")");

  console.log("B relance un paquet");
  await a.page.evaluate(() => window.scrollTo(0, 260));
  await hit(b, '[data-act="again"][data-deck="voyages"]');
  check(await until(() => a.page.locator('[data-act="ok"]').count()) && JSON.stringify(await ideas(a)) === JSON.stringify(want2.yes.map((x) => x.t)) && await a.page.locator(".match-list li.is-done").count() === 1 && await a.page.evaluate(() => window.scrollY === 260),
    "A lisait le résultat quand B relance : sa liste reste sous ses yeux, au même endroit, coche comprise");
  check(norm(await a.page.locator(".match-acts .hint").textContent()).includes("« " + norm(deck("voyages").name) + " »") && await a.page.locator('[data-act="again"]').count() === 0, "le bas de l'écran lui annonce le paquet lancé, sans plus proposer d'en choisir un");
  await a.page.reload();
  await a.page.waitForSelector('[data-act="ok"]');
  await hit(a, '[data-act="ok"]');
  check(await until(async () => (await a.page.locator(".match-card").count()) && await count(a) === "1 / " + deck("voyages").items.length && norm(await a.page.locator(".match-card .g-tag").textContent()) === norm(deck("voyages").name)),
    "le paquet choisi par B démarre aussi chez A");
  check(await card(a) === await card(b) && !(await saved(a)).local.d, "même première carte, brouillons repartis de zéro");

  console.log("Résultat manqué");
  await play(a, () => 2, 0, deck("voyages").items.length);
  await hit(a, SEND);
  await a.page.waitForSelector(".g-wait");
  check(await until(async () => await posts() === base + 4), "les réponses de A sont parties");
  await a.page.goto("about:blank");
  await play(b, () => 1, 0, deck("voyages").items.length);
  await hit(b, SEND);
  await b.page.waitForSelector(".match-list");
  check((await title(b)) === deck("voyages").items.length + " envies en commun" && await b.page.locator(".match-duo").count() === 0, "A est parti ; B finit et voit le résultat du paquet");
  await hit(b, '[data-act="again"][data-deck="fous"]');
  await b.page.waitForSelector(".match-card");
  check(await until(async () => await posts() === base + 6), "B lance aussitôt le paquet suivant");
  await a.page.goto(env.base + "#jeu-match");
  check(await until(() => a.page.locator('[data-act="ok"]').count()) && await a.page.locator(".match-card").count() === 0, "à son retour, A trouve d'abord le résultat qu'il n'avait pas vu");
  check((await a.page.locator(".match .eyebrow").textContent()).includes(deck("voyages").name) && (await ideas(a)).length === deck("voyages").items.length, "celui du paquet précédent, au complet");
  list = await kept(a);
  check(list.length === want2.yes.length + deck("voyages").items.length && new Set(list.map((it) => it.t)).size === list.length, "ses envies rejoignent la liste de A, sans doublon");
  await a.page.reload();
  check(await until(() => a.page.locator('[data-act="ok"]').count()), "après rechargement, le résultat manqué est toujours là");
  await hit(a, '[data-act="ok"]');
  await a.page.waitForSelector(".match-card");
  check(norm(await a.page.locator(".match-card .g-tag").textContent()) === norm(deck("fous").name) && await card(a) === await card(b), "puis A rejoint le paquet en cours");
  check(await posts() === base + 6, "trois paquets lancés, deux joués : six messages en plus des arrivées (" + await posts() + ")");

  console.log("Données hostiles");
  await quit(a);
  await a.page.waitForSelector(".g-wait");
  await a.page.evaluate((h) => localStorage.setItem("en:names", JSON.stringify({ a: h, b: h })), HOSTILE);
  await a.page.reload();
  await a.page.waitForSelector(".g-wait");
  check((await a.page.locator(".g-lead").textContent()).includes("<img") && await safe(a), "un prénom piégé s'affiche comme du texte sur l'écran d'attente");
  const F = deck("fous").items.length;
  for (const [label, v] of [["du HTML", HOSTILE], ["un nombre", 12], ["des chiffres hors bornes", "3".repeat(F)], ["une réponse en moins", "1".repeat(F - 1)], ["un tableau", ["1"]], ["un objet", { length: F }], ["rien", null]]) {
    await forge(b, "s.S.b = { k: s.gen + ':' + s.setup.seed, d: { v: " + JSON.stringify(v) + " } }; s.seq.b.d++;");
    const got = await until(async () => JSON.stringify((await saved(a)).S.b.d.v) === JSON.stringify(v), 8000);
    check(got && await a.page.locator(".g-wait").count() === 1 && await a.page.locator(".match-list").count() === 0 && await safe(a), "réponses de B remplacées par " + label + " : pour A, B n'a simplement pas fini");
  }
  check(await b.page.locator(".match-card").count() === 1 && await safe(b), "et B, qui les a écrites, retrouve ses cartes");
  await forge(b, "s.gen++; s.setup = { seed: " + JSON.stringify(HOSTILE) + ", deck: " + JSON.stringify(HOSTILE) + ", prev: { k: 5, d: 'sorties', m: '9'.repeat(" + S.length + ") } }; s.sh = { x: " + JSON.stringify(HOSTILE) + " }; s.st = 0; s.local = {}; s.seq.b.h++;");
  check(await until(async () => (await a.page.locator(".match-card").count()) && (await saved(a)).setup.deck === HOSTILE, 8000), "B envoie des réglages piégés (paquet, tirage, résultat précédent, état commun) : A les reçoit");
  check(norm(await a.page.locator(".match-card .g-tag").textContent()) === norm(decks[0].name) && await a.page.locator('[data-act="ok"]').count() === 0 && await safe(a), "A retombe sur le premier paquet, sans faux résultat ni dégât");
  await b.page.waitForSelector(".match-card");
  check(await card(a) === await card(b) && await safe(b), "et les deux téléphones montrent encore la même carte");
  await forge(b, "s.gen++; s.setup = { seed: 5, deck: 12, prev: { k: " + JSON.stringify(HOSTILE) + ", d: 'maison', m: '3' + '0'.repeat(" + (N - 1) + ") } }; s.st = 0; s.local = {}; s.seq.b.h++;");
  check(await until(() => a.page.locator('[data-act="ok"]').count(), 8000) && JSON.stringify(await ideas(a)) === JSON.stringify([norm(deck("maison").items[0])]) && await safe(a), "un résultat précédent inventé mais bien formé s'affiche tel quel, sans dégât");
  await hit(a, '[data-act="ok"]');
  await hit(b, '[data-act="ok"]');
  await hit(b, '[data-act="stop"]');
  await quit(a);
  check(await until(async () => typeof (await saved(b)).S.a.d.v === "string") && await b.page.locator(SEND).count() === 1 && await saved(b).then((x) => x.S.b.k !== x.gen + ":" + x.setup.seed),
    "B s'arrête sans avoir validé ; les réponses de l'autre arrivent : toujours à valider, rien n'est parti");
  await hit(b, SEND);
  check(await until(async () => (await title(a)).includes("Rien en commun") && (await title(b)).includes("Rien en commun"), 8000) && await safe(a) && await safe(b), "la partie continue ensuite normalement jusqu'au résultat");
  check((await a.page.locator(".g-opts .hint").textContent()).includes("<img"), "où le prénom piégé reste du texte");

  console.log("Paquets abîmés");
  const odd = await env.phone("abîmé");
  let body = '(window.GAME_DATA = window.GAME_DATA || {}).match = { decks: [{ id: "sorties", name: "Vide", hint: "Rien du tout.", items: [] }, null, { id: "mini", name: "Mini", hint: "Trois envies.", items: ["Une", "Deux", "Trois"] }] };';
  await odd.ctx.route("**/jeux/match.data.js", (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body }));
  await odd.page.goto(env.base + "#jeu-match");
  check(await odd.page.locator('[data-act="g-opt"]').count() === 1 && await odd.page.locator('[data-act="g-opt"][data-val="mini"]').count() === 1, "un paquet vide n'est pas proposé");
  check(await odd.page.locator('[data-act="g-opt"][data-val="mini"]').getAttribute("aria-pressed") === "true", "sans le paquet « sorties », le premier paquet jouable est choisi d'office");
  await hit(odd, '[data-act="g-start"][data-mode="solo"]');
  await odd.page.waitForSelector(".match-card");
  check(await count(odd) === "1 / 3" && norm(await odd.page.locator(".match-card .g-tag").textContent()) === "Mini" && (await saved(odd)).setup.deck === "mini", "et la partie se joue avec lui");
  await play(odd, () => 2, 0, 3);
  await hit(odd, SEND);
  await hit(odd, '[data-act="go"]');
  await tap(odd, 1);
  await quit(odd);
  await odd.page.waitForSelector(".match-list");
  check(await title(odd) === "1 envie en commun" && (await ideas(odd)).length === 1, "et se joue jusqu'au bout, même à trois cartes");
  check(norm(await odd.page.locator(".match-list + .hint").textContent()).startsWith("Elle est gardée"), "une seule envie : la phrase qui l'annonce est au singulier");
  body = '(window.GAME_DATA = window.GAME_DATA || {}).match = { decks: "oups" };';
  await odd.page.reload();
  await odd.page.waitForSelector("main.game");
  check((await title(odd)).includes("cartes manquent") && await odd.page.locator(".match-card").count() === 0, "sans aucun paquet, la partie en cours le dit au lieu de casser");
  await twice(odd, '.g-foot [data-act="g-stop"]');
  await odd.page.waitForSelector("main.intro");
  check(await odd.page.locator('[data-act="g-opt"]').count() === 0 && await odd.page.locator('[data-act="g-start"]').count() > 0, "et la présentation s'affiche sans option");

  console.log("Page intégrée");
  const framed = await phone(env, "cadre");
  await framed.page.setContent('<iframe src="' + env.base + '#jeu-match" style="width:380px;height:800px;border:0"></iframe>');
  const frame = framed.page.frameLocator("iframe");
  await frame.locator('[data-act="g-start"][data-mode="solo"]').tap();
  await frame.locator(".match-card").waitFor();
  await sleep(650);
  await frame.locator('.match-acts [data-k="2"]').tap();
  const fbox = await frame.locator(".match-card").boundingBox();
  await framed.page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
  await framed.page.mouse.down();
  await framed.page.mouse.move(fbox.x + fbox.width / 2 - 120, fbox.y + fbox.height / 2, { steps: 4 });
  await framed.page.mouse.up();
  check(norm(await frame.locator(".match-count").textContent()) === "3 / " + N, "dans un cadre, le jeu se joue sur un téléphone, boutons et glisser compris");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
