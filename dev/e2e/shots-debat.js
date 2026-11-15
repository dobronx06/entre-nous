/* Captures d'écran du jeu « Le débat idiot » (clair et sombre, puis grand écran et petit écran) pour contrôle visuel.
   Usage : EN_PW=… node dev/e2e/shots-debat.js   ->  dev/e2e/shots/debat-*.png */
const path = require("path");
const { setup, sleep, SHOTS } = require("./lib");

/* Sujets de secours : ils ne servent que si jeux/debat.data.js est absent (le vrai fichier les remplace). */
function fixture() {
  const list = ["La raclette se mange aussi en plein mois d'août", "Un chat, ça se vouvoie", "Le beige est une couleur pleine de caractère", "Mieux vaut un dragon de la taille d'un chat qu'un chat qui crache du feu"];
  window.GAME_DATA = window.GAME_DATA || {};
  window.GAME_DATA.debat = { topics: Array.from({ length: 12 }, (_, i) => list[i % list.length]) };
}
const screen = (p) => p.page.locator(".debat").getAttribute("data-screen");
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 8000)) throw new Error("attente trop longue : " + fn);
    await sleep(100);
  }
}
const on = (p, name) => until(async () => (await screen(p)).indexOf(name) === 0);
/* Le jeu ignore un toucher qui suit de trop près l'apparition d'un écran ou de ses boutons : on laisse passer ce délai. */
async function tap(p, act, v) {
  const sel = '.debat [data-act="' + act + '"]' + (v ? '[data-v="' + v + '"]' : "");
  await p.page.waitForSelector(sel);
  const age = await p.page.evaluate(() => { const s = JSON.parse(localStorage.getItem("en:g:debat") || "null"); return s && s.local.e ? Date.now() - s.local.e.at : 1e6; });
  if (age < 700) await sleep(700 - age);
  await p.page.click(sel);
}
/* Fait comme si la phase en cours avait commencé plus tôt sur ce téléphone (il lui reste `left` secondes), puis recharge. */
async function jump(p, left) {
  const loaded = p.page.waitForEvent("load");
  await p.page.evaluate((left) => {
    const s = JSON.parse(localStorage.getItem("en:g:debat"));
    s.local.t.at = Date.now() - (Number(s.setup.duree) - left) * 1000;
    localStorage.setItem("en:g:debat", JSON.stringify(s));
    location.reload();
  }, left).catch(() => {});
  await loaded;
  await p.page.waitForSelector(".debat");
}
/* Un débat entier, jusqu'au vote : celui qui parle arrête lui-même son temps. */
async function debate(a, b) {
  await tap(a, "go");
  for (const ph of ["pour", "contre"]) {
    await Promise.all([on(a, ph + "-"), on(b, ph + "-")]);
    await tap(await a.page.locator('.debat [data-act="done"]').count() ? a : b, "done");
  }
  await Promise.all([on(a, "vote-"), on(b, "vote-")]);
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
    await a.page.locator('article.card:has(a[href="#jeu-debat"])').screenshot({ path: path.join(SHOTS, "debat-01-carte-" + tag + ".png") });
    await a.page.goto(env.base + "#jeu-debat");
    await sleep(300);
    await a.shot("debat-02-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    /* Le créateur commence sans attendre : le sujet s'affiche, le débat attend l'invité. */
    await a.page.click('[data-act="g-go"]');
    await on(a, "sujet-");
    await sleep(400);
    await a.shot("debat-02b-sujet-sans-invite-" + tag);
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await Promise.all([on(a, "sujet-"), on(b, "sujet-")]);
    await sleep(400);
    await a.shot("debat-03-sujet-a-" + tag);
    await b.shot("debat-04-sujet-b-" + tag);

    /* Premier débat : le chrono en cours, puis la fin du temps vue du téléphone qui n'a pas lancé la phase. */
    await tap(a, "go");
    await Promise.all([on(a, "pour-"), on(b, "pour-")]);
    await jump(a, 47.4);
    await jump(b, 47.4);
    await sleep(300);
    const speaker = await a.page.locator('.debat [data-act="done"]').count() ? a : b, listener = speaker === a ? b : a;
    await speaker.shot("debat-05-parole-" + tag);
    await listener.shot("debat-06-ecoute-" + tag);
    await a.page.goto("about:blank");
    await jump(b, 1.2);
    await b.page.waitForSelector(".debat-flash", { state: "attached" });
    await b.shot("debat-07-eclair-" + tag);
    await b.page.waitForSelector('.debat [data-act="done"]:has-text("Passer")');
    await b.shot("debat-08-temps-ecoule-" + tag);
    await tap(b, "done");
    await a.page.goto(env.base + "#jeu-debat");
    await Promise.all([on(a, "contre-"), on(b, "contre-")]);
    await tap(await a.page.locator('.debat [data-act="done"]').count() ? a : b, "done");
    await Promise.all([on(a, "vote-"), on(b, "vote-")]);
    await sleep(300);
    await a.shot("debat-09-vote-" + tag);
    await tap(a, "vote", "a");
    await on(a, "attente-");
    await sleep(300);
    await a.shot("debat-10-a-vote-" + tag);
    await b.page.waitForSelector(".debat .hint");
    await b.shot("debat-11-vote-apres-l-autre-" + tag);
    await tap(b, "vote", "a");
    await Promise.all([on(a, "verdict-"), on(b, "verdict-")]);
    await sleep(300);
    await b.shot("debat-12-verdict-" + tag);

    /* Deuxième et troisième débats : chacun vote pour soi, puis chacun pour l'autre. */
    await tap(a, "next");
    await Promise.all([on(a, "sujet-"), on(b, "sujet-")]);
    await debate(a, b);
    await Promise.all([tap(a, "vote", "a"), tap(b, "vote", "b")]);
    await Promise.all([on(a, "verdict-"), on(b, "verdict-")]);
    await sleep(300);
    await a.shot("debat-13-mauvaise-foi-" + tag);
    await tap(b, "next");
    await Promise.all([on(a, "sujet-"), on(b, "sujet-")]);
    await debate(b, a);
    await Promise.all([tap(a, "vote", "b"), tap(b, "vote", "a")]);
    await Promise.all([on(a, "verdict-"), on(b, "verdict-")]);
    await sleep(300);
    await b.shot("debat-14-trop-de-politesse-" + tag);
    await tap(a, "end");
    await Promise.all([on(a, "fin"), on(b, "fin")]);
    await sleep(300);
    await a.shot("debat-15-resultat-" + tag);

    /* Sur un seul téléphone : mêmes écrans, textes adressés au couple. */
    const one = await env.phone("seul-" + tag, { dark });
    await one.ctx.addInitScript(fixture);
    await one.page.goto(env.base + "#jeu-debat");
    await one.page.fill("#name-a", "Maximilien-Alexandre");
    await one.page.fill("#name-b", "Zoé");
    await one.page.click('[data-act="g-opt"][data-val="90"]');
    await one.page.click('[data-act="g-start"][data-mode="solo"]');
    await on(one, "sujet-");
    await sleep(300);
    await one.shot("debat-16-seul-sujet-" + tag);
    await tap(one, "go");
    await on(one, "pour-");
    await jump(one, 88.4);
    await sleep(300);
    await one.shot("debat-17-seul-parole-" + tag);
    await tap(one, "done");
    await on(one, "contre-");
    await tap(one, "done");
    await on(one, "vote-");
    await sleep(300);
    await one.shot("debat-18-seul-vote-" + tag);
    await tap(one, "vote", "=");
    await on(one, "verdict-");
    await sleep(300);
    await one.shot("debat-19-seul-verdict-" + tag);
  }

  /* Grand écran, animations permises : la colonne reste étroite, le chrono garde sa taille, l'éclair de fin s'estompe. */
  const wide = await env.phone("bureau", { viewport: { width: 1280, height: 800 }, scale: 1, mobile: false, touch: false, motion: true });
  await wide.ctx.addInitScript(fixture);
  await wide.page.goto(env.base + "#jeu-debat");
  await wide.page.fill("#name-a", "Alex");
  await wide.page.fill("#name-b", "Inès");
  await sleep(600);
  await wide.shot("debat-20-bureau-presentation");
  await wide.page.click('[data-act="g-start"][data-mode="solo"]');
  await on(wide, "sujet-");
  await sleep(600);
  await wide.shot("debat-21-bureau-sujet");
  await tap(wide, "go");
  await on(wide, "pour-");
  await jump(wide, 52.4);
  await sleep(300);
  await wide.shot("debat-22-bureau-parole");
  await jump(wide, 1);
  await wide.page.waitForSelector(".debat-flash", { state: "attached" });
  await wide.shot("debat-23-bureau-eclair");
  await on(wide, "contre-");
  await tap(wide, "done");
  await tap(wide, "vote", "b");
  await on(wide, "verdict-");
  await tap(wide, "end");
  await on(wide, "fin");
  await sleep(300);
  await wide.shot("debat-24-bureau-resultat");

  /* Petit écran, prénoms longs, sans défiler : ce qu'on voit en arrivant sur l'annonce, le vote et le verdict. */
  const SMALL = { viewport: { width: 320, height: 568 }, fullPage: false };
  const sa = await env.phone("petit-a", SMALL), sb = await env.phone("petit-b", SMALL);
  await sa.ctx.addInitScript(fixture);
  await sb.ctx.addInitScript(fixture);
  await sa.page.goto(env.base + "#jeu-debat");
  await sa.page.fill("#name-a", "Maximilien-Alexandre");
  await sa.page.fill("#name-b", "Anne-Charlotte");
  await sa.page.click('[data-act="g-start"][data-mode="duo"]');
  await sb.page.goto(await sa.page.locator(".share[data-url]").getAttribute("data-url"));
  await sb.page.click('[data-act="g-join"]');
  await Promise.all([on(sa, "sujet-"), on(sb, "sujet-")]);
  await Promise.all([sa, sb].map((p) => p.page.waitForSelector('.debat [data-act="go"]')));
  await sleep(400);
  await sa.shot("debat-25-petit-sujet-a");
  await sb.shot("debat-25-petit-sujet-b");
  await debate(sa, sb);
  await sleep(300);
  await sb.shot("debat-26-petit-vote");
  await tap(sa, "vote", "a");
  await on(sa, "attente-");
  await tap(sb, "vote", "a");
  await Promise.all([on(sa, "verdict-"), on(sb, "verdict-")]);
  await sleep(500);
  await sb.shot("debat-27-petit-verdict");
  await tap(sa, "next");
  await Promise.all([on(sa, "sujet-"), on(sb, "sujet-")]);
  await debate(sb, sa);
  await tap(sa, "vote", "a");
  await on(sa, "attente-");
  await tap(sb, "vote", "=");
  await Promise.all([on(sa, "verdict-"), on(sb, "verdict-")]);
  await sleep(500);
  await sa.shot("debat-28-petit-verdict-mixte");
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
