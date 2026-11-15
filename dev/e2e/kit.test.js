/* Essais du socle des jeux (assets/jeux.js) avec le jeu d'essai dev/e2e/demo-game.js :
   un téléphone, deux téléphones, pannes du relais, données hostiles. */
const path = require("path");
const { setup, check, done, sleep } = require("./lib");

const DEMO = path.join(__dirname, "demo-game.js");
const HOSTILE = "<img src=x onerror=\"window.__xss=1\">";

async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DEMO });
  return p;
}
const state = (p) => p.page.evaluate(() => JSON.parse(document.getElementById("state").textContent));
const saved = (p) => p.page.evaluate(() => JSON.parse(localStorage.getItem("en:g:demo")));
const tap = (p, act, w) => p.page.click('[data-act="' + act + '"]' + (w ? '[data-w="' + w + '"]' : ""));
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
const token = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

(async () => {
  const env = await setup();

  console.log("Un seul téléphone");
  const one = await phone(env, "seul");
  await one.page.goto(env.base + "#jeu-demo");
  check((await one.page.locator("main.intro h1").textContent()).includes("jeu d'essai"), "la présentation du jeu s'affiche");
  await one.page.click('[data-act="g-opt"][data-val="y"]');
  check(await one.page.locator('[data-act="g-opt"][data-val="y"]').getAttribute("aria-pressed") === "true", "une option se choisit sans réaffichage");
  await one.page.fill("#name-a", "Alex");
  await one.page.fill("#name-b", "Inès");
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector('main.game[data-game="demo"]');
  let st = await state(one);
  check(st.duo === false && st.me === null && st.setup.mode === "y" && st.gen === 1, "partie sur un téléphone, avec l'option choisie");
  await tap(one, "inc", "a"); await tap(one, "inc", "a"); await tap(one, "inc", "b"); await tap(one, "sh"); await tap(one, "local");
  st = await state(one);
  check(st.a.n === 2 && st.b.n === 1 && st.sh.k === 1 && st.local.seen === 1, "tranches, état commun et état local s'écrivent");
  check((await one.page.locator(".g-pass h1").textContent()).includes("d'Inès"), "le passage de téléphone élide le prénom");
  await one.page.reload();
  await one.page.waitForSelector("main.game");
  const back = await state(one);
  check(back.a.n === 2 && back.b.n === 1 && back.sh.k === 1 && back.local.seen === 1 && back.setup.seed === st.setup.seed, "tout est retrouvé après rechargement");
  await tap(one, "new");
  const next = await state(one);
  check(next.gen === 2 && !next.a.n && !next.b.n && !next.sh.k && !next.local.seen && next.setup.seed !== st.setup.seed && next.setup.mode === "y", "nouvelle manche : tout repart de zéro, nouvelle seed");
  const counts = await one.page.evaluate(() => [window.__mounts, window.__cleanups]);
  check(counts[0] >= 2 && counts[1] === counts[0] - 1, "mount et son nettoyage sont appelés à chaque rendu");
  await one.page.click('.g-foot [data-act="g-stop"]');
  check(await one.page.locator("main.game").count() === 1, "un seul toucher n'arrête pas la partie");
  await one.page.click('.g-foot [data-act="g-stop"]');
  await one.page.waitForSelector("main.intro");
  check(await saved(one) === null, "deux touchers arrêtent la partie et l'effacent");
  await one.page.goto(env.base + "#accueil");
  check(await one.page.locator('a.card-link[href="#jeu-demo"]').count() === 1, "l'accueil liste le jeu dans « Pour jouer »");

  console.log("Deux téléphones");
  const a = await phone(env, "a"), b = await phone(env, "b");
  await a.page.goto(env.base + "#jeu-demo");
  await a.page.fill("#name-a", "Alex");
  await a.page.fill("#name-b", "Inès");
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
  check(/#g=/.test(link || ""), "l'invitation propose un lien");
  check((await a.page.locator("p.sync").textContent()).includes("En attente d'Inès"), "l'invitation attend l'autre");
  await b.page.goto(link);
  check((await b.page.locator(".invite").textContent()).includes("Alex"), "l'invité voit qui l'invite");
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector("main.game");
  check(await until(() => a.page.locator("main.game").count()), "partie en direct : l'écran de jeu s'ouvre chez l'hôte dès que l'invité arrive");
  check(await until(async () => (await state(a)).hereB && (await state(b)).hereA), "chacun sait que l'autre est là");
  check(await until(async () => (await state(a)).online === "ok" && await a.page.locator('.g-top [data-net="ok"]').count()), "la pastille indique la liaison");
  await tap(a, "mine");
  check(await until(async () => (await state(b)).a.n === 1, 2000), "ce que A écrit arrive chez B en moins de deux secondes");
  await tap(b, "mine"); await tap(b, "sh");
  check(await until(async () => { const s = await state(a); return s.b.n === 1 && s.sh.k === 1 && s.sh.by === "b"; }, 2000), "ce que B écrit, tranche et état commun, arrive chez A");
  await tap(b, "inc", "a");
  await sleep(300);
  check(!(await state(b)).a.n || (await state(b)).a.n === 1, "sur deux téléphones, on ne peut pas écrire dans la tranche de l'autre");
  await b.page.reload();
  await b.page.waitForSelector("main.game");
  await tap(a, "mine");
  check(await until(async () => (await state(b)).a.n === 2), "après rechargement, B continue de recevoir");

  console.log("Écritures simultanées");
  for (let i = 0; i < 3; i++) { await Promise.all([tap(a, "sh"), tap(b, "sh")]); await sleep(500); }
  check(await until(async () => {
    const x = await state(a), y = await state(b);
    return JSON.stringify(x.sh) === JSON.stringify(y.sh) && x.sh.k >= 2;
  }, 6000), "deux écritures au même instant : les deux téléphones gardent le même état commun");

  console.log("Gros envoi");
  const before = (await env.ctl()).count.post;
  await tap(a, "big");
  check(await until(async () => { const s = await state(b); return s.a.blob && s.a.blob.length === (await state(a)).a.blob.length && s.a.blob.endsWith("fin"); }, 8000), "une tranche de 12 ko arrive entière");
  const ctl = await env.ctl();
  check(ctl.count.post - before >= 4 && ctl.count.rejected === 0, "découpée en plusieurs messages, tous acceptés par le relais (" + (ctl.count.post - before) + ")");

  console.log("Champ de saisie pendant que l'autre joue");
  await a.page.click("#note");
  await a.page.type("#note", "bonjour");
  await tap(b, "mine");
  await until(async () => (await state(a)).b.n === 2);
  check(await a.page.inputValue("#note") === "bonjour" && await a.page.evaluate(() => document.activeElement.id === "note" && document.activeElement.selectionStart === 7), "le texte, le focus et le curseur survivent au réaffichage");

  console.log("Geste en cours");
  await tap(a, "hold");
  await tap(b, "mine");
  await sleep(1200);
  check((await state(a)).b.n === 2 && (await saved(a)).S.b.d.n === 3, "tenu : ce qui arrive est enregistré mais pas affiché");
  await tap(a, "release");
  check((await state(a)).b.n === 3, "lâché : l'écran se met à jour");

  console.log("Économie de messages");
  const p0 = (await env.ctl()).count.post;
  for (let i = 0; i < 5; i++) { await tap(a, "sh"); await sleep(450); }
  await sleep(600);
  check((await env.ctl()).count.post - p0 <= 6, "cinq changements de l'état commun coûtent au plus six messages, même avec une grosse tranche en mémoire");

  console.log("Flux coupé");
  await env.ctl("drop=1");
  await sleep(300);
  await tap(a, "sh");
  const want = (await state(a)).sh.k;
  check(await until(async () => (await state(b)).sh.k === want, 15000), "après une coupure du flux, le changement suivant arrive quand même");

  console.log("Envois refusés");
  await env.ctl("fail=2&status=500");
  await tap(a, "mine");
  const sawErr = await until(() => a.page.locator('.g-top [data-net="err"]').count(), 4000);
  const n = (await state(a)).a.n;
  check(await until(async () => (await state(b)).a.n === n, 20000), "un envoi refusé est retenté jusqu'à passer");
  check(sawErr, "la pastille a signalé le problème");
  check(await until(() => a.page.locator('.g-top [data-net="ok"]').count(), 20000), "puis la liaison revient");

  console.log("Nouvelle manche lancée par B");
  await tap(b, "new");
  check(await until(async () => { const s = await state(a); return s.gen === 2 && !s.a.n && !s.b.n && !s.sh.k && s.setup.mode === "y" && s.setup.seed === (await state(b)).setup.seed; }), "A passe à la nouvelle manche, avec la même seed que B");
  await tap(a, "mine");
  check(await until(async () => (await state(b)).a.n === 1), "la nouvelle manche se synchronise");

  console.log("Le relais a tout oublié");
  await env.ctl("reset=1");
  await Promise.all([a.page.reload(), b.page.reload()]);
  await Promise.all([a.page.waitForSelector("main.game"), b.page.waitForSelector("main.game")]);
  check(await until(async () => { const t = (await env.ctl()).topics; const k = Object.keys(t)[0]; return k && t[k].messages >= 2; }, 8000), "chacun redépose son dernier état");
  await tap(b, "mine");
  check(await until(async () => (await state(a)).b.n === 1), "et la partie continue");

  console.log("Invitations abîmées");
  const c = await phone(env, "c");
  const base = { g: "demo", v: 1, n: ["Alex", "Inès"], r: "0".repeat(32), k: "k".repeat(43), su: { seed: 1 }, gen: 1 };
  for (const [label, tk] of [["illisible", "pas-un-lien"], ["jeu inconnu", token(Object.assign({}, base, { g: "nope" }))], ["jeu piégé", token(Object.assign({}, base, { g: "constructor" }))],
    ["autre version", token(Object.assign({}, base, { v: 99 }))], ["incomplet", token(Object.assign({}, base, { k: "" }))], ["tableau", token([1, 2])]]) {
    await c.page.goto(env.base + "#g=" + tk);
    check(await until(() => c.page.locator(".err").count(), 3000), "lien " + label + " : message d'erreur, pas de page cassée");
    await c.page.goto("about:blank");
  }

  console.log("Données hostiles");
  await c.page.goto(env.base + "#g=" + token(Object.assign({}, base, { n: [HOSTILE, HOSTILE] })));
  await c.page.waitForSelector(".invite");
  check(await c.page.locator("#app img").count() === 0 && (await c.page.locator(".invite").textContent()).includes("<img"), "les prénoms d'une invitation sont affichés comme du texte");
  await c.page.evaluate((h) => { localStorage.setItem("en:names", JSON.stringify({ a: h, b: h })); localStorage.removeItem("en:ginvite"); }, HOSTILE);
  await c.page.goto(env.base + "#jeu-demo");
  await c.page.reload();
  await c.page.click('[data-act="g-start"][data-mode="solo"]');
  await c.page.waitForSelector("main.game");
  check(await c.page.locator("#app img").count() === 0 && await c.page.evaluate(() => window.__xss === undefined), "pastilles, passage de téléphone et attente échappent les prénoms");
  await c.page.evaluate(() => localStorage.setItem("en:g:demo", JSON.stringify({ id: "demo", v: 1, duo: "oui", S: null })));
  await c.page.reload();
  check(await until(() => c.page.locator("main.intro").count(), 3000) && await saved(c) === null, "une partie enregistrée illisible est jetée, la page s'ouvre");

  console.log("Page intégrée");
  const f = await phone(env, "cadre");
  await f.page.setContent('<iframe src="' + env.base + '#jeu-demo" style="width:380px;height:800px"></iframe>');
  const frame = f.page.frameLocator("iframe");
  await frame.locator('[data-act="g-start"][data-mode="solo"]').waitFor();
  check(await frame.locator('[data-act="g-start"][data-mode="duo"]').count() === 0, "dans un cadre, seul le jeu sur un téléphone est proposé");

  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
