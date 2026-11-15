/* Tu préfères ? : douze dilemmes. Pour chacun, on choisit pour soi, puis on devine ce que l'autre a choisi.
   Tranche d'un joueur : { v: "0110…" }, 24 caractères envoyés en une seule fois quand il a fini :
   pour le dilemme i, v[2i] est son choix (0 l'option a, 1 l'option b) et v[2i+1] ce qu'il devine de l'autre.
   D'ici là, ses réponses restent un brouillon sur l'appareil (g.local.d, même forme) ; g.local.go note,
   sur un seul téléphone, que le second joueur a repris l'appareil. L'état commun ne sert pas.
   Réglages : pack ; après un « Rejouer », deck (la seed de la première partie) et at (où en est chaque
   paquet), pour ne pas resservir les mêmes dilemmes, et prev, le résultat de la partie d'avant : le
   téléphone dont le joueur ne l'a pas quitté lui-même le garde à l'écran jusqu'à ce qu'il passe à la suite.
   Sur l'appareil : « prefere:vu », le dernier résultat quitté. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.prefere) || {};
  const ok = (x) => typeof x === "string" && x.length > 0 && x.length <= 120;
  const PACKS = (Array.isArray(DATA.packs) ? DATA.packs : []).filter((p) => p && /^[a-z0-9]+$/.test(p.id || "") && Array.isArray(p.items) && p.items.length &&
    p.items.every((it) => it && ok(it.a) && ok(it.b)));
  const N = 12, LEN = 2 * N, SEEN = "prefere:vu";
  const MIX = [["absurde", 6], ["nous", 6]];
  /* Un écran qui vient d'apparaître ignore les touchers une fraction de seconde : le doigt visait l'ancien. */
  const LOCK = 350;
  let screen = "", lock = 0;

  const pack = (id) => PACKS.find((p) => p.id === id);
  const int = (o, key) => { const n = o && typeof o === "object" ? o[key] : 0; return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; };
  const seedOf = (g) => Number(g.setup.seed) || 1;
  const tok = (g) => (g.gen + ":" + g.setup.seed).slice(0, 40);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* Ce que la partie prend dans chaque paquet : le mélange ne puise jamais dans le paquet pour adultes. */
  const plan = (g) => (pack(g.setup.pack) ? [[g.setup.pack, N]] : MIX);
  /* Les douze dilemmes, [paquet, numéro], tirés pareil sur les deux téléphones. Chaque paquet garde le même
     ordre d'une partie à l'autre (deck) et « Rejouer » y reprend où l'on s'était arrêté (at). */
  function refs(g) {
    const k = g.kit, deck = Number(g.setup.deck) || seedOf(g);
    let list = [];
    plan(g).forEach(([id, n]) => {
      const p = pack(id), all = p ? k.shuffle(p.items.map((_, i) => i), deck + PACKS.indexOf(p)) : [];
      for (let i = 0; i < Math.min(n, all.length); i++) list.push([id, all[(int(g.setup.at, id) + i) % all.length]]);
    });
    if (!pack(g.setup.pack)) list = k.shuffle(list, seedOf(g));
    return list.length === N ? list : [];
  }
  const item = (r) => pack(r[0]).items[r[1]];

  /* Des réponses ne comptent que complètes et bien formées : tout le reste veut dire « pas fini ». */
  const good = (v) => typeof v === "string" && v.length === LEN && /^[01]+$/.test(v);
  const vec = (g, w) => (good(g.S[w].v) ? g.S[w].v : null);
  const draft = (g) => (typeof g.local.d === "string" && /^[01]*$/.test(g.local.d) ? g.local.d.slice(0, LEN) : "");
  /* Sur un seul téléphone, qui commence change à chaque partie : l'appareil est chez qui vient de finir. */
  const first = (g) => (g.gen % 2 ? "a" : "b");
  function turn(g) {
    if (g.duo) return vec(g, g.me) ? null : g.me;
    const f = first(g);
    return !vec(g, f) ? f : !vec(g, g.other(f)) ? g.other(f) : null;
  }

  /* Le résultat d'avant, joint par qui a relancé : vérifié comme tout ce qui vient de l'autre téléphone. */
  function prev(g) {
    const p = g.setup.prev;
    if (!p || typeof p !== "object" || typeof p.k !== "string" || p.k.length > 40 || !good(p.a) || !good(p.b) || !Array.isArray(p.q) || p.q.length !== N) return null;
    const list = p.q.map((x) => {
      const m = typeof x === "string" ? /^([a-z0-9]{1,20})\.(\d{1,4})$/.exec(x) : null, pk = m && pack(m[1]);
      return pk && +m[2] < pk.items.length ? [pk.id, +m[2]] : null;
    });
    return list.every(Boolean) ? { k: p.k, list, a: p.a, b: p.b } : null;
  }
  const past = (g) => { const p = prev(g); return p && g.kit.store.get(SEEN, "") !== p.k ? p : null; };

  /* ---------- Écrans ---------- */
  const head = (g, w, word, at, done) => '<p class="prefere-head">' + g.kit.who(w) + "<span>" + word + '</span><span class="prefere-count">' + at + " / " + N + "</span></p>" +
    '<div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + N + '" aria-valuenow="' + done + '"><span style="width:' + (100 * done) / N + '%"></span></div>';

  /* Un dilemme, en deux temps : mon choix, puis ce que je crois que l'autre a choisi. */
  function vAsk(g, list, w, d) {
    const k = g.kit, i = Math.floor(d.length / 2), guess = d.length % 2 === 1, it = item(list[i]), o = k.nm(g.other(w));
    const btn = (x) => '<button class="prefere-opt' + (x ? " b" : "") + '" type="button" data-act="pick" data-k="' + x + '">' + k.esc(x ? it.b : it.a) + "</button>";
    return '<div class="prefere as-' + w + (guess ? " is-guess" : "") + '" data-screen="q-' + w + "-" + i + "-" + (guess ? 1 : 0) + '">' + head(g, w, guess ? "devine" : "choisit", i + 1, i) +
      '<h1 class="g-title" tabindex="-1" data-focus>' + (guess ? k.esc("Et " + o + " ?") : "Tu préfères…") + "</h1>" +
      (guess ? '<p class="hint">Ton choix\u00a0: <b>' + k.esc(d[d.length - 1] === "1" ? it.b : it.a) + "</b>. " + k.esc("Devine celui " + k.de(o) + ".") + "</p>" : "") +
      '<div class="prefere-opts">' + btn(0) + '<span class="prefere-or" aria-hidden="true">ou</span>' + btn(1) + "</div>" +
      (d ? '<p class="prefere-more"><button class="link" type="button" data-act="undo">Revenir en arrière</button></p>' : "") + "</div>";
  }

  /* Avant l'envoi, un dernier écran : c'est le seul endroit d'où les réponses partent, et on peut encore en revenir. */
  function vEnd(g, w) {
    const k = g.kit, o = k.nm(g.other(w)), last = !g.duo && w !== first(g);
    return '<div class="prefere as-' + w + '" data-screen="fin-' + w + '">' + head(g, w, "a fini", N, N) + '<h1 class="g-title" tabindex="-1" data-focus>C\'était le dernier.</h1><p class="g-lead">' +
      k.esc(last ? "Valide, et découvrez le résultat ensemble." : g.duo ? "Valide pour envoyer tes réponses : " + o + " ne les verra qu'une fois les siennes données." : "Valide, puis passe le téléphone à " + o + " : tes réponses resteront cachées jusqu'au résultat.") +
      '</p><div class="g-actions"><button class="btn" type="button" data-act="send">Valider mes réponses</button><p class="prefere-more"><button class="link" type="button" data-act="undo">Revenir au dernier choix</button></p></div></div>';
  }

  function vWait(g) {
    const k = g.kit, o = k.nm(g.other(g.me));
    return '<div class="prefere as-' + g.me + '" data-screen="attente"><h1 class="g-title" tabindex="-1" data-focus>C\'est noté.</h1><p class="g-lead">' +
      k.esc("Le résultat s'ouvrira ici dès " + k.que(o) + " aura fini. Tu peux fermer la page et revenir plus tard : rien ne se perd.") + "</p>" +
      k.wait(g, "En attente des réponses " + k.de(o) + "…") + "</div>";
  }

  /* Une ligne du récapitulatif : les deux options, chacune marquée de qui l'a choisie. */
  function row(k, it, i, a, b) {
    const ca = a[2 * i], cb = b[2 * i], missA = a[2 * i + 1] !== cb, missB = b[2 * i + 1] !== ca;
    const line = (x) => {
      const who = ["a", "b"].filter((w) => (w === "a" ? ca : cb) === x);
      return '<p class="prefere-line' + (who.length ? "" : " is-off") + '"><span class="prefere-dots" aria-hidden="true">' + who.map((w) => '<i class="sw ' + w + '"></i>').join("") + "</span><span>" +
        (who.length ? '<span class="sr">' + k.esc((who.length > 1 ? "Votre choix à tous les deux" : "Le choix " + k.de(k.nm(who[0]))) + " : ") + "</span>" : "") + k.esc(cap(x === "1" ? it.b : it.a)) + "</span></p>";
    };
    const note = missA || missB ? '<p class="prefere-note">' + k.esc(missA && missB ? "Surprise pour vous deux." : "Surprise pour " + k.nm(missA ? "a" : "b") + ".") + "</p>" : "";
    return "<li>" + line("0") + line("1") + note + "</li>";
  }

  function vResult(g, list, a, b, old) {
    const k = g.kit, A = k.nm("a"), B = k.nm("b"), idx = list.map((_, i) => i);
    const hit = (v, u) => idx.filter((i) => v[2 * i + 1] === u[2 * i]).length;
    const sa = hit(a, b), sb = hit(b, a), same = idx.filter((i) => a[2 * i] === b[2 * i]).length;
    const miss = (i) => a[2 * i + 1] !== b[2 * i] || b[2 * i + 1] !== a[2 * i];
    const title = sa === N && sb === N ? "Vous lisez dans vos pensées." : sa === sb ? "Égalité parfaite." : (sa > sb ? A : B) + " devine le mieux.";
    const cell = (w, n) => '<div class="as-' + w + '">' + k.who(w) + "<b>" + n + "<span> / " + N + "</span></b><span>" + k.esc("choix " + k.de(w === "a" ? B : A) + " bien devinés") + "</span></div>";
    const part = (cls, label, text, ids) => (ids.length ? '<section class="prefere-part ' + cls + '"><h2>' + label + ' <span class="g-tag">' + ids.length + '</span></h2><p class="hint">' + k.esc(text) +
      '</p><ul class="prefere-list">' + ids.map((i) => row(k, item(list[i]), i, a, b)).join("") + "</ul></section>" : "");
    const cur = pack(g.setup.pack) ? g.setup.pack : "melange";
    const choice = (id, name, adult) => '<button class="g-choice" type="button" data-act="again" data-pack="' + k.esc(id) + '"' + (cur === id && !old ? ' aria-current="true"' : "") + "><b>" + k.esc(name) +
      (adult ? ' <span class="g-tag">Adultes</span>' : "") + "</b></button>";
    const end = old
      ? '<div class="g-actions"><p class="hint">La partie suivante est déjà lancée.</p><button class="btn" type="button" data-act="ok">Passer à la partie suivante</button></div>'
      : '<div class="g-opts"><p class="g-opts-label">Rejouer avec</p><div class="g-choices">' + choice("melange", "Mélange") + PACKS.map((p) => choice(p.id, p.name, p.adult === true)).join("") + "</div>" +
        (g.duo ? '<p class="hint" role="status">' + k.esc("La nouvelle partie démarre aussi chez " + k.nm(g.other(g.me)) + ".") + "</p>" : "") + "</div>";
    return '<div class="prefere" data-screen="resultat"><p class="eyebrow">' + (old ? "Partie précédente" : "Résultat") + '</p><h1 class="g-title" tabindex="-1" data-focus>' + k.esc(title) + '</h1><p class="g-lead">' +
      k.esc(same === N ? "Vous avez fait le même choix à chaque fois." : same ? "Vous avez fait le même choix " + same + " fois sur " + N + "." : "Vous n'avez jamais fait le même choix. Les contraires s'attirent.") + '</p><div class="g-score">' + cell("a", sa) + cell("b", sb) + "</div>" +
      part("is-miss", "Les surprises", "Les choix que l'autre n'avait pas vus venir.", idx.filter(miss)) +
      part("is-same", "Vous êtes d'accord", "Le même choix, et vous le saviez.", idx.filter((i) => !miss(i) && a[2 * i] === b[2 * i])) +
      part("is-apart", "Chacun son camp", "Pas le même choix, mais aucune surprise.", idx.filter((i) => !miss(i) && a[2 * i] !== b[2 * i])) + end + "</div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "prefere",
    v: 1,
    title: "Tu préfères ?",
    hook: "Est-ce que tu sais ce que l'autre choisirait ?",
    blurb: "Douze dilemmes impossibles. Chacun choisit pour soi, puis devine le choix de l'autre.",
    meta: "12 dilemmes · 5 min",
    intro: [
      "« Tu préfères ne plus jamais manger de fromage, ou ne plus jamais manger de chocolat ? » Pour chaque dilemme, tu choisis pour toi, puis tu devines ce que l'autre a choisi.",
      "À la fin, vous voyez qui a le mieux deviné l'autre, ce sur quoi vous êtes d'accord, et les surprises."
    ],
    glyph: '<rect class="ink-a" x="4" y="11" width="18" height="26" rx="5"/><rect class="ring-b" x="27" y="13.5" width="16" height="21" rx="4"/>',
    live: false,
    options: PACKS.length ? [{
      id: "pack", label: "Dilemmes", def: "melange",
      choices: [{ id: "melange", name: "Mélange", hint: "Absurde et vie à deux." }].concat(PACKS.map((p) => ({ id: p.id, name: p.name, hint: p.hint, adult: p.adult === true })))
    }] : [],
    view(g) {
      const k = g.kit, list = refs(g);
      if (!list.length) return '<div class="prefere" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les dilemmes ne sont pas arrivés.</h1><p class="g-lead">Recharge la page, puis relance une partie.</p></div>';
      const old = past(g);
      if (old) return vResult(g, old.list, old.a, old.b, true);
      const w = turn(g);
      if (!w) return vec(g, "a") && vec(g, "b") ? vResult(g, list, vec(g, "a"), vec(g, "b"), false) : vWait(g);
      if (!g.duo && w !== first(g) && !g.local.go) {
        return '<div class="prefere" data-screen="passage">' + k.pass(w, "go") + '<p class="hint">' + k.esc("Les réponses " + k.de(k.nm(g.other(w))) + " restent cachées jusqu'au résultat.") + "</p></div>";
      }
      const d = draft(g);
      return d.length >= LEN ? vEnd(g, w) : vAsk(g, list, w, d);
    },
    act(g, name, el) {
      if (Date.now() < lock) return;
      const k = g.kit, list = refs(g), w = list.length && !past(g) ? turn(g) : null, d = draft(g);
      if (name === "pick" && w && d.length < LEN && /^[01]$/.test(el.getAttribute("data-k") || "")) {
        g.local.d = d + el.getAttribute("data-k");
        g.save();
        g.render();
      } else if (name === "undo" && w && d) {
        g.local.d = d.slice(0, -1);
        g.save();
        g.render();
      } else if (name === "send" && w && d.length === LEN) {
        g.local.d = "";
        g.set(w, { v: d });
      } else if (name === "go" && w) {
        g.local.go = 1;
        g.save();
        g.render();
      } else if (name === "ok" && past(g)) {
        k.store.set(SEEN, past(g).k);
        g.render();
      } else if (name === "again" && list.length && !past(g) && vec(g, "a") && vec(g, "b")) {
        /* Sans liaison, l'autre a peut-être déjà relancé : deux relances de même rang se départagent au
           profit d'une seule, et la partie de l'autre serait perdue. */
        if (g.duo && g.online !== "ok") {
          el.closest(".g-opts").querySelector(".hint").textContent = "La connexion est coupée pour le moment. Réessaie dans un instant : la partie doit démarrer sur vos deux téléphones.";
          return;
        }
        const id = el.getAttribute("data-pack"), at = {};
        PACKS.forEach((p) => { at[p.id] = int(g.setup.at, p.id); });
        plan(g).forEach(([p, n]) => { if (pack(p)) at[p] = (at[p] + n) % pack(p).items.length; });
        /* Quitter le résultat de soi-même, c'est l'avoir vu : il ne sera pas remontré d'office. */
        k.store.set(SEEN, tok(g));
        g.newGame({ pack: pack(id) ? id : "melange", deck: Number(g.setup.deck) || seedOf(g), at,
          prev: { k: tok(g), q: list.map((r) => r[0] + "." + r[1]), a: vec(g, "a"), b: vec(g, "b") } });
      }
    },
    over(g) { return !!(vec(g, "a") && vec(g, "b")); },
    mount(g, root) {
      const scr = root.querySelector(".prefere"), name = scr ? scr.getAttribute("data-screen") + "|" + tok(g) : "";
      if (name !== screen) { screen = name; lock = Date.now() + LOCK; }
    }
  });
})();
