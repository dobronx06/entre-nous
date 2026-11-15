/* Le blind test du couple : une consigne, une chanson chacun en secret (titre, artiste et un indice),
   puis chacun devine la chanson de l'autre à partir de son indice. Cinq manches. Le site ne joue
   aucune musique : seuls des liens de recherche mènent aux chansons, à la fin.
   Tranche d'un joueur : { c: [[titre, artiste, indice] | null, …], d: [réponse | null, …], ok: { "2a": 1 } }.
   - c[r] : sa chanson de la manche r, envoyée une fois, quand il valide.
   - d[r] : sa réponse pour la chanson de l'autre à la manche r ; "" quand il donne sa langue au chat.
   - ok compte, réponse par réponse (manche + qui devine), les fois où le couple a contredit le verdict
     du jeu (« Ça compte », « Finalement non ») : le plus grand des deux compteurs décide, impair, le
     verdict est inversé. Chacun n'écrit que le sien : deux décisions simultanées ne s'écrasent pas.
   État commun : { n }, le nombre de révélations passées (deux par manche) : c'est lui qui fait avancer
   les deux téléphones ensemble. Sur l'appareil : g.local.go, le passage de téléphone déjà fait ;
   « chanson:listes », les dix dernières playlists (« Nos playlists »).
   Réglages : après un « Rejouer », deck (l'ordre des consignes) et at (où l'on en est), pour ne pas
   resservir les consignes qu'on vient de jouer. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.chanson) || {};
  const PROMPTS = (Array.isArray(DATA.prompts) ? DATA.prompts : []).filter((p) => typeof p === "string" && p.trim() && p.length <= 200);
  const ROUNDS = 5, STEPS = 2 * ROUNDS, LIST = "chanson:listes", KEEP = 10, LOCK = 500;
  const MAX = { t: 60, a: 50, h: 90, d: 80 };
  const LEVELS = [
    [9, "Vous vous connaissez par cœur, en musique aussi."],
    [6, "Une belle oreille pour l'autre."],
    [3, "Quelques jolies surprises au programme."],
    [0, "De quoi vous faire découvrir plein de chansons."]
  ];

  const int = (o, key) => { const n = o && typeof o === "object" ? o[key] : 0; return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; };
  const str = (x, max) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const token = (g) => (g.gen + ":" + g.setup.seed).slice(0, 40);
  const first = (r) => (r % 2 ? "b" : "a");
  const pos = (g) => (Number.isInteger(g.sh.n) && g.sh.n >= 0 && g.sh.n <= STEPS ? g.sh.n : 0);

  /* ---------- Comparer une réponse à une chanson ----------
     Casse, accents, articles en tête, pluriels et fautes de frappe ne comptent pas ; l'artiste et les
     petits mots (« par », « feat ») ajoutés au titre non plus. */
  const ARTICLE = /^(?:le|la|les|l|un|une|des|du|de|d|the|a|an)$/;
  const FILLER = /^(?:par|de|d|by|feat|ft|featuring|et|and|avec|x)$/;
  let WORD = /[a-z0-9]+/g;
  try { WORD = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}\\p{M}]*", "gu"); } catch (e) { /* alphabet latin seulement */ }
  function words(s) {
    const t = s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/&/g, " et ").normalize("NFD").replace(/[̀-ͯ]/g, "").match(WORD) || [];
    while (t.length > 1 && ARTICLE.test(t[0])) t.shift();
    return t.map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w));
  }
  function distance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const near = (x, y) => { const n = Math.min(x.length, y.length); return n >= 4 && distance(x, y) <= (n >= 16 ? 3 : n >= 8 ? 2 : 1); };
  /* 2 : c'est elle. 1 : c'est elle à une faute près, ou le titre se cache dans la réponse (le couple peut refuser). 0 : non. */
  function same(guess, s) {
    const g = words(guess), t = words(s.t).join(""), art = words(s.a);
    if (!g.length || !t) return 0;
    const all = g.join(""), rest = g.filter((w) => !FILLER.test(w) && art.indexOf(w) < 0).join("");
    if (all === t || rest === t || all === t + art.join("") || all === art.join("") + t) return 2;
    if (near(all, t) || (rest && near(rest, t)) || (art.length && near(all, t + art.join("")))) return 1;
    return t.length >= 4 && all.indexOf(t) >= 0 ? 1 : 0;
  }

  /* ---------- Lire l'état (tout peut venir de l'autre téléphone) ---------- */
  function songs(g, w) {
    const c = Array.isArray(g.S[w].c) ? g.S[w].c : [];
    return Array.from({ length: ROUNDS }, (_, r) => {
      const x = c[r];
      if (!Array.isArray(x)) return null;
      const t = str(x[0], MAX.t), h = str(x[2], MAX.h);
      return t && h ? { t, a: str(x[1], MAX.a), h } : null;
    });
  }
  const guesses = (g, w) => { const d = Array.isArray(g.S[w].d) ? g.S[w].d : []; return Array.from({ length: ROUNDS }, (_, r) => (typeof d[r] === "string" ? str(d[r], MAX.d) : null)); };
  const flips = (g, r, w) => Math.max(int(g.S.a.ok, r + w), int(g.S.b.ok, r + w));
  /* La réponse de w à la chanson de h, manche r. sure : rien à discuter (identique, ou langue au chat). */
  function result(g, r, h) {
    const s = songs(g, h)[r], w = g.other(h), d = guesses(g, w)[r];
    if (!s || d == null) return null;
    const m = d ? same(d, s) : 0, flip = !!d && m < 2 && flips(g, r, w) % 2 === 1;
    return { s, d, h, w, auto: m > 0, sure: !d || m === 2, flip, ok: (m > 0) !== flip };
  }
  /* Les révélations 0 à n - 1, dans l'ordre : deux par manche, celle du premier à choisir d'abord. */
  const giver = (p) => ((p >> 1) % 2 ? (p % 2 ? "a" : "b") : p % 2 ? "b" : "a");
  const score = (g, n, w) => { let k = 0; for (let p = 0; p < n; p++) { const h = giver(p), x = result(g, p >> 1, h); if (x && x.ok && (!w || x.w === w)) k++; } return k; };

  /* Les cinq consignes de la partie, dans le même ordre sur les deux téléphones ; « Rejouer » reprend
     la pile où l'on s'était arrêté. Remplies pour celui qui choisit : {o}, c'est l'autre. */
  function prompts(g) {
    if (PROMPTS.length < ROUNDS) return null;
    const all = g.kit.shuffle(PROMPTS, Number(g.setup.deck) || Number(g.setup.seed) || 1), at = int(g.setup, "at");
    return Array.from({ length: ROUNDS }, (_, i) => all[(at + i) % all.length]);
  }
  const ask = (g, q, w) => { const o = g.kit.nm(g.other(w)); return g.kit.fill(q, { o, de_o: g.kit.de(o) }); };

  /* Où en est la partie, pour l'écran comme pour les touchers. gate : sur un seul téléphone, l'appareil change de mains avant. */
  function where(g) {
    const list = prompts(g);
    if (!list) return { kind: "vide" };
    const p = pos(g);
    if (p >= STEPS) return { kind: "fin", list, p };
    const r = p >> 1, f = first(r), o = g.other(f), has = (w) => !!songs(g, w)[r];
    if (!has(f) || !has(o)) {
      if (g.duo) return { kind: has(g.me) ? "attente" : "ecrire", r, list, p, w: g.me };
      const w = has(f) ? o : f;
      return { kind: "ecrire", r, list, p, w, gate: r > 0 || w === o };
    }
    const h = giver(p), w = g.other(h), x = result(g, r, h);
    if (x) return { kind: "revele", r, list, p, h, w, x };
    if (g.duo && g.me === h) return { kind: "indice", r, list, p, h, w };
    return { kind: "devine", r, list, p, h, w, gate: !g.duo && p % 2 === 1 };
  }
  const gateKey = (st) => st.kind + "-" + st.r + "-" + st.w;

  /* ---------- La playlist : celle de la partie, et celles gardées sur l'appareil ---------- */
  const okSong = (x) => !!x && typeof x === "object" && str(x.t, MAX.t) && str(x.h, MAX.h) ? { t: str(x.t, MAX.t), a: str(x.a, MAX.a), h: str(x.h, MAX.h) } : null;
  function lists(k) {
    const x = k.store.get(LIST, []);
    return (Array.isArray(x) ? x : []).slice(0, KEEP).map((e) => {
      if (!e || typeof e !== "object" || typeof e.k !== "string" || !Array.isArray(e.n) || !Array.isArray(e.r)) return null;
      const r = e.r.slice(0, ROUNDS).map((y) => (y && Array.isArray(y.q) && okSong(y.a) && okSong(y.b) ? { q: [str(y.q[0], 300), str(y.q[1], 300)], a: okSong(y.a), b: okSong(y.b) } : null)).filter(Boolean);
      return r.length ? { k: e.k.slice(0, 40), at: Number.isFinite(e.at) ? e.at : 0, n: [str(e.n[0], 20) || "Partenaire 1", str(e.n[1], 20) || "Partenaire 2"], r } : null;
    }).filter(Boolean);
  }
  function entry(g) {
    const list = prompts(g), A = songs(g, "a"), B = songs(g, "b");
    if (!list || A.indexOf(null) >= 0 || B.indexOf(null) >= 0) return null;
    return { k: token(g), at: Date.now(), n: [g.kit.nm("a"), g.kit.nm("b")], r: list.map((q, r) => ({ q: [ask(g, q, "a"), ask(g, q, "b")], a: A[r], b: B[r] })) };
  }
  const search = (s) => encodeURIComponent(s.t + (s.a ? " " + s.a : ""));
  const links = (k, s) => '<p class="chanson-links"><a class="g-link" href="https://www.youtube.com/results?search_query=' + k.esc(search(s)) + '" target="_blank" rel="noopener" aria-label="' +
    k.esc("Chercher « " + s.t + " » sur YouTube (nouvel onglet)") + '">YouTube</a><a class="g-link" href="https://open.spotify.com/search/' + k.esc(search(s)) + '" target="_blank" rel="noopener" aria-label="' +
    k.esc("Chercher « " + s.t + " » sur Spotify (nouvel onglet)") + '">Spotify</a></p>';
  const pill = (k, w, name) => '<span class="g-who ' + w + '"><i class="sw ' + w + '"></i>' + k.esc(name) + "</span>";
  function plist(k, e) {
    return '<ol class="chanson-list">' + e.r.map((y) => {
      const one = y.q[0] === y.q[1];
      const song = (w, i) => '<div class="chanson-song">' + pill(k, w, e.n[i]) + (one ? "" : '<p class="chanson-q">' + k.esc(y.q[i]) + "</p>") +
        '<p class="chanson-title">' + k.esc(y[w].t) + (y[w].a ? ' <span class="chanson-artist">' + k.esc("— " + y[w].a) + "</span>" : "") + '</p><p class="chanson-hint">' + k.esc("« " + y[w].h + " »") + "</p>" + links(k, y[w]) + "</div>";
      return "<li>" + (one ? '<p class="chanson-q">' + k.esc(y.q[0]) + "</p>" : "") + song("a", 0) + song("b", 1) + "</li>";
    }).join("") + "</ol>";
  }
  const day = (at) => { try { return new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
  function text(e) {
    return "Notre playlist · Le blind test du couple\n" + e.n[0] + " et " + e.n[1] + (e.at ? ", " + day(e.at) : "") + "\n" + e.r.map((y, i) => "\n" + (i + 1) + ". " + y.q[0] + "\n" +
      ["a", "b"].map((w, j) => (y.q[0] === y.q[1] || !j ? "" : "   (" + y.q[1] + ")\n") + "   " + e.n[j] + " : " + y[w].t + (y[w].a ? " — " + y[w].a : "") + "\n   « " + y[w].h + " »").join("\n")).join("\n") + "\n";
  }
  const copyRow = (i) => '<div class="chanson-copy"><button class="btn small alt" type="button" data-act="copier"' + (i != null ? ' data-i="' + i + '"' : "") + '>Copier la playlist</button>' +
    '<span class="chanson-msg" role="status"></span><textarea class="g-field chanson-text" readonly hidden aria-label="La playlist, à copier"></textarea></div>';
  function copy(el, t) {
    const box = el.closest(".chanson-copy"), msg = box.querySelector(".chanson-msg"), ta = box.querySelector("textarea");
    const ok = () => { msg.textContent = "Copiée : colle-la dans un message ou une note."; };
    const manual = () => {
      ta.value = t;
      ta.hidden = false;
      ta.focus();
      ta.select();
      let done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      if (done) ok(); else msg.textContent = "La playlist est affichée juste en dessous : sélectionne-la, puis copie-la.";
    };
    try { navigator.clipboard.writeText(t).then(ok, manual); } catch (e) { manual(); }
  }
  /* Deux touchers pour ce qui ne se rattrape pas. */
  function sure(el, label) {
    if (el.getAttribute("data-armed") && Date.now() - Number(el.getAttribute("data-armed")) >= 450) return true;
    if (el.getAttribute("data-armed")) return false;
    const was = el.textContent;
    el.setAttribute("data-armed", String(Date.now()));
    el.textContent = label;
    setTimeout(() => { if (el.isConnected) { el.removeAttribute("data-armed"); el.textContent = was; } }, 4000);
    return false;
  }

  /* ---------- Écrans ---------- */
  const top = (g, r, right) => '<div class="chanson-top"><p class="chanson-step">' + (!r && g.gen > 1 && !right ? "Nouvelle partie · " : "") + "Manche " + (r + 1) + " sur " + ROUNDS + "</p>" + (right || "") +
    '</div><div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + STEPS + '" aria-valuenow="' + pos(g) + '"><span style="width:' + (100 * pos(g)) / STEPS + '%"></span></div>';
  const keyOf = (g, st, f) => "ch-" + token(g) + "-" + st.r + "-" + st.w + "-" + f;
  const field = (g, st, f, label, max, ph) => '<label class="chanson-label"><span>' + label + '</span><input class="g-field" name="' + f + '" data-keep="' + g.kit.esc(keyOf(g, st, f)) + '" maxlength="' + max +
    '" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next"' + (ph ? ' placeholder="' + ph + '"' : "") + "></label>";

  function vWrite(g, st) {
    const k = g.kit, w = st.w, q = ask(g, st.list[st.r], w), o = k.nm(g.other(w)), done = !!songs(g, g.other(w))[st.r];
    return '<div class="chanson as-' + w + '" data-screen="ecrire-' + st.r + "-" + w + '">' + top(g, st.r) + '<p class="chanson-who">' + k.who(w) + " choisit</p>" +
      '<h1 class="g-title" tabindex="-1" data-focus>' + k.esc(q) + '</h1><form class="chanson-form" data-form="chanson">' +
      field(g, st, "titre", "Titre", MAX.t) + field(g, st, "artiste", "Artiste ou groupe <i>(facultatif)</i>", MAX.a) + field(g, st, "indice", "Ton indice", MAX.h, "Pourquoi elle, sans dire le titre") +
      '<p class="hint">' + k.esc(o + " devra la retrouver grâce à ton indice" + (done ? ", et a déjà choisi la sienne." : (g.duo ? ". Ta chanson reste cachée jusque-là." : ". Ensuite, passe-lui le téléphone."))) + "</p>" +
      '<div class="g-actions"><button class="btn" type="submit">Valider</button></div></form></div>';
  }

  function vWait(g, st) {
    const k = g.kit, s = songs(g, g.me)[st.r], o = k.nm(g.other(g.me));
    return '<div class="chanson as-' + g.me + '" data-screen="attente-' + st.r + '">' + top(g, st.r) + '<h1 class="g-title">' + k.esc(ask(g, st.list[st.r], g.me)) +
      '</h1><p class="g-lead" tabindex="-1" data-focus>Ta chanson : <b>' + k.esc(s.t) + "</b></p>" + k.wait(g, "En attente de la chanson " + k.de(o) + "…") +
      '<p class="hint">Tu peux fermer la page : la partie reprendra ici.</p></div>';
  }

  /* L'indice de h, que w doit deviner ; sur deux téléphones, h voit la même carte et attend. */
  function vGuess(g, st, mine) {
    const k = g.kit, s = songs(g, st.h)[st.r], H = k.nm(st.h), W = k.nm(st.w);
    const card = '<div class="g-card ' + st.h + ' chanson-card"><p class="eyebrow">' + k.esc(mine ? "Ton indice" : "L'indice " + k.de(H)) + '</p><p class="g-card-text">' + k.esc("« " + s.h + " »") + "</p></div>";
    const q = '<p class="chanson-q">' + k.esc((mine ? "Ta consigne : " : "La consigne " + k.de(H) + " : ") + ask(g, st.list[st.r], st.h)) + "</p>";
    if (mine) {
      return '<div class="chanson as-' + st.h + '" data-screen="indice-' + st.p + '">' + top(g, st.r) + '<h1 class="g-title" tabindex="-1" data-focus>' + k.esc(W + " cherche ta chanson.") + "</h1>" + q + card +
        '<p class="g-lead">Ta chanson : <b>' + k.esc(s.t) + "</b></p>" + k.wait(g, "En attente de la réponse " + k.de(W) + "…") + "</div>";
    }
    return '<div class="chanson as-' + st.w + '" data-screen="devine-' + st.p + '">' + top(g, st.r) + '<p class="chanson-who">' + k.who(st.w) + " devine</p>" +
      '<h1 class="g-title" tabindex="-1" data-focus>' + k.esc("Quelle est la chanson " + k.de(H) + " ?") + "</h1>" + q + card +
      '<form class="chanson-form" data-form="devine"><label class="chanson-label"><span>Ta réponse</span><input class="g-field" name="devine" data-keep="' + k.esc(keyOf(g, st, "devine")) + '" maxlength="' + MAX.d +
      '" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Le titre suffit"></label>' +
      '<p class="chanson-chat"><button class="link g-link" type="button" data-act="chat">Je donne ma langue au chat</button></p>' +
      '<div class="g-actions"><button class="btn" type="submit">Valider</button></div></form></div>';
  }

  function vReveal(g, st) {
    const k = g.kit, x = st.x, H = k.nm(st.h), W = k.nm(st.w), last = st.p === STEPS - 1;
    const butt = x.sure ? "" : '<div class="chanson-ask"><p class="hint">' +
      (x.flip ? (x.auto ? "Vous avez décidé que ça ne comptait pas." : "Vous avez décidé que ça comptait.") : x.auto ? "Pas tout à fait la même ?" : "C'était presque ça ?") +
      '</p><button class="link g-link" type="button" data-act="force" data-on="' + (x.flip ? 0 : 1) + '">' + (x.flip ? (x.auto ? "Finalement si" : "Finalement non") : x.auto ? "On ne compte pas" : "Ça compte") + "</button></div>";
    const next = last ? "Voir la playlist" : st.p % 2 ? "Manche suivante" : "Au tour " + k.de(W) + " de deviner";
    return '<div class="chanson as-' + st.h + '" data-screen="revele-' + st.p + '">' + top(g, st.r, '<p class="chanson-score">Trouvées : <b>' + score(g, st.p + 1) + "</b></p>") +
      '<div class="g-card ' + st.h + ' chanson-card chanson-reveal">' + k.who(st.h) + '<p class="g-card-text">' + k.esc(x.s.t) + "</p>" + (x.s.a ? '<p class="chanson-artist">' + k.esc(x.s.a) + "</p>" : "") +
      '<p class="chanson-hint">' + k.esc("« " + x.s.h + " »") + "</p></div>" +
      '<p class="chanson-guess">' + (x.d ? k.esc("Réponse " + k.de(W) + " : « " + x.d + " »") : k.esc(W + " a donné sa langue au chat.")) + "</p>" +
      '<h1 class="g-title chanson-verdict" tabindex="-1" data-focus>' + (x.ok ? "Trouvé." : "Pas cette fois.") + "</h1>" + butt +
      '<div class="g-actions"><button class="btn" type="button" data-act="next" data-n="' + st.p + '">' + k.esc(next) + "</button></div></div>";
  }

  function vEnd(g) {
    const k = g.kit, n = score(g, STEPS), e = entry(g);
    const per = (w) => k.nm(w) + " en a trouvé " + score(g, STEPS, w);
    return '<div class="chanson" data-screen="resultat"><p class="eyebrow">Fin de la partie</p><p class="g-big">' + n + "<span> / " + STEPS + '</span></p><h1 class="g-title" tabindex="-1" data-focus>' +
      LEVELS.find((l) => n >= l[0])[1] + '</h1><p class="g-lead">' + k.esc(per("a") + ", " + per("b") + ".") + "</p>" +
      (e ? '<h2 class="chanson-h2">La playlist de la soirée</h2>' + plist(k, e) + copyRow() +
        '<p class="hint">Elle est gardée sur cet appareil : retrouvez-la dans «\u00a0Nos playlists\u00a0», sur la page du jeu.</p>' : "") +
      '<div class="g-actions"><button class="btn" type="button" data-act="again">Rejouer</button></div></div>';
  }

  /* Écran affiché : son nom, depuis quand (les touchers qui suivent de trop près visaient l'ancien), et la dernière décision du couple. */
  let shown = { name: "", at: 0, flip: false, flipAt: 0 };

  (window.GAMES = window.GAMES || []).push({
    id: "chanson",
    v: 1,
    title: "Le blind test du couple",
    hook: "Est-ce que tu reconnaîtrais ma chanson ?",
    blurb: "Une consigne, une chanson chacun en secret et un indice. L'autre devine, et la soirée finit en playlist.",
    meta: "5 manches · 15 min",
    intro: [
      "« Une chanson qui te fait penser à l'autre », « La chanson de notre été » : à chaque manche, chacun choisit une chanson en secret et écrit un indice, en une ligne, pour dire pourquoi.",
      "Puis l'autre lit ton indice et tente de trouver la chanson, ou donne sa langue au chat. Rien ne joue de musique ici : à la fin, vous repartez avec la playlist de la soirée."
    ],
    glyph: '<circle class="ink-a" cx="15" cy="34" r="8"/><circle class="ink-b" cx="33" cy="30" r="8"/><path class="ring-a" d="M23 34V10l18-4v24"/>',
    live: false,
    view(g) {
      const st = where(g);
      if (st.kind === "vide") return '<div class="chanson" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les consignes ne sont pas arrivées.</h1><p class="g-lead">Recharge la page : la partie reprendra où elle en était.</p></div>';
      if (st.kind === "fin") return vEnd(g);
      if (st.gate && g.local.go !== gateKey(st)) {
        return '<div class="chanson" data-screen="passe-' + gateKey(st) + '">' + g.kit.pass(st.w, "go") + '<p class="hint">' +
          g.kit.esc(st.kind === "ecrire" ? "Choisis ta chanson sans que " + g.kit.nm(g.other(st.w)) + " regarde." : "À toi de deviner la chanson " + g.kit.de(g.kit.nm(st.h)) + ".") + "</p></div>";
      }
      if (st.kind === "ecrire") return vWrite(g, st);
      if (st.kind === "attente") return vWait(g, st);
      if (st.kind === "revele") return vReveal(g, st);
      return vGuess(g, st, st.kind === "indice");
    },
    submit(g, form) {
      const st = where(g), val = (n) => { const f = form.querySelector('[name="' + n + '"]'); return f ? str(f.value, MAX[n === "titre" ? "t" : n === "artiste" ? "a" : n === "indice" ? "h" : "d"]) : ""; };
      const need = (n) => { const f = form.querySelector('[name="' + n + '"]'); if (f) f.focus(); };
      if (st.gate && g.local.go !== gateKey(st)) return;
      if (st.kind === "ecrire" && form.getAttribute("data-form") === "chanson") {
        const t = val("titre"), h = val("indice");
        if (!t) return need("titre");
        if (!h) return need("indice");
        const c = songs(g, st.w).map((s) => (s ? [s.t, s.a, s.h] : null));
        c[st.r] = [t, val("artiste"), h];
        g.set(st.w, { c });
      } else if (st.kind === "devine" && form.getAttribute("data-form") === "devine") {
        const d = val("devine");
        if (!d) return need("devine");
        const list = guesses(g, st.w);
        list[st.r] = d;
        g.set(st.w, { d: list });
      }
    },
    act(g, name, el) {
      const st = where(g);
      if (name === "go" && st.gate) {
        g.local.go = gateKey(st);
        g.save();
        g.render();
      } else if (name === "chat" && st.kind === "devine" && !(st.gate && g.local.go !== gateKey(st))) {
        const list = guesses(g, st.w);
        list[st.r] = "";
        g.set(st.w, { d: list });
      } else if (name === "next" && st.kind === "revele" && el.getAttribute("data-n") === String(st.p)) {
        g.share({ n: st.p + 1 });
      } else if (name === "force" && st.kind === "revele" && !st.x.sure) {
        /* Déjà décidé ainsi (l'autre vient de toucher le même bouton), ou le bouton vient de changer de sens : rien. */
        if (st.x.flip === (el.getAttribute("data-on") === "1") || Date.now() - shown.flipAt < 1000) return;
        const me = g.me || "a", ok = {};
        for (let r = 0; r < ROUNDS; r++) ["a", "b"].forEach((w) => { if (int(g.S[me].ok, r + w)) ok[r + w] = int(g.S[me].ok, r + w); });
        ok[st.r + st.w] = flips(g, st.r, st.w) + 1;
        g.set(me, { ok });
      } else if (name === "again" && st.kind === "fin") {
        g.newGame({ deck: Number(g.setup.deck) || Number(g.setup.seed) || 1, at: (int(g.setup, "at") + ROUNDS) % PROMPTS.length });
      } else if (name === "copier" && st.kind === "fin") {
        const e = entry(g);
        if (e) copy(el, text(e));
      }
    },
    over(g) { return pos(g) >= STEPS; },
    mount(g, root) {
      const scr = root.querySelector(".chanson"), name = (scr && scr.getAttribute("data-screen")) + "|" + token(g), now = Date.now(), st = where(g);
      const flip = st.kind === "revele" && st.x.flip;
      if (name !== shown.name) {
        shown = { name, at: now, flip, flipAt: 0 };
        const card = root.querySelector(".chanson-reveal");
        if (card) card.classList.add("is-new");
      } else if (flip !== shown.flip) { shown.flip = flip; shown.flipAt = now; }
      /* Un écran tout juste apparu ignore les touchers : le second d'un double toucher visait l'ancien. */
      const guard = (e) => {
        if (Date.now() - shown.at >= LOCK || !e.target.closest || !e.target.closest("[data-act]")) return;
        e.stopPropagation();
        e.preventDefault();
      };
      root.addEventListener("click", guard, true);
      const field = root.querySelector(".chanson-form .g-field");
      if (field && document.activeElement !== field && !root.querySelector(".chanson-form .g-field:focus")) { try { field.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
      /* Dès que les dix chansons sont connues, la playlist rejoint « Nos playlists » sur cet appareil. */
      const e = entry(g);
      if (e) {
        const all = lists(g.kit);
        if (!all.some((x) => x.k === e.k)) g.kit.store.set(LIST, [e].concat(all).slice(0, KEEP));
      }
      return () => root.removeEventListener("click", guard, true);
    },
    extra(k) {
      const all = lists(k);
      return all.length ? '<details class="more chanson-keep"><summary>Nos playlists <span class="g-tag">' + all.length + '</span></summary><p class="hint">' +
        k.esc("Les chansons de vos dernières parties, gardées sur cet appareil.") + "</p>" + all.map((e, i) => '<details class="chanson-old"><summary>' + k.esc(((e.at && day(e.at)) || "Une partie") + " · " + e.n[0] + " et " + e.n[1]) +
          "</summary>" + plist(k, e) + copyRow(i) + "</details>").join("") + '<p><button class="link g-link" type="button" data-act="vider">Vider la liste</button></p></details>' : "";
    },
    extraAct(k, name, el) {
      if (name === "copier") {
        const e = lists(k)[parseInt(el.getAttribute("data-i"), 10)];
        if (e) copy(el, text(e));
      } else if (name === "vider" && sure(el, "Toucher encore pour tout effacer")) {
        const box = el.closest("[data-extra]");
        k.store.del(LIST);
        box.innerHTML = '<p class="hint" role="status" tabindex="-1">La liste est vide.</p>';
        box.firstChild.focus();
      }
    }
  });
})();
