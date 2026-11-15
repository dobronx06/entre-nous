/* Le mot interdit : l'un fait deviner un mot sans dire les trois mots interdits, l'autre devine, chrono en
   main. Six tours, trois chacun, et un seul score : celui du couple.
   État commun : { t, go }, le tour en cours (0 à 5, 6 pour la fin) et go: 1 dès que celui qui fait
   deviner a lancé le chrono. Seul lui écrit go: 1 ; le tour se termine quand son bilan arrive.
   Tranche d'un joueur : { r: { "2": { f, p, n } }, m }, le bilan de chacun de ses tours : les cartes
   trouvées (f) et passées (p), en rangs dans le paquet de la manche, et n, le rang où reprend le tour
   suivant (la carte affichée au coup de buzzer compte comme vue). Il part une fois, au bout du temps.
   m: { t, f } est le compte à mi-temps, envoyé une fois au plus pendant le tour pour l'écran de qui devine.
   Réglages : duree (45, 60 ou 90 secondes) et, après « Rejouer », vus (les cartes déjà tirées, pour ne pas
   les resservir) et prev (le score de la partie d'avant, pour qui n'aurait pas vu le résultat).
   Sur l'appareil : g.local.t = { t, at, z, h }, l'instant où CET appareil a vu le tour commencer (les
   horloges des deux téléphones ne sont jamais comparées), s'il a signalé la fin du temps (z) et envoyé
   le compte à mi-temps (h) ; g.local.c = { t, f, p, i, at, done }, l'avancement de qui fait deviner
   (i : la carte affichée, at : quand elle est apparue) ; g.local.h, sur un seul téléphone, le tour dont
   le joueur a reçu l'appareil ; g.local.e = { n, at }, l'écran affiché et l'instant où il est apparu. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.interdit) || {};
  const okCard = (c) => !!c && typeof c.w === "string" && !!c.w.trim() && Array.isArray(c.x) && c.x.every((s) => typeof s === "string");
  const CARDS = (Array.isArray(DATA.cards) ? DATA.cards : []).filter(okCard);
  const N = CARDS.length;
  const TURNS = 6;
  const TIMES = { 45: "45 secondes", 60: "Une minute", 90: "Une minute trente" };
  const HINTS = { 45: "Pour les plus rapides.", 60: "Le format classique.", 90: "Pour prendre son temps." };
  /* Rangs sautés quand le bilan d'un tour n'est jamais arrivé : on ne sait pas jusqu'où son paquet est allé. */
  const SKIP = 40;
  /* Secondes après la fin du temps où qui devine attend le bilan de l'autre, avant de pouvoir passer à la suite. */
  const GRACE = 8;
  /* Un toucher qui suit de moins de 0,6 s un changement d'écran visait l'écran d'avant ; un « Trouvé » qui
     suit de moins de 0,35 s l'arrivée d'une carte est le second d'un double toucher. */
  const SETTLE = 600, CARD = 350;
  /* Sous ce reste de chrono, un tour que l'autre téléphone vient de clore s'est fini à zéro chez lui. */
  const NEAR = 1.5;
  const RING = 339.3; /* périmètre de l'anneau du chrono (rayon 54) */
  const MAXP = 1e4, MAXF = 300;
  const LEVELS = [[7, "Vous vous lisez dans les pensées."], [5, "Une belle complicité."], [3, "Ça chauffe."], [0, "Les mots vous ont résisté, pas l'ambiance."]];
  let lastCard = "";

  const seed = (g) => Number(g.setup.seed) || 1;
  const token = (g) => g.gen + ":" + g.setup.seed;
  const dur = (g) => (TIMES.hasOwnProperty(g.setup.duree) ? Number(g.setup.duree) : 60);
  /* Le paquet de la manche, le même sur les deux téléphones : les cartes pas encore vues, mélangées par la
     seed, puis les déjà vues, de la plus ancienne à la plus récente. vus vient parfois de l'autre téléphone. */
  function deck(g) {
    const seen = (Array.isArray(g.setup.vus) ? g.setup.vus.slice(0, N) : []).filter((i, j, a) => Number.isInteger(i) && i >= 0 && i < N && a.indexOf(i) === j);
    const fresh = CARDS.map((c, i) => i).filter((i) => seen.indexOf(i) < 0);
    return { ids: g.kit.shuffle(fresh, seed(g)).concat(seen), fresh: fresh.length };
  }
  const cardAt = (ids, i) => CARDS[ids[i % ids.length]];
  /* Qui fait deviner au tour t : chacun son tour, et l'autre commence à la manche suivante. */
  const speaker = (g, t) => ((t + (g.gen % 2 ? 0 : 1)) % 2 ? "b" : "a");
  const talks = (g, t) => !g.duo || g.me === speaker(g, t);

  const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  const ranks = (x) => (Array.isArray(x) ? x.slice(0, MAXF).filter((i) => isInt(i, 0, MAXP)) : []);
  /* Le bilan du tour t, lu dans la tranche de qui a fait deviner (venue de l'autre téléphone, peut-être) : null s'il manque. */
  function rec(g, t) {
    const r = g.S[speaker(g, t)].r, x = r && typeof r === "object" ? r[t] : null;
    return x && typeof x === "object" && isInt(x.n, 0, MAXP) ? { f: ranks(x.f), p: ranks(x.p), n: x.n } : null;
  }
  /* Le rang de la première carte du tour t. */
  function first(g, t) {
    let i = 0;
    for (let j = 0; j < t; j++) { const x = rec(g, j); i = x ? Math.max(i, x.n) : i + SKIP; }
    return Math.min(i, MAXP);
  }
  /* Où en est la partie. sh vient parfois de l'autre téléphone : hors des valeurs connues, on reprend au début. */
  function state(g) {
    const T = isInt(g.sh.t, 0, TURNS) ? g.sh.t : 0, go = g.sh.go === 1 && T < TURNS;
    if (go && !rec(g, T)) return { t: T, ph: "jeu" };
    const n = go ? T + 1 : T;
    return { t: n, ph: n >= TURNS ? "fin" : "pret" };
  }
  function tally(g) {
    const o = { a: 0, b: 0, n: 0, rows: [] };
    for (let t = 0; t < TURNS; t++) { const x = rec(g, t), w = speaker(g, t); if (x) { o[w] += x.f.length; o.n += x.f.length; o.rows.push({ t, w, x }); } }
    return o;
  }
  /* Avancement de qui fait deviner au tour t, sur cet appareil. */
  function cur(g, t) {
    const c = g.local.c;
    return c && c.t === t && Array.isArray(c.f) && Array.isArray(c.p) && isInt(c.i, 0, MAXP) ? c : { t, f: [], p: [], i: first(g, t), at: 0 };
  }
  /* Le compte à mi-temps envoyé par qui fait deviner. */
  function mid(g, t) {
    const m = g.S[speaker(g, t)].m;
    return m && typeof m === "object" && m.t === t && isInt(m.f, 0, MAXF) ? m.f : -1;
  }
  /* Secondes restantes, comptées depuis l'instant où cet appareil a vu le tour commencer. */
  function left(g, t) {
    const x = g.local.t, now = Date.now();
    return dur(g) - (x && x.t === t && x.at <= now ? (now - x.at) / 1000 : 0);
  }
  /* 0 le chrono tourne, 1 temps écoulé, 2 écoulé depuis assez longtemps pour ne plus attendre le bilan. */
  const stage = (s) => (s <= -GRACE ? 2 : s <= 0 ? 1 : 0);
  /* Le score de la partie d'avant, rangé dans les réglages : deux petits entiers, ou rien. */
  function prev(g) {
    const p = g.setup.prev;
    return p && typeof p === "object" && isInt(p.a, 0, 999) && isInt(p.b, 0, 999) ? p : null;
  }
  /* Le record du couple sur cet appareil, un par durée : { n, k, was }, k la partie qui l'a établi, was le record d'avant. */
  function best(g) {
    const all = g.kit.store.get("interdit:best", null), b = all && typeof all === "object" ? all[dur(g)] : null;
    return b && typeof b === "object" && isInt(b.n, 0, 1e4) ? { n: b.n, k: b.k, was: isInt(b.was, -1, 1e4) ? b.was : -1 } : null;
  }
  function record(g, n) {
    const all = g.kit.store.get("interdit:best", null) || {}, b = best(g), k = token(g);
    const nb = !b ? { n, k, was: -1 } : b.k === k ? { n: Math.max(n, b.was), k, was: b.was } : n > b.n ? { n, k, was: b.n } : null;
    if (nb && (!b || nb.n !== b.n || nb.k !== b.k)) { all[dur(g)] = nb; g.kit.store.set("interdit:best", all); }
  }

  /* Fin du temps : vibration, bip, et un éclair de l'encre de qui faisait deviner, hors de l'écran de jeu. */
  function signal(g, w) {
    const el = document.createElement("div");
    el.className = "interdit-flash as-" + w;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
    g.kit.buzz([200, 100, 200]);
    g.kit.beep();
  }
  /* Le bilan du tour part : c'est la fin du chrono lancé sur cet appareil. */
  function finish(g, c) {
    const w = speaker(g, c.t), r = {};
    for (let j = 0; j < TURNS; j++) if (j !== c.t && speaker(g, j) === w) { const x = rec(g, j); if (x) r[j] = x; }
    r[c.t] = { f: c.f.slice(0, MAXF), p: c.p.slice(0, MAXF), n: Math.min(c.i + 1, MAXP) };
    c.done = 1;
    g.local.c = c;
    g.set(w, { r, m: null });
  }

  const esc = (g, s) => g.kit.esc(s);
  const step = (g, t, right) => '<div class="interdit-top"><p class="interdit-step">' + "Tour " + (t + 1) + " sur " + TURNS + "</p>" + (right || "") + "</div>";
  const total = (g) => '<p class="interdit-total">Total : <b>' + tally(g).n + "</b></p>";
  const word = (c) => c ? c.w.charAt(0).toUpperCase() + c.w.slice(1) : "";

  /* Bilan d'un tour : qui a fait deviner, combien, et les cartes, trouvées puis passées. */
  function recap(g, ids, t) {
    const k = g.kit, x = rec(g, t), w = speaker(g, t);
    if (!x) return '<div class="interdit-recap"><p>' + k.who(w) + " " + esc(g, "Le bilan de ce tour n'est pas arrivé.") + "</p></div>";
    const li = (i, ok) => '<li class="' + (ok ? "ok" : "no") + '"><span class="sr">' + (ok ? "Trouvé : " : "Passé : ") + "</span>" + esc(g, word(cardAt(ids, i))) + "</li>";
    return '<div class="interdit-recap"><p class="interdit-got">' + k.who(w) + " <b>" + esc(g, x.f.length ? k.pl(x.f.length, "mot trouvé", "mots trouvés") : "aucun mot trouvé") + "</b></p>" +
      (x.f.length + x.p.length ? '<ul class="interdit-words">' + x.f.map((i) => li(i, 1)).join("") + x.p.map((i) => li(i, 0)).join("") + "</ul>" : "") + "</div>";
  }
  function vReady(g, ids, t) {
    const k = g.kit, w = speaker(g, t), o = g.other(w), W = k.nm(w), O = k.nm(o), p = prev(g);
    const before = t ? '<p class="eyebrow">Bilan du tour ' + t + "</p>" + recap(g, ids, t - 1)
      : p ? '<p class="g-note">' + esc(g, "Partie précédente : " + k.pl(p.a + p.b, "mot trouvé", "mots trouvés") + " (" + k.nm("a") + " " + p.a + ", " + k.nm("b") + " " + p.b + ").") + "</p>" : "";
    /* Sur un seul téléphone, l'appareil passe d'abord à qui va faire deviner. */
    if (!g.duo && g.local.h !== t) return '<div class="interdit" data-screen="passe-' + t + '">' + step(g, t, total(g)) + before + k.pass(w, "moi") + "</div>";
    const talk = talks(g, t), oth = g.duo ? g.other(g.me) : "";
    const title = talk ? (g.duo ? "À toi de faire deviner." : W + " fait deviner, " + O + " devine.") : W + " fait deviner, tu devines.";
    const lead = talk ? "Tu as " + TIMES[dur(g)].toLowerCase() + " pour faire trouver un maximum de mots à " + O + ", sans dire les mots interdits." + (g.duo ? " " + O + " ne voit pas les cartes." : " Garde l'écran pour toi.")
      : "Le chrono démarre quand " + W + " touche « C'est parti ». Tu ne verras pas les cartes : écoute, et lance-toi.";
    return '<div class="interdit as-' + w + '" data-screen="pret-' + t + '">' + step(g, t, total(g)) + before +
      '<h1 class="g-title interdit-speaker" tabindex="-1" data-focus>' + esc(g, title) + '</h1><p class="g-lead">' + esc(g, lead) + "</p>" +
      (!talk ? k.wait(g, "En attente " + k.de(W) + "…")
        : g.duo && !g.here(oth) ? k.wait(g, "En attente " + k.de(k.nm(oth)) + "…")
          : '<div class="g-actions"><button class="btn" type="button" data-act="go">C\'est parti</button></div>') + "</div>";
  }
  function vTalk(g, ids, t) {
    const k = g.kit, w = speaker(g, t), c = cur(g, t), s = left(g, t), card = cardAt(ids, c.i);
    const head = step(g, t, '<p class="interdit-time" role="timer" aria-label="Secondes restantes"><b class="interdit-num">' + Math.max(0, Math.ceil(s)) + "</b> s</p>") +
      '<div class="interdit-bar" aria-hidden="true"><span style="width:' + (100 * Math.max(0, s) / dur(g)).toFixed(1) + '%"></span></div>';
    const count = '<p class="interdit-count">' + esc(g, k.pl(c.f.length, "trouvé", "trouvés") + " · " + k.pl(c.p.length, "passé", "passés")) + "</p>";
    if (s <= 0) return '<div class="interdit as-' + w + '" data-screen="jeu-' + t + '">' + head + '<h1 class="g-title" tabindex="-1" data-focus>Temps écoulé.</h1>' + count + "</div>";
    return '<div class="interdit as-' + w + '" data-screen="jeu-' + t + '">' + head +
      '<div class="g-card interdit-card" data-card="' + c.i + '"><p class="eyebrow">Fais deviner</p><h1 class="interdit-word" tabindex="-1" data-focus aria-live="polite">' + esc(g, word(card)) + "</h1>" +
      '<p class="interdit-ban">Sans dire</p><ul class="interdit-x">' + card.x.slice(0, 5).map((x) => "<li>" + esc(g, x) + "</li>").join("") + "</ul></div>" + count +
      '<div class="g-actions"><button class="btn alt" type="button" data-act="pass">Passer</button><button class="btn" type="button" data-act="ok">Trouvé</button></div></div>';
  }
  function vGuess(g, t) {
    const k = g.kit, w = speaker(g, t), W = k.nm(w), s = left(g, t), m = mid(g, t), st = stage(s);
    return '<div class="interdit as-' + w + '" data-screen="devine-' + t + '">' + step(g, t, total(g)) +
      '<h1 class="g-title interdit-speaker" tabindex="-1" data-focus>' + esc(g, W + " fait deviner.") + "</h1>" +
      '<div class="interdit-clock" role="timer" aria-label="Secondes restantes"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="interdit-track" cx="60" cy="60" r="54"/>' +
      (s > 0 ? '<circle class="interdit-ring" cx="60" cy="60" r="54" style="stroke-dashoffset:' + (RING * (1 - s / dur(g))).toFixed(1) + '"/>' : "") +
      '</svg><p class="g-big interdit-num">' + Math.max(0, Math.ceil(s)) + "</p></div>" +
      (s > 0 ? '<p class="g-lead">' + esc(g, m >= 0 ? "À mi-temps : " + k.pl(m, "mot trouvé", "mots trouvés") + "." : "Devine ! Les cartes restent sur le téléphone " + k.de(W) + ".") + "</p>"
        : '<p class="interdit-over" role="status">Temps écoulé.</p>' + (st < 2 ? k.wait(g, "En attente du bilan " + k.de(W) + "…")
          : '<p class="hint">' + esc(g, "Le bilan " + k.de(W) + " n'arrive pas. Il comptera s'il arrive plus tard.") + '</p><div class="g-actions"><button class="btn" type="button" data-act="skip">' +
            (t < TURNS - 1 ? "Passer au tour suivant" : "Voir le résultat") + "</button></div>")) + "</div>";
  }
  function vEnd(g, ids) {
    const k = g.kit, x = tally(g), b = best(g), was = !b ? -1 : b.k === token(g) ? b.was : b.n, rate = x.n / (TURNS * dur(g) / 60);
    const cell = (w) => "<div>" + k.who(w) + "<b>" + x[w] + "</b></div>";
    return '<div class="interdit" data-screen="fin"><p class="eyebrow">Résultat</p><p class="g-big">' + x.n + "<span> " + (x.n >= 2 ? "mots" : "mot") + "</span></p>" +
      '<h1 class="g-title" tabindex="-1" data-focus>' + LEVELS.find((l) => rate >= l[0])[1] + "</h1>" +
      '<p class="g-lead">' + (x.n > was && x.n > 0 ? "Nouveau record pour " + esc(g, TIMES[dur(g)].toLowerCase()) + " par tour."
        : was >= 0 ? "Votre record, " + esc(g, TIMES[dur(g)].toLowerCase()) + " par tour : " + esc(g, k.pl(was, "mot", "mots")) + "." : "") + "</p>" +
      '<div class="g-score">' + cell("a") + cell("b") + "</div>" +
      '<ul class="interdit-turns">' + x.rows.map((r) => '<li><span class="interdit-step">Tour ' + (r.t + 1) + "</span>" + k.who(r.w) + "<b>" + r.x.f.length + "</b></li>").join("") + "</ul>" +
      '<div class="g-actions"><button class="btn" type="button" data-act="again">Rejouer</button></div></div>';
  }

  (window.GAMES = window.GAMES || []).push({
    id: "interdit",
    v: 1,
    title: "Le mot interdit",
    hook: "Saurez-vous vous comprendre à demi-mot ?",
    blurb: "L'un fait deviner un mot sans prononcer les trois mots interdits, l'autre devine, chrono en main. Trois tours chacun, un seul score : le vôtre.",
    meta: (N ? N + " cartes · " : "") + "8 min",
    intro: [
      "Un mot à faire deviner, « parapluie », et trois mots qu'on n'a pas le droit de dire : pluie, ouvrir, mouillé. À toi de trouver un autre chemin, pendant que l'autre cherche à voix haute.",
      "Trouvé, un point ; trop dur, on passe. Au bout du temps, le téléphone sonne et les rôles s'inversent. Six tours, et vous jouez ensemble : tous les mots trouvés comptent pour le couple."
    ],
    glyph: '<rect class="ink-a" x="5" y="9" width="26" height="32" rx="5"/><circle class="ring-b" cx="31" cy="21" r="12"/><path class="ring-b" d="M22.5 29.5l17-17"/>',
    live: true,
    options: [{ id: "duree", label: "Durée d'un tour", def: "60", choices: ["45", "60", "90"].map((id) => ({ id, name: TIMES[id], hint: HINTS[id] })) }],
    view(g) {
      if (!N) return '<div class="interdit" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les cartes ne sont pas arrivées.</h1><p class="g-lead">Recharge la page : la partie reprendra où elle en était.</p></div>';
      const st = state(g), ids = deck(g).ids;
      if (st.ph === "fin") return vEnd(g, ids);
      if (st.ph === "pret") return vReady(g, ids, st.t);
      return talks(g, st.t) ? vTalk(g, ids, st.t) : vGuess(g, st.t);
    },
    act(g, name) {
      if (!N) return;
      const st = state(g), t = st.t, now = Date.now();
      if (name === "moi" && st.ph === "pret" && !g.duo) { g.local.h = t; g.save(); g.render(); }
      else if (name === "go" && st.ph === "pret" && talks(g, t) && (g.duo ? g.here(g.other(g.me)) : g.local.h === t)) {
        /* Le bip du départ obtient aussi le droit de sonner à la fin du temps : le navigateur ne l'accorde que pendant un geste. */
        g.kit.beep();
        g.local.t = { t, at: now };
        g.local.c = { t, f: [], p: [], i: first(g, t), at: now };
        g.share({ t, go: 1 });
      } else if ((name === "ok" || name === "pass") && st.ph === "jeu" && talks(g, t) && left(g, t) > 0) {
        const c = cur(g, t);
        if (c.done || now - (c.at || 0) < CARD || c.i >= MAXP - 1 || c.f.length + c.p.length >= MAXF) return;
        c[name === "ok" ? "f" : "p"].push(c.i);
        c.i++;
        c.at = now;
        g.local.c = c;
        g.save();
        g.render();
      } else if (name === "skip" && st.ph === "jeu" && g.duo && !talks(g, t) && stage(left(g, t)) === 2) g.share({ t: t + 1, go: 0 });
      else if (name === "again" && st.ph === "fin") {
        /* Les cartes tirées pendant cette manche vont au bout des déjà vues : elles reviendront les dernières. */
        const o = deck(g), used = Math.min(o.ids.length, first(g, TURNS)), x = tally(g);
        g.newGame({ vus: o.ids.slice(Math.max(used, o.fresh)).concat(o.ids.slice(0, used)), prev: { a: Math.min(x.a, 999), b: Math.min(x.b, 999) } });
      }
    },
    over(g) { return state(g).ph === "fin"; },
    mount(g, root) {
      const scr = root.querySelector(".interdit"), born = Date.now();
      if (!scr || !N) return;
      const st = state(g), name = scr.getAttribute("data-screen"), num = root.querySelector(".interdit-num");
      const ring = root.querySelector(".interdit-ring"), bar = root.querySelector(".interdit-bar span"), cardEl = root.querySelector(".interdit-card");
      const key = name + "/" + Array.from(scr.querySelectorAll("[data-act]"), (b) => b.getAttribute("data-act")).join();
      let e = g.local.e, dirty = false, timer = 0, lock = null, asked = false, off = false, seen = born;
      if (!e || e.n !== key) { e = g.local.e = { n: key, at: born }; dirty = true; }
      if (st.ph === "fin") record(g, tally(g).n);
      /* Les touchers qui suivent de trop près l'apparition de ces boutons visaient l'écran d'avant. */
      root.addEventListener("click", (ev) => {
        const age = Date.now() - e.at;
        if (ev.detail && age >= 0 && age < SETTLE) { ev.preventDefault(); ev.stopPropagation(); }
      }, true);
      /* Une nouvelle carte fait son entrée, pas un simple réaffichage. */
      if (cardEl) { const id = token(g) + ":" + cardEl.getAttribute("data-card"); if (id !== lastCard) { lastCard = id; cardEl.classList.add("is-new"); } }

      /* Le chrono suit le tour en cours ; sur l'appareil de qui fait deviner, il suit aussi un tour dont le bilan
         n'est pas encore parti (page rouverte après coup, ou l'autre est passé à la suite sans l'attendre). */
      const c0 = g.local.c, pend = c0 && !c0.done && isInt(c0.t, 0, TURNS - 1) && talks(g, c0.t) && !rec(g, c0.t) ? c0.t : -1;
      const t = st.ph === "jeu" ? st.t : pend;
      if (t < 0) { if (dirty) g.save(); return; }
      const w = speaker(g, t), talk = talks(g, t);
      let x = g.local.t;
      /* Première fois que cet appareil voit ce tour : son chrono part de maintenant. */
      if (!x || x.t !== t) { x = g.local.t = { t, at: born }; dirty = true; }
      /* Qui fait deviner a perdu son avancement (stockage vidé) : il reprend à la première carte du tour. */
      if (talk && st.ph === "jeu" && (!g.local.c || g.local.c.t !== t)) { g.local.c = { t, f: [], p: [], i: first(g, t), at: born }; dirty = true; }
      if (dirty) g.save();
      const drawn = stage(left(g, t));
      /* L'écran a vu le chrono tourner jusqu'à maintenant : rouvert ou réveillé après coup, il ne signale rien. */
      const live = () => !drawn && Date.now() - seen < 1500;
      const awake = () => {
        if (lock || asked || document.hidden || !navigator.wakeLock) return;
        asked = true;
        navigator.wakeLock.request("screen").then((l) => {
          asked = false;
          lock = l;
          l.addEventListener("release", () => { lock = null; });
          if (off) l.release();
        }, () => { /* refusé : tant pis */ });
      };
      const tick = () => {
        const s = left(g, t), now = stage(s), ok = live(), c = g.local.c;
        seen = Date.now();
        if (talk && c && c.t === t && !c.done) {
          if (s <= 0) { if (ok && !x.z) { x.z = 1; signal(g, w); } finish(g, c); return; }
          /* Une fois au plus, à mi-temps, le compte part vers l'écran de qui devine. */
          if (g.duo && !x.h && s <= dur(g) / 2) { x.h = 1; if (c.f.length) { g.set(g.me, { m: { t, f: c.f.length } }); return; } g.save(); }
        } else if (s <= 0 && !x.z) { x.z = 1; if (ok) signal(g, w); g.save(); }
        if (st.ph === "jeu" && now !== drawn) { g.render(); return; }
        if (now || !num) return;
        const n = String(Math.ceil(s));
        if (num.textContent !== n) num.textContent = n;
        if (ring) ring.style.strokeDashoffset = (RING * (1 - s / dur(g))).toFixed(1);
        if (bar) bar.style.width = (100 * s / dur(g)).toFixed(1) + "%";
        awake();
      };
      /* Premier passage juste après le rendu : il peut envoyer, donc réafficher, ce qui ne se fait pas pendant mount. */
      const soon = setTimeout(tick, 0);
      timer = setInterval(tick, 200);
      return () => {
        clearTimeout(soon);
        clearInterval(timer);
        off = true;
        if (lock) lock.release();
        /* L'autre téléphone a clos le tour à la fin de son chrono : celui d'ici n'arrivera jamais à zéro. */
        const to = state(g);
        if (live() && !x.z && g.local.t === x && (to.t !== t || to.ph !== "jeu") && left(g, t) < NEAR) { x.z = 1; signal(g, w); g.save(); }
      };
    }
  });
})();
