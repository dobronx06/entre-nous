/* Captures d'écran du jeu « Les cartes à piocher » (clair et sombre) pour contrôle visuel :
   deux téléphones, un seul, un petit écran et un grand (pages entières), puis ce que l'on voit sans
   défiler sur des écrans bas, en attendant l'invité, au clavier et dans une page intégrée.
   Usage : EN_PW=… node dev/e2e/shots-cartes.js   ->  dev/e2e/shots/cartes-*.png */
const path = require("path");
const { setup, sleep, SHOTS } = require("./lib");

/* Cartes de secours : elles ne servent que si jeux/cartes.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const q = (x, near) => ({ t: "q", x, near }), d = (x, near) => ({ t: "d", x, near }), two = (x, near) => ({ t: "2", x, near });
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.cartes = { decks: [
    { id: "leger", name: "Léger", hint: "Pour rire et se découvrir, sans se prendre au sérieux.", cards: [
      q("Quel est le dernier fou rire que tu as eu grâce à {o} ?"),
      q("Quelle manie {de_o} te fait sourire en secret ?"),
      q("Raconte le moment où tu as compris que {o} allait compter dans ta vie : où étiez-vous, que s'est-il passé, et quel détail t'a mis la puce à l'oreille ce jour-là ?"),
      q("Quel plat réussis-tu mieux {que_o}, en toute modestie ?"),
      q("Quelle chanson te fait aussitôt penser à {o} ?"),
      q("Si {o} était un dessert, lequel serait-ce ?"),
      d("Imite {o} au réveil pendant dix secondes."),
      d("Regarde {o} dans les yeux pendant trente secondes, sans rire.", true),
      d("Décris {o} à la façon d'un commentateur sportif."),
      two("Trouvez ensemble le titre du film que raconterait votre histoire."),
      two("Faites-vous un câlin de vingt secondes, montre en main.", true),
      two("Chacun cite son plus beau souvenir de vos dernières vacances.")
    ] },
    { id: "profond", name: "Profond", hint: "Pour se dire ce qu'on ne prend jamais le temps de se dire.", cards: [
      q("Qu'est-ce que tu n'as encore jamais osé demander à {o} ?"),
      q("Quel moment de votre histoire aimerais-tu revivre à l'identique ?"),
      q("Qu'est-ce que {o} comprend de toi mieux que personne ?"),
      q("Quelle peur aimerais-tu confier à {o} ce soir ?"),
      d("Dis à {o} une chose que tu admires et que tu ne lui dis jamais."),
      two("Racontez-vous votre rencontre, chacun avec sa version."),
      two("Dites chacun une chose que vous aimeriez faire plus souvent à deux."),
      two("Prenez-vous la main et dites ce que ce geste vous fait, là, maintenant.", true)
    ] },
    { id: "coquin", name: "Coquin", hint: "Pour faire monter la température, à votre rythme.", adult: true, cards: [
      q("Quel souvenir à deux te donne encore chaud aux joues ?"),
      q("Quelle tenue {de_o} te fait toujours de l'effet ?"),
      d("Dis à {o} ce que tu préfères dans sa façon de t'embrasser."),
      d("Embrasse {o} dans le cou pendant dix secondes.", true),
      two("Échangez un baiser comme au premier jour.", true),
      two("Dites chacun le geste tendre que vous aimeriez recevoir plus souvent.")
    ] }
  ] };
}

(async () => {
  const env = await setup({ net: true });
  const mk = async (name, o) => { const p = await env.phone(name, o); await p.ctx.addInitScript(fixture); return p; };
  const card = (p) => p.page.evaluate(() => {
    const c = document.querySelector(".cartes-card");
    return c ? { i: c.getAttribute("data-i"), t: c.getAttribute("data-t"), w: c.classList.contains("a") ? "a" : c.classList.contains("b") ? "b" : "", len: c.querySelector(".cartes-text").textContent.length } : null;
  });
  /* Après un changement d'écran, le jeu ignore les touchers pendant une demi-seconde : on laisse passer ce délai. */
  const settle = () => sleep(600);
  /* Repart de la première carte et avance jusqu'à celle qui convient ; false si le paquet n'en contient pas. */
  async function seek(p, ok) {
    while (await p.page.locator('[data-act="prev"]:enabled').count()) await p.page.click('[data-act="prev"]');
    for (;;) {
      const c = await card(p);
      if (!c || ok(c)) { await settle(); return !!c; }
      await p.page.click('[data-act="next"]');
    }
  }
  /* La carte au texte le plus long du paquet : le pire cas pour la mise en page. */
  async function longest(p) {
    let best = "", len = 0;
    await seek(p, (c) => { if (c.len > len) { len = c.len; best = c.i; } return false; });
    return seek(p, (c) => c.i === best);
  }
  /* Attend que l'autre téléphone affiche la même carte. */
  async function follow(lead, p) {
    const i = (await card(lead)).i;
    for (let n = 0; n < 80 && (await card(p) || {}).i !== i; n++) await sleep(100);
    await sleep(450);
  }
  const start = async (p, mode, names, deck) => {
    await p.page.goto(env.base + "#jeu-cartes");
    if (names) { await p.page.fill("#name-a", names[0]); await p.page.fill("#name-b", names[1]); }
    if (deck) await p.page.click('[data-act="g-opt"][data-val="' + deck + '"]');
    await p.page.click('[data-act="g-start"][data-mode="' + mode + '"]');
    await p.page.waitForSelector(mode === "solo" ? ".cartes-card" : ".share[data-url]");
  };
  const snap = async (p, ok, label) => { if (await seek(p, ok)) await p.shot(label); else console.log("carte introuvable pour " + label); };

  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await mk("a-" + tag, { dark }), b = await mk("b-" + tag, { dark });
    await a.page.goto(env.base + "#accueil");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(800);
    await a.page.locator("article.card", { has: a.page.locator('a[href="#jeu-cartes"]') }).screenshot({ path: path.join(SHOTS, "cartes-01-accueil-" + tag + ".png") });
    await a.page.goto(env.base + "#jeu-cartes");
    await sleep(300);
    await a.shot("cartes-02-presentation-" + tag);
    await start(a, "duo");
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await a.page.click('[data-act="g-go"]');
    await a.page.waitForSelector(".cartes-card");
    await sleep(400);
    await a.shot("cartes-03-attente-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await b.page.waitForSelector(".cartes-card");
    await a.page.waitForSelector(".g-wait", { state: "detached" });
    /* Toute la navigation part du téléphone A ; chaque carte est prise chez qui elle s'adresse, puis chez l'autre. */
    for (const [t, label] of [["q", "question"], ["d", "defi"]]) {
      if (!await seek(a, (c) => c.t === t)) continue;
      await follow(a, b);
      const mine = (await card(a)).w === "a" ? a : b;
      await mine.shot("cartes-" + (t === "q" ? "04" : "06") + "-" + label + "-a-toi-" + tag);
      await (mine === a ? b : a).shot("cartes-" + (t === "q" ? "05" : "07") + "-" + label + "-a-l-autre-" + tag);
    }
    await snap(a, (c) => c.t === "2", "cartes-08-a-deux-" + tag);
    await a.page.click('[data-act="pick"]');
    await settle();
    await a.shot("cartes-09-changer-" + tag);
    await a.page.click('[data-act="pick"]');
    await settle();
    await seek(a, () => false);
    await b.page.waitForSelector('.cartes[data-screen="fin"]');
    await sleep(400);
    await b.shot("cartes-10-fin-" + tag);

    const one = await mk("seul-" + tag, { dark });
    await start(one, "solo", ["Alex", "Inès"], "profond");
    await longest(one);
    await one.shot("cartes-11-seul-longue-" + tag);
    await seek(one, () => false);
    await one.page.click('[data-act="prev"]');
    await settle();
    await one.page.click('[data-act="prev"]');
    await sleep(300);
    await one.shot("cartes-12-seul-avant-derniere-" + tag);
    await one.page.click('[data-act="next"]');
    await sleep(300);
    await one.shot("cartes-13-seul-derniere-" + tag);
    const anon = await mk("anonyme-" + tag, { dark });
    await start(anon, "solo");
    await snap(anon, (c) => c.t === "d", "cartes-14-sans-prenoms-" + tag);
    const small = await mk("petit-" + tag, { dark, viewport: { width: 320, height: 568 } });
    await start(small, "solo", ["Maximilien-Alexandre", "Marie-Antoinette-Lou"], "coquin");
    await longest(small);
    await small.shot("cartes-15-petit-ecran-longue-" + tag);
    await snap(small, (c) => c.t === "d" && c.len > 70, "cartes-16-petit-ecran-defi-" + tag);
    await seek(small, () => false);
    await small.shot("cartes-17-petit-ecran-fin-" + tag);
    const wide = await mk("grand-" + tag, { dark, viewport: { width: 1280, height: 800 }, mobile: false, touch: false, scale: 1 });
    await wide.page.goto(env.base + "#jeu-cartes");
    await sleep(300);
    await wide.shot("cartes-18-grand-ecran-presentation-" + tag);
    await start(wide, "solo", ["Alex", "Inès"]);
    await snap(wide, (c) => c.t === "q", "cartes-19-grand-ecran-" + tag);
    /* Au clavier : le contour du focus de « changer », au bord du mot. */
    await wide.page.keyboard.press("Shift+Tab");
    const step = await wide.page.locator(".cartes-step").boundingBox();
    await wide.page.screenshot({ path: path.join(SHOTS, "cartes-21-clavier-changer-" + tag + ".png"), clip: { x: step.x - 24, y: step.y - 40, width: step.width + 48, height: 150 } });
    await seek(wide, () => false);
    await wide.shot("cartes-20-grand-ecran-fin-" + tag);

    /* Ce que l'on voit sans défiler : écrans bas, téléphone couché, attente de l'invité. */
    const view = (name, width, height) => mk(name + "-" + tag, { dark, viewport: { width, height }, fullPage: false });
    const low = await view("bas", 375, 548);
    await start(low, "solo", ["Alex", "Inès"]);
    await longest(low);
    await low.shot("cartes-22-ecran-bas-longue-" + tag);
    await seek(low, () => false);
    await low.shot("cartes-31-ecran-bas-fin-" + tag);
    const tiny = await view("tres-bas", 320, 454);
    await start(tiny, "solo", ["Maximilien-Alexandre", "Marie-Antoinette-Lou"]);
    await longest(tiny);
    await tiny.shot("cartes-23-ecran-tres-bas-longue-" + tag);
    const lying = await view("couche", 740, 340);
    await start(lying, "solo", ["Alex", "Inès"]);
    await longest(lying);
    await lying.shot("cartes-24-couche-longue-" + tag);
    await snap(lying, (c) => c.t === "d", "cartes-25-couche-defi-" + tag);
    const host = await view("hote", 390, 664);
    await start(host, "duo", ["Alex", "Inès"]);
    await host.page.click('[data-act="g-go"]');
    await host.page.waitForSelector(".cartes-card");
    await settle();
    await host.shot("cartes-26-attente-ecran-" + tag);
    await host.page.click(".g-wait details.more > summary");
    await sleep(300);
    await host.shot("cartes-27-attente-rappel-" + tag);
    await seek(host, () => false);
    await host.shot("cartes-32-fin-a-deux-ecran-" + tag);
    const narrow = await view("etroit", 320, 568);
    await start(narrow, "duo", ["Maximilien-Alexandre", "Marie-Antoinette-Lou"]);
    await narrow.page.click('[data-act="g-go"]');
    await narrow.page.waitForSelector(".cartes-card");
    await settle();
    await narrow.shot("cartes-28-petit-attente-" + tag);
    await narrow.page.click('[data-act="pick"]');
    await settle();
    await narrow.shot("cartes-29-petit-changer-a-deux-" + tag);
    /* Dans une page intégrée (la version en un seul fichier) : une présentation sans jeu à distance. */
    const framed = await mk("cadre-" + tag, { dark });
    await framed.page.setContent('<body style="margin:0"><iframe src="' + env.base + '#jeu-cartes" style="display:block;width:390px;height:1100px;border:0"></iframe>');
    await framed.page.frameLocator("iframe").locator('[data-act="g-start"]').first().waitFor();
    await sleep(600);
    await framed.page.locator("iframe").screenshot({ path: path.join(SHOTS, "cartes-30-presentation-cadre-" + tag + ".png") });
    for (const p of [a, b, one, anon, small, wide, low, tiny, lying, host, narrow, framed]) if (p.errors.length) console.log("ERREURS " + p.name + " : " + p.errors.join(" | "));
  }
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
