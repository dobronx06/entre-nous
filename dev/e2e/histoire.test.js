/* Essais du jeu « L'histoire à quatre mains » : une histoire complète sur un téléphone, puis sur deux,
   avec rechargements, phrases cachées, lecture, partage, « Nos histoires », relance par le second joueur,
   valeurs hostiles et décompte des messages. Le jeu n'est pas (encore) dans index.html : l'essai l'injecte. */
const path = require("path");
const { setup, check, done, sleep, ROOT } = require("./lib");

const DATA = path.join(ROOT, "jeux", "histoire.data.js"), GAME = path.join(ROOT, "jeux", "histoire.js");
const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";
const KEY = "en:g:histoire";

async function phone(env, name) {
  const p = await env.phone(name);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: env.base.replace(/\/$/, "") });
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
const screen = (p) => p.page.getAttribute("main.game [data-screen]", "data-screen");
const text = (p) => p.page.locator("main.game").innerText();
const starts = (p) => p.page.evaluate(() => window.GAME_DATA.histoire.starts);
async function write(p, t) {
  await p.page.waitForSelector(".histoire-field");
  await p.page.fill(".histoire-field", t);
  await p.page.click(".histoire-form .btn");
}
/* Un seul téléphone : la personne désignée prend l'appareil, puis écrit. Retourne qui a écrit. */
async function turn(p, t) {
  await p.page.waitForSelector('[data-act="moi"]');
  const w = (await p.page.getAttribute(".g-pass", "class")).includes("as-b") ? "b" : "a";
  await p.page.click('[data-act="moi"]');
  await write(p, t);
  return w;
}
async function readAll(p, n) {
  await p.page.click('[data-act="lire"]');
  const inks = [];
  for (let r = 0; r <= n; r++) {
    await p.page.waitForSelector('[data-screen="lire-' + r + '"]');
    const cls = await p.page.getAttribute(".histoire-now .g-card", "class");
    inks.push(cls.includes(" a") ? "a" : cls.includes(" b") ? "b" : "-");
    await p.page.click('[data-act="suite"]');
  }
  await p.page.waitForSelector('[data-screen="histoire"]');
  return inks;
}
/* Ce téléphone redépose une tranche trafiquée (comme le ferait un téléphone malveillant), puis recharge. */
async function forge(p, d) {
  await p.page.evaluate(([key, d]) => {
    const s = JSON.parse(localStorage.getItem(key));
    s.S[s.me] = { k: s.gen + ":" + s.setup.seed, d };
    s.seq[s.me].d = Math.max(s.seq[s.me].d + 1, Date.now());
    localStorage.setItem(key, JSON.stringify(s));
    location.reload();
  }, [KEY, d]).catch(() => { /* la page se recharge pendant l'appel */ });
  await p.page.waitForSelector("main.game [data-screen]");
}

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-histoire");
  check(await one.page.locator('[data-act="g-opt"][data-opt="longueur"]').count() === 3, "trois longueurs proposées");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-opt"][data-val="8"]');
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector(".g-pass");
  check((await screen(one)).indexOf("passe-0-") === 0, "on commence par passer le téléphone à qui lance l'histoire");
  const all = await starts(one);
  check(all.length === 60 && new Set(all).size === 60, "soixante débuts différents");
  await one.page.click('[data-act="moi"]');
  await one.page.waitForSelector(".histoire-field");
  const open1 = await one.page.locator(".histoire-card .g-card-text").textContent();
  check(all.some((s) => s.replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« ") === open1), "le premier écran montre la première phrase, tirée de la liste");
  check((await one.page.locator(".histoire-step").textContent()).includes("Phrase 1 sur 8"), "phrase 1 sur 8");
  check(await one.page.getAttribute(".histoire-field", "maxlength") === "200", "200 signes au plus par phrase");
  await one.page.fill(".histoire-field", "   ");
  await one.page.click(".histoire-form .btn");
  check((await screen(one)).indexOf("ecrire-0") === 0, "une phrase vide ne part pas");
  const S = ["Un <b>chat</b> passa par là.", "Il portait un chapeau rouge.", "Personne ne savait pourquoi.", "Puis la pluie arriva.", "Le chapeau devint une barque.", "On navigua jusqu'au marché.", "Tout le monde applaudit.", "Et ce fut la fin."];
  await write(one, S[0]);
  await one.page.waitForSelector(".g-pass");
  check((await text(one)).indexOf("chat") < 0, "en passant le téléphone, la phrase écrite n'est plus à l'écran");
  await one.page.click('[data-act="moi"]');
  await one.page.waitForSelector(".histoire-field");
  check((await text(one)).includes("Un <b>chat</b> passa par là.") && await one.page.locator("main.game b").count() === 0, "le second voit la phrase du premier, en texte");
  await one.page.fill(".histoire-field", "brouillon");
  await one.page.reload();
  await one.page.waitForSelector(".histoire-field");
  check((await screen(one)).indexOf("ecrire-1") === 0, "après rechargement, on retrouve l'écran d'écriture");
  await write(one, S[1]);
  await one.page.reload();
  await one.page.waitForSelector(".g-pass");
  check((await screen(one)).indexOf("passe-2") === 0, "après rechargement, le téléphone est toujours à passer");
  await one.page.click('[data-act="moi"]');
  await one.page.waitForSelector(".histoire-field");
  const t2 = await text(one);
  check(t2.includes(S[1]) && !t2.includes("chat") && t2.includes(open1.slice(0, 20)), "le troisième ne voit que la dernière phrase de l'autre et la première phrase");
  await write(one, S[2]);
  for (let i = 3; i < 8; i++) {
    if (i === 7) {
      await one.page.click('[data-act="moi"]');
      await one.page.waitForSelector(".histoire-field");
      check((await one.page.locator(".histoire-form .btn").textContent()).includes("Finir"), "la dernière phrase est annoncée");
      await write(one, S[i]);
    } else await turn(one, S[i]);
  }
  await one.page.waitForSelector('[data-screen="fin"]');
  check(await one.page.locator('[data-act="lire"]').count() === 1, "l'histoire complète attend d'être lue");
  const inks = await readAll(one, 8);
  check(inks[0] === "-" && inks.slice(1).every((w, i) => i === 0 || w !== inks[i]), "la lecture montre la première phrase, puis les phrases en alternant les encres (" + inks.join("") + ")");
  check(await one.page.locator(".histoire-text .histoire-s").count() === 9, "l'histoire entière : la première phrase et les huit autres");
  check((await one.page.locator(".histoire-text").innerText()).includes("Un <b>chat</b>") && await one.page.locator(".histoire-text b").count() === 0, "le HTML écrit dans une phrase reste du texte");
  await one.page.evaluate(() => { navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await one.page.click('[data-act="partager"]');
  const shared = await one.page.evaluate(() => window.__shared);
  check(shared && shared.text.includes("Et ce fut la fin.") && shared.text.includes("Alex et Inès"), "« Enregistrer le texte » ouvre le partage avec toute l'histoire");
  await one.page.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await one.page.click('[data-act="partager"]');
  check(await until(async () => (await one.page.locator(".histoire-msg").textContent()).length > 0), "sans partage, le texte est copié (ou affiché à copier)");
  const clip = await one.page.evaluate(() => navigator.clipboard.readText().catch(() => "")), raw = await one.page.locator(".histoire-raw").count();
  check(clip.includes("Il portait un chapeau rouge.") || raw === 1, "le texte copié contient l'histoire");
  await one.page.reload();
  await one.page.waitForSelector('[data-screen="histoire"]');
  check(true, "après rechargement, l'histoire entière reste affichée");
  await one.page.click('[data-act="again"][data-val="12"]');
  await one.page.waitForSelector(".g-pass");
  await one.page.click('[data-act="moi"]');
  await one.page.waitForSelector(".histoire-field");
  const open2 = await one.page.locator(".histoire-card .g-card-text").textContent();
  check((await one.page.locator(".histoire-step").textContent()).includes("Nouvelle histoire · Phrase 1 sur 12") && open2 !== open1, "« Rejouer » relance en 12 phrases, avec un autre début");
  /* Les soixante débuts suivants (at = 0 à 59) sont tous différents : aucun ne revient avant que tous soient passés. */
  const seenStarts = new Set();
  for (let at = 0; at < 60; at++) {
    await one.page.evaluate(([key, at]) => { const s = JSON.parse(localStorage.getItem(key)); s.setup.at = at; s.local = { ok: 0 }; localStorage.setItem(key, JSON.stringify(s)); location.reload(); }, [KEY, at]).catch(() => {});
    await one.page.waitForSelector(".histoire-card .g-card-text");
    seenStarts.add(await one.page.locator(".histoire-card .g-card-text").textContent());
  }
  check(seenStarts.size === 60, "soixante relances, soixante débuts différents (" + seenStarts.size + ")");
  await one.page.click('[data-act="g-stop"]');
  await sleep(600);
  await one.page.click('[data-act="g-stop"]');
  await one.page.waitForSelector("[data-extra]");
  check((await one.page.locator(".histoire-kept > summary").textContent()).includes("(1)"), "« Nos histoires » garde l'histoire finie, pas celle en cours");
  await one.page.click(".histoire-kept > summary");
  await one.page.click(".histoire-old > summary");
  check((await one.page.locator(".histoire-old .histoire-text").innerText()).includes("Et ce fut la fin.") && await one.page.locator(".histoire-old .histoire-text b").count() === 0, "elle s'y relit en entier, en texte");
  await one.page.evaluate(() => { navigator.share = (d) => { window.__shared2 = d; return Promise.resolve(); }; });
  await one.page.click('.histoire-old [data-act="partager"]');
  check((await one.page.evaluate(() => window.__shared2 && window.__shared2.text) || "").includes("chapeau"), "et se partage depuis la présentation");
  await one.page.click('[data-act="vider"]');
  await one.page.click('[data-act="vider"]');
  check(await one.page.locator(".histoire-kept").count() === 1, "un double toucher trop rapide n'efface rien");
  await sleep(600);
  await one.page.click('[data-act="vider"]');
  check(await until(async () => (await one.page.locator(".histoire-kept").count()) === 0), "« Tout effacer » en deux touchers vide la liste");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-histoire");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-opt"][data-val="8"]');
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  await b.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await Promise.all([a.page.waitForSelector(".histoire"), b.page.waitForSelector(".histoire")]);
  check(await until(async () => (await a.page.locator(".histoire-field").count()) + (await b.page.locator(".histoire-field").count()) === 1), "un seul des deux écrit");
  const firstIsA = (await a.page.locator(".histoire-field").count()) === 1;
  const P = firstIsA ? [a, b] : [b, a];
  check(await P[1].page.locator(".g-wait").count() === 1 && (await P[1].page.locator(".g-title").textContent()).includes("Au tour"), "l'autre attend son tour");
  const openDuo = await P[0].page.locator(".histoire-card .g-card-text").textContent();
  check(openDuo.length > 10 && (await P[0].page.locator(".histoire-card .g-tag").textContent()) === "La première phrase", "le premier voit la première phrase");
  const D = ["Le vent se leva d'un coup.", HOSTILE, "La lune fit semblant de dormir.", "Un hibou prit des notes.", "Tout le monde se tut.", "Sauf la bouilloire.", "Elle siffla la fin.", "Et la nuit applaudit."];
  for (let i = 0; i < 8; i++) {
    const w = P[i % 2], o = P[1 - (i % 2)];
    if (i === 3) {
      /* Rechargement des deux côtés au milieu de l'histoire, brouillon en cours chez qui écrit. */
      await w.page.waitForSelector(".histoire-field");
      await w.page.fill(".histoire-field", "brouillon");
      await Promise.all([w.page.reload(), o.page.reload()]);
      await w.page.waitForSelector(".histoire-field");
      await o.page.waitForSelector(".g-wait");
      check((await screen(w)) === "ecrire-3-" + (w === a ? "a" : "b") && (await screen(o)) === "attente-3", "après rechargement des deux téléphones, chacun retrouve son écran");
      const seenNow = await text(w);
      check(seenNow.includes(D[2]) && !seenNow.includes(D[0]), "qui écrit la phrase 4 ne voit que la phrase 3 de l'autre, pas la phrase 1");
    }
    await write(w, D[i]);
    if (i < 7) {
      check(await until(async () => (await o.page.locator(".histoire-field").count()) === 1), "phrase " + (i + 1) + " envoyée : c'est à l'autre");
      if (i === 1) check(await o.page.locator("#app img").count() === 0 && await o.page.evaluate(() => window.__xss === undefined) && (await text(o)).includes("<img"), "une phrase hostile s'affiche comme du texte");
      if (i === 0) check((await screen(w)) === "attente-1" && (await text(w)).includes(D[0]), "qui vient d'écrire attend, avec sa phrase sous les yeux");
    }
  }
  check(await until(async () => (await screen(a)) === "fin" && (await screen(b)) === "fin"), "l'histoire est complète sur les deux téléphones");
  const ia = await readAll(a, 8);
  check(ia.slice(1).join("") === (firstIsA ? "abababab" : "babababa"), "chaque phrase est lue dans l'encre de son auteur");
  check(await a.page.locator('[data-act="again"]').count() === 0 && (await a.page.locator(".g-wait").textContent()).includes("Inès aura lu"), "A a fini de lire avant B : pas encore de relance");
  check((await a.page.locator(".histoire-text").innerText()).includes("<img") && await a.page.locator("#app img").count() === 0, "l'histoire entière garde la phrase hostile en texte");
  await readAll(b, 8);
  check(await until(() => a.page.locator('[data-act="again"]').count()), "B a lu : la relance apparaît chez A");
  check((await a.page.locator(".histoire-text").innerText()) === (await b.page.locator(".histoire-text").innerText()), "même histoire des deux côtés");
  await b.page.click('[data-act="again"][data-val="16"]');
  check(await until(async () => (await a.page.locator(".histoire-step").count()) && (await a.page.locator(".histoire-step").textContent()).includes("Phrase 1 sur 16")), "B relance en 16 phrases : A suit");
  const posts = (await env.ctl()).count.post;
  check(posts <= 20, "une histoire de huit phrases à deux, relance comprise, coûte au plus vingt messages (" + posts + ")");

  console.log("Valeurs hostiles");
  await forge(b, { s: "pas un tableau", fin: "oui" });
  await sleep(1500);
  check(await a.page.locator("main.game [data-screen]").count() === 1, "une tranche qui n'est pas un tableau ne bloque pas l'écran");
  await forge(b, { s: [42, { x: 1 }, HOSTILE, "x".repeat(5000)].concat(Array(40).fill("trop")) });
  await sleep(1500);
  const big = await a.page.evaluate(() => Math.max(0, ...[...document.querySelectorAll(".g-card-text")].map((e) => e.textContent.length)));
  check(await a.page.locator("#app img").count() === 0 && big <= 200 && await a.page.evaluate(() => window.__xss === undefined), "types faux, texte géant et HTML : affichés sans danger, bornés à 200 signes");
  await forge(b, { s: [] });
  await b.page.evaluate(([key]) => { const s = JSON.parse(localStorage.getItem(key)); s.setup = Object.assign({}, s.setup, { longueur: { x: 1 }, at: -5, deck: "<b>" }); s.st += 5; s.sw = s.me; s.seq[s.me].h = Date.now(); localStorage.setItem(key, JSON.stringify(s)); location.reload(); }, [KEY]).catch(() => {});
  await b.page.waitForSelector("main.game [data-screen]");
  check(await until(async () => (await a.page.locator(".histoire-step").textContent()).includes("sur 12")), "une longueur trafiquée retombe sur 12 phrases");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
