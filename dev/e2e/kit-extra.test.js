/* Essais « pour casser » le socle des jeux (assets/jeux.js), en complément de kit.test.js. Chaque
   scénario est une chose qui arrive vraiment à deux personnes qui jouent, sur deux téléphones ou sur
   un seul : réseau qui lâche, rechargement, lien ouvert deux fois, relais saturé ou lent, messages
   forgés, stockage abîmé, prénoms difficiles. Un check en échec décrit un défaut du socle.

   Lancer :  EN_PW=/chemin/vers/playwright-core node dev/e2e/kit-extra.test.js [mots…]
   Sans argument, tout est joué (comptez trois à quatre minutes). Avec des mots, seuls les scénarios
   dont le titre en contient un sont joués :  … kit-extra.test.js rafale relais

   Outils propres à ces essais : un second jeu d'essai (« demo2 », pas en direct, titre long), déclaré
   ici ; le chiffrement du salon refait côté Node pour lire le relais et y déposer des messages forgés ;
   l'horloge de Playwright (page.clock, à partir de la version 1.45) pour traverser en un instant les
   attentes de trente secondes du socle ;
   un relais qui compte ses requêtes, imité en interceptant les envois d'un téléphone. Hors une capture
   d'écran dans dev/e2e/shots/, rien n'est écrit dans le projet : build.js est lancé avec sa sortie
   détournée vers un dossier temporaire. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { webcrypto } = require("crypto");
const { pathToFileURL } = require("url");
const { setup, check, done, sleep, ROOT } = require("./lib");

const DEMO = path.join(__dirname, "demo-game.js");

/* Le même jeu que « demo », mais pas en direct, avec le titre long de l'exemple donné aux auteurs
   de jeux et deux boutons de plus : une tranche trop grosse pour le relais, et une tranche faite
   de tout ce qui gêne un découpage (caractères de contrôle, moitiés de caractères doubles, séparateurs
   de ligne, guillemets et barres obliques en série). */
function secondGame() {
  const base = (window.GAMES || []).find((d) => d.id === "demo");
  if (!base) return;
  const nasty = "\u0000\u001f".repeat(700) + "\ud83d" + "é\u2028\u2029\ufeff".repeat(300) + "\u{1F469}\u200d\u{1F469}\u200d\u{1F467}".repeat(260) + "\udc00" + "\\\"".repeat(1300) + "</script><!--" + "fin";
  window.GAMES.push(Object.assign({}, base, {
    id: "demo2", title: "Sur la même longueur d'onde", hook: "Un second jeu d'essai", live: false, options: undefined,
    view(g) {
      return base.view(g) + '<div class="actions"><button class="btn small" type="button" data-act="huge">énorme</button>' +
        '<button class="btn small" type="button" data-act="nasty">difficile</button></div>';
    },
    act(g, name, el) {
      if (name === "huge") g.set(g.me || "a", { blob: "x".repeat(200000) });
      else if (name === "nasty") g.set(g.me || "a", { blob: nasty });
      else base.act(g, name, el);
    }
  }));
}

/* o.clock : horloge pilotée par l'essai ; o.noStream : navigateur sans EventSource. */
async function phone(env, name, o) {
  o = o || {};
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DEMO });
  await p.ctx.addInitScript(secondGame);
  if (o.noStream) await p.ctx.addInitScript(() => { Object.defineProperty(window, "EventSource", { value: undefined, configurable: true }); });
  if (o.clock) await p.page.clock.install();
  return p;
}

const state = (p) => p.page.evaluate(() => JSON.parse(document.getElementById("state").textContent));
const saved = (p, id) => p.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), "en:g:" + (id || "demo"));
const tap = (p, act, w) => p.page.click('[data-act="' + act + '"]' + (w ? '[data-w="' + w + '"]' : ""));
const net = (p) => p.page.locator(".g-top [data-net]").getAttribute("data-net");
const secs = (ms) => (ms / 1000).toFixed(1).replace(".", ",") + " s";
async function until(fn, ms) {
  const t0 = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) { /* la page se redessine : on réessaie */ }
    if (Date.now() - t0 > (ms || 5000)) return false;
    await sleep(100);
  }
}
const linked = (p, ms) => until(async () => (await net(p)) === "ok", ms || 8000);

/* Ce que le jeu voit, dans un ordre de clés stable, pour comparer deux téléphones. */
const sorted = (x) => (Array.isArray(x) ? x.map(sorted) : x && typeof x === "object" ? Object.keys(x).sort().reduce((o, k) => { o[k] = sorted(x[k]); return o; }, {}) : x);
const game = (s) => JSON.stringify(sorted({ gen: s.gen, setup: s.setup, a: s.a, b: s.b, sh: s.sh }));
async function settled(x, y, ms) {
  const same = async () => game(await state(x)) === game(await state(y));
  if (!await until(same, ms || 8000)) return false;
  await sleep(700); /* une égalité de passage ne compte pas */
  return until(same, 3000);
}

async function stop(p) {
  await p.page.click('.g-foot [data-act="g-stop"]');
  await sleep(450);
  await p.page.click('.g-foot [data-act="g-stop"]');
  await p.page.waitForSelector("main.intro");
}

/* Crée une partie à deux téléphones et renvoie le lien d'invitation. */
async function host(env, p, o) {
  o = o || {};
  await p.page.goto(env.base + "#jeu-" + (o.id || "demo"));
  if (o.names) { await p.page.fill("#name-a", o.names[0]); await p.page.fill("#name-b", o.names[1]); }
  await p.page.click('[data-act="g-start"][data-mode="duo"]');
  return p.page.locator(".share[data-url]").getAttribute("data-url");
}
async function join(p, link) {
  await p.page.goto(link);
  await p.page.click('[data-act="g-join"]');
  await p.page.waitForSelector("main.game");
}
/* Deux téléphones reliés dans une même partie : Alex l'a créée (a), Inès l'a rejointe (b). */
async function pair(env, tag, o) {
  o = o || {};
  const a = await phone(env, tag + "-a", o.a || o), b = await phone(env, tag + "-b", o.b || o);
  const link = await host(env, a, { id: o.id, names: o.names || ["Alex", "Inès"] });
  await join(b, link);
  if (o.id === "demo2") await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector("main.game");
  await linked(a);
  await linked(b);
  const room = (await saved(a, o.id)).room;
  return { a, b, link, room };
}

/* Le chiffrement du salon, refait ici pour lire le relais et y écrire sans passer par le site. */
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const roomKey = (room) => webcrypto.subtle.importKey("raw", unb64u(room.k), "AES-GCM", false, ["encrypt", "decrypt"]);
async function seal(room, obj) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, await roomKey(room), Buffer.from(JSON.stringify(obj)));
  return b64u(Buffer.concat([Buffer.from(iv), Buffer.from(ct)]));
}
async function unseal(room, msg) {
  const raw = unb64u(msg);
  const pt = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12) }, await roomKey(room), raw.subarray(12));
  return JSON.parse(Buffer.from(pt).toString("utf8"));
}
const topicUrl = (env, room) => env.relayUrl + "entrenous-" + room.r;
const post = (env, room, body) => fetch(topicUrl(env, room), { method: "POST", body });
async function backlog(env, room) {
  const res = await fetch(topicUrl(env, room) + "/json?poll=1&since=all"), out = [];
  for (const line of (await res.text()).split("\n")) {
    let m = null, o = null;
    try { m = JSON.parse(line); } catch (e) { continue; }
    try { o = await unseal(room, m.message); } catch (e) { /* pas pour nous */ }
    out.push({ raw: m.message, o });
  }
  return out;
}
const subscribers = async (env, room) => ((await env.ctl()).topics["entrenous-" + room.r] || { subscribers: 0 }).subscribers;
const decodeLink = (link) => JSON.parse(unb64u(link.split("#g=")[1]).toString("utf8"));

const scenarios = [];
const scenario = (title, fn) => scenarios.push({ title, fn });

/* ---------- État partagé ---------- */

