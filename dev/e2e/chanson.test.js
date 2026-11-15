/* Essais du jeu « Le blind test du couple » : une partie complète sur un téléphone, puis sur deux,
   avec rechargements, secrets, réponses validées à la main, valeurs hostiles, relance et playlist.
   Le jeu n'est pas encore dans index.html : l'essai injecte ses fichiers dans chaque téléphone. */
const path = require("path");
const { setup, check, done, sleep } = require("./lib");

const DATA = path.join(__dirname, "../../jeux/chanson.data.js"), GAME = path.join(__dirname, "../../jeux/chanson.js");
const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
/* Le jeu ignore pendant une demi-seconde les touchers sur un écran tout juste apparu. */
const LOCK = 550;

async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  /* La feuille de style du jeu, ajoutée à chaque chargement (index.html reste tel quel ; une page servie
     par Playwright perdrait le droit de joindre le faux relais local). */
  await p.ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/chanson.css";
    document.head.appendChild(l);
  }));
  return p;
}
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 6000)) return false;
    await sleep(100);
  }
}
const screen = (p) => p.page.locator("main.game [data-screen]").first().getAttribute("data-screen");
const onScreen = (p, re) => until(async () => re.test(await screen(p)));
const tap = async (p, sel) => { await p.page.waitForSelector(sel); await sleep(LOCK); await p.page.click(sel); };
const go = (p) => tap(p, '[data-act="go"]');
async function write(p, t, a, h) {
  await p.page.waitForSelector('[data-form="chanson"]');
  await p.page.fill('[name="titre"]', t);
  await p.page.fill('[name="artiste"]', a);
  await p.page.fill('[name="indice"]', h);
  await p.page.press('[name="indice"]', "Enter");
}
async function guess(p, text) {
  await p.page.waitForSelector('[data-form="devine"]');
  if (text == null) return tap(p, '[data-act="chat"]');
  await p.page.fill('[name="devine"]', text);
  await p.page.press('[name="devine"]', "Enter");
}
const body = (p) => p.page.locator("main.game").innerText();
const verdict = (p) => p.page.locator(".chanson-verdict").textContent();
const next = (p) => tap(p, '[data-act="next"]');

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-chanson");
  check((await one.page.locator("main.intro h1").textContent()).includes("reconnaîtrais ma chanson"), "la présentation du jeu s'affiche");
  check(await one.page.locator("[data-extra]").count() === 0, "pas encore de « Nos playlists »");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  check(await onScreen(one, /^ecrire-0-a$/), "manche 1 : Alex choisit en premier, sans écran de passage");
  check(await one.page.locator("audio, video, iframe").count() === 0, "aucun lecteur de musique sur la page");
  const q1 = await one.page.locator(".chanson .g-title").textContent();
  await write(one, "Les Lumières du port", "Nadia Ferrant", "On l'a entendue partout pendant ce voyage");
  check(await onScreen(one, /^passe-ecrire-0-b$/), "puis le téléphone passe à Inès");
  check(!(await body(one)).includes("Lumières"), "l'écran de passage ne montre rien de la chanson d'Alex");
  await go(one);
  check(await onScreen(one, /^ecrire-0-b$/) && await one.page.inputValue('[name="titre"]') === "", "Inès choisit à son tour, champs vides");
  check(!(await body(one)).includes("Lumières"), "Inès ne voit pas la chanson d'Alex");
  await one.page.fill('[name="titre"]', "Matin calme");
  await one.page.press('[name="titre"]', "Enter");
  check(await screen(one) === "ecrire-0-b" && await one.page.evaluate(() => document.activeElement.name === "indice"), "sans indice, rien ne part : le curseur va à l'indice");
  await write(one, "Matin calme", "Les Ondes", "Le réveil des grasses matinées");
  check(await onScreen(one, /^devine-0$/), "Inès, qui tient le téléphone, devine la chanson d'Alex sans passage");
  check((await body(one)).includes("On l'a entendue partout") && !(await body(one)).includes("Lumières"), "l'indice d'Alex est affiché, pas sa chanson");
  check((await one.page.locator(".chanson-q").textContent()).includes(q1.trim().replace(/\s+/g, " ").slice(0, 10)), "la consigne d'Alex est rappelée");
  await guess(one, "lumiere du port nadia ferant");
  check(await onScreen(one, /^revele-0$/) && (await verdict(one)).includes("Trouvé"), "« lumiere du port nadia ferant » compte (accents, pluriel, artiste, faute)");
  check((await body(one)).includes("Les Lumières du port") && (await body(one)).includes("Nadia Ferrant"), "la chanson est révélée avec son artiste");
  await next(one);
  check(await onScreen(one, /^passe-devine-0-a$/), "au tour d'Alex de deviner : écran de passage");
  await go(one);
  await guess(one, null);
  check(await onScreen(one, /^revele-1$/) && (await verdict(one)).includes("Pas cette fois") && (await body(one)).includes("Alex a donné sa langue au chat"), "« Je donne ma langue au chat » révèle la chanson");
  check(await one.page.locator('[data-act="force"]').count() === 0, "langue au chat : rien à valider");
  await next(one);
  check(await onScreen(one, /^passe-ecrire-1-b$/), "manche 2 : Inès choisit en premier, après un passage");
  await go(one);
  await write(one, "Jardin d'hiver", "Clara Vasse", "Ta saison préférée");
  await go(one);
  await write(one, "Route vers le sud", "Les Phares", "Ce qu'on chante en voiture");
  check(await onScreen(one, /^devine-2$/) && await one.page.locator(".chanson.as-a").count() === 1, "Alex devine la chanson d'Inès");
  await guess(one, "complètement autre chose");
  check((await verdict(one)).includes("Pas cette fois") && (await one.page.locator('[data-act="force"]').textContent()) === "Ça compte", "une réponse fausse se discute : « Ça compte »");
  await tap(one, '[data-act="force"]');
  check((await verdict(one)).includes("Trouvé") && (await one.page.locator(".chanson-score b").textContent()) === "2", "« Ça compte » accorde le point");
  await one.page.click('[data-act="force"]');
  check((await verdict(one)).includes("Trouvé"), "un second toucher dans la foulée ne le retire pas");
  await one.page.reload();
  check(await onScreen(one, /^revele-2$/) && (await verdict(one)).includes("Trouvé"), "après rechargement : même révélation, même décision");
  await next(one);
  await go(one);
  await guess(one, "Rote vers le sud");
  check((await verdict(one)).includes("Trouvé") && (await one.page.locator('[data-act="force"]').textContent()) === "On ne compte pas", "à une lettre près, ça compte, mais le couple peut refuser");
  await next(one);
  for (let r = 2; r < 5; r++) {
    await go(one); await write(one, "Chanson " + r + " A", "", "Indice " + r + " A");
    await go(one); await write(one, "Chanson " + r + " B", "Groupe " + r, "Indice " + r + " B");
    await guess(one, "chanson " + r + " a");
    await next(one);
    await go(one);
    await guess(one, r === 4 ? "rien à voir" : "chanson " + r + " b");
    await next(one);
  }
  check(await onScreen(one, /^resultat$/), "après cinq manches, la fin de partie");
  check((await one.page.locator(".g-big").textContent()).replace(/\s+/g, "") === "8/10", "huit chansons trouvées sur dix");
  check((await one.page.locator(".chanson .g-lead").textContent()).includes("Alex en a trouvé 3, Inès en a trouvé 5"), "le compte de chacun");
  check(await one.page.locator(".chanson-list > li").count() === 5 && await one.page.locator(".chanson-song").count() === 10, "la playlist liste les deux chansons de chaque manche");
  const yt = await one.page.locator(".chanson-links a").first();
  check(await yt.getAttribute("href") === "https://www.youtube.com/results?search_query=" + encodeURIComponent("Les Lumières du port Nadia Ferrant") &&
    await yt.getAttribute("target") === "_blank" && await yt.getAttribute("rel") === "noopener", "lien de recherche YouTube, nouvel onglet, rel=noopener");
  check(await one.page.locator('.chanson-links a[href^="https://open.spotify.com/search/"]').count() === 10, "un lien Spotify par chanson");
  await one.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: env.base.replace(/\/$/, "") });
  await tap(one, '[data-act="copier"]');
  await until(async () => (await one.page.locator(".chanson-msg").textContent()).length > 0);
  const clip = await one.page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(/Copiée|affichée/.test(await one.page.locator(".chanson-msg").textContent()), "« Copier la playlist » répond");
  check( (clip.includes("Alex : Les Lumières du port — Nadia Ferrant") && clip.includes("« Ta saison préférée »")), "le texte copié reprend titres, artistes et indices");
  const q0 = await one.page.locator(".chanson-list .chanson-q").first().textContent();
  await tap(one, '[data-act="again"]');
  check(await onScreen(one, /^ecrire-0-a$/) && (await one.page.locator(".chanson-step").textContent()).includes("Nouvelle partie"), "« Rejouer » relance une partie, annoncée comme nouvelle");
  check(!q0.includes((await one.page.locator(".chanson .g-title").textContent()).trim()), "avec d'autres consignes");
  await tap(one, '.g-foot [data-act="g-stop"]'); await sleep(500); await one.page.click('.g-foot [data-act="g-stop"]');
  await one.page.waitForSelector("main.intro");
  check(await one.page.locator(".chanson-keep summary .g-tag").textContent() === "1" && (await one.page.locator(".chanson-keep").innerText()).length > 0, "la partie arrêtée, « Nos playlists » garde la playlist");

  console.log("Valeurs hostiles sur un téléphone");
  await one.page.evaluate((h) => {
    localStorage.setItem("en:chanson:listes", JSON.stringify([{ k: "x", at: "demain", n: [h, 7], r: [{ q: [h, h], a: { t: h, a: 3, h }, b: { t: h, a: h, h } }, "nimporte", { q: 1 }] }, 42, null]));
  }, HOSTILE);
  await one.page.reload();
  await one.page.locator(".chanson-keep > summary").click();
  await one.page.locator(".chanson-old summary").first().click();
  check(await one.page.locator(".chanson-keep .chanson-song").count() === 2 && await one.page.locator("#app img").count() === 0, "une playlist gardée abîmée s'affiche en texte, le reste est ignoré");
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await onScreen(one, /^ecrire-0-a$/);
  await one.page.evaluate((h) => {
    const s = JSON.parse(localStorage.getItem("en:g:chanson"));
    const k = s.gen + ":" + s.setup.seed;
    s.S.a = { k, d: { c: [[h, h, h], "x", 5], d: [h], ok: { "0b": "1" } } };
    s.S.b = { k, d: { c: { 0: 1 }, d: 12, ok: [] } };
    s.sh = { n: "9" };
    localStorage.setItem("en:g:chanson", JSON.stringify(s));
  }, HOSTILE);
  await one.page.reload();
  check(await onScreen(one, /^passe-ecrire-0-b$/) && await one.page.locator("#app img").count() === 0 && await one.page.evaluate(() => window.__xss === undefined),
    "des tranches mal formées et du HTML n'emportent rien : la chanson d'Alex compte, celle d'Inès reste à écrire");
  await go(one);
  await write(one, "Normal", "", "Ok");
  check((await body(one)).includes("<img src=x"), "l'indice hostile est affiché comme du texte");
  await tap(one, '.g-foot [data-act="g-stop"]'); await sleep(500); await one.page.click('.g-foot [data-act="g-stop"]');

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-chanson");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await a.page.click('[data-act="g-go"]');
  check(await onScreen(a, /^ecrire-0-a$/), "partie à distance : Alex commence sans attendre");
  await write(a, "Les Lumières du port", "Nadia Ferrant", "Ce voyage, encore");
  check(await onScreen(a, /^attente-0$/) && (await body(a)).includes("En attente de la chanson d'Inès"), "Alex attend la chanson d'Inès");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  check(await onScreen(b, /^ecrire-0-b$/), "Inès rejoint plus tard et choisit");
  check(!(await body(b)).includes("Lumières") && !(await body(b)).includes("Ce voyage"), "Inès ne voit ni la chanson ni l'indice d'Alex");
  await write(b, "Matin calme", "Les Ondes", "Le réveil du dimanche");
  check(await onScreen(a, /^indice-0$/) && await onScreen(b, /^devine-0$/), "Inès devine, Alex attend sa réponse");
  check((await body(b)).includes("Ce voyage, encore") && !(await body(b)).includes("Lumières"), "Inès voit l'indice d'Alex, pas sa chanson");
  check((await body(a)).includes("Inès cherche ta chanson") && !(await body(a)).includes("Matin calme"), "Alex voit son propre indice, pas encore la chanson d'Inès");
  await guess(b, HOSTILE);
  check(await onScreen(a, /^revele-0$/) && await onScreen(b, /^revele-0$/), "la révélation s'ouvre sur les deux téléphones");
  check(await a.page.locator("#app img").count() === 0 && await a.page.evaluate(() => window.__xss === undefined) && (await body(a)).includes("<img src=x"), "une réponse hostile est affichée comme du texte");
  await tap(a, '[data-act="force"]');
  check(await until(async () => (await verdict(b)).includes("Trouvé")), "« Ça compte » touché par Alex vaut aussi chez Inès");
  await b.page.reload();
  check(await onScreen(b, /^revele-0$/) && (await verdict(b)).includes("Trouvé"), "Inès recharge : même révélation");
  await next(b);
  check(await onScreen(a, /^devine-1$/) && await onScreen(b, /^indice-1$/), "« Au tour d'Alex » touché par Inès fait avancer les deux téléphones");
  await a.page.reload();
  check(await onScreen(a, /^devine-1$/), "Alex recharge : toujours à deviner");
  await guess(a, "matin calme");
  check(await until(async () => (await verdict(b)).includes("Trouvé")) && await onScreen(a, /^revele-1$/), "Alex trouve, les deux le voient");
  await next(a);
  for (let r = 1; r < 5; r++) {
    await Promise.all([write(a, "Titre A" + r, "", "Indice A" + r), write(b, "Titre B" + r, "Groupe", "Indice B" + r)]);
    const g1 = r % 2 ? a : b, g2 = r % 2 ? b : a;
    await onScreen(g1, new RegExp("^devine-" + 2 * r + "$"));
    check(!(await body(g1)).includes("Titre " + (r % 2 ? "B" : "A") + r), "manche " + (r + 1) + " : la chanson à deviner reste cachée");
    await guess(g1, "titre " + (r % 2 ? "b" : "a") + r);
    await onScreen(g2, new RegExp("^revele-" + 2 * r + "$"));
    await next(g2);
    await guess(g2, null);
    await onScreen(g1, new RegExp("^revele-" + (2 * r + 1) + "$"));
    await next(g1);
  }
  check(await onScreen(a, /^resultat$/) && await onScreen(b, /^resultat$/), "la fin de partie s'ouvre chez les deux");
  const sa = (await a.page.locator(".g-big").textContent()).replace(/\s+/g, ""), sb = (await b.page.locator(".g-big").textContent()).replace(/\s+/g, "");
  check(sa === "6/10" && sb === sa, "même score des deux côtés (" + sa + ")");
  check(await b.page.locator(".chanson-song").count() === 10, "la playlist complète chez Inès");
  await tap(b, '[data-act="again"]');
  check(await onScreen(a, /^ecrire-0-a$/) && (await a.page.locator(".chanson-step").textContent()).includes("Nouvelle partie"), "Inès relance : Alex repart aussi à la manche 1");
  check(await onScreen(b, /^ecrire-0-b$/), "et Inès aussi");
  const posts = (await env.ctl()).count.post;
  check(posts <= 36, "une partie complète à deux, relance comprise, coûte au plus 36 messages (" + posts + ")");
  await tap(a, '.g-foot [data-act="g-stop"]'); await sleep(500); await a.page.click('.g-foot [data-act="g-stop"]');
  await a.page.waitForSelector("main.intro");
  check(await a.page.locator(".chanson-keep summary .g-tag").textContent() === "1", "la playlist de la partie à deux est gardée chez Alex");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
