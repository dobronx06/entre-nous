/* Essais du jeu « Sur la même longueur d'onde » : une partie complète sur un téléphone,
   puis sur deux, avec rechargement, verdict contredit à la main et relance. */
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
async function write(p, word) {
  await p.page.waitForSelector(".onde-form .g-field");
  await p.page.fill(".onde-form .g-field", word);
  await p.page.press(".onde-form .g-field", "Enter");
}
/* Thèmes de secours : ils ne servent que si jeux/onde.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const mk = (id, name, n, f) => ({ id, name, hint: "Paquet d'essai.", themes: Array.from({ length: n }, (_, i) => f(i)) });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.onde = { packs: [mk("classique", "Classique", 14, (i) => "Thème classique " + i), mk("nous", "Spécial nous", 14, (i) => (i % 2 ? "Le plat préféré {de_a} " : "Ce que {b} oublie ") + i), mk("absurde", "Absurde", 14, (i) => "Thème absurde " + i)] };
}
async function phone(env, name) {
  const p = await env.phone(name);
  await p.ctx.addInitScript(fixture);
  return p;
}
const title = (p) => p.page.locator(".onde .g-title").textContent();
const step = (p) => p.page.locator(".onde-step").textContent();
const hint = (p) => p.page.locator(".onde-form .hint").textContent();
const FORCE = '[data-act="force"]';
/* Le jeu ignore un toucher qui suit de moins d'une seconde un changement de décision : on attend, comme une personne. */
const PAUSE = 1100;

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-onde");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="classique"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector(".onde-form");
  check((await step(one)).includes("Manche 1 sur 10") && !(await step(one)).includes("Nouvelle partie") && await one.page.locator(".onde.as-a").count() === 1, "manche 1 : Alex écrit en premier");
  const theme1 = await title(one);
  check((await hint(one)).includes("Inès ne le verra") && (await hint(one)).includes("passe-lui le téléphone"), "qui écrit en premier est invité à passer le téléphone ensuite");
  check(await one.page.getAttribute(".onde-form .g-field", "aria-label") === "Alex, ton mot pour «\u00a0" + theme1 + "\u00a0»", "le champ annonce à qui c'est le tour et le thème");
  await write(one, "Les Pommes");
  check(await one.page.locator(".onde.as-b").count() === 1 && await one.page.inputValue(".onde-form .g-field") === "" && await title(one) === theme1, "puis c'est à Inès, même thème, champ vide");
  check((await hint(one)).includes("Alex a déjà écrit le sien") && !(await hint(one)).includes("passe"), "qui écrit en second apprend que la révélation suit, sans consigne de passer le téléphone");
  await write(one, "pomme");
  check((await title(one)).includes("Même longueur d'onde"), "« Les Pommes » et « pomme » comptent pour le même mot");
  check(await one.page.locator(FORCE).count() === 0, "un même mot ne se discute pas : aucun bouton pour revenir dessus");
  await one.page.click('[data-act="next"]');
  check(await one.page.locator(".onde.as-b").count() === 1 && (await step(one)).includes("Manche 2"), "manche 2 : Inès commence");
  await write(one, "canapé");
  await write(one, "sofa");
  check((await title(one)).includes("Pas cette fois"), "deux mots différents : pas de point");
  await one.page.click(FORCE);
  check((await title(one)).includes("Même longueur d'onde") && (await one.page.locator(".onde-score").textContent()).includes("2"), "« On compte quand même » accorde le point");
  await one.page.click(FORCE);
  check((await title(one)).includes("Même longueur d'onde"), "un second toucher dans la foulée (double toucher) ne le retire pas");
  await sleep(PAUSE);
  await one.page.click(FORCE);
  check((await title(one)).includes("Pas cette fois") && (await one.page.locator(FORCE).textContent()).includes("On compte quand même"), "« Finalement non » le retire");
  await one.page.reload();
  await one.page.waitForSelector(".onde-pair");
  check((await step(one)).includes("Manche 2") && (await title(one)).includes("Pas cette fois"), "après rechargement, on retrouve la révélation en cours");
  await one.page.click('[data-act="next"]');
  await write(one, "poule");
  await write(one, "moule");
  check((await title(one)).includes("Même longueur d'onde") && (await one.page.locator(FORCE).textContent()).includes("On ne compte pas"), "à une lettre près, le jeu compte le même mot mais laisse le couple en décider");
  await one.page.click(FORCE);
  check((await title(one)).includes("Pas cette fois") && (await one.page.locator(".onde-score").textContent()).includes("1"), "« On ne compte pas » retire le point");
  await sleep(PAUSE);
  await one.page.click(FORCE);
  check((await title(one)).includes("Même longueur d'onde"), "« Finalement si » le rend");
  await one.page.click('[data-act="next"]');
  for (let r = 3; r < 10; r++) {
    await write(one, r < 8 ? "mot" + r : "bleu");
    await write(one, r < 8 ? "MOT" + r : "rouge");
    await one.page.click('[data-act="next"]');
  }
  await one.page.waitForSelector(".onde-list");
  check((await one.page.locator(".g-big").textContent()).replace(/\s+/g, "") === "7/10", "le résultat compte sept points sur dix");
  check(await one.page.locator(".onde-list li").count() === 10, "le récapitulatif liste les dix manches");
  check((await one.page.locator(".g-lead").textContent()).includes("Nouveau record"), "premier score : nouveau record");
  check((await one.page.locator(".onde-words .sr").allTextContents()).join("|").indexOf("Alex\u00a0: |Inès\u00a0: ") === 0, "le récapitulatif dit à l'oreille qui a écrit quoi");
  check(await one.page.locator('[data-act="again"][aria-pressed]').count() === 0 && await one.page.getAttribute('[data-act="again"][aria-current]', "data-pack") === "classique",
    "les tuiles « Rejouer avec » sont de simples boutons, celle du paquet qu'on vient de jouer est repérée");
  await one.page.click('[data-act="again"][data-pack="absurde"]');
  await one.page.waitForSelector(".onde-form");
  check((await step(one)).includes("Nouvelle partie") && (await step(one)).includes("Manche 1 sur 10"), "rejouer relance une partie à la manche 1, annoncée comme une nouvelle partie");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-onde");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await Promise.all([a.page.waitForSelector(".onde-form"), b.page.waitForSelector(".onde-form")]);
  check(await title(a) === await title(b), "les deux téléphones affichent le même thème");
  check(await a.page.locator(".onde.as-a").count() === 1 && await b.page.locator(".onde.as-b").count() === 1, "chacun écrit sous sa couleur");
  await write(a, "Fraise");
  check(await until(() => a.page.locator(".g-wait").count()) && (await a.page.locator(".g-lead").textContent()).includes("Fraise"), "A attend le mot de B");
  check(await a.page.evaluate(() => document.activeElement.matches(".g-lead[data-focus]")), "le focus va à la ligne « Tu as écrit », pas au corps de la page");
  check(await b.page.locator(".onde-pair").count() === 0, "B ne voit rien tant que son mot n'est pas écrit");
  await write(b, "fraises");
  check(await until(async () => (await a.page.locator(".onde-pair").count()) && (await b.page.locator(".onde-pair").count())), "la révélation s'ouvre sur les deux téléphones");
  check((await title(a)).includes("Même longueur d'onde") && (await title(b)).includes("Même longueur d'onde"), "avec le même verdict");
  await a.page.click('[data-act="next"]');
  await write(a, "lundi");
  check(await b.page.locator(".onde-pair").count() === 1, "B reste sur la révélation tant que B n'a pas touché « suivante »");
  await b.page.click('[data-act="next"]');
  await write(b, HOSTILE);
  check(await until(() => a.page.locator(".onde-pair").count()), "manche 2 révélée");
  check(await a.page.locator("#app img").count() === 0 && await a.page.evaluate(() => window.__xss === undefined), "un mot hostile est affiché comme du texte");
  await b.page.click(FORCE);
  check(await until(async () => (await title(a)).includes("Même longueur d'onde")), "« On compte quand même » touché par B vaut aussi chez A");
  await a.page.reload();
  await a.page.waitForSelector(".onde-pair");
  await Promise.all([a.page.click('[data-act="next"]'), b.page.click('[data-act="next"]')]);
  for (let r = 2; r < 10; r++) {
    await Promise.all([write(a, "mot" + r), write(b, r % 2 ? "mot" + r : "autre" + r)]);
    await Promise.all([a.page.waitForSelector(".onde-pair"), b.page.waitForSelector(".onde-pair")]);
    await a.page.click('[data-act="next"]');
    if (r < 9) await b.page.click('[data-act="next"]');
  }
  await a.page.waitForSelector(".onde-list");
  check(await a.page.locator('[data-act="again"]').count() === 0 && (await a.page.locator(".g-wait").textContent()).includes("dès qu'Inès aura vu le résultat"),
    "A voit le résultat avant B : pas encore de « Rejouer », qui arracherait B à sa dernière révélation");
  await b.page.click('[data-act="next"]');
  await b.page.waitForSelector(".onde-list");
  check(await until(() => a.page.locator('[data-act="again"]').count()), "B a vu le résultat : « Rejouer avec » apparaît chez A");
  const sa = (await a.page.locator(".g-big").textContent()).replace(/\s+/g, ""), sb = (await b.page.locator(".g-big").textContent()).replace(/\s+/g, "");
  check(sa === "6/10" && sb === sa, "même résultat des deux côtés (" + sa + ")");
  await b.page.click('[data-act="again"][data-pack="nous"]');
  check(await until(async () => (await a.page.locator(".onde-form").count()) && (await step(a)).includes("Manche 1")), "B relance : A repart aussi à la manche 1");
  check(await title(a) === await title(b), "avec le même nouveau thème");
  const posts = (await env.ctl()).count.post;
  check(posts <= 30, "une partie complète à deux, relance comprise, coûte au plus trente messages (" + posts + ")");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