scenario("Nouvelle manche lancée au même instant sur les deux téléphones, puis chacun écrit", async (env) => {
  const { a, b } = await pair(env, "manche");
  await tap(a, "local");
  await tap(b, "local");
  for (let i = 1; i <= 3; i++) {
    await Promise.all([tap(a, "new"), tap(b, "new")]);
    await Promise.all([tap(a, "mine"), tap(b, "mine")]);
    await Promise.all([tap(a, "sh"), tap(b, "sh")]);
    const ok = await settled(a, b, 8000), x = await state(a), y = await state(b);
    check(ok, "essai " + i + " : même manche, même seed, mêmes tranches et même état commun des deux côtés (manches " + x.gen + " et " + y.gen + ")");
  }
  const x = await state(a), y = await state(b);
  check(!x.local.seen && !y.local.seen, "l'état local des deux téléphones est reparti de zéro");
  await tap(a, "mine");
  await tap(b, "mine");
  check(await until(async () => { const s = await state(a), t = await state(b); return s.a.n >= 1 && s.b.n >= 1 && game(s) === game(t); }, 6000), "ensuite, ce que chacun écrit arrive encore chez l'autre");
});

scenario("L'invité arrive alors que la partie en est à sa troisième manche", async (env) => {
  const a = await phone(env, "tard-a"), b = await phone(env, "tard-b");
  const link = await host(env, a, { names: ["Alex", "Inès"] });
  await a.page.click('[data-act="g-go"]'); /* « Commencer sans attendre » */
  await a.page.waitForSelector("main.game");
  await tap(a, "new");
  await tap(a, "new");
  await tap(a, "mine");
  await tap(a, "sh");
  await join(b, link); /* le lien date de la première manche */
  const ok = await settled(a, b, 8000), s = await state(b);
  check(ok && s.gen === 3 && s.a.n === 1 && s.sh.k === 1, "il se retrouve dans la manche en cours, avec ce que l'autre y a déjà fait (manche " + s.gen + ")");
  check(await until(async () => (await state(a)).hereB, 4000), "et l'hôte voit qu'il est arrivé");
});

/* ---------- Réseau ---------- */

scenario("Un téléphone hors ligne pendant dix changements de l'autre, puis de retour", async (env) => {
  const { a, b } = await pair(env, "horsligne");
  await tap(b, "mine");
  await until(async () => (await state(a)).b.n === 1);
  await b.ctx.setOffline(true);
  await env.ctl("drop=1"); /* une vraie coupure ferme aussi le flux déjà ouvert (A, lui, se reconnecte) */
  const cut = Date.now();
  await tap(b, "mine"); /* B joue sans réseau */
  await tap(b, "mine");
  for (let i = 0; i < 10; i++) { await tap(a, "mine"); await sleep(120); }
  await tap(a, "sh");
  await tap(a, "sh");
  check((await state(b)).b.n === 3, "sans réseau, B continue de jouer sur son téléphone");
  check(await until(async () => (await net(b)) === "err", 12000), "et sa pastille finit par dire « Hors ligne »");
  /* Huit secondes de coupure : le prochain essai d'envoi programmé par B est alors à plusieurs secondes. */
  await sleep(Math.max(0, 8000 - (Date.now() - cut)));
  const t0 = Date.now();
  await b.ctx.setOffline(false);
  const okIn = await until(async () => { const s = await state(b); return s.a.n === 10 && s.sh.k === 2; }, 40000), tIn = Date.now() - t0;
  const okOut = await until(async () => (await state(a)).b.n === 3, 40000), tOut = Date.now() - t0;
  check(okIn, "de retour, B rattrape les dix changements de A et son état commun (" + secs(tIn) + ")");
  check(okOut, "et A reçoit ce que B a écrit sans réseau (" + secs(tOut) + ")");
  check(okOut && tOut <= 3000, "ce que B avait à envoyer part dès le retour du réseau, sans attendre l'essai suivant (" + secs(tOut) + " après le retour)");
  check(await until(async () => (await net(a)) === "ok" && (await net(b)) === "ok", 20000), "les deux pastilles reviennent à « Connecté »");
  check(await settled(a, b, 5000), "et les deux téléphones sont d'accord");
});

scenario("Rechargement au milieu d'un envoi en plusieurs morceaux", async (env) => {
  const { a, b } = await pair(env, "recharge");
  await env.ctl("delay=250"); /* huit morceaux à 250 ms : l'envoi dure deux secondes */
  await tap(a, "big");
  await sleep(900);
  await a.page.reload();
  await env.ctl("delay=0");
  await a.page.waitForSelector("main.game");
  const mine = (await state(a)).a.blob || "";
  check(mine.length > 7000 && mine.endsWith("fin"), "après rechargement, A a toujours sa grosse tranche");
  check(await until(async () => (await state(b)).a.blob === mine, 12000), "B la reçoit entière, identique au caractère près, malgré l'envoi interrompu");
  await tap(a, "sh");
  check(await until(async () => (await state(b)).sh.k === 1, 5000), "et la suite de la partie passe");
});

