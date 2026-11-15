/* Entre Nous : moteur des tests à deux.
   Les questionnaires sont dans tests/*.js (window.TESTS). Ce fichier gère le
   parcours (accueil, questions, passage de main, rapport), le calcul des
   comparaisons et les graphiques. Aucune donnée ne quitte le navigateur. */
(function () {
  "use strict";

  const TESTS = window.TESTS || [];
  const BY_ID = {};
  TESTS.forEach((t) => { BY_ID[t.id] = t; });

  const GROUPS = [
    { id: "commencer", name: "Pour commencer" },
    { id: "couple", name: "Notre couple" },
    { id: "quotidien", name: "Notre quotidien" },
    { id: "projets", name: "Nos projets" },
    { id: "liens", name: "Ce qui nous lie" },
    { id: "cerveau", name: "Nos fonctionnements" }
  ];
  const MIRROR = ["Moi, nettement", "Plutôt moi", "Moitié-moitié", "Plutôt {p}", "{p}, nettement"];
  const ST = {
    ok: { g: "=", one: "accord", many: "accords" },
    near: { g: "≈", one: "réponse proche", many: "réponses proches" },
    gap: { g: "≠", one: "écart", many: "écarts" }
  };
  const DIM_ST = { ok: "Très proches", near: "Assez proches", gap: "À discuter" };
  const NUMBERS = ["Zéro", "Un", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix", "Onze", "Douze",
    "Treize", "Quatorze", "Quinze", "Seize", "Dix-sept", "Dix-huit", "Dix-neuf", "Vingt"];

  const app = document.getElementById("app");

  /* ---------- Stockage local (toujours optionnel) ---------- */
  const mem = {};
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem("en:" + k);
        if (v != null) return JSON.parse(v);
      } catch (e) { /* stockage indisponible */ }
      return k in mem ? mem[k] : d;
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem("en:" + k, JSON.stringify(v)); } catch (e) { /* idem */ }
    },
    del(k) {
      delete mem[k];
      try { localStorage.removeItem("en:" + k); } catch (e) { /* idem */ }
    }
  };

  /* ---------- État ---------- */
  let names = store.get("names", null) || { a: "", b: "" };
  let results = store.get("results", null) || {};
  let session = store.get("session", null);
  let invite = store.get("invite", null);
  const ui = { codeOpen: false, codeErr: "" };
  let route = "";
  let busy = false;
  let games = null; /* socle des jeux (assets/jeux.js), branché juste avant le démarrage */

  let framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  const canLink = !framed && /^https?:$/.test(location.protocol);
  /* Mode « en même temps » : il faut un vrai site, le chiffrement du navigateur et le réseau. */
  const canRoom = canLink && !!(window.crypto && window.crypto.subtle) && typeof fetch === "function";
  /* En développement (localhost uniquement), les essais remplacent le relais par un faux. */
  const RELAY = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && store.get("relay", null)) || "https://ntfy.sh/";
  const hasQr = () => typeof window.qrcode === "function";

  /* ---------- Outils ---------- */
  const esc = (s) => String(s)
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
    .replace(/ ([?!:;%»])/g, "\u00a0$1").replace(/« /g, "«\u00a0"); /* espaces insécables à la française */
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const other = (w) => (w === "a" ? "b" : "a");
  const nm = (w) => (names[w] || "").trim() || (w === "a" ? "Partenaire 1" : "Partenaire 2");
  const de = (n) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? "d'" : "de ") + n;
  const que = (n) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? "qu'" : "que ") + n;
  const pl = (n, one, many) => n + " " + (n >= 2 ? many : one);
  /* Mot d'état au singulier ou au pluriel ; un test peut fournir les siens (t.words). */
  const word = (t, k, n) => {
    const w = t.words && t.words[k];
    return w ? w[n >= 2 ? 1 : 0] : n >= 2 ? ST[k].many : ST[k].one;
  };
  const fill = (tpl, map) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
  const longDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const shortDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const blank = (n) => Array.from({ length: n }, () => null);

  function baseOpts(t, q) { return q.t === "mir" ? (q.o || t.mirror || MIRROR) : (q.o || t.scale); }
  function nOpts(t, q) { return baseOpts(t, q).length; }
  function optsFor(t, q, who) {
    const base = baseOpts(t, q);
    return q.t === "mir" ? base.map((s) => s.replace("{p}", nm(other(who)))) : base;
  }
  /* Libellé d'une réponse dans le rapport. Pour une question miroir, la réponse
     est traduite en désignation absolue (« Plutôt Tom ») quel que soit l'auteur. */
  function ansLabel(t, q, who, v) {
    if (v == null) return "Question passée";
    const base = baseOpts(t, q);
    if (q.t !== "mir") return base[v];
    const n = base.length, k = who === "a" ? v : n - 1 - v, mid = (n - 1) / 2;
    if (k === mid) return base[k];
    return k < mid ? base[n - 1 - k].replace("{p}", nm("a")) : base[k].replace("{p}", nm("b"));
  }
  function dimOf(t, id) { return t.dims.find((d) => d.id === id); }

  /* ---------- Calculs ---------- */
  function cmp(t, q, a, b) {
    if (a == null || b == null) return null;
    if (q.t === "nom") return a === b ? { steps: 0, sim: 1, st: "ok" } : { steps: 2, sim: 0, st: "gap" };
    const n = nOpts(t, q);
    const steps = Math.abs(a - (q.t === "mir" ? n - 1 - b : b));
    return { steps, sim: 1 - steps / (n - 1), st: steps === 0 ? "ok" : steps === 1 ? "near" : "gap" };
  }

  /* Jeu de devinettes : les questions vont par paires (ma réponse, mon intuition
     sur l'autre). On compare l'intuition de chacun à la vraie réponse de l'autre. */
  function analyseGuess(t, A, B) {
    const pairs = [];
    for (let i = 0; i + 1 < t.questions.length; i += 2) {
      const q = t.questions[i];
      pairs.push({
        q, g: t.questions[i + 1],
        onA: { real: A[i], guess: B[i + 1], c: cmp(t, q, A[i], B[i + 1]) },
        onB: { real: B[i], guess: A[i + 1], c: cmp(t, q, B[i], A[i + 1]) }
      });
    }
    const all = [];
    pairs.forEach((p) => { if (p.onA.c) all.push(p.onA.c); if (p.onB.c) all.push(p.onB.c); });
    const score = (key) => {
      const v = pairs.map((p) => p[key].c).filter(Boolean);
      return v.length ? Math.round(100 * avg(v.map((c) => c.sim))) : null;
    };
    const count = (st) => all.filter((c) => c.st === st).length;
    return {
      pairs, items: [], dims: [], n: all.length, heavy: 0,
      align: all.length ? Math.round(100 * avg(all.map((c) => c.sim))) : 0,
      ok: count("ok"), near: count("near"), gap: count("gap"),
      knowB: score("onB"), /* ce que A devine de B */
      knowA: score("onA")  /* ce que B devine de A */
    };
  }

  function analyse(t, A, B) {
    if (t.kind === "devine") return analyseGuess(t, A, B);
    const items = t.questions.map((q, i) => ({ q, i, a: A[i], b: B[i], c: cmp(t, q, A[i], B[i]) }));
    const valid = items.filter((x) => x.c);
    const count = (list, st) => list.filter((x) => x.c.st === st).length;
    const dims = t.dims.map((d) => {
      const all = items.filter((x) => x.q.d === d.id);
      const v = all.filter((x) => x.c);
      return {
        d, all, n: v.length,
        align: v.length ? Math.round(100 * avg(v.map((x) => x.c.sim))) : null,
        ok: count(v, "ok"), near: count(v, "near"), gap: count(v, "gap")
      };
    });
    return {
      items, dims, n: valid.length,
      align: valid.length ? Math.round(100 * avg(valid.map((x) => x.c.sim))) : 0,
      ok: count(valid, "ok"), near: count(valid, "near"), gap: count(valid, "gap"),
      heavy: valid.filter((x) => x.c.st === "gap" && (x.q.w || 1) > 1).length
    };
  }

  /* Score de 0 à 100 par dimension pour une personne (tests de profil). */
  function profile(t, ans) {
    const acc = {};
    t.questions.forEach((q, i) => {
      const v = ans[i];
      if (v == null) return;
      let x = v / (nOpts(t, q) - 1);
      if (q.r) x = 1 - x;
      (acc[q.d] = acc[q.d] || []).push(x);
    });
    const out = {};
    t.dims.forEach((d) => { out[d.id] = acc[d.id] ? Math.round(100 * avg(acc[d.id])) : null; });
    return out;
  }

  /* Climat : les réponses sont classées du mieux (0) au moins bien. */
  function moodScore(t, ans, dimId) {
    const xs = [];
    t.questions.forEach((q, i) => {
      if (q.d === dimId && ans[i] != null) xs.push(1 - ans[i] / (nOpts(t, q) - 1));
    });
    return xs.length ? Math.round(100 * avg(xs)) : null;
  }

  function pickTalks(an) {
    const cand = an.items
      .filter((x) => x.c && x.c.st !== "ok")
      .map((x) => ({ x, s: (1 - x.c.sim) * (x.q.w || 1) + (x.c.st === "gap" ? 1 : 0) }))
      .sort((p, q) => q.s - p.s);
    const out = [], seen = {};
    cand.forEach((c) => { if (out.length < 4 && !seen[c.x.q.d]) { seen[c.x.q.d] = 1; out.push(c.x); } });
    cand.forEach((c) => { if (out.length < 4 && out.indexOf(c.x) < 0) out.push(c.x); });
    return out;
  }

  const dimStatus = (p) => (p >= 80 ? "ok" : p >= 60 ? "near" : "gap");

  const H = {
    top(t, p, n) {
      return t.dims.filter((d) => p[d.id] != null).sort((x, y) => p[y.id] - p[x.id]).slice(0, n);
    },
    global(p) {
      const xs = Object.keys(p).map((k) => p[k]).filter((v) => v != null);
      return xs.length ? Math.round(avg(xs)) : 0;
    },
    level(t, s) { return t.levels[s < 35 ? 0 : s <= 65 ? 1 : 2]; }
  };

  function headline(p, isProfile) {
    if (isProfile) {
      return p >= 85 ? "Vous fonctionnez de façon très proche."
        : p >= 70 ? "Des profils proches, avec quelques nuances."
        : p >= 55 ? "Deux profils différents sur plusieurs points."
        : "Deux fonctionnements bien distincts.";
    }
    return p >= 85 ? "Vous regardez dans la même direction."
      : p >= 70 ? "Beaucoup d'accords, et quelques sujets à ouvrir."
      : p >= 55 ? "Des bases communes et de vraies différences."
      : "Vous voyez beaucoup de choses différemment.";
  }

  /* ---------- Codes d'échange entre deux appareils ---------- */
  const pack = (a) => a.map((v) => (v == null ? "-" : String(v))).join("");
  function unpack(t, s) {
    if (typeof s !== "string" || s.length !== t.questions.length) return null;
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "-") { out.push(null); continue; }
      const v = parseInt(s[i], 10);
      if (isNaN(v) || v >= nOpts(t, t.questions[i])) return null;
      out.push(v);
    }
    return out;
  }
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(raw) {
    let code = String(raw).trim();
    const m = code.match(/#c=([\w-]+)/);
    if (m) code = m[1];
    code = code.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    code += "=".repeat((4 - (code.length % 4)) % 4);
    const bin = atob(code);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  const full = (r) => !!(r && r.a && r.b);
  /* Code d'échange. Avec une seule série de réponses, l'expéditeur est toujours présenté en
     premier : les réponses étant relatives à leur auteur, les deux rôles sont interchangeables. */
  function codeFor(t, r) {
    if (full(r)) return encode({ v: t.v, t: t.id, n: [names.a || "", names.b || ""], a: pack(r.a), b: pack(r.b), d: r.at });
    const me = r.me || "a";
    return encode({ v: t.v, t: t.id, n: [names[me] || "", names[other(me)] || ""], a: pack(r[me]) });
  }
  const codeUrl = (code) => location.origin + location.pathname + "#c=" + code;
  const joinUrl = (t, room) => location.origin + location.pathname + "#j=" +
    encode({ v: t.v, t: t.id, n: [names.a || "", names.b || ""], r: room.r, k: room.k });

  function failCode(msg) {
    ui.codeErr = msg;
    ui.codeOpen = true;
    if (/^(rapport|test)-/.test(route)) render(true); else go("accueil");
  }
  function setNames(n) {
    if (!Array.isArray(n)) return;
    names = { a: String(n[0] || "").slice(0, 20), b: String(n[1] || "").slice(0, 20) };
    store.set("names", names);
  }

  function importCode(raw) {
    const txt = String(raw || "").trim();
    if (!txt) return failCode("Colle d'abord le code ou le lien que tu as reçu.");
    const mj = txt.match(/#j=([\w-]+)/);
    if (mj) return importJoin(mj[1]);
    const mg = txt.match(/#g=([\w-]+)/);
    if (mg && games) return games.join(mg[1]);
    let o;
    try { o = decode(txt); } catch (e) { return failCode("Ce code est illisible. Vérifie qu'il a été copié en entier."); }
    const t = o && BY_ID[o.t];
    if (!t) return failCode("Ce code ne correspond à aucun test de cette page.");
    if (o.v !== t.v) return failCode("Ce code vient d'une ancienne version du test. Il faut le refaire.");
    const A = unpack(t, o.a);
    const B = o.b ? unpack(t, o.b) : null;
    if (!A || (o.b && !B)) return failCode("Ce code est incomplet. Vérifie qu'il a été copié en entier.");
    ui.codeErr = "";
    ui.codeOpen = false;
    if (B) {
      setNames(o.n);
      results[t.id] = { v: t.v, at: o.d || new Date().toISOString(), a: A, b: B, from: "code" };
      store.set("results", results);
      return go("rapport-" + t.id);
    }
    /* Une seule série : ce sont les réponses de l'autre. */
    const cur = results[t.id];
    const mine = cur && !full(cur) ? cur[cur.me || "a"] : null;
    if (mine && pack(mine) === o.a) return go("rapport-" + t.id); /* c'est mon propre lien */
    setNames(o.n);
    if (mine) {
      /* J'ai déjà répondu de mon côté : on réunit les deux séries. */
      results[t.id] = { v: t.v, at: new Date().toISOString(), a: A, b: mine, from: "guest" };
      store.set("results", results);
      return go("rapport-" + t.id);
    }
    if (session && session.t === t.id && (session.mode === "solo" || session.mode === "room")) {
      /* Je suis en train de répondre : je continue, le rapport s'ouvrira à la fin. */
      session.ans = { a: A, b: session.ans[session.who] };
      session.who = "b";
      session.mode = "guest";
      session.phase = "quiz";
      delete session.room;
      delete session.me;
      saveSession();
      invite = null;
      store.del("invite");
      return go("test-" + t.id);
    }
    invite = { t: t.id, a: A };
    store.set("invite", invite);
    if (session && session.t === t.id) dropSession();
    go("test-" + t.id);
  }

  /* Lien d'invitation partagé au début : même test, même salon, chacun sur son téléphone. */
  function importJoin(raw) {
    let o;
    try { o = decode(raw); } catch (e) { return failCode("Ce lien d'invitation est illisible. Demande à l'autre de te le renvoyer."); }
    const t = o && BY_ID[o.t];
    if (!t || !o.r || !o.k) return failCode("Ce lien d'invitation ne correspond à aucun test de cette page.");
    if (o.v !== t.v) return failCode("Ce lien vient d'une ancienne version du test. Il faut relancer le test.");
    ui.codeErr = "";
    ui.codeOpen = false;
    const cur = results[t.id];
    if (session && session.t === t.id && session.room && session.room.r === o.r) return go("test-" + t.id);
    if (cur && cur.room && cur.room.r === o.r) return go("rapport-" + t.id);
    setNames(o.n);
    invite = { t: t.id, room: { r: o.r, k: o.k } };
    store.set("invite", invite);
    if (session && session.t === t.id) dropSession();
    go("test-" + t.id);
  }

  /* ---------- Salon chiffré : les réponses se rejoignent toutes seules ----------
     Chaque téléphone dépose ses réponses, chiffrées avec une clé qui ne voyage que dans le
     lien d'invitation, sur un relais public. Le relais ne voit que du texte illisible. */
  const b64u = (bytes) => {
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const unb64u = (str) => {
    let c = str.replace(/-/g, "+").replace(/_/g, "/");
    c += "=".repeat((4 - (c.length % 4)) % 4);
    return Uint8Array.from(atob(c), (ch) => ch.charCodeAt(0));
  };
  function newRoom() {
    const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
    return { r: Array.from(rnd(16), (b) => b.toString(16).padStart(2, "0")).join(""), k: b64u(rnd(32)) };
  }
  const roomKey = (room) => crypto.subtle.importKey("raw", unb64u(room.k), "AES-GCM", false, ["encrypt", "decrypt"]);
  async function seal(room, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await roomKey(room), new TextEncoder().encode(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return b64u(out);
  }
  async function unseal(room, msg) {
    const raw = unb64u(msg);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await roomKey(room), raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* Un passage : lit le salon, y dépose mes réponses si elles n'y sont pas, récupère celles
     de l'autre. Renvoie true quand les deux séries sont réunies. */
  async function syncRoom(t) {
    const r = results[t.id];
    if (!r || !r.room || full(r)) return full(r);
    const me = r.me, oth = other(me), url = RELAY + "entrenous-" + r.room.r;
    const res = await fetch(url + "/json?poll=1&since=all", { cache: "no-store" });
    if (!res.ok) throw new Error("relais " + res.status);
    let mineThere = false, theirs = null;
    for (const line of (await res.text()).split("\n")) {
      let o = null;
      try {
        const m = JSON.parse(line);
        if (m.event === "message") o = await unseal(r.room, m.message);
      } catch (e) { o = null; }
      if (!o || o.t !== t.id || o.v !== t.v) continue;
      if (o.w === me) mineThere = true;
      else if (o.w === oth) theirs = unpack(t, o.a) || theirs;
    }
    if (!mineThere) {
      const put = await fetch(url, { method: "POST", body: await seal(r.room, { v: t.v, t: t.id, w: me, a: pack(r[me]) }) });
      if (!put.ok) throw new Error("relais " + put.status);
    }
    const cur = results[t.id];
    if (theirs && cur && cur.room && cur.room.r === r.room.r && !full(cur)) {
      cur[oth] = theirs;
      cur.at = new Date().toISOString();
      store.set("results", results);
    }
    return full(results[t.id]);
  }

  /* Tant que la page d'attente est affichée, on repasse toutes les huit secondes. */
  let syncRun = 0, syncTimer = null;
  function setSync(text, err) {
    const el = app.querySelector("[data-sync]");
    if (el) { el.textContent = text; el.classList.toggle("is-err", !!err); }
  }
  function watch() {
    clearTimeout(syncTimer);
    const run = ++syncRun;
    const m = /^rapport-([a-z0-9]+)$/.exec(route), t = m && BY_ID[m[1]], r = t && results[t.id];
    if (!canRoom || !r || !r.room || full(r)) return;
    const oth = nm(other(r.me));
    const again = (ms) => { syncTimer = setTimeout(tick, ms); };
    const tick = () => {
      if (run !== syncRun) return;
      if (document.hidden) return again(8000);
      syncRoom(t).then((done) => {
        if (run !== syncRun) return;
        if (done) return render();
        setSync("En attente des réponses " + de(oth) + ". Cette page se met à jour toute seule.");
        again(8000);
      }, () => {
        if (run !== syncRun) return;
        setSync("Connexion impossible pour l'instant. Nouvel essai dans quelques secondes.", true);
        again(12000);
      });
    };
    tick();
  }
  /* À l'ouverture du site : un passage pour chaque test resté en attente. */
  function syncAll() {
    if (!canRoom) return;
    TESTS.forEach((t) => {
      const r = results[t.id];
      if (!r || !r.room || full(r) || route === "rapport-" + t.id) return;
      syncRoom(t).then((done) => { if (done && (route === "" || route === "accueil")) render(true); }, () => {});
    });
  }

  /* ---------- Session de réponses ---------- */
  function saveSession() { store.set("session", session); }
  function dropSession() { session = null; store.del("session"); }

  function readNames() {
    ["a", "b"].forEach((k) => {
      const el = document.getElementById("name-" + k);
      if (el) names[k] = el.value.trim().slice(0, 20);
    });
    store.set("names", names);
  }

  function start(t, mode) {
    const n = t.questions.length;
    const inv = invite && invite.t === t.id ? invite : null;
    if (mode === "guest" && !(inv && inv.a)) return;
    if (mode === "join" && !(inv && inv.room)) return;
    if (mode !== "guest" && mode !== "join") readNames();
    if (mode === "room") {
      /* Je lance le test : je crée le salon et j'invite l'autre avant de répondre. */
      session = { t: t.id, mode: "room", me: "a", who: "a", i: 0, phase: "invite", room: newRoom(), ans: { a: blank(n), b: blank(n) } };
    } else if (mode === "join") {
      session = { t: t.id, mode: "room", me: "b", who: "b", i: 0, phase: "quiz", room: inv.room, ans: { a: blank(n), b: blank(n) } };
      invite = null;
      store.del("invite");
    } else {
      session = { t: t.id, mode, who: mode === "guest" ? "b" : "a", i: 0, phase: "quiz", ans: { a: mode === "guest" ? inv.a : blank(n), b: blank(n) } };
    }
    saveSession();
    render();
  }

  function pick(k) {
    const s = session;
    if (!s || s.phase !== "quiz" || busy) return;
    const t = BY_ID[s.t];
    if (k < 0 || k >= nOpts(t, t.questions[s.i])) return;
    s.ans[s.who][s.i] = k;
    saveSession();
    app.querySelectorAll(".opt").forEach((b, i) => {
      b.classList.toggle("on", i === k);
      b.setAttribute("aria-pressed", i === k ? "true" : "false");
    });
    busy = true;
    setTimeout(() => { busy = false; step(1); }, 170);
  }

  function step(d) {
    const s = session;
    if (!s) return;
    const t = BY_ID[s.t];
    if (d > 0 && s.i >= t.questions.length - 1) return finish();
    s.i = Math.max(0, s.i + d);
    saveSession();
    render();
  }

  function finish() {
    const s = session, t = BY_ID[s.t];
    if (s.mode === "same" && s.who === "a") {
      s.who = "b"; s.i = 0; s.phase = "handoff";
      saveSession();
      render();
      return;
    }
    if (s.mode === "room") {
      const r = { v: t.v, at: new Date().toISOString(), a: null, b: null, me: s.me, room: s.room, from: "room" };
      r[s.me] = s.ans[s.me];
      results[t.id] = r;
    } else {
      results[t.id] = { v: t.v, at: new Date().toISOString(), a: s.ans.a, b: s.mode === "solo" ? null : s.ans.b, from: s.mode };
      if (s.mode === "solo") results[t.id].me = "a";
    }
    store.set("results", results);
    if (s.mode === "guest") { invite = null; store.del("invite"); }
    dropSession();
    go("rapport-" + t.id);
  }

  /* ---------- Dessins ---------- */
  const LOGO = '<svg class="logo inks" viewBox="0 0 40 28" aria-hidden="true"><circle class="ink-a" cx="14" cy="14" r="11"/><circle class="ink-b" cx="26" cy="14" r="11"/></svg>';
  const GLYPHS = {
    bilan: '<circle class="ink-a" cx="18" cy="24" r="13"/><circle class="ink-b" cx="30" cy="24" r="13"/>',
    quidenous: '<path class="ink-a" d="M22 8a16 16 0 0 0 0 32z"/><path class="ink-b" d="M26 8a16 16 0 0 1 0 32z"/>',
    valeurs: '<rect class="ink-a" x="7" y="7" width="22" height="22" rx="4"/><rect class="ink-b" x="19" y="19" width="22" height="22" rx="4"/>',
    amour: '<circle class="ink-a" cx="24" cy="24" r="17"/><circle class="ink-b" cx="24" cy="24" r="8"/>',
    attachement: '<circle class="ring-a" cx="18" cy="24" r="10.5"/><circle class="ring-b" cx="30" cy="24" r="10.5"/>',
    autisme: [12, 24, 36].map((y, r) => [12, 24, 36].map((x, c) => '<circle class="ink-' + ((r + c) % 2 ? "b" : "a") + '" cx="' + x + '" cy="' + y + '" r="4.6"/>').join("")).join(""),
    tdah: '<path class="ring-a" d="M6 31 15 15l9 18 9-20 9 17"/><circle class="ink-b" cx="24" cy="24" r="6"/>',
    general: '<rect class="ink-a" x="6" y="6" width="17" height="17" rx="4"/><rect class="ink-b" x="25" y="6" width="17" height="17" rx="4"/><rect class="ink-b" x="6" y="25" width="17" height="17" rx="4"/><rect class="ink-a" x="25" y="25" width="17" height="17" rx="4"/>',
    connais: '<path class="ink-a" d="M3 24Q24 4 45 24Q24 44 3 24z"/><circle class="ink-b" cx="24" cy="24" r="8"/>',
    desir: '<ellipse class="ink-a" cx="19" cy="24" rx="9" ry="17" transform="rotate(-22 19 24)"/><ellipse class="ink-b" cx="29" cy="24" rx="9" ry="17" transform="rotate(22 29 24)"/>',
    argent: '<rect class="ink-a" x="11" y="8" width="28" height="9" rx="4.5"/><rect class="ink-b" x="7" y="19.5" width="28" height="9" rx="4.5"/><rect class="ink-a" x="13" y="31" width="28" height="9" rx="4.5"/>',
    parents: '<circle class="ink-a" cx="20" cy="21" r="14"/><circle class="ink-b" cx="34" cy="34" r="8"/>',
    conflits: '<path class="ink-a" d="M5 9 29 24 5 39z"/><path class="ink-b" d="M43 9 19 24 43 39z"/>',
    charge: '<rect class="ink-a" x="8" y="7" width="14" height="34" rx="4"/><rect class="ink-b" x="26" y="23" width="14" height="18" rx="4"/>',
    perso: '<path class="ring-a" d="M24 6 41 18.5 34.5 39h-21L7 18.5z"/><circle class="ink-b" cx="24" cy="24" r="6"/>',
    sensible: '<circle class="ring-a" cx="24" cy="24" r="17"/><circle class="ring-b" cx="24" cy="24" r="8.5"/>',
    rythme: '<path class="ring-a" d="M4 18q5-10 10 0t10 0 10 0 10 0"/><path class="ring-b" d="M4 31q5 10 10 0t10 0 10 0 10 0"/>',
    voyages: '<path class="ink-a" d="M3 41 19 11l16 30z"/><circle class="ink-b" cx="34" cy="15" r="9"/>'
  };
  const glyph = (t) => '<svg class="inks" viewBox="0 0 48 48" aria-hidden="true">' + (GLYPHS[t.id] || GLYPHS.bilan) + "</svg>";

  /* Deux cercles qui se recouvrent d'autant plus que les réponses concordent. */
  function venn(p) {
    const r = 62, d = 2 * r * (0.92 - 0.74 * (p / 100)), cx = 150, cy = 70;
    return '<svg class="venn inks" viewBox="0 0 300 140" role="img" aria-label="Deux cercles qui se recouvrent à ' + p + ' %">' +
      '<circle class="ink-a" cx="' + (cx - d / 2).toFixed(1) + '" cy="' + cy + '" r="' + r + '"/>' +
      '<circle class="ink-b" cx="' + (cx + d / 2).toFixed(1) + '" cy="' + cy + '" r="' + r + '"/></svg>';
  }

  /* Radar : axes = [{label, full}], series = [{k, vals, st?, name?}]. */
  function radar(axes, series, aria) {
    const W = 440, Hh = 350, cx = W / 2, cy = Hh / 2 + 2, R = 116, n = axes.length;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i, v) => [cx + (R * v / 100) * Math.cos(ang(i)), cy + (R * v / 100) * Math.sin(ang(i))];
    const f = (p) => p[0].toFixed(1) + "," + p[1].toFixed(1);
    let s = '<svg class="radar" viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="' + esc(aria) + '">';
    [25, 50, 75, 100].forEach((v) => { s += '<polygon class="grid" points="' + axes.map((_, i) => f(pt(i, v))).join(" ") + '"/>'; });
    axes.forEach((_, i) => { const p = pt(i, 100); s += '<line class="grid" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; });
    s += '<text class="tick" x="' + (cx + 5) + '" y="' + (cy - R / 2 + 12) + '">50</text>';
    axes.forEach((a, i) => {
      const c = Math.cos(ang(i)), sn = Math.sin(ang(i));
      const x = cx + (R + 16) * c, y = cy + (R + 16) * sn;
      const anchor = c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";
      const dy = sn > 0.5 ? "0.85em" : sn < -0.5 ? "-0.15em" : "0.35em";
      s += '<text class="axis" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" dy="' + dy + '">' + esc(a.label) + "</text>";
    });
    series.forEach((se) => { s += '<polygon class="shape ' + se.k + '" points="' + se.vals.map((v, i) => f(pt(i, v))).join(" ") + '"/>'; });
    series.forEach((se) => {
      se.vals.forEach((v, i) => {
        const p = pt(i, v), x = p[0].toFixed(1), y = p[1].toFixed(1);
        const tip = "<title>" + esc(axes[i].full + " : " + v + (se.st ? " % (" + DIM_ST[se.st[i]].toLowerCase() + ")" : " sur 100, " + se.name)) + "</title>";
        if (se.st) {
          s += '<g class="mark ' + se.st[i] + '"><circle cx="' + x + '" cy="' + y + '" r="8.5"/><text x="' + x + '" y="' + y + '" dy="0.36em" text-anchor="middle">' + ST[se.st[i]].g + "</text>" + tip + "</g>";
        } else if (se.k === "b") {
          s += '<rect class="pt b" x="' + (p[0] - 4.5).toFixed(1) + '" y="' + (p[1] - 4.5).toFixed(1) + '" width="9" height="9" rx="1.5">' + tip + "</rect>";
        } else {
          s += '<circle class="pt a" cx="' + x + '" cy="' + y + '" r="5">' + tip + "</circle>";
        }
      });
    });
    return s + "</svg>";
  }

  /* Plan à deux axes pour les styles d'attachement. */
  function quadrant(t, pa, pb) {
    const q = t.quad, S = 330, m0 = 42, m1 = 14, L = S - m0 - m1;
    const X = (v) => m0 + (L * v) / 100, Y = (v) => m1 + L * (1 - v / 100);
    const zone = (label, x, y) => '<text class="zone" x="' + X(x) + '" y="' + Y(y) + '" text-anchor="middle">' + esc(label) + "</text>";
    let s = '<svg class="quad" viewBox="0 0 ' + S + " " + S + '" role="img" aria-label="Position de chacun selon ' + esc(q.xl.toLowerCase()) + " et " + esc(q.yl.toLowerCase()) + '">';
    s += '<rect class="plot" x="' + m0 + '" y="' + m1 + '" width="' + L + '" height="' + L + '" rx="8"/>';
    s += '<line class="grid" x1="' + X(50) + '" y1="' + m1 + '" x2="' + X(50) + '" y2="' + (m1 + L) + '"/><line class="grid" x1="' + m0 + '" y1="' + Y(50) + '" x2="' + (m0 + L) + '" y2="' + Y(50) + '"/>';
    s += zone(q.ul, 25, 93) + zone(q.ur, 75, 93) + zone(q.ll, 25, 4) + zone(q.lr, 75, 4);
    s += '<text class="axis" x="' + X(50) + '" y="' + (S - 8) + '" text-anchor="middle">' + esc(q.xl) + " →</text>";
    s += '<text class="axis" transform="rotate(-90 15 ' + Y(50) + ')" x="15" y="' + Y(50) + '" text-anchor="middle">' + esc(q.yl) + " →</text>";
    const place = (k, p, up) => {
      const vx = p[q.x], vy = p[q.y];
      if (vx == null || vy == null) return "";
      const x = X(vx), y = Y(vy), anchor = vx < 18 ? "start" : vx > 82 ? "end" : "middle";
      const mark = k === "a"
        ? '<circle class="pt a" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7"/>'
        : '<rect class="pt b" x="' + (x - 6.5).toFixed(1) + '" y="' + (y - 6.5).toFixed(1) + '" width="13" height="13" rx="2"/>';
      return "<g>" + mark + '<text class="who" x="' + x.toFixed(1) + '" y="' + (up ? y - 13 : y + 23).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(nm(k)) + "</text><title>" +
        esc(nm(k) + " : " + q.xl.toLowerCase() + " " + vx + ", " + q.yl.toLowerCase() + " " + vy) + "</title></g>";
    };
    const aUp = pa[q.y] == null || pb[q.y] == null || pa[q.y] >= pb[q.y];
    return s + place("a", pa, aUp) + place("b", pb, !aUp) + "</svg>";
  }

  /* ---------- Morceaux d'interface ---------- */
  function topbar(home) {
    return '<header class="top"><a class="brand" href="#accueil">' + LOGO + "<span>Entre Nous</span></a>" +
      (home
        ? '<button class="link" type="button" data-act="toggle-code" aria-expanded="' + ui.codeOpen + '">J\'ai reçu un code</button>'
        : '<a class="link" href="#accueil">Accueil</a>') +
      "</header>";
  }

  function namesForm(la, lb) {
    const field = (k, label) => '<label class="name ' + k + '"><span><i class="sw ' + k + '"></i>' + label + '</span><input id="name-' + k + '" data-name="' + k +
      '" type="text" autocomplete="off" maxlength="20" placeholder="Prénom" value="' + esc(names[k] || "") + '"></label>';
    return '<form class="names" data-form="names">' + field("a", la) + field("b", lb) + "</form>";
  }

  function codeForm(id, label) {
    return '<form class="code-form" data-form="code"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="3" spellcheck="false" autocomplete="off"></textarea>' +
      (ui.codeErr ? '<p class="err" role="alert">' + esc(ui.codeErr) + "</p>" : "") +
      '<button class="btn small" type="submit">Ouvrir</button></form>';
  }

  function qrSvg(text) {
    if (!hasQr()) return "";
    try {
      const qr = window.qrcode(0, "L");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount(), m = 4, size = n + 2 * m;
      let d = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
      return '<svg class="qr" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="QR code à scanner avec l\'appareil photo" shape-rendering="crispEdges"><rect class="qr-bg" width="' + size +
        '" height="' + size + '"/><path class="qr-fg" d="' + d + '"/></svg>';
    } catch (e) { return ""; }
  }

  /* Boîte de partage. o = { url | code, label, how, text }. Un lien se partage par QR code,
     par la feuille de partage du téléphone ou par copie ; un code (page intégrée) se copie. */
  function shareBox(o) {
    if (!o.url) {
      return '<div class="share"><p class="share-label">' + o.label + '</p><textarea readonly rows="4" spellcheck="false" aria-label="Code à copier">' + esc(o.code) +
        '</textarea><div class="share-row"><button class="btn small" type="button" data-act="copy">Copier le code</button><span class="share-msg" role="status"></span></div></div>';
    }
    const qr = qrSvg(o.url), canShare = typeof navigator.share === "function";
    return '<div class="share" data-url="' + esc(o.url) + '" data-text="' + esc(o.text || "") + '"><div class="share-main">' + (qr ? '<div class="qr-box">' + qr + "</div>" : "") +
      '<div class="share-side"><p class="share-label">' + o.label + "</p>" + (o.how ? "<p>" + o.how + "</p>" : "") + '<div class="actions">' +
      (canShare ? '<button class="btn small" type="button" data-act="share">Envoyer le lien</button>' : "") +
      '<button class="btn small' + (canShare ? " alt" : "") + '" type="button" data-act="copy">Copier le lien</button></div><span class="share-msg" role="status"></span></div></div>' +
      '<details class="share-raw"><summary>Voir le lien en entier</summary><textarea readonly rows="4" spellcheck="false" aria-label="Lien à copier">' + esc(o.url) + "</textarea></details></div>";
  }

  /* Invitation à rejoindre le test, partagée avant de répondre. */
  function inviteBox(t, room) {
    const B = esc(nm("b"));
    return shareBox({
      url: joinUrl(t, room),
      label: "Le lien du test pour " + B,
      how: hasQr() ? "Fais scanner ce QR code avec l'appareil photo de son téléphone, ou envoie le lien par message." : "Envoie ce lien par message.",
      text: nm("a") + " t'invite à faire le test « " + t.title + " » en même temps"
    });
  }

  const stChip = (st, text) => '<span class="st ' + st + '"><i aria-hidden="true">' + ST[st].g + "</i>" + text + "</span>";
  const legendStatus = () => '<ul class="legend">' + ["ok", "near", "gap"].map((k) => "<li>" + stChip(k, ST[k].many.charAt(0).toUpperCase() + ST[k].many.slice(1)) + "</li>").join("") + "</ul>";
  const legendPeople = () => '<ul class="legend"><li><i class="sw a"></i>' + esc(nm("a")) + '</li><li><i class="sw b"></i>' + esc(nm("b")) + "</li></ul>";

  function answers(t, x) {
    const cell = (k) => '<div class="ans"><span class="ans-who"><i class="sw ' + k + '"></i>' + esc(nm(k)) + '</span><span class="ans-val">' + esc(ansLabel(t, x.q, k, x[k])) + "</span></div>";
    return '<div class="answers">' + cell("a") + cell("b") + "</div>";
  }

  function qRow(t, x) {
    const st = x.c ? x.c.st : null;
    return '<li class="qrow">' + (st ? stChip(st, ST[st].one.charAt(0).toUpperCase() + ST[st].one.slice(1)) : '<span class="st skip">Non comparée</span>') +
      '<p class="qtext">' + esc(x.q.q) + "</p>" + answers(t, x) + "</li>";
  }

  /* ---------- Vues ---------- */
  function card(t) {
    const r = results[t.id];
    let state = "";
    if (r && !full(r)) {
      state = '<a class="card-state" href="#rapport-' + t.id + '">En attente ' + esc(de(nm(other(r.me || "a")))) + " · reprendre</a>";
    } else if (r) {
      state = '<a class="card-state" href="#rapport-' + t.id + '"><b>' + analyse(t, r.a, r.b).align + "\u00a0%</b> " + esc(t.simLabel) + " · " + shortDate(r.at) + " · voir le rapport</a>";
    }
    return '<article class="card"><div class="glyph">' + glyph(t) + '</div><div class="card-body"><p class="eyebrow">' + esc(t.title) + '</p><h3><a class="card-link" href="#test-' + t.id + '">' + esc(t.hook) +
      '</a></h3><p class="blurb">' + esc(t.blurb) + '</p><p class="meta">' + t.questions.length + " questions · " + t.minutes + " min chacun</p>" + state + "</div></article>";
  }

  function vHome() {
    const play = games ? games.home() : { banners: "", group: "", count: 0 };
    const groups = GROUPS.map((g) => {
      const ts = TESTS.filter((t) => t.group === g.id);
      return (ts.length ? '<section class="group"><h2 class="group-title">' + esc(g.name) + '</h2><div class="cards">' + ts.map(card).join("") + "</div></section>" : "") +
        (g.id === "commencer" ? play.group : "");
    }).join("");
    let banner = "";
    if (session) {
      const t = BY_ID[session.t];
      banner = '<aside class="banner"><p><b>' + esc(t.title) + "</b> est en cours : " + esc(nm(session.who)) + " en est à la question " + (session.i + 1) + " sur " + t.questions.length +
        '.</p><div class="banner-actions"><a class="btn small" href="#test-' + t.id + '">Reprendre</a><button class="link" type="button" data-act="drop">Abandonner</button></div></aside>';
    }
    const done = TESTS.filter((t) => full(results[t.id]));
    const dash = done.length >= 2 ? '<section class="group"><h2 class="group-title">Vos résultats</h2><ul class="res">' + done.map((t) => {
      const p = analyse(t, results[t.id].a, results[t.id].b).align;
      return '<li><a href="#rapport-' + t.id + '">' + esc(t.title) + '</a><span class="track m" title="' + esc(t.title + " : " + p + " % " + t.simLabel) + '"><span class="bar" style="width:' + Math.max(p, 2) +
        '%"></span></span><span class="num">' + p + " %</span></li>";
    }).join("") + "</ul></section>" : "";
    const count = NUMBERS[TESTS.length] || String(TESTS.length);
    return topbar(true) + '<main class="wrap">' +
      (ui.codeOpen ? '<section class="panel">' + codeForm("code-in", "Colle ici le code ou le lien que tu as reçu") + "</section>" : "") +
      '<section class="hero"><h1>Faites le point à deux.</h1><p class="sub">' + count +
      " tests à passer chacun de son côté, en même temps si vous voulez, puis un rapport qui compare vos réponses. " +
      (play.count ? (NUMBERS[play.count] || String(play.count)) + (play.count >= 2 ? " jeux" : " jeu") + " pour s'amuser à deux. " : "") + "Gratuit et sans compte.</p>" +
      namesForm("Premier prénom", "Second prénom") + "</section>" + banner + play.banners + dash + groups +
      '<footer class="foot"><p>Vos réponses ' + (play.count ? "et vos parties " : "") + "sont enregistrées dans ce navigateur. " + (canRoom
        ? "En mode « chacun sur son téléphone », elles passent, chiffrées, par un relais (ntfy.sh) qui ne peut pas les lire et qui les efface au bout de douze heures."
        : "Rien n'est envoyé sur un serveur.") + '</p><p>Ces tests servent à ouvrir la discussion. Ils ne remplacent ni un diagnostic, ni une thérapie de couple.</p></footer></main>';
  }

  function vIntro(t) {
    const r = results[t.id], guest = invite && invite.t === t.id;
    const units = t.units || [t.dims.length, t.kind === "accord" ? "domaines" : "dimensions"];
    const facts = '<ul class="facts"><li><b>' + t.questions.length + "</b> questions</li><li><b>" + t.minutes + " min</b> chacun</li><li><b>" + units[0] + "</b> " + units[1] + "</li></ul>";
    let startHtml;
    if (guest && invite.room) {
      startHtml = '<div class="invite"><p><b>' + esc(nm("a")) + "</b> t'invite à faire ce test en même temps, chacun sur son téléphone. Le rapport s'ouvrira tout seul quand vous aurez terminé tous les deux.</p></div>" +
        '<div class="actions"><button class="btn" type="button" data-act="start" data-mode="join">Je suis ' + esc(nm("b")) + ", je commence</button></div>" +
        '<p class="hint"><button class="link" type="button" data-act="decline">Ignorer cette invitation</button></p>';
    } else if (guest) {
      startHtml = '<div class="invite"><p><b>' + esc(nm("a")) + "</b> a déjà répondu et t'invite à faire ce test. Vos réponses seront comparées dès que tu auras terminé.</p></div>" +
        '<div class="actions"><button class="btn" type="button" data-act="start" data-mode="guest">Je suis ' + esc(nm("b")) + ", je commence</button></div>" +
        '<p class="hint"><button class="link" type="button" data-act="decline">Ignorer cette invitation</button></p>';
    } else {
      startHtml = namesForm("Ton prénom", "Le prénom de l'autre") +
        '<div class="actions"><button class="btn" type="button" data-act="start" data-mode="' + (canRoom ? "room" : "solo") + '">' + (canRoom ? "Chacun sur son téléphone, en même temps" : "Chacun sur son appareil") + "</button>" +
        '<button class="btn alt" type="button" data-act="start" data-mode="same">Sur cet appareil, chacun son tour</button></div>' +
        '<p class="hint">' + (canRoom
          ? "Chacun sur son téléphone : tu obtiens tout de suite un lien et un QR code à partager. Vous répondez en même temps, et le rapport s'ouvre chez vous deux quand tout le monde a terminé. Vos réponses transitent chiffrées par un relais qui ne peut pas les lire."
          : "Chacun sur son appareil : tu réponds ici, puis tu envoies " + (canLink ? "un lien" : "un code") + " à l'autre, qui répond de son côté.") + "</p>";
    }
    let prev = "";
    if (full(r)) prev = '<p class="prev">Vous avez déjà fait ce test le ' + longDate(r.at) + '. <a href="#rapport-' + t.id + '">Revoir le rapport</a>. Le refaire remplacera ce résultat.</p>';
    else if (r) prev = '<p class="prev">Des réponses attendent déjà celles ' + esc(de(nm(other(r.me || "a")))) + '. <a href="#rapport-' + t.id + '">Retrouver la page d\'attente</a>.</p>';
    return topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(t) + '</div><p class="eyebrow">' + esc(t.title) + "</p><h1>" + esc(t.hook) + "</h1>" +
      t.intro.map((p) => "<p>" + esc(p) + "</p>").join("") + facts + startHtml + prev + (t.note ? '<p class="note">' + esc(t.note) + "</p>" : "") + "</main>";
  }

  function vQuiz(t) {
    const s = session, q = t.questions[s.i], total = t.questions.length;
    const cur = s.ans[s.who][s.i], opts = optsFor(t, q, s.who);
    const pct = Math.round((100 * s.i) / total);
    const partner = nm(other(s.who));
    const qText = q.guess ? fill(q.q, { p: partner, de_p: de(partner) }) : q.q;
    const eyebrow = t.kind === "devine" ? (q.guess ? "Devine la réponse " + de(partner) : "Ta réponse")
      : t.kind === "accord" ? dimOf(t, q.d).name + (t.lead ? " · " + t.lead : "")
      : t.lead;
    return '<main class="wrap narrow quiz" data-who="' + s.who + '"><header class="quiz-top"><a class="link" href="#accueil">Quitter</a><span class="chip"><i class="sw ' + s.who + '"></i>' + esc(nm(s.who)) +
      ' répond</span><span class="count">' + (s.i + 1) + " / " + total + '</span></header><div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + s.i +
      '"><span style="width:' + pct + '%"></span></div><p class="eyebrow">' + esc(eyebrow) + '</p><h1 class="question" tabindex="-1" data-focus>' + esc(qText) +
      '</h1><div class="options">' + opts.map((o, k) => '<button class="opt' + (cur === k ? " on" : "") + '" type="button" data-act="pick" data-k="' + k + '" aria-pressed="' + (cur === k) + '"><kbd>' + (k + 1) + "</kbd><span>" + esc(o) + "</span></button>").join("") +
      '</div><footer class="quiz-nav"><button class="btn alt small" type="button" data-act="prev"' + (s.i === 0 ? " disabled" : "") + '>Précédente</button><button class="link" type="button" data-act="skip">Passer cette question</button>' +
      (cur != null ? '<button class="btn alt small" type="button" data-act="next">Suivante</button>' : "") + "</footer></main>";
  }

  function vHandoff(t) {
    return '<main class="wrap narrow handoff" data-who="b"><div class="glyph big">' + glyph(t) + '</div><p class="eyebrow">' + esc(t.title) + "</p><h1>Merci " + esc(nm("a")) + ". Au tour " + esc(de(nm("b"))) +
      ".</h1><p>Passe l'appareil. Les réponses " + esc(de(nm("a"))) + ' restent cachées jusqu\'au rapport.</p><div class="actions"><button class="btn" type="button" data-act="resume">Je suis ' + esc(nm("b")) + ", je commence</button></div></main>";
  }

  function vInvite(t) {
    const B = esc(nm("b"));
    return topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(t) + '</div><p class="eyebrow">' + esc(t.title) + "</p><h1>Invite " + B + " à répondre en même temps.</h1><p>" + B +
      " ouvre ce lien sur son téléphone et répond de son côté. Le rapport s'ouvrira tout seul, chez vous deux, quand vous aurez terminé l'un et l'autre.</p>" + inviteBox(t, session.room) +
      '<div class="actions"><button class="btn" type="button" data-act="resume">Commencer mes réponses</button></div><p class="hint">Tu peux commencer sans attendre : ' + B +
      " peut rejoindre le test à tout moment.</p></main>";
  }

  function profileBars(t, pa, pb, withText, solo) {
    return '<div class="pairs">' + t.dims.map((d) => {
      const row = (k, v) => v == null ? "" : '<span class="bar-who"><i class="sw ' + k + '"></i>' + esc(nm(k)) + '</span><span class="track ' + k + '" title="' + esc(nm(k) + " : " + v + " sur 100") + '"><span class="bar" style="width:' + Math.max(v, 2) +
        '%"></span></span><span class="num">' + v + '</span><span class="lvl">' + esc(H.level(t, v)) + "</span>";
      let text = "";
      if (withText && pa[d.id] != null && pb && pb[d.id] != null) {
        const sa = pa[d.id], sb = pb[d.id], hi = sa >= sb ? "a" : "b", lo = other(hi);
        const map = { a: nm("a"), b: nm("b"), hi: nm(hi), lo: nm(lo), de_hi: de(nm(hi)), de_lo: de(nm(lo)), de_a: de(nm("a")), de_b: de(nm("b")) };
        const tpl = Math.abs(sa - sb) >= 20 && d.gap ? d.gap : sa >= 60 && sb >= 60 && d.both ? d.both : sa < 40 && sb < 40 && d.none ? d.none : "Vous êtes proches sur ce point.";
        text = '<p class="pair-text">' + esc(fill(tpl, map)) + "</p>";
      }
      return '<div class="pair"><h3>' + esc(d.name) + '</h3><p class="pair-desc">' + esc(d.desc || "") + '</p><div class="bars">' + (pb ? row("a", pa[d.id]) + row("b", pb[d.id]) : row(solo || "a", pa[d.id])) + "</div>" + text + "</div>";
    }).join("") + "</div>";
  }

  function vWait(t, r) {
    const me = r.me || "a", oth = other(me), O = esc(nm(oth));
    const head = topbar(false) + '<main class="wrap narrow wait"><p class="eyebrow">' + esc(t.title) + "</p><h1>Tes réponses sont enregistrées.</h1>";
    const tail = (t.kind === "profil" ? "<h2>Ton profil en attendant</h2>" + profileBars(t, profile(t, r[me]), null, false, me) : "") +
      '<p class="prev"><a href="#test-' + t.id + '">Recommencer ce test</a></p></main>';
    const manual = shareBox(canLink
      ? {
        url: codeUrl(codeFor(t, r)),
        label: "Tes réponses, pour " + O,
        how: (hasQr() ? O + " scanne ce QR code ou ouvre le lien" : O + " ouvre ce lien") + " : s'il lui reste à répondre, le test s'ouvre ; sinon le rapport s'affiche, avec un lien à te renvoyer.",
        text: nm(me) + " t'envoie ses réponses au test « " + t.title + " »"
      }
      : { code: codeFor(t, r), label: "Code à envoyer à " + O });
    const back = codeForm("code-back", (canLink ? "Lien" : "Code") + " reçu en retour");
    if (r.room && canRoom) {
      return head + "<p>Le rapport s'ouvrira tout seul, ici et chez " + O + ", dès que " + O + " aura terminé. Tu peux laisser cette page ouverte ou y revenir plus tard.</p>" +
        '<p class="sync" role="status" data-sync>Recherche des réponses ' + esc(de(nm(oth))) + "…</p>" +
        (me === "a" ? '<details class="more"><summary>' + O + " n'a pas encore le lien du test ?</summary>" + inviteBox(t, r.room) + "</details>" : "") +
        '<details class="more"><summary>Le rapport ne s\'ouvre pas ?</summary><p>Vous pouvez réunir vos réponses à la main.</p>' + manual + back + "</details>" + tail;
    }
    return head + "<p>Il manque celles " + esc(de(nm(oth))) + ". " +
      (canLink ? "" : O + " ouvre cette page, touche « J'ai reçu un code », colle le code, puis répond aux mêmes questions.") + "</p>" + manual +
      "<h2>Quand " + O + " a terminé</h2><p>" + O + " te renvoie " + (canLink ? "un lien" : "un code") + " depuis son rapport. Ouvre-le sur cet appareil, ou colle-le ici.</p>" + back + tail;
  }

  function verdictBlock(t, an) {
    const A = [], B = [], E = [], D = [];
    an.items.forEach((x) => {
      if (!x.c || x.q.t !== "mir") return;
      const n = nOpts(t, x.q), m = (x.a + (n - 1 - x.b)) / 2, mid = (n - 1) / 2;
      (x.c.st === "gap" ? D : m < mid ? A : m > mid ? B : E).push(x);
    });
    const col = (title, list, sw) => '<div class="vcol"><h3>' + (sw ? '<i class="sw ' + sw + '"></i>' : "") + title + ' <span class="vcount">' + list.length + "</span></h3>" +
      (list.length ? "<ul>" + list.map((x) => "<li>" + esc(x.q.q) + "</li>").join("") + "</ul>" : '<p class="muted">Aucune question.</p>') + "</div>";
    return '<section class="sec"><h2>Le verdict</h2><p class="sec-sub">Ce que vos deux versions désignent, question par question.</p><div class="verdict">' +
      col("C'est " + esc(nm("a")), A, "a") + col("C'est " + esc(nm("b")), B, "b") + col("Égalité", E) + col("Versions opposées", D) + "</div></section>";
  }

  /* Rapport du jeu « Tu me connais ? » : les intuitions de chacun face aux vraies réponses de l'autre. */
  function guessReport(t, an) {
    const lvl = (v) => (v >= 80 ? "Par cœur" : v >= 60 ? "Bien" : v >= 40 ? "Avec des surprises" : "À redécouvrir");
    const row = (k, v) => v == null ? "" : '<span class="bar-who"><i class="sw ' + k + '"></i>' + esc(nm(k)) + '</span><span class="track ' + k + '" title="' + esc(nm(k) + " : " + v + " sur 100") +
      '"><span class="bar" style="width:' + Math.max(v, 2) + '%"></span></span><span class="num">' + v + '</span><span class="lvl">' + lvl(v) + "</span>";
    const order = { gap: 0, near: 1, ok: 2 };
    let h = '<section class="sec"><h2>Qui connaît le mieux l\'autre ?</h2><p class="sec-sub">La justesse des intuitions de chacun sur les réponses de l\'autre, sur 100.</p><div class="bars">' +
      row("a", an.knowB) + row("b", an.knowA) + "</div></section>";
    ["a", "b"].forEach((k) => {
      const o = other(k), key = k === "a" ? "onB" : "onA";
      const rows = an.pairs.filter((p) => p[key].c).sort((x, y) => order[x[key].c.st] - order[y[key].c.st]);
      if (!rows.length) return;
      h += '<section class="sec"><h2>Ce ' + esc(que(nm(k))) + " pense " + esc(de(nm(o))) + '</h2><p class="sec-sub">Les surprises d\'abord.</p><ul class="qlist">' + rows.map((p) => {
        const x = p[key], w = word(t, x.c.st, 1);
        return '<li class="qrow">' + stChip(x.c.st, w.charAt(0).toUpperCase() + w.slice(1)) + '<p class="qtext">' + esc(fill(p.g.q, { p: nm(o), de_p: de(nm(o)) })) + '</p><div class="answers">' +
          '<div class="ans"><span class="ans-who"><i class="sw ' + o + '"></i>Réponse ' + esc(de(nm(o))) + '</span><span class="ans-val">' + esc(ansLabel(t, p.q, o, x.real)) + "</span></div>" +
          '<div class="ans"><span class="ans-who"><i class="sw ' + k + '"></i>Intuition ' + esc(de(nm(k))) + '</span><span class="ans-val">' + esc(ansLabel(t, p.q, k, x.guess)) + "</span></div></div></li>";
      }).join("") + "</ul></section>";
    });
    return h;
  }

  /* Part des tâches portée par chacun, selon l'un puis selon l'autre (questions miroir). */
  function shareBlock(t, r) {
    const part = (ans, who) => {
      const xs = [];
      t.questions.forEach((q, i) => {
        if (q.t !== "mir" || ans[i] == null) return;
        const v = ans[i] / (nOpts(t, q) - 1);
        xs.push(who === "a" ? 1 - v : v);
      });
      return xs.length ? Math.round(100 * avg(xs)) : null;
    };
    const sa = part(r.a, "a"), sb = part(r.b, "b");
    if (sa == null || sb == null) return "";
    const A = esc(nm("a")), B = esc(nm("b"));
    const bar = (label, pa) => '<div class="split-row"><span class="split-lab">' + label + '</span><div class="split" role="img" aria-label="' + label + " : " + A + " " + pa + " %, " + B + " " + (100 - pa) + ' %">' +
      (pa > 0 ? '<span class="a" style="flex-grow:' + pa + '">' + (pa >= 18 ? pa + " %" : "") + "</span>" : "") +
      (pa < 100 ? '<span class="b" style="flex-grow:' + (100 - pa) + '">' + (100 - pa >= 18 ? (100 - pa) + " %" : "") + "</span>" : "") + "</div></div>";
    let text;
    if (sa - sb >= 10) text = "Chacun a le sentiment d'en porter plus que l'autre ne le voit. C'est très courant : on remarque mieux ses propres efforts que ceux de l'autre.";
    else if (sb - sa >= 10) text = "Chacun attribue à l'autre une part plus grande que celle que l'autre se reconnaît : vous voyez les efforts de l'autre, et c'est bon signe.";
    else text = "Vous évaluez la répartition de la même façon.";
    const mean = (sa + sb) / 2;
    if (mean >= 62 || mean <= 38) text += " D'après vos deux versions, " + (mean >= 62 ? A : B) + " porte la plus grande part : est-ce que cette répartition vous convient à tous les deux ?";
    return '<section class="sec"><h2>La répartition vue par chacun</h2><p class="sec-sub">La part des tâches portée par chacun, d\'après les réponses de l\'un puis de l\'autre.</p>' + legendPeople() +
      '<div class="splits">' + bar("Selon " + A, sa) + bar("Selon " + B, sb) + '</div><p class="pair-text">' + text + "</p></section>";
  }

  /* Tests conseillés après le test général : ceux des domaines les moins alignés. */
  function moreBlock(dimsOk) {
    const picks = [];
    dimsOk.slice().sort((x, y) => x.align - y.align).forEach((dm) => {
      const m = dm.d.more && BY_ID[dm.d.more];
      if (m && picks.length < 3 && picks.indexOf(m) < 0) picks.push(m);
    });
    if (!picks.length) return "";
    return '<section class="sec"><h2>Les tests à faire ensuite</h2><p class="sec-sub">Vos domaines les moins alignés ont chacun un test qui va plus loin.</p><div class="cards">' + picks.map(card).join("") + "</div></section>";
  }

  function vReport(t, r) {
    const an = analyse(t, r.a, r.b), isP = t.kind === "profil", isG = t.kind === "devine";
    const pa = profile(t, r.a), pb = profile(t, r.b);
    const N = { a: esc(nm("a")), b: esc(nm("b")) };
    const head = t.headline ? t.headline(an.align, pa, pb) : headline(an.align, isP);
    let h = topbar(false) + '<main class="wrap report">';

    h += '<header class="rep-head"><p class="eyebrow">' + esc(t.title) + " · " + longDate(r.at) + '</p><h1><span><i class="sw a"></i>' + N.a + '</span> <span class="amp">et</span> <span><i class="sw b"></i>' + N.b + "</span></h1></header>";

    if (!an.n) {
      return h + '<p>Aucune question n\'a reçu de réponse des deux côtés : il n\'y a rien à comparer.</p><p class="prev"><a href="#test-' + t.id + '">Refaire ce test</a></p></main>';
    }

    if (r.from === "guest") {
      h += '<section class="panel">' + shareBox(canLink
        ? {
          url: codeUrl(codeFor(t, r)),
          label: "Dernière étape : le rapport pour " + N.a,
          how: (hasQr() ? N.a + " scanne ce QR code ou ouvre le lien" : "Renvoie ce lien à " + N.a) + ", et le rapport s'affiche aussi de son côté.",
          text: "Notre rapport « " + t.title + " » est prêt"
        }
        : { code: codeFor(t, r), label: "Dernière étape : renvoie ce code à " + N.a + " pour que le rapport s'ouvre aussi de son côté" }) + "</section>";
    }

    h += '<section class="hero-block"><div class="hero-fig"><div class="venn-box">' + venn(an.align) + '</div><div class="hero-txt"><p class="hero-num">' + an.align + '<span>\u00a0%</span></p><p class="hero-lab">' + esc(t.simLabel) +
      '</p><p class="hero-head">' + esc(head) + "</p></div></div>";
    h += '<ul class="counts">' + ["ok", "near", "gap"].map((k) => '<li><span class="st ' + k + '"><i aria-hidden="true">' + ST[k].g + "</i></span><b>" + an[k] + "</b> " + word(t, k, an[k]) + "</li>").join("") + "</ul>";
    h += '<p class="hero-note">' + (isG
      ? "Une intuition juste compte pour un point. Les surprises ne sont pas des fautes\u00a0: ce sont les meilleurs sujets de discussion."
      : isP
      ? "Le pourcentage mesure à quel point vos réponses se ressemblent, phrase par phrase. Se ressembler n'est ni mieux ni moins bien\u00a0: l'important est de savoir où vous différez."
      : (an.heavy ? "Dont " + pl(an.heavy, "écart", "écarts") + " sur des sujets décisifs, ceux qui pèsent le plus dans un couple. " : "") + "Un écart n'est pas une mauvaise note\u00a0: c'est un sujet dont il vaut mieux parler à froid.") + "</p></section>";

    if (isG) {
      h += guessReport(t, an);
    } else if (isP) {
      if (t.summary) {
        try {
          t.summary(pa, pb, N, H).forEach((b) => { h += '<section class="sec summary"><h2>' + esc(b.title) + "</h2>" + b.html + "</section>"; });
        } catch (e) { /* résumé indisponible si des dimensions entières ont été passées */ }
      }
      const dimsOk = t.dims.filter((d) => pa[d.id] != null && pb[d.id] != null);
      h += '<section class="sec"><h2>Vos deux profils</h2><p class="sec-sub">Un score de 0 à 100 par dimension, calculé à partir des réponses de chacun.</p>' + legendPeople();
      if (t.quad) {
        h += '<div class="chart">' + quadrant(t, pa, pb) + "</div>";
      } else if (dimsOk.length >= 5) {
        h += '<div class="chart">' + radar(dimsOk.map((d) => ({ label: d.short, full: d.name })), [
          { k: "a", name: nm("a"), vals: dimsOk.map((d) => pa[d.id]) },
          { k: "b", name: nm("b"), vals: dimsOk.map((d) => pb[d.id]) }
        ], "Profils de " + nm("a") + " et " + nm("b") + " par dimension") + '<p class="chart-cap">Du centre (0) au bord (100).</p></div>';
      }
      h += profileBars(t, pa, pb, true) + "</section>";

      const far = an.items.filter((x) => x.c && x.c.st === "gap").sort((x, y) => y.c.steps - x.c.steps).slice(0, 5);
      if (far.length) {
        h += '<section class="sec"><h2>Vos réponses les plus éloignées</h2><p class="sec-sub">Les phrases où vous avez répondu le plus différemment.</p><ul class="qlist">' + far.map((x) => qRow(t, x)).join("") + "</ul></section>";
      }
    } else {
      const dimsOk = an.dims.filter((dm) => dm.align != null);
      if (dimsOk.length >= 5) {
        h += '<section class="sec"><h2>Vos domaines d\'un coup d\'œil</h2>' + legendStatus() + '<div class="chart">' +
          radar(dimsOk.map((dm) => ({ label: dm.d.short, full: dm.d.name })), [{ k: "m", vals: dimsOk.map((dm) => dm.align), st: dimsOk.map((dm) => dimStatus(dm.align)) }], "Alignement par domaine") +
          '<p class="chart-cap">Alignement par domaine, du centre (0\u00a0%) au bord (100\u00a0%).</p></div></section>';
      }
      h += '<section class="sec"><h2>La carte de vos domaines</h2><p class="sec-sub">Pour chaque domaine, la part d\'accords, de réponses proches et d\'écarts.</p>' + (dimsOk.length >= 5 ? "" : legendStatus()) + '<ul class="doms">' +
        dimsOk.map((dm) => {
          const st = dimStatus(dm.align);
          const tip = pl(dm.ok, ST.ok.one, ST.ok.many) + ", " + pl(dm.near, ST.near.one, ST.near.many) + ", " + pl(dm.gap, ST.gap.one, ST.gap.many);
          return '<li class="dom" title="' + esc(tip) + '"><span class="dom-name">' + esc(dm.d.name) + '</span><span class="seg" role="img" aria-label="' + esc(tip) + '">' +
            ["ok", "near", "gap"].map((k) => (dm[k] ? '<i class="' + k + '" style="flex-grow:' + dm[k] + '"></i>' : "")).join("") +
            '</span><span class="num">' + dm.align + '\u00a0%</span><span class="dom-st">' + stChip(st, DIM_ST[st]) + "</span></li>";
        }).join("") + "</ul></section>";

      const talks = pickTalks(an);
      if (talks.length) {
        const used = {};
        h += '<section class="sec"><h2>Vos prochaines conversations</h2><p class="sec-sub">Les sujets par lesquels commencer, avec une question pour lancer la discussion.</p><ol class="talks">' +
          talks.map((x) => {
            const d = dimOf(t, x.q.d), k = used[d.id] || 0;
            used[d.id] = k + 1;
            const prompt = x.q.talk || (d.talk && d.talk[k % d.talk.length]);
            return '<li class="talk"><p class="eyebrow">' + esc(d.name) + ((x.q.w || 1) > 1 ? " · sujet décisif" : "") + '</p><p class="qtext">' + esc(x.q.q) + "</p>" + answers(t, x) +
              (prompt ? '<p class="prompt"><span>Pour en parler</span>' + esc(prompt) + "</p>" : "") + "</li>";
          }).join("") + "</ol></section>";
      }

      t.dims.filter((d) => d.mood).forEach((d) => {
        const ma = moodScore(t, r.a, d.id), mb = moodScore(t, r.b, d.id);
        if (ma == null || mb == null) return;
        const word = (v) => (v >= 80 ? "Très bien" : v >= 60 ? "Plutôt bien" : v >= 40 ? "Mitigé" : "En difficulté");
        const row = (k, v) => '<span class="bar-who"><i class="sw ' + k + '"></i>' + esc(nm(k)) + '</span><span class="track ' + k + '" title="' + esc(nm(k) + " : " + v + " sur 100") + '"><span class="bar" style="width:' + Math.max(v, 2) +
          '%"></span></span><span class="num">' + v + '</span><span class="lvl">' + word(v) + "</span>";
        h += '<section class="sec"><h2>Le climat de votre couple</h2><p class="sec-sub">Comment chacun se sent dans la relation en ce moment, sur 100, d\'après ses propres réponses.</p><div class="bars">' + row("a", ma) + row("b", mb) + "</div>" +
          (Math.abs(ma - mb) >= 20 ? '<p class="pair-text">' + esc(nm(ma < mb ? "a" : "b")) + " vit la relation moins bien en ce moment. C'est le premier sujet à ouvrir, avant tous les autres.</p>" : "") +
          (Math.min(ma, mb) < 40 ? '<p class="note">Quand l\'un des deux va mal dans la relation, en parler avec un conseiller conjugal ou un thérapeute de couple aide souvent à débloquer la situation.</p>' : "") + "</section>";
      });

      if (t.share) h += shareBlock(t, r);
      if (t.verdict) h += verdictBlock(t, an);
      h += moreBlock(dimsOk);
    }

    const order = { gap: 0, near: 1, ok: 2 };
    if (!isG) h += '<section class="sec"><h2>Toutes vos réponses</h2><p class="sec-sub">' + (isP ? "Dimension par dimension" : "Domaine par domaine") + ", les différences d'abord.</p><div class=\"dets\">" +
      an.dims.map((dm) => {
        const rows = dm.all.slice().sort((x, y) => (x.c ? order[x.c.st] : 3) - (y.c ? order[y.c.st] : 3));
        return '<details class="det"><summary><span class="det-name">' + esc(dm.d.name) + '</span><span class="det-counts">' +
          ["ok", "near", "gap"].map((k) => '<span class="st ' + k + '"><i aria-hidden="true">' + ST[k].g + "</i>" + dm[k] + '<span class="sr"> ' + ST[k].many + "</span></span>").join("") +
          '</span></summary><ul class="qlist">' + rows.map((x) => qRow(t, x)).join("") + "</ul></details>";
      }).join("") + "</div></section>";

    h += '<section class="sec end">';
    if (r.from !== "guest") {
      h += "<h2>Garder ce rapport</h2><p class=\"sec-sub\">Ce " + (canLink ? "lien" : "code") + " contient vos deux séries de réponses. " +
        (canLink ? "Ouvert sur un autre appareil, il affiche le même rapport." : "Collé dans « J'ai reçu un code » sur un autre appareil, il rouvre le même rapport.") + "</p>" +
        shareBox(canLink ? { url: codeUrl(codeFor(t, r)), label: "Lien du rapport", text: "Notre rapport « " + t.title + " »" } : { code: codeFor(t, r), label: "Code du rapport" });
    }
    h += '<p class="prev"><a href="#test-' + t.id + '">Refaire ce test</a> · <a href="#accueil">Choisir un autre test</a></p></section>';
    return h + "</main>";
  }

  /* ---------- Navigation ---------- */
  function render(keepScroll) {
    const m = /^(test|rapport)-([a-z0-9]+)$/.exec(route);
    const t = m && BY_ID[m[2]];
    let html = games ? games.view(route) : null;
    if (html != null) {
      /* page d'un jeu : le socle a tout fourni */
    } else if (t && m[1] === "test") {
      html = session && session.t === t.id ? (session.phase === "handoff" ? vHandoff(t) : session.phase === "invite" ? vInvite(t) : vQuiz(t)) : vIntro(t);
    } else if (t && m[1] === "rapport") {
      const r = results[t.id];
      html = !r ? vIntro(t) : full(r) ? vReport(t, r) : vWait(t, r);
    } else {
      html = vHome();
    }
    app.innerHTML = html;
    if (!keepScroll) window.scrollTo(0, 0);
    const f = app.querySelector("[data-focus]");
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
    watch();
    if (games) games.after(route);
  }

  function go(h) {
    route = h;
    try { if (location.hash !== "#" + h) location.hash = h; } catch (e) { /* cadre sans accès au hash */ }
    render();
  }

  function boot() {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* hash laissé tel quel */ }
    if (h.indexOf("j=") === 0) { importJoin(h.slice(2)); return; }
    if (games && h.indexOf("g=") === 0) { games.join(h.slice(2)); return; }
    if (h.indexOf("c=") === 0) { importCode(h.slice(2)); return; }
    route = h;
    render();
  }

  /* Nettoyage d'un état enregistré par une version précédente des tests. */
  (function sanitize() {
    Object.keys(results).forEach((id) => {
      const t = BY_ID[id], r = results[id];
      const arr = (x) => x == null || (Array.isArray(x) && x.length === t.questions.length);
      const ok = t && r && r.v === t.v && (r.a || r.b) && arr(r.a) && arr(r.b);
      if (!ok) delete results[id];
    });
    if (session && !(BY_ID[session.t] && session.ans && session.ans.a && session.ans.a.length === BY_ID[session.t].questions.length)) dropSession();
    if (invite && !(BY_ID[invite.t] && ((invite.room && invite.room.r && invite.room.k) || (Array.isArray(invite.a) && invite.a.length === BY_ID[invite.t].questions.length)))) { invite = null; store.del("invite"); }
  })();

  /* ---------- Événements ---------- */
  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.getAttribute("data-act");
    if (games && games.click(act, el, e)) return;
    const m = /^(?:test|rapport)-([a-z0-9]+)$/.exec(route);
    const t = m && BY_ID[m[1]];
    if (act === "toggle-code") { ui.codeOpen = !ui.codeOpen; ui.codeErr = ""; render(true); const i = document.getElementById("code-in"); if (i) i.focus(); }
    else if (act === "drop") { dropSession(); render(true); }
    else if (act === "decline") { invite = null; store.del("invite"); render(); }
    else if (act === "start" && t) start(t, el.getAttribute("data-mode"));
    else if (act === "pick") pick(parseInt(el.getAttribute("data-k"), 10));
    else if (act === "prev") step(-1);
    else if (act === "next") step(1);
    else if (act === "skip" && session) { session.ans[session.who][session.i] = null; step(1); }
    else if (act === "resume" && session) { session.phase = "quiz"; saveSession(); render(); }
    else if (act === "copy") {
      const box = el.closest(".share"), ta = box.querySelector("textarea"), msg = box.querySelector(".share-msg");
      const what = box.hasAttribute("data-url") ? "lien" : "code";
      const done = () => { msg.textContent = "Copié : colle-le dans un message."; };
      const manual = () => {
        const det = ta.closest("details");
        if (det) det.open = true;
        ta.focus();
        try { ta.setSelectionRange(0, ta.value.length); } catch (err) { ta.select(); }
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        if (ok) return done();
        msg.textContent = window.matchMedia && window.matchMedia("(pointer: coarse)").matches
          ? "Le " + what + " est affiché juste en dessous : appuie longuement dessus, puis choisis Copier."
          : "Le " + what + " est sélectionné : copie-le avec Ctrl ou Cmd + C.";
      };
      try { navigator.clipboard.writeText(ta.value).then(done, manual); } catch (err) { manual(); }
    }
    else if (act === "share") {
      const box = el.closest(".share");
      const fallback = () => { const c = box.querySelector('[data-act="copy"]'); if (c) c.click(); };
      try {
        navigator.share({ title: "Entre Nous", text: box.getAttribute("data-text") || "", url: box.getAttribute("data-url") })
          .catch((err) => { if (!err || err.name !== "AbortError") fallback(); });
      } catch (err) { fallback(); }
    }
  });

  app.addEventListener("input", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-name");
    if (k) { names[k] = e.target.value.slice(0, 20); store.set("names", names); }
    else if (games) games.input(e.target, e);
  });

  app.addEventListener("submit", (e) => {
    e.preventDefault();
    if (games && games.submit(e.target, e)) return;
    if (e.target.getAttribute("data-form") === "code") importCode(e.target.querySelector("textarea").value);
  });

  document.addEventListener("keydown", (e) => {
    if (games && games.key(e)) return;
    if (!session || session.phase !== "quiz" || !/^test-/.test(route)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (/^[1-9]$/.test(e.key)) pick(parseInt(e.key, 10) - 1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  window.addEventListener("hashchange", () => {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* idem */ }
    if (h !== route) boot();
  });

  document.addEventListener("visibilitychange", () => { if (!document.hidden) watch(); });

  if (window.ENGames) {
    games = window.ENGames({
      app, store, esc, nm, de, que, pl, fill, other, encode, decode, newRoom, seal, unseal, RELAY, canRoom, canLink, hasQr,
      shareBox, namesForm, readNames, setNames, topbar, venn, go, render,
      names: () => [names.a || "", names.b || ""],
      route: () => route,
      fail: failCode
    });
  }

  boot();
  syncAll();
})();
