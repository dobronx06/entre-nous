/* Captures d'écran du jeu « Sur la même longueur d'onde » pour contrôle visuel : une partie à deux
   téléphones en clair et en sombre, puis, en clair, ce qui ne se voit que sur un seul téléphone,
   sur un petit écran ou sans les thèmes.
   Usage : EN_PW=… node dev/e2e/shots-onde.js   ->  dev/e2e/shots/onde-*.png */
const { setup, sleep } = require("./lib");

const FIELD = ".onde-form .g-field", NEXT = '[data-act="next"]', FORCE = '[data-act="force"]';

/* Thèmes de secours : ils ne servent que si jeux/onde.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const mk = (id, name, list) => ({ id, name, hint: "Paquet d'essai pour les captures.", themes: list });
  const many = (s) => Array.from({ length: 12 }, (_, i) => s[i % s.length] + " " + i);
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.onde = { packs: [mk("classique", "Classique", many(["Un fruit rouge", "Une ville où l'on mange bien", "Un bruit qui réveille"])), mk("nous", "Spécial nous", many(["Le plat qu'on commande le plus souvent", "Le dessert préféré {de_a}"])), mk("absurde", "Absurde", many(["Un prénom pour un poisson rouge"]))] };
}
async function write(p, word) {
  await p.page.waitForSelector(FIELD);
  await p.page.fill(FIELD, word);
  await p.page.press(FIELD, "Enter");
}
async function solo(p, env) {
  await p.ctx.addInitScript(fixture);
  await p.page.goto(env.base + "#jeu-onde");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector("main.game");
}
/* Un téléphone : une manche complète, puis l'écran tel qu'il s'ouvre, sans défiler. */
async function reveal(p, first, second, label) {
  await write(p, first);
  await write(p, second);
  await p.page.waitForSelector(".onde-pair");
  await sleep(700);
  await p.shot(label);
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await env.phone("a-" + tag, { dark }), b = await env.phone("b-" + tag, { dark });
    await a.ctx.addInitScript(fixture);
    await b.ctx.addInitScript(fixture);
    await a.page.goto(env.base + "#accueil");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(800);
    await a.shot("onde-01-accueil-" + tag);
    await a.page.goto(env.base + "#jeu-onde");
    await sleep(300);
    await a.shot("onde-02-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    await sleep(500);
    await a.shot("onde-03-invitation-" + tag);
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await a.page.waitForSelector(".onde-form");
    await a.shot("onde-04-ecrire-" + tag);
    await write(a, "Framboise");
    await sleep(400);
    await a.shot("onde-05-attente-" + tag);
    await b.page.goto(link);
    await sleep(300);
    await b.shot("onde-06-invite-" + tag);
    await b.page.click('[data-act="g-join"]');
    await write(b, "Fraise");
    await b.page.waitForSelector(".onde-pair");
    await sleep(700);
    await b.shot("onde-07-rate-" + tag);
    await b.page.click(FORCE);
    await sleep(500);
    await b.shot("onde-08-compte-quand-meme-" + tag);
    await b.page.click(NEXT);
    await a.page.click(NEXT);
    for (let r = 1; r < 10; r++) {
      await Promise.all([write(a, r === 2 ? "Pamplemousse" : r % 3 ? "Champignons" : "Le matin"), write(b, r === 2 ? "pamplemouse" : r % 3 ? "champignon" : "Le soir")]);
      await Promise.all([a.page.waitForSelector(".onde-pair"), b.page.waitForSelector(".onde-pair")]);
      await sleep(700);
      if (r === 1) await a.shot("onde-09-gagne-" + tag);
      if (r === 2) {
        await a.shot("onde-10-a-une-lettre-" + tag);
        await a.page.click(FORCE);
        await sleep(500);
        await a.shot("onde-11-on-ne-compte-pas-" + tag);
      }
      await a.page.click(NEXT);
      if (r < 9) await b.page.click(NEXT);
    }
    await a.page.waitForSelector(".onde-list");
    await sleep(400);
    await a.shot("onde-12-resultat-avant-l-autre-" + tag);
    await b.page.click(NEXT);
    await a.page.waitForSelector('[data-act="again"]');
    await sleep(400);
    await a.shot("onde-13-resultat-" + tag);
    await a.page.click('[data-act="again"][data-pack="nous"]');
    await b.page.waitForSelector(".onde-form");
    await sleep(400);
    await b.shot("onde-14-nouvelle-partie-" + tag);
  }

  const one = await env.phone("seul");
  await solo(one, env);
  await one.shot("onde-15-seul-premier");
  await write(one, "Tiramisu");
  await one.page.waitForSelector(".onde.as-b");
  await one.shot("onde-16-seul-second");

  /* La hauteur utile d'un petit iPhone dans Safari, puis le plus étroit des téléphones : la révélation doit tenir au-dessus des boutons. */
  const short = await env.phone("court", { viewport: { width: 375, height: 553 }, fullPage: false });
  await solo(short, env);
  await reveal(short, "Canapé", "Sofa", "onde-17-petit-375x553-rate");
  await short.page.click(NEXT);
  await reveal(short, "Réfrigérateur", "réfrigérateurs", "onde-18-petit-375x553-gagne");
  const narrow = await env.phone("etroit", { viewport: { width: 320, height: 568 }, fullPage: false });
  await solo(narrow, env);
  await reveal(narrow, "Pamplemousse", "Bibliothèques", "onde-19-petit-320x568-rate");
  await narrow.page.click(NEXT);
  await narrow.page.waitForSelector(FIELD);
  await narrow.shot("onde-20-petit-320x568-ecrire");

  const empty = await env.phone("sans-themes");
  await empty.ctx.route(/\/jeux\/onde\.data\.js/, (r) => r.fulfill({ contentType: "text/javascript; charset=utf-8", body: "(window.GAME_DATA = window.GAME_DATA || {}).onde = { packs: [] };" }));
  await solo(empty, env);
  await empty.shot("onde-21-sans-themes");
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