scenario("Le relais est lent, et le téléphone se réveille deux fois de suite", async (env) => {
  const { a, b, room } = await pair(env, "lent");
  await env.ctl("delay=700");
  await tap(a, "mine");
  await tap(a, "mine");
  await Promise.all([tap(a, "sh"), tap(b, "sh")]);
  await tap(b, "mine");
  const ok = await settled(a, b, 15000), s = await state(b);
  check(ok && s.a.n === 2 && s.b.n === 1 && s.sh.k === 1, "relais lent : les deux téléphones finissent d'accord");
  await b.page.reload();
  await b.page.waitForSelector("main.game");
  await tap(a, "mine");
  check(await until(async () => (await state(b)).a.n === 3, 10000), "un rechargement pendant ce temps ne casse rien");
  /* Écran rallumé et réseau retrouvé au même moment : deux réveils alors qu'une lecture est en cours. */
  await a.page.evaluate(() => { window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
  await sleep(3000);
  const subs = await subscribers(env, room);
  check(subs === 2, "deux réveils coup sur coup n'ouvrent pas deux flux (" + subs + " flux ouverts pour deux téléphones)");
  await env.ctl("delay=0");
  await tap(b, "mine");
  check(await until(async () => (await state(a)).b.n === 2, 6000), "et A reçoit toujours");
});

scenario("Une requête au relais qui ne répond jamais", async (env) => {
  const { a, b } = await pair(env, "muet");
  await env.ctl("delay=45000"); /* la prochaine requête reste sans réponse trois quarts de minute */
  await tap(a, "mine");
  await sleep(1200);
  await env.ctl("delay=0"); /* le relais va de nouveau bien, mais la requête partie reste en suspens */
  await tap(a, "mine");
  await tap(a, "sh");
  const t0 = Date.now(), ok = await until(async () => { const s = await state(b); return s.a.n === 2 && s.sh.k === 1; }, 25000);
  check(ok, "une requête restée sans réponse ne bloque pas les envois suivants plus de 25 s (" + (ok ? secs(Date.now() - t0) : "rien reçu en 25 s, pastille de A : " + await net(a)) + ")");
});

scenario("Sans EventSource : lecture lente du relais", async (env) => {
  const { a, b } = await pair(env, "sansflux", { a: {}, b: { noStream: true, clock: true } });
  check((await net(b)) === "ok", "sans flux continu, la liaison est quand même annoncée");
  const p0 = (await env.ctl()).count.poll;
  await tap(a, "mine");
  await tap(a, "sh");
  await sleep(1500);
  check(!(await state(b)).a.n, "rien n'arrive avant la lecture suivante");
  await b.page.clock.fastForward(12500);
  check(await until(async () => { const s = await state(b); return s.a.n === 1 && s.sh.k === 1; }, 4000), "douze secondes plus tard, la lecture apporte les changements de A");
  for (let i = 0; i < 4; i++) { await b.page.clock.fastForward(12500); await sleep(250); }
  const polls = (await env.ctl()).count.poll - p0;
  check(polls <= 6, "une lecture toutes les douze secondes, pas plus (" + polls + " en une minute)");
  await tap(b, "mine");
  check(await until(async () => (await state(a)).b.n === 1, 4000), "et ce que B écrit part normalement");
});

scenario("Flux muet : sans signe de vie du relais, le téléphone se reconnecte", async (env) => {
  await env.ctl("keepalive=600000");
  const { a, b, room } = await pair(env, "chien", { a: { clock: true }, b: {} });
  const s0 = (await env.ctl()).count.sse;
  await a.page.clock.fastForward(71000);
  await sleep(300);
  await a.page.clock.fastForward(2500);
  check(await until(async () => (await env.ctl()).count.sse > s0, 4000), "après 70 s sans signe de vie, A rouvre le flux");
  check(await linked(a, 4000) && await subscribers(env, room) === 2, "un seul flux par téléphone ensuite");
  await tap(b, "mine");
  check(await until(async () => (await state(a)).b.n === 1, 4000), "et la partie continue");
});

/* ---------- Limites du relais ---------- */

scenario("Rafale : trois cents changements en douze secondes", async (env) => {
  const { a, b } = await pair(env, "rafale");
  const p0 = (await env.ctl()).count.post, t0 = Date.now();
  await a.page.evaluate(async () => {
    for (let i = 0; i < 300; i++) { document.querySelector('[data-act="mine"]').click(); await new Promise((r) => setTimeout(r, 40)); }
  });
  const dur = Date.now() - t0, sent = (await env.ctl()).count.post - p0;
  check((await state(a)).a.n === 300, "A a bien compté ses 300 changements");
  check(sent <= 36, "les envois sont regroupés et la soupape tient : " + sent + " messages en " + secs(dur));
  check(await until(async () => (await state(b)).a.n === 300, 8000), "le dernier état arrive chez B");
  await sleep(5500);
  const total = (await env.ctl()).count.post - p0;
  check(total <= 38, "rien ne part en plus une fois le calme revenu (" + total + " messages au total)");
});

scenario("Rafale de grosses tranches : la soupape compte-t-elle les messages ?", async (env) => {
  const { a, b } = await pair(env, "rafgros");
  const p0 = (await env.ctl()).count.post, t0 = Date.now();
  await a.page.evaluate(async () => {
    for (let i = 0; i < 25; i++) { document.querySelector('[data-act="big"]').click(); await new Promise((r) => setTimeout(r, 400)); }
  });
  const dur = Date.now() - t0, sent = (await env.ctl()).count.post - p0;
  check(sent <= 60, "25 changements d'une tranche de 12 ko en " + secs(dur) + " restent sous la rafale de 60 requêtes que le relais accepte (" + sent + " messages déposés)");
  check(await until(async () => ((await state(b)).a.blob || "").endsWith("fin"), 10000), "la tranche arrive chez B");
});

scenario("Le relais répond 429 pendant cinq minutes", async (env) => {
  const { a, b, room } = await pair(env, "limite", { clock: true });
  await env.ctl("fail=100000&status=429");
  await env.ctl("drop=1"); /* les flux tombent aussi : il faut se reconnecter */
  await tap(a, "mine");
  await tap(b, "sh");
  await sleep(1500);
  const r0 = (await env.ctl()).count.rejected;
  for (let i = 0; i < 10; i++) {
    await a.page.clock.fastForward(30000);
    await b.page.clock.fastForward(30000);
    await sleep(300);
  }
  const rejected = (await env.ctl()).count.rejected - r0;
  check(rejected > 0 && rejected <= 60, "pendant cinq minutes de refus, les deux téléphones n'insistent pas plus que ce que le relais rend, une requête toutes les 5 s (" + rejected + " requêtes refusées)");
  check(/^(err|full)$/.test(await net(a)) && /^(err|full)$/.test(await net(b)), "les deux pastilles signalent le problème (« Relais saturé » ou « Hors ligne »)");
  await env.ctl("fail=0");
  await a.page.clock.fastForward(30000);
  await b.page.clock.fastForward(30000);
  check(await until(async () => (await state(b)).a.n === 1 && (await state(a)).sh.k === 1, 8000), "le relais revenu, ce qui attendait part au premier essai suivant");
  check(await linked(a, 6000) && await linked(b, 6000), "et les pastilles reviennent à « Connecté »");
  check(await subscribers(env, room) === 2, "avec un seul flux par téléphone");
});

scenario("429 au milieu d'un gros envoi : le relais ne rend qu'une requête toutes les cinq secondes", async (env) => {
  const { a, b, room } = await pair(env, "seau", { a: { clock: true }, b: {} });
  let tokens = 3, refused = 0; /* le seau du relais est presque vide */
  await a.ctx.route(env.relayUrl + "entrenous-*", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (tokens > 0) { tokens--; return route.continue(); }
    refused++;
    return route.fulfill({ status: 429, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: '{"code":42901,"http":429,"error":"limit reached"}' });
  });
  await tap(a, "big"); /* huit morceaux */
  await until(() => refused > 0, 5000);
  let rounds = 0;
  const arrived = async () => ((await state(b)).a.blob || "").endsWith("fin");
  while (rounds < 6 && !await arrived()) {
    rounds++;
    tokens = 6; /* ce que le relais a rendu en trente secondes */
    await a.page.clock.fastForward(30000);
    await sleep(700);
  }
  const parts = (await backlog(env, room)).filter((m) => m.o && m.o.w === "a" && m.o.t === "d" && m.o.c > 1);
  const distinct = new Set(parts.map((m) => m.o.n + ":" + m.o.p)).size;
  check(await arrived(), "avec six requêtes rendues toutes les trente secondes, une tranche de huit morceaux finit par arriver (" + rounds + " reprises, " + parts.length + " messages déposés)");
  check(parts.length === distinct, "un morceau déjà accepté par le relais n'est pas renvoyé (" + (parts.length - distinct) + " doublons sur " + parts.length + " messages)");
});

scenario("Une tranche trop grosse pour le relais", async (env) => {
  const { a, b } = await pair(env, "enorme", { id: "demo2" });
  const p0 = (await env.ctl()).count.post;
  await tap(a, "huge");
  await sleep(1500);
  const sent = (await env.ctl()).count.post - p0;
  check(sent === 0, "au-delà de 150 ko, rien ne part (" + sent + " message)");
  await tap(a, "sh");
  check(await until(async () => (await state(b)).sh.k === 1, 5000), "l'état commun, lui, passe toujours");
  await a.page.reload();
  await a.page.waitForSelector("main.game");
  await sleep(1500);
  check((await env.ctl()).count.post - p0 === 1 && (await state(a)).a.blob.length === 200000, "après rechargement, la tranche est toujours là et le socle ne s'acharne pas à l'envoyer");
});

scenario("Une tranche pleine de caractères difficiles à découper", async (env) => {
  const { a, b } = await pair(env, "difficile", { id: "demo2" });
  await tap(a, "nasty");
  const mine = (await state(a)).a.blob;
  check(await until(async () => (await state(b)).a.blob === mine, 8000), "caractères de contrôle, moitiés de caractères doubles, séparateurs de ligne, guillemets en série : la tranche arrive identique (" + mine.length + " caractères)");
  const ctl = await env.ctl();
  check(ctl.count.rejected === 0, "et aucun morceau n'a dépassé la limite du relais (" + ctl.count.post + " messages, " + ctl.count.rejected + " refusé)");
});

/* ---------- Invitations, onglets, relances ---------- */

/* L'invité revient dans la partie par le lien, comme le même joueur. Avant : B a écrit deux fois sa
   tranche et deux fois l'état commun, A n'a écrit que sa tranche (le dernier état commun vient donc de B).
   Après : le revenant doit voir ce que A voit, et ce qu'il écrit doit arriver chez A. */
async function comeBack(a, back, how) {
  const ref = await state(a);
  const found = await until(async () => { const s = await state(back); return s.b.n === 2 && s.a.n === 1; }, 6000);
  check(found, how + " : il retrouve sa tranche et celle de A (" + JSON.stringify((await state(back)).b) + ")");
  const same = await until(async () => JSON.stringify((await state(back)).sh) === JSON.stringify(ref.sh), 4000);
  check(same, how + " : il retrouve l'état commun de la partie (A voit " + JSON.stringify(ref.sh) + ", lui " + JSON.stringify((await state(back)).sh) + ")");
  await tap(back, "mine");
  await tap(back, "sh");
  check(await until(async () => (await state(a)).b.n === 3, 6000), how + " : sa tranche arrive encore chez A");
  const ok = await settled(a, back, 6000), x = await state(a), y = await state(back);
  check(ok && x.sh.k === 3, how + " : ce qu'il écrit dans l'état commun arrive chez A (A voit " + JSON.stringify(x.sh) + ", lui " + JSON.stringify(y.sh) + ")");
}
async function played(a, b) {
  await tap(a, "mine");
  await tap(b, "mine");
  await tap(b, "mine");
  await tap(b, "sh");
  await tap(b, "sh");
  return until(async () => { const s = await state(a); return s.b.n === 2 && s.sh.k === 2 && (await state(b)).a.n === 1; }, 6000);
}

scenario("L'invité ouvre l'invitation deux fois, et l'hôte ouvre son propre lien", async (env) => {
  const { a, b, link } = await pair(env, "deuxfois");
  check(await played(a, b), "la partie est en route");
  await b.page.goto(link);
  await b.page.waitForSelector("main.game");
  check(await b.page.locator('[data-act="g-join"]').count() === 0 && (await state(b)).b.n === 2 && (await state(b)).sh.k === 2, "rouvrir le lien dans le même onglet ramène l'invité dans la partie, sans rien perdre");
  const tab = { page: await b.ctx.newPage() }; /* le lien touché une seconde fois dans la messagerie ouvre un nouvel onglet */
  tab.page.on("pageerror", (e) => b.errors.push("pageerror (onglet 2) : " + e.message));
  await tab.page.goto(link);
  await tab.page.waitForSelector("main.game");
  await comeBack(a, tab, "nouvel onglet ouvert par le lien");
  await a.page.goto(link);
  await a.page.waitForSelector("main.game");
  check(await a.page.locator('[data-act="g-join"]').count() === 0 && (await state(a)).me === "a", "l'hôte qui ouvre son propre lien retrouve sa partie, sans se voir proposer de la rejoindre");
});

scenario("Deux onglets ouverts sur l'invitation : l'invité rejoint dans l'un, puis dans l'autre", async (env) => {
  const a = await phone(env, "onglets-a"), b = await phone(env, "onglets-b");
  const link = await host(env, a, { names: ["Alex", "Inès"] });
  await b.page.goto(link);
  const tab = { page: await b.ctx.newPage() };
  tab.page.on("pageerror", (e) => b.errors.push("pageerror (onglet 2) : " + e.message));
  await tab.page.goto(link);
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector("main.game");
  await a.page.waitForSelector("main.game");
  check(await played(a, b), "la partie est en route dans le premier onglet");
  if (await tab.page.locator('[data-act="g-join"]').count()) await tab.page.click('[data-act="g-join"]');
  await tab.page.waitForSelector("main.game");
  await comeBack(a, tab, "second onglet");
  /* Choix assumé : un téléphone n'adopte jamais une tranche publiée sous sa propre lettre par quelqu'un
     d'autre (sinon quiconque a le lien pourrait la réécrire). Le premier onglet ne suit donc pas le second ;
     il suffit que le second joue normalement avec l'autre téléphone (vérifié par comeBack ci-dessus). */
});

scenario("L'invité reprend la partie dans un autre navigateur", async (env) => {
  const { a, b, link } = await pair(env, "navigateur");
  check(await played(a, b), "la partie est en route");
  /* Lien ouvert d'abord dans le navigateur d'une messagerie, puis dans le vrai : autre stockage, même joueur. */
  const b2 = await phone(env, "navigateur-b2");
  await join(b2, link);
  await comeBack(a, b2, "autre navigateur");
});

scenario("L'invité arrête la partie par erreur, puis rouvre le lien", async (env) => {
  const { a, b, link } = await pair(env, "erreur");
  check(await played(a, b), "la partie est en route");
  await stop(b);
  await join(b, link);
  await comeBack(a, b, "revenu par le lien");
});

scenario("L'invité qui avait lancé la manche en cours revient par le lien", async (env) => {
  const { a, b, link } = await pair(env, "manche2");
  await tap(b, "new"); /* la deuxième manche n'est annoncée que par B */
  await until(async () => (await state(a)).gen === 2);
  await tap(a, "mine");
  await tap(b, "mine");
  check(await settled(a, b, 6000) && (await state(a)).gen === 2, "la deuxième manche est en route chez les deux");
  const b2 = await phone(env, "manche2-b2");
  await join(b2, link);
  const ok = await settled(a, b2, 6000), x = await state(a), y = await state(b2);
  check(ok && y.gen === 2, "il revient dans la manche en cours, avec les deux tranches (A en manche " + x.gen + ", lui en manche " + y.gen + ", tranche de A vue par lui : " + JSON.stringify(y.a) + ")");
  await tap(b2, "mine");
  const seen = await until(async () => (await state(a)).b.n === 2, 5000);
  check(seen, "et ce qu'il joue arrive chez A (A voit " + JSON.stringify((await state(a)).b) + ")");
});

scenario("Partie en direct : l'hôte est retourné à l'accueil quand l'invité arrive", async (env) => {
  const a = await phone(env, "accueil-a"), b = await phone(env, "accueil-b");
  const link = await host(env, a, { names: ["Alex", "Inès"] });
  await a.page.goto(env.base + "#accueil");
  await join(b, link);
  await tap(b, "mine");
  await a.page.click('.banner a[href="#jeu-demo"]');
  check(await until(async () => { const s = await state(a); return s.hereB && s.b.n === 1; }, 6000), "en reprenant depuis l'accueil, l'hôte arrive dans la partie, avec ce que l'invité a déjà fait");
});

scenario("L'invité avait déjà une partie de ce jeu sur un seul téléphone", async (env) => {
  const a = await phone(env, "solo-a"), b = await phone(env, "solo-b");
  await b.page.goto(env.base + "#jeu-demo");
  await b.page.click('[data-act="g-start"][data-mode="solo"]');
  await b.page.waitForSelector("main.game");
  await tap(b, "inc", "a");
  await tap(b, "inc", "b");
  const link = await host(env, a, { names: ["Alex", "Inès"] });
  await b.page.goto(link);
  check((await b.page.locator(".invite").textContent()).includes("remplacera"), "l'invitation prévient qu'elle remplacera la partie en cours");
  await b.page.click('[data-act="g-decline"]');
  await b.page.waitForSelector("main.game");
  const s = await state(b);
  check(s.duo === false && s.a.n === 1 && s.b.n === 1, "ignorer l'invitation ramène à la partie sur un téléphone, intacte");
  await b.page.reload();
  await b.page.waitForSelector("main.game");
  check(await b.page.locator('[data-act="g-join"]').count() === 0, "l'invitation ignorée ne revient pas au rechargement");
  await join(b, link);
  const t = await state(b);
  check(t.duo === true && t.me === "b" && !t.a.n && !t.b.n, "rouvrir le lien et rejoindre remplace la partie sur un téléphone par la partie à deux");
  check(await until(() => a.page.locator("main.game").count(), 5000), "qui démarre chez l'hôte");
});

scenario("Qui a créé la partie l'arrête et en relance une, l'invité est resté dans l'ancienne", async (env) => {
  const { a, b, link, room } = await pair(env, "relance");
  await tap(b, "mine");
  await stop(a);
  const link2 = await host(env, a);
  check(!!link2 && link2 !== link, "la nouvelle partie a un nouveau lien");
  await tap(b, "mine"); /* B joue encore dans l'ancienne */
  await b.page.goto(link2);
  const prompt = await b.page.locator(".invite").count() ? await b.page.locator(".invite").textContent() : "";
  check(await b.page.locator('[data-act="g-join"]').count() === 1 && prompt.includes("remplacera"), "l'invité se voit proposer la nouvelle partie, prévenu qu'elle remplace celle en cours");
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector("main.game");
  check(await until(() => a.page.locator("main.game").count(), 6000), "elle démarre chez A dès que B la rejoint");
  const s = await state(b);
  check(s.gen === 1 && !s.a.n && !s.b.n && !s.sh.k, "elle repart de zéro chez B");
  await tap(a, "mine");
  await tap(b, "sh");
  check(await settled(a, b, 6000) && (await state(b)).a.n === 1 && (await state(a)).sh.k === 1, "et se synchronise");
  check((await saved(b)).room.r !== room.r, "B a bien quitté l'ancien salon");
});

scenario("L'invité de la première partie lance la suivante depuis son téléphone", async (env) => {
  const { a, b } = await pair(env, "roles"); /* Alex a créé, Inès a rejoint */
  await stop(b);
  const mine = await b.page.locator('label.name:has-text("Ton prénom") input').inputValue();
  check(mine === "Inès", "sur le téléphone d'Inès, le champ « Ton prénom » propose Inès (il propose « " + mine + " »)");
  await b.page.click('[data-act="g-start"][data-mode="duo"]');
  const link2 = await b.page.locator(".share[data-url]").getAttribute("data-url"), title = (await b.page.locator("main.intro h1").textContent()).trim();
  check(title.includes("Alex"), "son écran d'invitation lui dit d'inviter Alex (il dit : « " + title + " »)");
  await a.page.goto(link2);
  await a.page.waitForSelector('[data-act="g-join"]');
  const who = (await a.page.locator(".invite b").first().textContent()).trim(), btn = (await a.page.locator('[data-act="g-join"]').textContent()).trim();
  check(who === "Inès" && btn.includes("Alex"), "Alex lit « Inès t'invite » et « Je suis Alex, je rejoins » (il lit « " + who + " t'invite » et « " + btn + " »)");
  await a.page.click('[data-act="g-join"]');
  await a.page.waitForSelector("main.game");
  await b.page.waitForSelector("main.game");
  const wait = [(await b.page.locator(".g-wait .sync").textContent()).trim(), (await a.page.locator(".g-wait .sync").textContent()).trim()];
  check(wait[0].includes("Alex") && wait[1].includes("Inès"), "en jeu, chaque téléphone attend l'autre personne, pas celle qui le tient (chez Inès : « " + wait[0] + " », chez Alex : « " + wait[1] + " »)");
});

scenario("Arrêter la partie pendant que l'autre joue", async (env) => {
  const { a, b } = await pair(env, "arret");
  await a.page.click('.g-foot [data-act="g-stop"]');
  await tap(b, "mine");
  await until(async () => (await state(a)).b.n === 1);
  await sleep(450);
  await a.page.click('.g-foot [data-act="g-stop"]');
  check(await until(() => a.page.locator("main.intro").count(), 1500), "deux touchers arrêtent la partie même si l'autre a joué entre les deux");
  await b.page.click('.g-foot [data-act="g-stop"]');
  await sleep(4400);
  await b.page.click('.g-foot [data-act="g-stop"]');
  await sleep(300);
  check(await b.page.locator("main.game").count() === 1, "un second toucher plus de quatre secondes après le premier ne suffit pas");

  /* Un seul téléphone, et un jeu qui réaffiche son écran deux fois par seconde (compte à rebours). */
  const one = await phone(env, "arret-seul");
  await one.page.goto(env.base + "#jeu-demo");
  await one.page.click('[data-act="g-start"][data-mode="solo"]');
  await one.page.waitForSelector("main.game");
  await one.page.evaluate(() => { setInterval(() => { const el = document.querySelector('main.game [data-act="local"]'); if (el) el.click(); }, 500); });
  await one.page.click('.g-foot [data-act="g-stop"]');
  await sleep(900); /* le temps de lire « Toucher encore pour confirmer » */
  if (await one.page.locator('.g-foot [data-act="g-stop"]').count()) await one.page.click('.g-foot [data-act="g-stop"]');
  check(await until(() => one.page.locator("main.intro").count(), 1500), "sur un seul téléphone, deux touchers arrêtent aussi une partie dont l'écran se réaffiche deux fois par seconde");
});

/* ---------- Plusieurs choses à la fois ---------- */

scenario("Aller sur un test puis revenir au jeu, liaison ouverte", async (env) => {
  const { a, b, room } = await pair(env, "allerretour");
  await tap(a, "mine"); /* un changement juste avant de partir */
  await a.page.goto(env.base + "#test-voyages");
  await a.page.waitForSelector("main.intro");
  check(await until(async () => (await state(b)).a.n === 1, 4000), "un changement fait juste avant de quitter la page part quand même");
  check(await until(async () => (await subscribers(env, room)) === 1, 4000), "hors de la page du jeu, A n'écoute plus le relais");
  await a.page.click('[data-act="start"][data-mode="same"]');
  await a.page.locator(".opt").first().click();
  await tap(b, "mine");
  await tap(b, "mine");
  await tap(b, "sh");
  await a.page.goto(env.base + "#jeu-demo");
  await a.page.waitForSelector("main.game");
  check(await until(async () => { const s = await state(a); return s.b.n === 2 && s.sh.k === 1; }, 6000), "de retour sur le jeu, A rattrape ce que B a fait entre-temps");
  check(await linked(a, 6000) && await subscribers(env, room) === 2, "et la liaison est rétablie, un flux par téléphone");
  await a.page.goto(env.base + "#accueil");
  check(await a.page.locator('.banner a[href="#test-voyages"]').count() === 1 && await a.page.locator('.banner a[href="#jeu-demo"]').count() === 1, "l'accueil propose de reprendre le test et la partie");
});

scenario("Une partie sur un téléphone et une partie à deux téléphones, de deux jeux, en même temps", async (env) => {
  const { a, b, room } = await pair(env, "deuxjeux");
  await tap(a, "mine");
  await until(async () => (await state(b)).a.n === 1);
  await a.page.goto(env.base + "#jeu-demo2");
  await a.page.click('[data-act="g-start"][data-mode="solo"]');
  await a.page.waitForSelector('main.game[data-game="demo2"]');
  const p0 = (await env.ctl()).count.post;
  await tap(a, "inc", "a");
  await tap(a, "inc", "b");
  await tap(a, "inc", "b");
  await tap(a, "sh");
  let s = await state(a);
  check(s.duo === false && s.me === null && s.a.n === 1 && s.b.n === 2 && s.sh.k === 1, "le jeu sur un téléphone se joue pendant que l'autre partie existe");
  await tap(b, "mine");
  await tap(b, "sh");
  await sleep(900);
  check(await a.page.locator(".g-top [data-net]").count() === 0 && await subscribers(env, room) === 1, "il n'affiche pas de liaison et n'écoute pas le salon de l'autre jeu");
  check((await env.ctl()).count.post - p0 === 2, "seul B a déposé des messages pendant ce temps (" + ((await env.ctl()).count.post - p0) + ")");
  await a.page.goto(env.base + "#accueil");
  check(await a.page.locator('.banner [data-act="g-drop"]').count() === 2, "l'accueil annonce les deux parties en cours");
  await a.page.goto(env.base + "#jeu-demo");
  check(await until(async () => { const t = await state(a); return t.duo && t.a.n === 1 && t.b.n === 1 && t.sh.k === 1; }, 6000), "de retour sur la partie à deux téléphones : tout y est, plus ce que B a fait entre-temps");
  await a.page.goto(env.base + "#jeu-demo2");
  s = await state(a);
  check(s.duo === false && s.a.n === 1 && s.b.n === 2 && s.sh.k === 1, "la partie sur un téléphone n'a pas bougé");
  await a.page.goto(env.base + "#accueil");
  await a.page.click('.banner [data-act="g-drop"][data-id="demo2"]');
  await sleep(450);
  await a.page.click('.banner [data-act="g-drop"][data-id="demo2"]');
  check(await saved(a, "demo2") === null && await saved(a, "demo") !== null, "abandonner l'une n'efface pas l'autre");
  await a.page.goto(env.base + "#jeu-demo");
  await tap(a, "mine");
  check(await until(async () => (await state(b)).a.n === 2, 5000), "et la partie à deux téléphones continue");
});

scenario("Jeu pas en direct : l'un joue seul, l'autre arrive ensuite", async (env) => {
  const a = await phone(env, "apres-a"), b = await phone(env, "apres-b");
  const link = await host(env, a, { id: "demo2", names: ["Alex", "Inès"] });
  await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector("main.game");
  await tap(a, "mine");
  await tap(a, "mine");
  await tap(a, "sh");
  await a.page.goto(env.base + "#accueil"); /* A a fini de son côté et ferme le jeu */
  await join(b, link);
  check(await until(async () => { const s = await state(b); return s.a.n === 2 && s.sh.k === 1; }, 6000), "B trouve ce que A a joué avant son arrivée");
  await tap(b, "mine");
  await a.page.goto(env.base + "#jeu-demo2");
  check(await until(async () => { const s = await state(a); return s.b.n === 1 && s.hereB; }, 6000), "en rouvrant le jeu, A trouve ce que B a joué");
});

/* ---------- Messages hostiles ---------- */

scenario("Messages déposés directement sur le relais : illisibles, mal formés, tronqués, rejoués", async (env) => {
  const { a, b, room } = await pair(env, "intrus");
  const seen = [];
  [a, b].forEach((p) => p.ctx.on("request", (r) => seen.push({ url: r.url(), body: r.postData() || "" })));
  await tap(a, "mine");
  await tap(b, "mine");
  await tap(b, "sh");
  await settled(a, b, 6000);
  const ref = [game(await state(a)), game(await state(b))], errs = a.errors.length + b.errors.length;
  const msgs = await backlog(env, room);
  check(msgs.length >= 4 && msgs.every((m) => /^[\w-]+$/.test(m.raw) && !/Alex|In[eè]s|demo/.test(m.raw)), "ce que le relais garde est illisible sans la clé (" + msgs.length + " messages)");
  const toRelay = seen.filter((r) => r.url.indexOf(env.relayUrl) === 0);
  check(toRelay.length > 0 && toRelay.every((r) => r.url.indexOf(room.k) < 0 && r.body.indexOf(room.k) < 0 && !/Alex|In%C3%A8s|Inès/.test(r.url + r.body)), "ni la clé ni les prénoms ne partent vers le relais");
  const strangers = seen.map((r) => new URL(r.url).host).filter((h, i, all) => all.indexOf(h) === i && !/^localhost:|^fonts\.(googleapis|gstatic)\.com$|^cdnjs\.cloudflare\.com$/.test(h));
  check(strangers.length === 0, "aucune requête vers un autre serveur" + (strangers.length ? " (" + strangers.join(", ") + ")" : ""));

  const top = (w, t) => Math.max(0, ...msgs.filter((m) => m.o && m.o.w === w && m.o.t === t).map((m) => m.o.n));
  const mark = JSON.parse(msgs.filter((m) => m.o && m.o.w === "b" && m.o.t === "d").pop().o.s).k;
  const n = top("b", "d") + 1000, nh = top("b", "h") + 1000;
  const d = (over) => Object.assign({ g: "demo", v: 1, w: "b", t: "d", n, p: 0, c: 1, s: JSON.stringify({ k: mark, d: { n: 99 } }) }, over);
  const h = (x) => ({ g: "demo", v: 1, w: "b", t: "h", n: nh, p: 0, c: 1, s: JSON.stringify(x) });
  const other = { r: room.r, k: b64u(webcrypto.getRandomValues(new Uint8Array(32))) };
  const bodies = ["bonjour", "", "A".repeat(4000), "A".repeat(5000) /* trop long : le relais le refuse */, await seal(other, d({}))];
  for (const o of [[1, 2, 3], "texte", null, 7, {},
    d({ g: "autre" }), d({ v: 2 }), d({ w: "c" }), d({ t: "x" }), d({ n: 0 }), d({ n: -3 }), d({ n: 1.5 }), d({ n: String(n) }), d({ n: 1e300 }),
    d({ c: 0 }), d({ c: 65 }), d({ p: -1 }), d({ p: 1 }), d({ s: 12 }), d({ s: null }), d({ s: "{oups" }), d({ s: "[]" }), d({ s: "null" }),
    d({ s: JSON.stringify({ k: 5, d: {} }) }), d({ s: JSON.stringify({ k: mark, d: [1] }) }), d({ s: JSON.stringify({ k: "x".repeat(65), d: {} }) }), d({ s: JSON.stringify({ d: { n: 99 } }) }),
    h({ gen: 99, sh: {}, st: 0, sw: "a" }), h({ gen: 99, su: { seed: 1 }, sh: [], st: 0, sw: "a" }), h({ gen: 1e7, su: { seed: 1 }, sh: {}, st: 0, sw: "a" }),
    h({ gen: 99, su: { seed: 1 }, sh: {}, st: -1, sw: "a" }), h({ gen: 99, su: { seed: 1 }, sh: {}, st: 0, sw: "z" }), h({ gen: "99", su: { seed: 1 }, sh: {}, st: 0, sw: "a" }),
    d({ n: n + 1, c: 3, p: 0, s: "{\"k\":" }), d({ n: n + 1, c: 3, p: 1, s: JSON.stringify(mark) }) /* tronqué : le troisième morceau ne vient jamais */
  ]) bodies.push(await seal(room, o));
  const old = msgs.filter((m) => m.o && m.o.w === "b"); /* rejoués : les premiers messages de B */
  bodies.push(old[0].raw, old[1].raw, old[0].raw);
  let refused = 0;
  for (const body of bodies) if (!(await post(env, room, body)).ok) refused++;
  await sleep(1200);
  check(game(await state(a)) === ref[0] && game(await state(b)) === ref[1], bodies.length + " messages illisibles, mal formés, tronqués, trop longs ou rejoués ne changent rien à la partie (" + refused + " refusé par le relais)");
  check(a.errors.length + b.errors.length === errs, "et ne lèvent aucune erreur");
  await tap(b, "mine");
  await tap(a, "sh");
  check(await settled(a, b, 6000) && (await state(a)).b.n === 2 && (await state(b)).sh.k === 2, "la partie continue ensuite normalement");

  /* Avec la bonne clé, une tranche piégée ne doit pas déborder sur le reste de la page. */
  const nb = Math.max(n + 10, Date.now() + 10);
  await post(env, room, await seal(room, d({ n: nb, s: "{\"k\":" + JSON.stringify(mark) + ",\"d\":{\"__proto__\":{\"piege\":1},\"constructor\":{\"prototype\":{\"piege\":1}},\"n\":3}}" })));
  await until(async () => (await state(a)).b.n === 3, 4000);
  await tap(b, "mine");
  check(await a.page.evaluate(() => ({}).piege === undefined) && await b.page.evaluate(() => ({}).piege === undefined), "une tranche forgée avec __proto__ ne contamine pas les objets de la page");
});

scenario("Un message forgé avec la bonne clé et un numéro au plafond", async (env) => {
  const { a, b, room } = await pair(env, "plafond");
  await tap(b, "mine");
  await until(async () => (await state(a)).b.n === 1);
  const mark = JSON.parse((await backlog(env, room)).filter((m) => m.o && m.o.w === "b" && m.o.t === "d").pop().o.s).k;
  /* Quiconque a vu passer le lien peut écrire au nom de B ; on essaie les plafonds plausibles du numéro. */
  for (const n of [1e9, 1e12, 1e15, Number.MAX_SAFE_INTEGER]) {
    await post(env, room, await seal(room, { g: "demo", v: 1, w: "b", t: "d", n, p: 0, c: 1, s: JSON.stringify({ k: mark, d: { n: 50 } }) }));
  }
  await sleep(800);
  await tap(b, "mine");
  const want = (await state(b)).b.n;
  check(await until(async () => (await state(a)).b.n === want, 5000), "après ce message, ce que B écrit arrive encore chez A (B en est à " + want + ", A voit " + (await state(a)).b.n + ")");
  await b.page.reload();
  check(await until(() => b.page.locator("main.game").count(), 3000), "et la partie de B survit à un rechargement");
});

/* ---------- Stockage ---------- */

scenario("Partie, invitation ou options abîmées dans le stockage du navigateur", async (env) => {
  const p = await phone(env, "abime");
  await p.page.goto(env.base + "#jeu-demo");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector("main.game");
  await tap(p, "inc", "a");
  const solo = await saved(p);
  await stop(p);
  await p.page.click('[data-act="g-start"][data-mode="duo"]');
  await p.page.waitForSelector(".share[data-url]");
  const duo = await saved(p);
  const mut = (base, fn) => { const o = JSON.parse(JSON.stringify(base)); fn(o); return o; };
  const cases = [
    ["texte coupé", "{\"id\":\"demo\",\"v\":1,"], ["null", "null"], ["un nombre", "42"], ["une chaîne", "\"partie\""], ["un tableau", "[1,2]"], ["un objet vide", "{}"],
    ["un téléphone, mais à l'étape de l'invitation", mut(solo, (o) => { o.phase = "invite"; })],
    ["un téléphone, avec un joueur attitré", mut(solo, (o) => { o.me = "a"; })],
    ["deux téléphones, sans salon", mut(duo, (o) => { o.room = null; })],
    ["deux téléphones, clé tronquée", mut(duo, (o) => { o.room.k = "abc"; })],
    ["deux téléphones, joueur inconnu", mut(duo, (o) => { o.me = "c"; })],
    ["mode illisible", mut(solo, (o) => { o.duo = "non"; })],
    ["étape inconnue", mut(solo, (o) => { o.phase = "fin"; })],
    ["manche zéro", mut(solo, (o) => { o.gen = 0; })],
    ["manche en texte", mut(solo, (o) => { o.gen = "1"; })],
    ["réglages vides", mut(solo, (o) => { o.setup = {}; })],
    ["réglages absents", mut(solo, (o) => { delete o.setup; })],
    ["état commun en tableau", mut(solo, (o) => { o.sh = [1]; })],
    ["état commun nul", mut(solo, (o) => { o.sh = null; })],
    ["compteur négatif", mut(solo, (o) => { o.st = -1; })],
    ["auteur inconnu", mut(solo, (o) => { o.sw = "z"; })],
    ["tranches absentes", mut(solo, (o) => { delete o.S; })],
    ["tranche en tableau", mut(solo, (o) => { o.S.a.d = [1, 2]; })],
    ["tranche sans marque", mut(solo, (o) => { delete o.S.b.k; })],
    ["une seule tranche", mut(solo, (o) => { delete o.S.b; })],
    ["numéros d'envoi nuls", mut(duo, (o) => { o.seq = null; })],
    ["numéro d'envoi négatif", mut(duo, (o) => { o.seq.a.h = -5; })],
    ["numéro d'envoi à virgule", mut(duo, (o) => { o.seq.b.d = 1.5; })],
    ["envois faits incomplets", mut(duo, (o) => { delete o.sent.d; })],
    ["état local nul", mut(solo, (o) => { o.local = null; })],
    ["autre version", mut(solo, (o) => { o.v = 99; })],
    ["autre jeu", mut(solo, (o) => { o.id = "demo2"; })]
  ];
  const bad = [];
  for (const [label, value] of cases) {
    const before = p.errors.length;
    await p.page.evaluate((v) => localStorage.setItem("en:g:demo", v), typeof value === "string" ? value : JSON.stringify(value));
    await p.page.reload();
    const ok = await until(async () => await p.page.locator('main.intro [data-act="g-start"]').count() > 0, 2500);
    if (!ok || p.errors.length > before) bad.push(label + (p.errors.length > before ? " (" + p.errors[p.errors.length - 1] + ")" : " (page sans présentation)"));
  }
  check(bad.length === 0, cases.length + " formes de partie abîmée : la présentation du jeu s'ouvre à chaque fois" + (bad.length ? " ; en échec : " + bad.join(" ; ") : ""));
  await p.page.evaluate(() => localStorage.setItem("en:g:demo", "{\"id\":"));
  await p.page.goto(env.base + "#accueil");
  await p.page.reload();
  check(await until(() => p.page.locator('a.card-link[href="#jeu-demo"]').count(), 2500), "l'accueil s'ouvre aussi");

  const room = { g: "demo", v: 1, r: "0".repeat(32), k: "k".repeat(43), su: { seed: 1 }, gen: 1 };
  const others = [
    ["ginvite", "invitation : texte coupé", "{\"g\":"], ["ginvite", "invitation : sans salon", JSON.stringify({ g: "demo", v: 1 })],
    ["ginvite", "invitation : jeu inconnu", JSON.stringify(Object.assign({}, room, { g: "nope" }))], ["ginvite", "invitation : jeu piégé", JSON.stringify(Object.assign({}, room, { g: "constructor", v: undefined }))],
    ["ginvite", "invitation : autre version", JSON.stringify(Object.assign({}, room, { v: 7 }))], ["ginvite", "invitation : tableau", "[1]"],
    ["go:demo", "options : texte", "\"y\""], ["go:demo", "options : choix inconnu", JSON.stringify({ mode: "zzz" })], ["go:demo", "options : tableau", "[\"y\"]"], ["go:demo", "options : nul", "null"]
  ];
  const bad2 = [];
  await p.page.goto(env.base + "#jeu-demo");
  for (const [key, label, value] of others) {
    const before = p.errors.length;
    await p.page.evaluate((kv) => { localStorage.removeItem("en:g:demo"); localStorage.removeItem("en:ginvite"); localStorage.removeItem("en:go:demo"); localStorage.setItem("en:" + kv[0], kv[1]); }, [key, value]);
    await p.page.reload();
    const ok = await until(async () => await p.page.locator('main.intro [data-act="g-start"]').count() > 0, 2500) &&
      await p.page.locator('[data-act="g-opt"][data-val="x"]').getAttribute("aria-pressed") === "true";
    if (!ok || p.errors.length > before) bad2.push(label);
  }
  check(bad2.length === 0, others.length + " formes d'invitation ou d'options abîmées : présentation normale, option par défaut" + (bad2.length ? " ; en échec : " + bad2.join(" ; ") : ""));
});

/* ---------- Adresses et liens ---------- */

scenario("Adresses piégées et lien illisible suivi du bon", async (env) => {
  const p = await phone(env, "adresse"), a = await phone(env, "adresse-a");
  const bad = [];
  for (const hash of ["#jeu-constructor", "#jeu-", "#jeu-inconnu", "#jeu-demo/x", "#jeu-DEMO"]) {
    await p.page.goto("about:blank");
    await p.page.goto(env.base + hash);
    const home = await until(() => p.page.locator(".hero").count(), 2500);
    if (!home || await p.page.locator("main.intro, main.game").count()) bad.push(hash);
  }
  check(bad.length === 0, "une adresse de jeu qui n'existe pas mène à l'accueil" + (bad.length ? " ; en échec : " + bad.join(", ") : ""));
  await p.page.goto("about:blank");
  await p.page.goto(env.base + "#g=pas-un-lien");
  check(await until(() => p.page.locator(".err").count(), 3000), "un lien illisible affiche un message sur l'accueil");
  const link = await host(env, a, { names: ["Alex", "Inès"] });
  await join(p, link);
  await p.page.goto(env.base + "#accueil");
  await p.page.waitForSelector(".hero");
  check(await p.page.locator(".err").count() === 0, "une fois la partie rejointe avec le bon lien, l'accueil n'affiche plus l'erreur du premier");
});

/* ---------- Hors du site : fichier ouvert tel quel, page en un seul fichier ---------- */

const INVITE = b64u(Buffer.from(JSON.stringify({ g: "demo", v: 1, n: ["Alex", "Inès"], r: "0".repeat(32), k: "k".repeat(43), su: { seed: 1 }, gen: 1 })));

scenario("Ouvert depuis un fichier (file://)", async (env) => {
  const p = await phone(env, "fichier"), url = pathToFileURL(path.join(ROOT, "index.html")).href;
  await p.page.goto(url + "#jeu-demo");
  await p.page.waitForSelector("main.intro");
  check(await p.page.locator('[data-act="g-start"][data-mode="duo"]').count() === 0 && await p.page.locator('[data-act="g-start"][data-mode="solo"]').count() === 1, "depuis un fichier, seul le jeu sur un téléphone est proposé");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await p.page.waitForSelector("main.game");
  await tap(p, "inc", "a");
  await tap(p, "inc", "b");
  await tap(p, "sh");
  await p.page.reload();
  await p.page.waitForSelector("main.game");
  const s = await state(p);
  check(s.duo === false && s.a.n === 1 && s.b.n === 1 && s.sh.k === 1, "la partie se joue et se retrouve après rechargement");
  await p.page.goto("about:blank");
  await p.page.goto(url + "#g=" + INVITE);
  check(await until(async () => (await p.page.locator(".err").textContent()).includes("navigateur"), 3000), "un lien d'invitation y est refusé avec une explication");
});

scenario("Page en un seul fichier (build.js), dans un cadre", async (env) => {
  /* build.js écrit dans artifact/ : pour l'essai, sa sortie est détournée vers un dossier temporaire. */
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "entre-nous-")), "entre-nous.html");
  const code = 'const fs = require("fs"), w = fs.writeFileSync; fs.writeFileSync = (p, c) => w(process.env.EN_OUT, c); fs.mkdirSync = () => {}; require(' + JSON.stringify(path.join(ROOT, "build.js")) + ");";
  let html = "";
  try {
    execFileSync(process.execPath, ["-e", code], { env: Object.assign({}, process.env, { EN_OUT: out }), stdio: "pipe" });
    html = fs.readFileSync(out, "utf8");
  } catch (e) { html = ""; }
  const ids = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/src="jeux\/[a-z0-9]+\.js"/g) || []).map((x) => x.slice(10, -4));
  if (!check(html.indexOf("window.ENGames") > 0 && html.indexOf(".g-top") > 0, "build.js assemble la page, socle et styles des jeux compris")) return;
  const p = await phone(env, "fichier-unique");
  await p.ctx.route("http://entre-nous.test/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  await p.page.setContent('<iframe src="http://entre-nous.test/" style="width:380px;height:800px;border:0"></iframe>');
  const f = p.page.frameLocator("iframe");
  await f.locator(".hero").waitFor();
  const cards = await f.locator('a.card-link[href^="#jeu-"]').evaluateAll((els) => els.map((e) => e.getAttribute("href").slice(5)));
  check(ids.length > 0 && ids.every((id) => cards.indexOf(id) >= 0), "dans un cadre, l'accueil propose les jeux chargés par index.html (" + ids.join(", ") + " ; proposés : " + cards.join(", ") + ")");
  const bad = [];
  for (const id of cards.filter((c) => c !== "demo" && c !== "demo2")) {
    await f.locator('a.card-link[href="#jeu-' + id + '"]').click();
    await f.locator("main.intro").waitFor();
    const duo = await f.locator('[data-act="g-start"][data-mode="duo"]').count();
    await f.locator('[data-act="g-start"][data-mode="solo"]').click();
    const game = await until(() => f.locator('main.game[data-game="' + id + '"]').count(), 2000);
    if (duo || !game) bad.push(id);
    await f.locator('a[href="#accueil"]').first().click();
    await f.locator(".hero").waitFor();
  }
  check(bad.length === 0, "chaque jeu n'y propose qu'un téléphone, et la partie s'ouvre" + (bad.length ? " ; en échec : " + bad.join(", ") : ""));
});

