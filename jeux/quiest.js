/* Qui de nous deux ? (le jeu) : quinze questions express, un prénom à chaque fois, puis on compare.
   Chacun répond de son côté ; le résultat s'ouvre quand les deux ont fini.
   Une réponse tient en un caractère : "a" ou "b" (le prénom touché), "2" (les deux), "0" (personne).
   - Pendant qu'on répond, les réponses restent sur l'appareil (g.local.d[w]) : rien ne part.
   - À la quinzième, la tranche reçoit { r: "ab20…" } en un seul envoi. Celui qui finit en second voit
     aussitôt le résultat : il y ajoute fin: 1. Celui qui avait fini en premier touche « Voir le
     résultat » quand les réponses de l'autre arrivent, ce qui envoie fin: 1. On ne relance une partie
     que lorsque l'autre a vu le résultat de celle-ci.
   Réglages : pack, puis, après un « Rejouer », deck (la seed de la première partie) et at (où en est
   chaque paquet), comme dans « Sur la même longueur d'onde ». */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.quiest) || { packs: [] };
  const N = 15;
  /* Le mélange ne pioche jamais dans un paquet pour adultes. */
  const MIX = [["quotidien", 8], ["caractere", 7]];
  const FULL = new RegExp("^[ab20]{" + N + "}$");
  const LEVELS = [
    [15, "Une seule et même version des faits."],
    [12, "Vous vous connaissez par cœur."],
    [9, "D'accord sur l'essentiel."],
    [6, "Deux versions, de quoi animer la soirée."],
    [0, "Chacun sa vérité. Ça promet."]
  ];
  const packs = () => (Array.isArray(DATA.packs) ? DATA.packs : []).filter((p) => p && typeof p.id === "string" && Array.isArray(p.items));
  const pack = (id) => packs().find((p) => p.id === id);
  const items = (p) => (p ? p.items.filter((x) => typeof x === "string" && x) : []);
  const int = (o, key) => { const n = o && typeof o === "object" ? o[key] : 0; return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; };
  const seedOf = (g) => Number(g.setup.seed) || 1;
  const plan = (g) => (pack(g.setup.pack) ? [[g.setup.pack, N]] : MIX);

  /* Les quinze questions, tirées de la même façon sur les deux téléphones ; « Rejouer » reprend chaque
     paquet où l'on s'était arrêté : une question ne revient qu'une fois son paquet épuisé. */
  function questions(g) {
    const k = g.kit, deck = Number(g.setup.deck) || seedOf(g);
    let list = [];
    plan(g).forEach(([id, n]) => {
      const p = pack(id), all = k.shuffle(items(p), deck + packs().indexOf(p));
      for (let i = 0; i < Math.min(n, all.length); i++) list.push(all[(int(g.setup.at, id) + i) % all.length]);
    });
    return pack(g.setup.pack) ? list : k.shuffle(list, seedOf(g));
  }

  /* Les réponses publiées d'un joueur : une chaîne de quinze codes, sinon rien (elle peut venir de l'autre téléphone). */
  const answers = (g, w) => { const r = g.S[w].r; return typeof r === "string" && FULL.test(r) ? r : null; };
  const fin = (g, w) => g.S[w].fin === 1;
  /* Le brouillon de qui répond sur cet appareil. */
  function draft(g, w) {
    const d = g.local.d && typeof g.local.d === "object" ? g.local.d[w] : "";
    return typeof d === "string" && /^[ab20]*$/.test(d) ? d.slice(0, N - 1) : "";
  }
  /* Qui répond maintenant : moi sur deux téléphones ; sur un seul, "a" puis "b", avec le passage
     du téléphone entre les deux ("pass"). null quand j'ai fini. */
  function turn(g) {
    if (g.duo) return answers(g, g.me) ? null : g.me;
    if (!answers(g, "a")) return "a";
    if (!answers(g, "b")) return g.local.pass ? "b" : "pass";
    return null;
  }
  const ready = (g) => !g.duo || fin(g, g.other(g.me));
  const both = (g) => !!answers(g, "a") && !!answers(g, "b");

  /* Ce que désigne une réponse, à l'encre de la personne désignée. */
  function label(g, c) {
    const k = g.kit;
    if (c === "a" || c === "b") return '<span class="quiest-chip ' + c + '"><i class="sw ' + c + '"></i>' + k.esc(k.nm(c)) + "</span>";
    return '<span class="quiest-chip">' + (c === "2" ? "Les deux" : "Personne") + "</span>";
  }
  /* L'étiquette d'un désaccord, selon la façon dont les deux versions se contredisent. */
  function tag(x, y) {
    if (x === "a" && y === "b") return "Chacun lève la main";
    if (x === "b" && y === "a") return "Vous vous renvoyez la balle";
    if (x === "0" || y === "0") return x === "2" || y === "2" ? "Tout ou rien" : "Quelqu'un est dans le déni";
    return "À moitié d'accord";
  }

  const top = (g, i) => '<div class="quiest-top"><p class="quiest-step">' + (!i && g.gen > 1 ? "Nouvelle partie · " : "") + "Question " + (i + 1) + " sur " + N + "</p></div>" +
    '<div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + N + '" aria-valuenow="' + i + '"><span style="width:' + (100 * i) / N + '%"></span></div>';

  function vAsk(g, list, w) {
    const k = g.kit, i = draft(g, w).length;
    const pick = (c, cls, text) => '<button class="' + cls + '" type="button" data-act="pick" data-val="' + c + '" data-i="' + i + '">' + text + "</button>";
    const name = (c) => pick(c, "quiest-pick " + c, '<i class="sw ' + c + '"></i><span>' + k.esc(k.nm(c)) + "</span>");
    return '<div class="quiest as-' + w + '" data-screen="q-' + i + "-" + w + '">' + top(g, i) +
      '<p class="quiest-who">' + k.who(w) + " répond" + (g.duo ? "" : '<span class="quiest-shh">' + k.esc(k.nm(g.other(w))) + " ne regarde pas</span>") + "</p>" +
      '<div class="quiest-card" data-i="' + i + '"><h1 class="g-title" tabindex="-1" data-focus>' + k.esc(list[i]) + "</h1></div>" +
      '<div class="quiest-answers" role="group" aria-label="Ta réponse"><div class="quiest-names">' + name("a") + name("b") + '</div><div class="quiest-alt">' +
      pick("2", "quiest-small", "Les deux") + pick("0", "quiest-small", "Personne") + "</div>" +
      (i ? '<button class="link g-link quiest-back" type="button" data-act="back">Revenir à la question précédente</button>' : "") + "</div></div>";
  }

  function vWait(g) {
    const k = g.kit, O = k.nm(g.other(g.me));
    return '<div class="quiest" data-screen="attente"><div class="quiest-venn">' + k.venn(0) + '</div><h1 class="g-title" tabindex="-1" data-focus>C\'est envoyé.</h1><p class="g-lead">' +
      k.esc("Le résultat s'ouvre dès " + k.que(O) + " aura répondu à son tour. Tes réponses restent cachées jusque-là.") + "</p>" + k.wait(g, "En attente des réponses " + k.de(O) + "…") + "</div>";
  }

  function vReady(g) {
    const k = g.kit;
    return '<div class="quiest" data-screen="pret"><div class="quiest-venn">' + k.venn(50) + '</div><h1 class="g-title" tabindex="-1" data-focus>' + k.esc("Les réponses " + k.de(k.nm(g.other(g.me))) + " sont arrivées.") +
      '</h1><p class="g-lead">Le moment de vérité.</p><div class="g-actions"><button class="btn" type="button" data-act="voir">Voir le résultat</button></div></div>';
  }

  function vEnd(g, list) {
    const k = g.kit, A = answers(g, "a"), B = answers(g, "b"), cur = pack(g.setup.pack) ? g.setup.pack : "melange";
    const rows = list.map((q, i) => ({ q, x: A[i], y: B[i] }));
    const same = rows.filter((r) => r.x === r.y), diff = rows.filter((r) => r.x !== r.y), n = same.length;
    const say = (w, c) => '<span class="quiest-say"><span class="quiest-by"><i class="sw ' + w + '"></i>Selon ' + k.esc(k.nm(w)) + "</span>" + label(g, c) + "</span>";
    const row = (r, ok) => '<li class="quiest-row ' + (ok ? "ok" : "gap") + '"><p class="quiest-q">' + k.esc(r.q) + '</p><div class="quiest-two">' + say("a", r.x) + say("b", r.y) + "</div>" +
      (ok ? "" : '<span class="g-tag quiest-tag">' + k.esc(tag(r.x, r.y)) + "</span>") + "</li>";
    const part = (title, list2, ok) => list2.length ? '<h2 class="quiest-h">' + title + " <span>" + list2.length + '</span></h2><ul class="quiest-list">' + list2.map((r) => row(r, ok)).join("") + "</ul>" : "";
    const choice = (id, name, adult) => '<button class="g-choice" type="button" data-act="again" data-pack="' + id + '"' + (cur === id ? ' aria-current="true"' : "") + "><b>" + k.esc(name) +
      (adult ? ' <span class="g-tag">Adultes</span>' : "") + "</b></button>";
    return '<div class="quiest" data-screen="resultat"><p class="eyebrow">Résultat</p><div class="quiest-venn">' + k.venn(Math.round((100 * n) / N)) + '</div><p class="g-big">' + n + "<span> / " + N +
      '</span></p><h1 class="g-title" tabindex="-1" data-focus>' + LEVELS.find((l) => n >= l[0])[1] + '</h1><p class="g-lead">' +
      (n === N ? "Pas une seule question pour vous départager." : n ? k.pl(n, "réponse", "réponses") + " en commun, et " + k.pl(N - n, "version", "versions") + " à confronter." : "Pas une seule réponse en commun. À vous de raconter.") + "</p>" +
      part("Vous êtes d'accord", same, true) + part("Deux versions des faits", diff, false) + (ready(g)
        ? '<div class="g-opts"><p class="g-opts-label">Rejouer avec</p><div class="g-choices">' + choice("melange", "Mélange") + packs().map((p) => choice(p.id, p.name, p.adult)).join("") + "</div></div>"
        : k.wait(g, "Vous pourrez rejouer dès " + k.que(k.nm(g.other(g.me))) + " aura vu le résultat.")) + "</div>";
  }

  /* Le dernier toucher pris en compte : un double toucher ne répond pas à deux questions d'un coup. */
  let lastTap = 0, shownQ = "";

  (window.GAMES = window.GAMES || []).push({
    id: "quiest",
    v: 1,
    title: "Qui de nous deux\u00a0?",
    hook: "Qui ronfle\u00a0? Qui vole la couette\u00a0?",
    blurb: "Quinze questions express, un prénom à chaque fois. Puis on compare\u00a0: qui est d'accord, et qui se renvoie la balle.",
    meta: "15 questions · 3 min",
    intro: [
      "«\u00a0Qui parle à ses plantes\u00a0?\u00a0», «\u00a0Qui finit les restes en cachette\u00a0?\u00a0»\u00a0: à chaque question, touche le prénom qui s'impose. «\u00a0Les deux\u00a0» et «\u00a0Personne\u00a0» sont permis, l'hésitation beaucoup moins.",
      "Chacun répond de son côté, sans regarder l'autre. À la fin, vous découvrez où vos versions concordent, et où elles se contredisent."
    ],
    glyph: '<circle class="ink-a" cx="15" cy="30" r="11"/><rect class="ink-b" x="22" y="19" width="22" height="22" rx="5"/><path class="ring-a" d="M19 9.5a5 5 0 1 1 7 4.6c-1.5.7-2 1.7-2 3.4"/>',
    live: false,
    options: [{
      id: "pack", label: "Questions", def: "melange",
      choices: [{ id: "melange", name: "Mélange", hint: "Le quotidien et nos caractères." }].concat(packs().map((p) => ({ id: p.id, name: p.name, hint: p.hint, adult: !!p.adult })))
    }],
    view(g) {
      const k = g.kit, list = questions(g);
      if (list.length < N) return '<div class="quiest" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les questions ne sont pas arrivées.</h1><p class="g-lead">Recharge la page\u00a0: la partie reprendra où elle en était.</p></div>';
      const w = turn(g);
      if (w === "pass") return '<div class="quiest" data-screen="passe">' + k.pass("b", "moi") + '<p class="hint">' + k.esc(k.nm("a") + " a répondu. Les mêmes questions t'attendent, dans le même ordre.") + "</p></div>";
      if (w) return vAsk(g, list, w);
      if (!both(g)) return vWait(g);
      if (g.duo && !fin(g, g.me)) return vReady(g);
      return vEnd(g, list);
    },
    act(g, name, el) {
      const w = turn(g);
      if (name === "pick" && w && w !== "pass") {
        const c = el.getAttribute("data-val"), d = draft(g, w), now = Date.now();
        /* Le bouton touché doit appartenir à la question affichée, et pas au second toucher d'un double toucher. */
        if (!/^[ab20]$/.test(c) || el.getAttribute("data-i") !== String(d.length) || now - lastTap < 250) return;
        lastTap = now;
        const next = d + c;
        g.local.d = Object.assign({}, g.local.d, { [w]: next.length < N ? next : "" });
        if (next.length < N) { g.save(); g.render(); return; }
        const patch = { r: next };
        if (g.duo && answers(g, g.other(w))) patch.fin = 1;
        g.set(w, patch);
      } else if (name === "back" && w && w !== "pass") {
        g.local.d = Object.assign({}, g.local.d, { [w]: draft(g, w).slice(0, -1) });
        g.save();
        g.render();
      } else if (name === "moi" && w === "pass") {
        g.local.pass = 1;
        g.save();
        g.render();
      } else if (name === "voir" && g.duo && both(g) && !fin(g, g.me)) {
        g.set(g.me, { fin: 1 });
      } else if (name === "again" && both(g) && ready(g) && questions(g).length === N) {
        const id = el.getAttribute("data-pack"), at = {};
        packs().forEach((p) => { at[p.id] = int(g.setup.at, p.id); });
        plan(g).forEach(([p, n]) => { const all = items(pack(p)).length; if (all) at[p] = (at[p] + n) % all; });
        g.newGame({ pack: pack(id) ? id : "melange", deck: Number(g.setup.deck) || seedOf(g), at });
      }
    },
    over(g) { return both(g) && (!g.duo || fin(g, g.me)); },
    mount(g, root) {
      const card = root.querySelector(".quiest-card");
      if (!card) { shownQ = ""; return; }
      /* La question n'entre en glissant qu'à sa première apparition, pas quand l'autre téléphone écrit. */
      const key = g.gen + ":" + g.setup.seed + ":" + card.closest("[data-screen]").getAttribute("data-screen");
      if (key !== shownQ) { shownQ = key; card.classList.add("is-new"); }
    }
  });
})();
