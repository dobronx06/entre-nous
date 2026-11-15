/* Essais du jeu « Dessine-moi » : une partie sur un téléphone, puis sur deux, avec rechargements,
   feuilles tenues secrètes, chrono, galerie, image enregistrée, données hostiles et budget de messages. */
const fs = require("fs");
const { setup, check, done, sleep } = require("./lib");

const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
/* La même, précédée de quoi sortir d'un attribut HTML : les prénoms se retrouvent aussi dans des aria-label. */
const SNEAKY = "\">" + HOSTILE;
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
/* Sujets de secours : ils ne servent que si jeux/dessin.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const prompts = [];
  ["portrait", "souvenir", "futur", "delire"].forEach((c) => {
    for (let i = 0; i < 3; i++) prompts.push({ c, x: c === "portrait" ? (i % 2 ? "La grimace préférée {de_o}, version " + i : "{o} au réveil, version " + i) : "Sujet d'essai " + c + " " + i });
  });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.dessin = { prompts };
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript(fixture);
  return p;
}
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:dessin")));
const gallery = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:dessin:galerie") || "[]"));
/* Récrit la partie enregistrée puis recharge la page : pour vieillir le chrono, sauter au dernier sujet,
   ou faire « tricher » un téléphone (ce qu'il a récrit repart vers l'autre à la reconnexion). */