/* ---------- Prénoms, petit écran, typographie ---------- */

const NAME_A = "<u>O'Brien & \"Co\"</u>", NAME_B = "Élise-Marie O'Connor"; /* le premier est coupé à vingt caractères, le second en fait vingt */

/* Éléments de #app qui dépassent du bord droit de l'écran. */
const overflow = (p) => p.page.evaluate(() => {
  const w = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > w) out.push("page (" + document.documentElement.scrollWidth + " px pour " + w + ")");
  document.querySelectorAll("#app *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.right > w + 0.5 && !el.closest("svg")) out.push((el.className && String(el.className).split(" ")[0]) || el.tagName.toLowerCase());
  });
  return out.filter((x, i) => out.indexOf(x) === i);
});
/* Espace ordinaire là où le français veut une espace insécable. */
const typo = (p, sel) => p.page.evaluate((s) => {
  const out = [];
  document.querySelectorAll(s).forEach((el) => {
    const t = el.innerText, re = /[^\s\u00a0] [?!:;%»]|« /g;
    let m;
    while ((m = re.exec(t))) out.push("« " + t.slice(Math.max(0, m.index - 22), m.index + 4).replace(/\s+/g, " ").trim() + " »");
  });
  return out;
}, sel);
/* Hauteur des cibles tactiles propres au socle. */
const small = (p, sels) => p.page.evaluate((list) => {
  const out = [];
  list.forEach((s) => document.querySelectorAll(s).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height && r.height < 43.5) out.push(el.textContent.trim().slice(0, 28) + " (" + Math.round(r.height) + " px)");
  }));
  return out.filter((x, i) => out.indexOf(x) === i);
}, sels);

