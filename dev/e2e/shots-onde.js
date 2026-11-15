/* Captures d'écran du jeu « Sur la même longueur d'onde » (clair et sombre) pour contrôle visuel.
   Usage : EN_PW=… node dev/e2e/shots-onde.js   ->  dev/e2e/shots/onde-*.png */
const { setup, sleep } = require("./lib");

function fixture() {
  if (window.GAME_DATA && window.GAME_DATA.onde) return;
  const mk = (id, name, list) => ({ id, name, hint: "Paquet d'essai pour les captures.", themes: list });
  const many = (s) => Array.from({ length: 12 }, (_, i) => s[i % s.length]);
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.onde = { packs: [mk("classique", "Classique", many(["Un fruit rouge", "Une ville où l'on mange bien", "Un bruit qui réveille"])), mk("nous", "Spécial nous", many(["Le plat qu'on commande le plus souvent", "Le dessert préféré {de_a}"])), mk("absurde", "Absurde", many(["Un prénom pour un poisson rouge"]))] };
}
async function write(p, word) {
  await p.page.waitForSelector(".onde-form .g-field");
  await p.page.fill(".onde-form .g-field", word);
  await p.page.press(".onde-form .g-field", "Enter");
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
    await a.shot("onde-1-accueil-" + tag);
    await a.page.goto(env.base + "#jeu-onde");
    await sleep(300);
    await a.shot("onde-2-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    await sleep(500);
    await a.shot("onde-3-invitation-" + tag);
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await a.page.waitForSelector(".onde-form");
    await a.shot("onde-4-ecrire-" + tag);
    await write(a, "Framboise");
    await sleep(400);
    await a.shot("onde-5-attente-" + tag);
    await b.page.goto(link);
    await sleep(300);
    await b.shot("onde-6-invite-" + tag);
    await b.page.click('[data-act="g-join"]');
    await write(b, "Fraise");
    await b.page.waitForSelector(".onde-pair");
    await sleep(600);
    await b.shot("onde-7-rate-" + tag);
    await b.page.click('[data-act="next"]');
    await a.page.click('[data-act="next"]');
    for (let r = 1; r < 10; r++) {
      await Promise.all([write(a, r % 3 ? "Cerise" : "Le matin"), write(b, r % 3 ? "cerises" : "Le soir")]);
      await Promise.all([a.page.waitForSelector(".onde-pair"), b.page.waitForSelector(".onde-pair")]);
      if (r === 1) { await sleep(600); await a.shot("onde-8-gagne-" + tag); }
      await Promise.all([a.page.click('[data-act="next"]'), b.page.click('[data-act="next"]')]);
    }
    await a.page.waitForSelector(".onde-list");
    await sleep(400);
    await a.shot("onde-9-resultat-" + tag);
  }
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