async function rewrite(p, change, arg) {
  await p.page.evaluate(({ code, arg }) => {
    const s = JSON.parse(localStorage.getItem("en:g:dessin"));
    (0, eval)("(" + code + ")")(s, arg);
    localStorage.setItem("en:g:dessin", JSON.stringify(s));
  }, { code: change.toString(), arg });
  await p.page.reload();
}
/* Trace un trait à la souris. Les points sont des fractions de la feuille ; held laisse le « doigt » posé. */
async function stroke(p, pts, held) {
  const b = await p.page.locator(".dessin-sheet").boundingBox(), at = (q) => [b.x + q[0] * b.width, b.y + q[1] * b.height];
  await p.page.mouse.move(...at(pts[0]));
  await p.page.mouse.down();
  for (const q of pts.slice(1)) await p.page.mouse.move(...at(q), { steps: pts.length > 100 ? 1 : 4 });
  if (!held) await p.page.mouse.up();
}
/* Le même geste avec un vrai doigt (événements tactiles), comme sur un téléphone. */
async function finger(p, pts) {
  const b = await p.page.locator(".dessin-sheet").boundingBox(), cdp = await p.ctx.newCDPSession(p.page);
  const touch = (type, q) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: q ? [{ x: Math.round(b.x + q[0] * b.width), y: Math.round(b.y + q[1] * b.height) }] : [] });
  await touch("touchStart", pts[0]);
  for (const q of pts.slice(1)) await touch("touchMove", q);
  await touch("touchEnd");
  await cdp.detach();
}
const ring = (cx, cy, r) => Array.from({ length: 25 }, (_, i) => [cx + r * Math.cos(i / 4), cy + r * Math.sin(i / 4)]);
const pixels = (p) => p.page.evaluate(() => document.querySelector(".dessin-sheet").toDataURL());
const blank = (p) => p.page.evaluate(() => {
  const c = document.querySelector(".dessin-sheet"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  return d.every((v) => v === 255);
});
const title = (p) => p.page.locator(".dessin .g-title").textContent();
const step = (p) => p.page.locator(".dessin-step").textContent();
const subject = (p) => p.page.locator(".dessin-subject").textContent();
/* Le texte affiché est-il bien un sujet du fichier de contenu, avec o à la place de {o} ? La rédaction des
   sujets peut changer : on compare au contenu chargé dans la page, pas à des phrases écrites ici. */
const known = (p, text, o, deO, cat) => p.page.evaluate(([text, o, deO, cat]) => window.GAME_DATA.dessin.prompts.some((q) => {
  const s = q.x.replace(/\{de_o\}/g, deO).replace(/\{o\}/g, o);
  return (!cat || q.c === cat) && s.charAt(0).toUpperCase() + s.slice(1) === text.replace(/\u00a0/g, " ");
}), [text, o, deO, cat]);
const seconds = async (p) => { const m = /(\d+):(\d+)/.exec(await p.page.locator(".dessin-time").textContent()); return m[1] * 60 + Number(m[2]); };
const paths = (p, w) => p.page.locator(".dessin-fig.as-" + w + " .dessin-art path").count();
const harmless = async (p) => await p.page.locator("#app img").count() === 0 && await p.page.evaluate(() => window.__xss === undefined);
/* Un écran qui vient d'apparaître ne répond pas tout de suite (voir le jeu) : une seconde pour « Sujet suivant »,
   « Enregistrer l'image » et « à moi » après le passage du téléphone, une petite demi-seconde ailleurs. On attend,
   comme une personne. */
const PAUSE = 450, LONG = 1100;
async function next(p) {
  await sleep(LONG);
  await p.page.click('[data-act="next"]');
}
async function begin(p) {
  await p.page.waitForSelector('[data-act="start"]');
  await sleep(await p.page.locator(".g-pass").count() ? LONG : PAUSE);
  await p.page.click('[data-act="start"]');
  await p.page.waitForSelector(".dessin-sheet");
  await sleep(PAUSE);
}
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

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-dessin");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="portrait"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector('[data-act="start"]');
  check((await step(one)).trim() === "Sujet 1" && await one.page.locator(".dessin.as-a").count() === 1 && (await title(one)).includes("une minute"), "sujet 1 : Alex commence, avec une minute au chrono");
  check(await one.page.locator(".dessin-subject, .dessin-sheet").count() === 0, "le sujet reste caché tant que le chrono n'est pas lancé");
  await begin(one);
  const forAlex = await subject(one);
  check(await known(one, forAlex, "Inès", "d'Inès", "portrait"), "Alex reçoit un sujet de la catégorie choisie, tourné vers Inès (« " + forAlex + " »)");
  check(await seconds(one) >= 58, "le chrono d'une minute est lancé");
  await stroke(one, [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8]]);
  await stroke(one, [[0.3, 0.5], [0.5, 0.7], [0.7, 0.5]]);
  await finger(one, [[0.2, 0.9], [0.4, 0.86], [0.6, 0.86], [0.8, 0.9]]);
  let cur = (await saved(one)).local.cur;
  check(cur.s.length === 3 && cur.s.every((s) => /^[\w-]{6,}$/.test(s)), "trois traits, à la souris et au doigt, sont rangés sur l'appareil");
  await one.page.click('[data-act="ink"][data-v="2"]');
  await one.page.click('[data-act="size"][data-v="1"]');
  await stroke(one, [[0.1, 0.1], [0.9, 0.9]]);
  cur = (await saved(one)).local.cur;
  check(cur.s[3][0] === ABC[2 * 2 + 1] && await one.page.locator('[data-act="ink"][data-v="2"]').getAttribute("aria-pressed") === "true", "l'encre orange et le trait épais sont pris en compte");
  await one.page.click('[data-act="ink"][data-v="6"]');
  await stroke(one, [[0.5, 0.1], [0.5, 0.3]]);
  check((await saved(one)).local.cur.s[4][0] === ABC[6 * 2 + 1], "la gomme trace en blanc de papier");
  await one.page.click('[data-act="undo"]');
  check((await saved(one)).local.cur.s.length === 4, "« Annuler » retire le dernier trait");
  await one.page.click('[data-act="clear"]');
  check((await saved(one)).local.cur.s.length === 4 && (await one.page.locator('[data-act="clear"]').textContent()).includes("Tout effacer"), "un seul toucher sur « Effacer » n'efface rien");
  await one.page.click('[data-act="clear"]');
  check((await saved(one)).local.cur.s.length === 0 && await blank(one), "le second efface toute la feuille");
  await one.page.click('[data-act="ink"][data-v="0"]');
  await one.page.click('[data-act="size"][data-v="0"]');
  await one.page.locator(".dessin-sheet").click({ position: { x: 100, y: 100 } });
  check(/^A[\w-]{3}$/.test((await saved(one)).local.cur.s.join()) && !(await blank(one)), "un simple toucher laisse un point");
  await one.page.click('[data-act="undo"]');
  check(await blank(one), "qu'« Annuler » retire");
  await one.page.click('[data-act="done"]');
  check(await one.page.locator(".dessin-sheet").count() === 1 && (await one.page.locator('[data-act="done"]').textContent()).includes("feuille blanche"), "une feuille blanche ne part pas sur un seul toucher");
  await one.page.click('[data-act="ink"][data-v="1"]');
  await stroke(one, ring(0.5, 0.45, 0.3));
  await stroke(one, [[0.35, 0.6], [0.5, 0.68], [0.65, 0.6]]);
  const sheetA = await pixels(one), left = await seconds(one);
  await one.page.reload();
  await one.page.waitForSelector(".dessin-sheet");
  check(await pixels(one) === sheetA, "après rechargement, la feuille en cours est retrouvée à l'identique");
  check(await seconds(one) <= left && await one.page.locator('[data-act="ink"][data-v="1"]').getAttribute("aria-pressed") === "true", "le chrono n'est pas reparti de zéro et l'encre choisie est gardée");
  await one.page.click('[data-act="done"]');
  await one.page.waitForSelector(".g-pass");
  check(await one.page.locator(".dessin-art, .dessin-sheet").count() === 0, "la feuille d'Alex disparaît pendant le passage du téléphone");
  await one.page.reload();
  await one.page.waitForSelector(".g-pass");
  check((await one.page.locator(".g-pass h1").textContent()).includes("d'Inès"), "après rechargement, on retrouve le passage du téléphone");
  await sleep(600);
  await one.page.click('.g-pass [data-act="start"]');
  check(await one.page.locator(".g-pass").count() === 1, "un toucher dans la seconde qui suit le passage du téléphone ne lance pas le tour d'Inès");
  await sleep(PAUSE);
  await one.page.dblclick('.g-pass [data-act="start"]');
  await one.page.waitForSelector(".dessin-sheet");
  await sleep(PAUSE);
  const forInes = await subject(one);
  check(await one.page.locator(".dessin.as-b").count() === 1 && forInes.replace(/Alex/g, "#") === forAlex.replace(/Inès/g, "#") && await known(one, forInes, "Alex", "d'Alex", "portrait"), "Inès reçoit le même sujet, tourné vers Alex (« " + forInes + " »)");
  check(await blank(one) && await one.page.locator(".dessin-art").count() === 0, "sa feuille est vierge : rien du dessin d'Alex, et pas de point laissé par un double toucher sur « à moi »");
  await stroke(one, [[0.3, 0.3], [0.7, 0.7]]);
  await rewrite(one, (s) => { s.local.cur.t -= 58500; });
  check(await until(() => one.page.locator(".dessin-pair").count(), 8000), "à la fin du chrono, la feuille part telle quelle et la révélation s'ouvre");
  await one.page.click('[data-act="next"]');
  check(await one.page.locator(".dessin-pair").count() === 1, "un toucher arrivé trop tôt sur « Sujet suivant » ne fait pas sauter la révélation");
  check(await paths(one, "a") === 2 && await paths(one, "b") === 1, "chaque dessin s'affiche du côté de son auteur");
  const head = await title(one);
  check(await known(one, head, "l'autre", "de l'autre", "portrait") && head.replace(/l'autre/gi, "#") === forAlex.replace(/Inès/g, "#").replace(/d'#/g, "de #"), "le titre de la révélation ne prend le parti de personne (« " + head + " »)");
  check((await one.page.locator(".dessin-fig.as-a figcaption").textContent()) === "Par Alex" && (await one.page.locator(".dessin-fig.as-b figcaption").textContent()) === "Par Inès", "signé du prénom de son auteur (« Par Alex », « Par Inès »)");
  check((await gallery(one)).length === 1, "la paire révélée est rangée dans la galerie");
  await one.page.reload();
  await one.page.waitForSelector(".dessin-pair");
  check((await gallery(one)).length === 1 && await paths(one, "a") === 2, "après rechargement, la révélation est retrouvée, sans doublon dans la galerie");
  let early = false;
  const note = () => { early = true; };
  one.page.on("download", note);
  await one.page.click('[data-act="image"]');
  await sleep(LONG);
  one.page.off("download", note);
  check(!early, "un toucher arrivé trop tôt sur « Enregistrer l'image » n'enregistre rien");
  const [file] = await Promise.all([one.page.waitForEvent("download"), one.page.click('[data-act="image"]')]);
  const png = fs.readFileSync(await file.path());
  check(file.suggestedFilename() === "dessine-moi.png" && png.slice(1, 4).toString() === "PNG" && png.readUInt32BE(16) === 1200 && png.length > 5000, "« Enregistrer l'image » télécharge un PNG de 1 200 px de large (" + Math.round(png.length / 1024) + " ko)");
  await one.page.evaluate(() => {
    navigator.canShare = (o) => !!(o && o.files);
    navigator.share = (o) => { window.__shared = o.files[0]; return Promise.resolve(); };
  });
  await one.page.click('[data-act="image"]');
  check(await one.page.evaluate(() => !!window.__shared && window.__shared.type === "image/png" && window.__shared.size > 5000), "quand le téléphone sait partager un fichier, l'image passe par sa feuille de partage");
  await one.page.dblclick('[data-act="next"]');
  await sleep(PAUSE);
  check((await step(one)).includes("Sujet 2") && await one.page.locator(".dessin.as-a").count() === 1 && await one.page.locator(".dessin-sheet").count() === 0,
    "sujet suivant : Alex reprend la main, et un double toucher ne lance pas son chrono à sa place");

  console.log("Fin de la pile, nouvelle manche, dessin démesuré");
  const count = await one.page.evaluate(() => window.GAME_DATA.dessin.prompts.filter((p) => p.c === "portrait").length);
  await rewrite(one, (s, r) => { s.sh = { r }; }, count - 1);
  await one.page.waitForSelector('[data-act="start"]');
  check((await step(one)).includes("Sujet " + count), "on saute au dernier des " + count + " sujets de la catégorie");
  for (let i = 0; i < 2; i++) {
    await begin(one);
    await stroke(one, [[0.2, 0.3 + 0.2 * i], [0.8, 0.5]]);
    await one.page.click('[data-act="done"]');
  }
  await one.page.waitForSelector(".dessin-pair");
  check((await one.page.locator('[data-act="next"]').textContent()).includes("Terminer"), "au dernier sujet, le bouton propose de terminer");
  await next(one);
  await one.page.waitForSelector('[data-act="again"]');
  check((await title(one)).includes("tout dessiné"), "puis l'écran de fin propose de mélanger et de recommencer");
  check((await one.page.locator(".dessin .g-lead").textContent()).includes("juste en dessous") && await one.page.locator(".dessin .dessin-gal .dessin-thumb").count() === 2, "et montre la galerie annoncée, avec les deux paires révélées");
  await one.page.click(".dessin-gal summary");
  const [fromEnd] = await Promise.all([one.page.waitForEvent("download"), one.page.locator(".dessin-thumb").first().click()]);
  check(fromEnd.suggestedFilename() === "dessine-moi.png" && (await saved(one)).gen === 1, "toucher une paire y enregistre son image, sans relancer de pile");
  check(await one.page.locator('[data-act="again"][aria-pressed]').count() === 0 && await one.page.getAttribute('[data-act="again"][aria-current]', "data-v") === "portrait",
    "les tuiles « Rejouer avec » sont de simples boutons, celle de la catégorie qu'on vient de jouer est repérée");
  await one.page.goto(env.base + "#accueil");
  check(await one.page.locator('a.card-state[href="#jeu-dessin"]').count() === 0 && await one.page.locator(".banner").count() === 0, "la pile finie, l'accueil ne propose plus de reprendre la partie");
  await one.page.goto(env.base + "#jeu-dessin");
  check(await one.page.locator(".dessin .dessin-gal").count() === 1, "en revenant sur le jeu, la galerie est toujours sur l'écran de fin");
  await one.page.click('[data-act="again"][data-v="souvenir"]');
  await one.page.waitForSelector('[data-act="start"]');
  let game = await saved(one);
  check(game.gen === 2 && game.setup.sujets === "souvenir" && (await step(one)).includes("Nouvelle pile · Sujet 1"), "« Rejouer avec » relance une manche au sujet 1, dans la catégorie choisie, annoncée comme une nouvelle pile");
  await begin(one);
  await rewrite(one, (s, list) => { s.local.cur.s = list; }, Array.from({ length: 1000 }, (_, k) => scribble(60, k + 1)));
  await one.page.waitForSelector(".dessin-sheet");
  await one.page.click('[data-act="done"]');
  await one.page.waitForSelector(".g-pass");
  const huge = (await saved(one)).S.a.d.d;
  check(huge.length <= 10000 && huge.split(".").length === 1000, "un dessin démesuré (1 000 traits, 120 ko) est simplifié avant de partir : " + huge.length + " caractères, aucun trait perdu");
  await begin(one);
  await stroke(one, Array.from({ length: 2300 }, (_, i) => [0.5 + (0.05 + i / 6000) * Math.cos(i / 22), 0.5 + (0.05 + i / 6000) * Math.sin(i / 22)]));
  cur = (await saved(one)).local.cur;
  check(cur.s.length === 2 && cur.s.every((s) => /^[\w-]{50,8000}$/.test(s)), "un trait interminable (2 300 points sans lever le doigt) est rangé en deux tronçons");
  await one.page.click('[data-act="done"]');
  await one.page.waitForSelector(".dessin-pair");
  check(await paths(one, "a") === 1000 && await paths(one, "b") === 2, "et tout s'affiche en entier à la révélation");

  console.log("Galerie");
  await one.page.click('.g-foot [data-act="g-stop"]'); await sleep(450);
  await one.page.click('.g-foot [data-act="g-stop"]');
  await one.page.waitForSelector("main.intro");
  const kept = (await gallery(one)).length;
  check(kept === 3 && await one.page.locator(".dessin-gal .dessin-thumb").count() === 3, "la présentation range les trois paires révélées dans « Vos dessins »");
  check(await one.page.locator(".dessin-gal[open]").count() === 0 && await one.page.locator(".dessin-thumb").first().isHidden(), "la galerie est repliée");
  await one.page.click(".dessin-gal summary");
  const [again] = await Promise.all([one.page.waitForEvent("download"), one.page.locator(".dessin-thumb").first().click()]);
  check(again.suggestedFilename() === "dessine-moi.png", "toucher une paire enregistre son image");
  await one.page.click('.dessin-gal [data-act="empty"]');
  check((await gallery(one)).length === 3, "un seul toucher ne vide pas la galerie");
  await one.page.click('.dessin-gal [data-act="empty"]');
  check(await until(async () => await one.page.locator(".dessin-gal").count() === 0) && (await gallery(one)).length === 0, "le second la vide");

  console.log("Prénoms hostiles");
  const odd = await phone(env, "prenoms");
  await odd.page.goto(env.base + "#jeu-dessin");
  await odd.page.evaluate((h) => localStorage.setItem("en:names", JSON.stringify({ a: h, b: h })), SNEAKY);
  await odd.page.reload();
  await odd.page.click('[data-act="g-opt"][data-val="30"]');
  await odd.page.click('[data-act="g-opt"][data-val="portrait"]');
  await odd.page.click('[data-act="g-start"][data-mode="solo"]');
  await odd.page.waitForSelector('[data-act="start"]');
  check((await title(odd)).includes("trente secondes") && await harmless(odd), "prêt : le prénom est affiché comme du texte");
  await begin(odd);
  /* Le site ne garde que les vingt premiers caractères d'un prénom : assez pour ouvrir une balise si rien n'était échappé. */
  check(await known(odd, await subject(odd), SNEAKY.slice(0, 20), "de " + SNEAKY.slice(0, 20), "portrait") && await seconds(odd) <= 30 && await harmless(odd), "le sujet aussi, avec trente secondes au chrono");
  await stroke(odd, [[0.2, 0.2], [0.8, 0.8]]);
  await odd.page.click('[data-act="done"]');
  await begin(odd);
  await stroke(odd, [[0.8, 0.2], [0.2, 0.8]]);
  await odd.page.click('[data-act="done"]');
  await odd.page.waitForSelector(".dessin-pair");
  await sleep(LONG);
  const [odd1] = await Promise.all([odd.page.waitForEvent("download"), odd.page.click('[data-act="image"]')]);
  check(await harmless(odd) && odd1.suggestedFilename() === "dessine-moi.png", "révélation et image : toujours du texte");
  await odd.page.click('.g-foot [data-act="g-stop"]'); await sleep(450);
  await odd.page.click('.g-foot [data-act="g-stop"]');
  await odd.page.waitForSelector(".dessin-gal");
  await odd.page.evaluate((h) => { const g = JSON.parse(localStorage.getItem("en:dessin:galerie")); g.push({ k: h, x: h, n: [h, 3], d: [h, h] }, { k: "x", x: h, n: [h, h], d: [h, h] }, "n'importe quoi", null); localStorage.setItem("en:dessin:galerie", JSON.stringify(g)); }, SNEAKY);
  await odd.page.reload();
  await odd.page.waitForSelector(".dessin-gal");
  check(await odd.page.locator(".dessin-thumb").count() === 2 && await harmless(odd), "une galerie abîmée est triée, et son contenu affiché comme du texte");

  console.log("Petit écran");
  const small = await phone(env, "petit", { viewport: { width: 360, height: 520 } });
  await small.page.goto(env.base + "#jeu-dessin");
  await small.page.click('[data-act="g-opt"][data-val="30"]');
  await small.page.click('[data-act="g-start"][data-mode="solo"]');
  await begin(small);
  const fit = await small.page.evaluate(() => {
    const box = (q) => document.querySelector(q).getBoundingClientRect();
    return { sheet: box(".dessin-sheet").width, tools: box(".dessin-tools").bottom, done: box('[data-act="done"]').top, bottom: box('[data-act="done"]').bottom, wide: document.documentElement.scrollWidth };
  });
  check(fit.sheet >= 190 && fit.tools <= fit.done && fit.bottom <= 520 && fit.wide <= 360, "sur un petit écran, la feuille rétrécit (" + Math.round(fit.sheet) + " px) : outils et « J'ai fini » restent visibles, sans défilement de côté");
  await small.page.evaluate(() => window.scrollTo(0, 9999));
  await stroke(small, [[0.2, 0.2], [0.8, 0.8]]);
  await small.page.click('[data-act="done"]');
  await small.page.waitForSelector(".g-pass");
  check(await small.page.evaluate(() => window.scrollY) === 0, "chaque nouvel écran commence en haut de page");

  /* Téléphone étroit : « Effacer » armé reste à sa place (il passait à la ligne, sous « J'ai fini », et « Annuler » prenait sa place). */
  const narrow = await phone(env, "etroit", { viewport: { width: 320, height: 568 } });
  await narrow.page.goto(env.base + "#jeu-dessin");
  await narrow.page.click('[data-act="g-start"][data-mode="solo"]');
  await begin(narrow);
  for (let i = 0; i < 4; i++) await stroke(narrow, [[0.2, 0.2 + 0.15 * i], [0.8, 0.25 + 0.15 * i]]);
  const boxes = () => narrow.page.evaluate(() => JSON.stringify(["undo", "clear"].map((n) => { const r = document.querySelector('[data-act="' + n + '"]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })));
  const rest = await boxes(), spot = await narrow.page.locator('[data-act="clear"]').boundingBox();
  await narrow.page.touchscreen.tap(spot.x + spot.width / 2, spot.y + spot.height / 2);
  const armed = await boxes();
  await narrow.page.touchscreen.tap(spot.x + spot.width / 2, spot.y + spot.height / 2);
  check(armed === rest && (await saved(narrow)).local.cur.s.length === 0, "sur 320 px, « Effacer » armé ne bouge pas : deux touchers au même endroit effacent les quatre traits");
  check(await narrow.page.evaluate(() => Array.from(document.querySelectorAll(".dessin-pick")).every((el) => el.getBoundingClientRect().width >= 44) && document.documentElement.scrollWidth <= 320), "et les sept outils font 44 px de large, sans défilement de côté");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-dessin");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-opt"][data-val="0"]');
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await Promise.all([a.page.waitForSelector('[data-act="start"]'), b.page.waitForSelector('[data-act="start"]')]);
  check(await a.page.locator(".dessin.as-a").count() === 1 && await b.page.locator(".dessin.as-b").count() === 1 && (await title(b)).includes("tout ton temps"), "chacun attend le départ sous sa couleur, sans chrono comme choisi par A");
  /* Le temps que les messages d'arrivée soient tous partis : le socle redépose parfois le sien une seconde fois. */
  await sleep(1000);
  const posts = (await env.ctl()).count.post;
  await Promise.all([begin(a), begin(b)]);
  check((await subject(a)).replace(/Inès/g, "#") === (await subject(b)).replace(/Alex/g, "#"), "les deux téléphones reçoivent le même sujet");
  check(await a.page.locator(".dessin-time").count() === 0, "sans chrono, pas de compte à rebours");
  for (let i = 0; i < 12; i++) await stroke(a, ring(0.2 + 0.2 * (i % 4), 0.25 + 0.25 * Math.floor(i / 4), 0.08));
  for (let i = 0; i < 4; i++) await stroke(a, Array.from({ length: 9 }, (_, j) => [0.1 + 0.1 * j, 0.9 + (j % 2 ? 0.06 : 0) - 0.02 * i]));
  await stroke(b, [[0.2, 0.2], [0.8, 0.3]]);
  await b.page.evaluate(() => { document.querySelector(".dessin-sheet").same = true; });
  await stroke(b, [[0.2, 0.5], [0.5, 0.5]], true);
  await a.page.click('[data-act="done"]');
  check(await until(() => a.page.locator(".g-wait").count()) && await a.page.locator(".dessin-mine .dessin-art path").count() === 16, "A a rendu sa feuille : il attend, son propre dessin sous les yeux");
  const sent = (await saved(a)).S.a.d.d;
  check(sent.length < 8000, "un dessin de seize traits pèse " + sent.length + " caractères");
  check(await until(async () => typeof (await saved(b)).S.a.d.d === "string"), "la feuille de A arrive chez B pendant qu'il trace un trait");
  check(await b.page.evaluate(() => document.querySelector(".dessin-sheet").same === true), "l'écran de B n'est pas redessiné tant que son doigt est posé");
  const box = await b.page.locator(".dessin-sheet").boundingBox();
  await b.page.mouse.move(box.x + 0.5 * box.width, box.y + 0.8 * box.height, { steps: 4 });
  await b.page.mouse.up();
  check(await until(() => b.page.evaluate(() => document.querySelector(".dessin-sheet").same !== true)), "il l'est dès que le doigt se lève");
  cur = (await saved(b)).local.cur;
  check(cur.s.length === 2 && cur.s[1].length > 8, "et le trait de B est entier, virage compris");
  check(await b.page.locator(".dessin-art").count() === 0 && await b.page.locator(".dessin-pair").count() === 0, "B ne voit rien du dessin de A tant que sa propre feuille n'est pas rendue");
  const sheetB = await pixels(b);
  await b.page.reload();
  await b.page.waitForSelector(".dessin-sheet");
  check(await pixels(b) === sheetB, "B recharge la page : sa feuille en cours est intacte");
  await a.page.goto(env.base + "#accueil");
  check(await a.page.locator('a.card-state[href="#jeu-dessin"]').count() === 1, "A retourne à l'accueil : la partie y est signalée");
  await a.page.goto(env.base + "#jeu-dessin");
  await a.page.reload();
  await a.page.waitForSelector(".g-wait");
  check(await a.page.locator(".dessin-pair").count() === 0, "A revient et recharge : il attend toujours");
  await b.page.click('[data-act="done"]');
  check(await until(async () => (await a.page.locator(".dessin-pair").count()) && (await b.page.locator(".dessin-pair").count())), "la révélation s'ouvre sur les deux téléphones");
  const both = await a.page.locator(".dessin-pair").innerHTML(), tip = (p) => p.page.locator(".dessin > .hint").textContent();
  check(both === await b.page.locator(".dessin-pair").innerHTML() && await paths(a, "a") === 16 && await paths(b, "b") === 2, "qui montrent exactement les mêmes dessins");
  await next(b);
  await b.page.waitForSelector('[data-act="start"]');
  check((await step(b)).includes("Sujet 2"), "« Sujet suivant » : B passe au sujet 2");
  check(await until(async () => (await tip(a)).includes("Inès t'attend")) && await a.page.locator(".dessin-pair").innerHTML() === both, "A n'est pas arraché à la révélation : il la garde sous les yeux et apprend qu'Inès l'attend");
  const cost = (await env.ctl()).count.post - posts;
  check(cost <= 3, "un sujet complet à deux coûte trois messages au plus : un dessin chacun, puis le passage au suivant (" + cost + ")");
  await begin(b);
  await stroke(b, [[0.3, 0.2], [0.7, 0.8]]);
  await b.page.click('[data-act="done"]');
  check(await until(async () => (await saved(a)).S.b.d.r === 1) && await a.page.locator(".dessin-pair").innerHTML() === both, "la feuille suivante de B arrive : A garde la révélation du sujet 1, relue dans sa galerie");
  await a.page.reload();
  await a.page.waitForSelector(".dessin-pair");
  check(await a.page.locator(".dessin-pair").innerHTML() === both, "après rechargement aussi");
  const quiet = (await env.ctl()).count.post;
  await next(a);
  await a.page.waitForSelector('[data-act="start"]');
  check((await step(a)).includes("Sujet 2") && (await tip(a)).includes("a déjà rendu sa feuille. Tu la verras") && (await env.ctl()).count.post === quiet, "A la quitte à son tour, sans rien envoyer : au sujet 2, il apprend qu'Inès a déjà rendu sa feuille");

  console.log("Données hostiles");
  await begin(a);
  await stroke(a, [[0.2, 0.2], [0.8, 0.8]]);
  await a.page.click('[data-act="done"]');
  await a.page.waitForSelector(".dessin-pair");
  await rewrite(b, (s, d) => { s.S.b = { k: s.gen + ":" + s.setup.seed, d: { r: 1, d } }; s.seq.b.d++; }, HOSTILE + ".!!!!.AAAAzz.zzzzzz.AAAAzzzz");
  check(await until(async () => await paths(a, "b") === 2), "une feuille farcie de HTML et de traits illisibles : seuls ses deux traits valides sont dessinés");
  check(await harmless(a), "le reste est ignoré");
  await rewrite(b, (s) => { s.S.b = { k: s.gen + ":" + s.setup.seed, d: { r: 1, d: { length: 12 } } }; s.seq.b.d++; });
  check(await until(() => a.page.locator(".g-wait").count()), "une feuille du mauvais type compte pour non rendue : A attend, rien ne casse");
  await rewrite(b, (s, h) => { s.sh = { r: h }; s.st++; s.sw = "b"; s.seq.b.h++; }, HOSTILE);
  check(await until(async () => (await saved(a)).sh.r !== 1) && (await step(a)).includes("Sujet 2") && await a.page.locator(".g-wait").count() === 1 && await harmless(a), "un numéro de sujet illisible ne fait pas reculer A : sa feuille rendue dit où en est la partie");
  await rewrite(b, (s) => { s.sh = { r: -2.5 }; s.st++; s.sw = "b"; s.seq.b.h++; });
  await sleep(1200);
  check((await step(a)).includes("Sujet 2"), "un numéro négatif non plus");
  await rewrite(b, (s) => { s.sh = { r: 1e9 }; s.st++; s.sw = "b"; s.seq.b.h++; });
  check(await until(() => a.page.locator(".dessin-pair").count()) && (await step(a)).includes("Sujet 2") && await paths(a, "b") === 1, "un numéro hors de la pile : A retrouve d'abord la révélation qu'il n'avait pas quittée, telle qu'il l'avait vue");
  await next(a);
  check(await until(() => a.page.locator('[data-act="again"]').count()), "puis arrive à l'écran de fin");

  console.log("Nouvelle manche lancée par B");
  await b.page.waitForSelector(".dessin-pair");
  await next(b);
  await b.page.waitForSelector('[data-act="again"]');
  await b.page.click('[data-act="again"][data-v="delire"]');
  check(await until(async () => (await saved(a)).gen === 2 && (await step(a)).includes("Nouvelle pile · Sujet 1") && await a.page.locator('[data-act="start"]').count()), "B relance : A repart aussi au sujet 1 d'une nouvelle pile");
  await Promise.all([begin(a), begin(b)]);
  check((await subject(a)).replace(/Inès/g, "#") === (await subject(b)).replace(/Alex/g, "#") && (await saved(a)).setup.sujets === "delire", "avec le même nouveau sujet, dans la catégorie choisie par B");
  await rewrite(b, (s, h) => { s.gen++; s.setup = { seed: h, chrono: h, sujets: [h] }; s.sh = { r: h }; s.st = 0; s.sw = "b"; s.local = {}; s.seq.b.h++; }, HOSTILE);
  check(await until(async () => (await saved(a)).gen === 3 && await a.page.locator('[data-act="start"]').count()), "des réglages hostiles arrivent chez A");
  check((await title(a)).includes("une minute") && await harmless(a), "ils sont remplacés par les réglages par défaut");
  /* Un temps qui ne peut même pas se lire comme un texte : il faisait tomber l'écran en panne. */
  await rewrite(b, (s) => { s.gen++; s.setup = { seed: 7, chrono: { toString: 1 }, sujets: "tous" }; s.sh = {}; s.st = 0; s.sw = "b"; s.local = {}; s.seq.b.h++; });
  check(await until(async () => (await saved(a)).gen === 4 && await a.page.locator('[data-act="start"]').count()) && (await title(a)).includes("une minute") && !a.errors.length, "un temps de forme impossible aussi, sans faire tomber l'écran");
  await begin(a);
  check((await subject(a)).length > 5 && await seconds(a) >= 55 && await harmless(a), "et la partie reste jouable");
  const total = (await env.ctl()).count.post;
  check(total <= 21, "toute la partie à deux, tricheries comprises, coûte au plus vingt et un messages (" + total + ")");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