scenario("Prénoms avec apostrophe, balises et vingt caractères, sur un petit écran", async (env) => {
  const o = { viewport: { width: 320, height: 640 } };
  const a = await phone(env, "prenoms-a", o), b = await phone(env, "prenoms-b", o);
  const wide = [], tags = [], spaces = [], tiny = [];
  const look = async (p, where, sel, targets) => {
    const out = await overflow(p);
    if (out.length) wide.push(where + " : " + out.join(", "));
    if (await p.page.locator("#app u").count() || await p.page.evaluate(() => window.__xss !== undefined)) tags.push(where);
    (await typo(p, sel)).forEach((t) => spaces.push(where + " " + t));
    (await small(p, targets || [])).forEach((t) => tiny.push(where + " : " + t));
  };
  await a.page.goto(env.base + "#jeu-demo");
  await look(a, "présentation", "main.intro", ['[data-act="g-opt"]', '[data-act="g-start"]']);
  const link = await host(env, a, { names: [NAME_A, NAME_B] });
  const n = decodeLink(link).n;
  check(n[0] === NAME_A.slice(0, 20) && n[1] === NAME_B, "le lien porte les deux prénoms tels quels, coupés à vingt caractères");
  check((await a.page.locator("main.intro h1").textContent()).includes(NAME_B) && (await a.page.locator("p.sync").textContent()).includes("En attente d'Élise-Marie O'Connor"), "l'invitation les affiche, avec l'élision");
  await look(a, "invitation", "main.intro", ['[data-act="g-go"]', '[data-act="g-stop"]']);
  await b.page.goto(link);
  const inv = await b.page.locator(".invite").textContent(), btn = await b.page.locator('[data-act="g-join"]').textContent();
  check(inv.includes("<u>O'Brien & \"Co\"") && btn.includes(NAME_B), "l'invité lit les prénoms comme du texte");
  await look(b, "invitation reçue", "main.intro", ['[data-act="g-join"]', '[data-act="g-decline"]']);
  await b.page.click('[data-act="g-join"]');
  await b.page.waitForSelector("main.game");
  await a.page.waitForSelector("main.game");
  await linked(a);
  const pass = await a.page.locator(".g-pass h1").textContent(), wait = await b.page.locator(".g-wait .sync").textContent(), who = await b.page.locator("#who").textContent();
  check(pass.includes("Au tour d'Élise-Marie O'Connor") && wait.includes("En attente de <u>O'Brien") && who.includes(NAME_B), "en jeu : passage de téléphone, attente et pastilles affichent les prénoms comme du texte");
  await look(a, "jeu", ".g-top, .g-pass, .g-wait, .g-foot", [".g-top a", ".g-foot [data-act]", ".g-pass [data-act]"]);
  await look(b, "jeu de l'invité", ".g-top, .g-pass, .g-wait, .g-foot");
  await a.page.goto(env.base + "#accueil");
  await look(a, "accueil", ".banner, .card-state", ['.banner [data-act="g-drop"]', ".banner .btn"]);

  /* Le cadre d'une partie avec un titre long, et l'attente de l'hôte avant l'arrivée de l'autre. */
  await a.page.goto(env.base + "#jeu-demo2");
  await a.page.click('[data-act="g-start"][data-mode="duo"]');
  await a.page.waitForSelector('[data-act="g-go"]');
  await look(a, "invitation d'un jeu pas en direct", "main.intro", ['[data-act="g-go"]']);
  await a.page.click('[data-act="g-go"]');
  await a.page.waitForSelector("main.game");
  await linked(a);
  await look(a, "jeu au titre long", ".g-top, .g-wait, .g-foot");
  const bar = await a.page.evaluate(() => {
    const box = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const net = document.querySelector(".g-top .g-net"), label = net.textContent;
    net.textContent = "Connexion…"; /* le plus long des trois états */
    const out = { quit: box(document.querySelector(".g-top a")), name: box(document.querySelector(".g-top .g-name")), net: box(net), w: document.documentElement.clientWidth };
    net.textContent = label;
    return out;
  });
  const hit = (x, y) => x.r > y.l + 0.5 && y.r > x.l + 0.5 && x.b > y.t + 0.5 && y.b > x.t + 0.5;
  await a.shot("extra-barre-titre-long-320");
  check(!hit(bar.quit, bar.name) && !hit(bar.name, bar.net) && bar.net.r <= bar.w + 0.5 && bar.quit.l >= 0,
    "à 320 px, « Quitter », un titre de 27 lettres et la pastille de liaison ne se chevauchent pas (titre de " + Math.round(bar.name.l) + " à " + Math.round(bar.name.r) + " px, pastille à partir de " + Math.round(bar.net.l) + " px)");
  /* Sur un écran de 390 px, le rappel du lien tient sur une ligne : c'est là qu'il est le plus bas. */
  await a.page.setViewportSize({ width: 390, height: 844 });
  (await small(a, [".g-wait > details > summary"])).forEach((t) => tiny.push("attente, à 390 px : " + t));

  check(tags.length === 0, "aucune balise d'un prénom n'est interprétée" + (tags.length ? " ; en échec : " + tags.join(", ") : ""));
  check(wide.length === 0, "rien ne dépasse de l'écran à 320 px" + (wide.length ? " ; en échec : " + wide.join(" | ") : ""));
  check(tiny.length === 0, "les cibles tactiles du socle font au moins 44 px de haut" + (tiny.length ? " ; trop petites : " + tiny.join(" | ") : ""));
  check(spaces.length === 0, "espace insécable devant ? ! : ; dans les textes du socle" + (spaces.length ? " ; espaces ordinaires : " + spaces.filter((x, i) => spaces.indexOf(x) === i).join(" | ") : ""));
});

(async () => {
  const env = await setup();
  const words = process.argv.slice(2).map((w) => w.toLowerCase());
  for (const sc of scenarios) {
    if (words.length && !words.some((w) => sc.title.toLowerCase().indexOf(w) >= 0)) continue;
    console.log(sc.title);
    const first = env.phones.length;
    await env.ctl("reset=1");
    try { await sc.fn(env); } catch (e) { check(false, "le scénario va jusqu'au bout (" + String(e && e.message).split("\n")[0] + ")"); }
    /* Les téléphones d'un scénario sont fermés avant le suivant ; leurs erreurs restent comptées à la fin. */
    for (const p of env.phones.slice(first)) await p.ctx.close().catch(() => {});
  }
  await done(env);
})().catch((e) => { console.error(e); process.exit(1); });
