/* Sur la même longueur d'onde : un thème, un mot chacun sans se concerter, dix manches.
   Tranche d'un joueur : { w: [mot de la manche 0, mot de la manche 1, …] }.
   État commun : { ok: { "3": 1 } } pour les manches que le couple décide de compter quand
   même (synonymes). Chaque appareil avance à son rythme d'une révélation à la suivante
   (g.local.r), mais une manche ne se révèle que lorsque les deux mots sont là. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.onde) || { packs: [] };
  const ROUNDS = 10;
  const LEVELS = [
    [9, "Télépathie confirmée."],
    [7, "Presque la même fréquence."],
    [5, "Bonne réception."],
    [3, "Ça capte par moments."],
    [0, "Deux planètes, et c'est très bien comme ça."]
  ];
  const pack = (id) => DATA.packs.find((p) => p.id === id);

  /* Deux réponses comptent pour la même si elles ne diffèrent que par la casse, les accents,
     l'article, le pluriel ou une faute de frappe. */
  function norm(s) {
    return String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim()
      .replace(/^(le|la|les|l|un|une|des|du|de|d|au|aux|mon|ma|mes|ton|ta|tes|notre|nos) (?=.)/, "")
      .split(" ").map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w)).join(" ");
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
  function same(a, b) {
    const x = norm(a), y = norm(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const n = Math.min(x.length, y.length);
    return n >= 5 && distance(x, y) <= (n >= 9 ? 2 : 1);
  }

  /* Les dix thèmes de la manche de jeu, tirés de la même façon sur les deux téléphones. */
  function themes(g) {
    const k = g.kit, seed = Number(g.setup.seed) || 1, p = pack(g.setup.pack);
    let list;
    if (p) {
      list = k.shuffle(p.themes, seed).slice(0, ROUNDS);
    } else {
      const take = (id, n, s) => (pack(id) ? k.shuffle(pack(id).themes, s).slice(0, n) : []);
      list = k.shuffle(take("classique", 4, seed).concat(take("nous", 4, seed + 1), take("absurde", 2, seed + 2)), seed + 3);
    }
    const map = { a: k.nm("a"), b: k.nm("b"), de_a: k.de(k.nm("a")), de_b: k.de(k.nm("b")) };
    return list.map((t) => k.fill(t, map));
  }

  /* Les mots viennent parfois de l'autre téléphone : on ne garde que des chaînes courtes. */
  const words = (g, w) => (Array.isArray(g.S[w].w) ? g.S[w].w : []).map((x) => (typeof x === "string" && x.trim() ? x.slice(0, 40) : null));
  function result(g, r) {
    const a = words(g, "a")[r], b = words(g, "b")[r];
    if (a == null || b == null) return null;
    const auto = same(a, b), forced = !auto && !!(g.sh.ok && typeof g.sh.ok === "object" && g.sh.ok[r]);
    return { a, b, auto, forced, ok: auto || forced };
  }
  const score = (g, upTo) => { let n = 0; for (let r = 0; r < upTo; r++) { const x = result(g, r); if (x && x.ok) n++; } return n; };
  const round = (g) => Math.min(Math.max(parseInt(g.local.r, 10) || 0, 0), ROUNDS);
  /* Qui doit écrire maintenant : moi sur deux téléphones ; sur un seul, celui qui n'a pas encore
     écrit, en alternant qui commence. Renvoie null quand les deux mots sont là. */
  function writer(g, r) {
    if (g.duo) return words(g, g.me)[r] == null ? g.me : null;
    const first = r % 2 ? "b" : "a", second = g.other(first);
    return words(g, first)[r] == null ? first : words(g, second)[r] == null ? second : null;
  }
  const best = (k) => { const b = k.store.get("onde:best", null); return b && typeof b.n === "number" ? b : { n: -1, k: "" }; };

  const head = (g, r, who) => '<p class="onde-step">Manche ' + (r + 1) + " sur " + ROUNDS + '</p><div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + ROUNDS +
    '" aria-valuenow="' + r + '"><span style="width:' + (100 * r) / ROUNDS + '%"></span></div>' + (who ? '<p class="onde-who">' + g.kit.who(who) + " écrit</p>" : "");

  function vWrite(g, r, w, theme) {
    const k = g.kit, oth = k.nm(g.other(w));
    return '<div class="onde as-' + w + '">' + head(g, r, w) + '<h1 class="g-title" tabindex="-1" data-focus>' + k.esc(theme) + "</h1>" +
      '<form class="onde-form"><input class="g-field" name="mot" data-keep="mot-' + g.gen + "-" + r + "-" + w + '" maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Ton mot" aria-label="Ton mot pour ce thème">' +
      '<p class="hint">Un mot ou deux, sans rien dire à voix haute. ' + k.esc(oth) + " ne le verra qu'une fois le sien écrit." + (g.duo ? "" : " Ensuite, passe le téléphone.") + "</p>" +
      '<div class="g-actions"><button class="btn" type="submit">Valider</button></div></form></div>';
  }

  function vWait(g, r, theme) {
    const k = g.kit, oth = g.other(g.me);
    return '<div class="onde as-' + g.me + '">' + head(g, r) + '<h1 class="g-title">' + k.esc(theme) + '</h1><p class="g-lead">Tu as écrit : <b>' + k.esc(words(g, g.me)[r]) + "</b></p>" +
      k.wait(g, "En attente du mot " + k.de(k.nm(oth)) + "…") + "</div>";
  }

  function vReveal(g, r, theme) {
    const k = g.kit, x = result(g, r), last = r === ROUNDS - 1;
    const cell = (w) => '<div class="g-card ' + w + '">' + k.who(w) + '<p class="g-card-text">' + k.esc(x[w]) + "</p></div>";
    return '<div class="onde">' + head(g, r) + '<p class="eyebrow">' + k.esc(theme) + '</p><div class="onde-pair">' + cell("a") + cell("b") + "</div>" +
      '<div class="onde-venn">' + k.venn(x.ok ? 100 : 0) + '</div><h1 class="g-title" tabindex="-1" data-focus>' + (x.ok ? "Même longueur d'onde." : "Pas cette fois.") + "</h1>" +
      (x.auto ? "" : '<p class="hint">' + (x.forced ? "Vous avez décidé que ça comptait. " : "Deux façons de dire la même chose ? ") +
        '<button class="link" type="button" data-act="force">' + (x.forced ? "Finalement non" : "On compte quand même") + "</button></p>") +
      '<p class="onde-score">Score : <b>' + score(g, r + 1) + "</b> sur " + (r + 1) + "</p>" +
      '<div class="g-actions"><button class="btn" type="button" data-act="next">' + (last ? "Voir le résultat" : "Manche suivante") + "</button></div></div>";
  }

  function vEnd(g, list) {
    const k = g.kit, n = score(g, ROUNDS), b = best(k), token = g.gen + ":" + g.setup.seed;
    const record = b.k === token || n > b.n ? "Nouveau record." : "Votre record : " + b.n + " sur " + ROUNDS + ".";
    const cur = pack(g.setup.pack) ? g.setup.pack : "melange";
    const choice = (id, name) => '<button class="g-choice" type="button" data-act="again" data-pack="' + id + '" aria-pressed="' + (cur === id) + '"><b>' + k.esc(name) + "</b></button>";
    return '<div class="onde"><p class="eyebrow">Résultat</p><div class="onde-venn">' + k.venn(10 * n) + '</div><p class="g-big">' + n + "<span> / " + ROUNDS + '</span></p><h1 class="g-title" tabindex="-1" data-focus>' +
      LEVELS.find((l) => n >= l[0])[1] + '</h1><p class="g-lead">' + record + '</p><ul class="onde-list">' + list.map((t, r) => {
        const x = result(g, r);
        return x ? '<li><span class="st ' + (x.ok ? "ok" : "gap") + '"><i aria-hidden="true">' + (x.ok ? "=" : "≠") + '</i><span class="sr">' + (x.ok ? "Pareil" : "Différent") + '</span></span><p class="onde-theme">' + k.esc(t) +
          '</p><p class="onde-words"><span><i class="sw a"></i>' + k.esc(x.a) + '</span><span><i class="sw b"></i>' + k.esc(x.b) + "</span></p></li>" : "";
      }).join("") + '</ul><div class="g-opts"><p class="g-opts-label">Rejouer avec</p><div class="g-choices">' + choice("melange", "Mélange") + DATA.packs.map((p) => choice(p.id, p.name)).join("") + "</div></div></div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "onde",
    v: 1,
    title: "Sur la même longueur d'onde",
    hook: "Est-ce qu'on pense au même mot ?",
    blurb: "Un thème, un mot chacun, sans se concerter. Dix manches pour voir si vous captez la même fréquence.",
    meta: "10 manches · 5 min",
    intro: [
      "Un thème s'affiche : « Un fruit rouge », « Le plat qu'on commande le plus souvent ». Chacun écrit un mot sans rien dire. Si vous avez écrit le même, c'est gagné.",
      "Dix manches. Il ne s'agit pas de donner la meilleure réponse, mais de deviner celle que l'autre va écrire."
    ],
    glyph: '<path class="ring-a" d="M4 24q5-13 10 0t10 0 10 0 10 0"/><path class="ring-b" d="M4 24q5 13 10 0t10 0 10 0 10 0"/>',
    live: true,
    options: [{
      id: "pack", label: "Thèmes", def: "melange",
      choices: [{ id: "melange", name: "Mélange", hint: "Un peu de tout." }].concat(DATA.packs.map((p) => ({ id: p.id, name: p.name, hint: p.hint })))
    }],
    view(g) {
      const list = themes(g), r = round(g);
      if (r >= ROUNDS || r >= list.length) return vEnd(g, list);
      const w = writer(g, r);
      if (w) return vWrite(g, r, w, list[r]);
      return result(g, r) ? vReveal(g, r, list[r]) : vWait(g, r, list[r]);
    },
    submit(g, form) {
      const r = round(g), w = writer(g, r), field = form.querySelector("[name=mot]");
      const word = field ? field.value.trim().replace(/\s+/g, " ").slice(0, 40) : "";
      if (!w || !field) return;
      if (!word) { field.focus(); return; }
      const list = words(g, w);
      for (let i = 0; i <= r; i++) if (list[i] === undefined) list[i] = null;
      list[r] = word;
      g.set(w, { w: list });
    },
    act(g, name, el) {
      const r = round(g);
      if (name === "next" && result(g, r)) {
        g.local.r = r + 1;
        g.save();
        g.render();
      } else if (name === "force" && result(g, r) && !result(g, r).auto) {
        const ok = Object.assign({}, g.sh.ok && typeof g.sh.ok === "object" ? g.sh.ok : {});
        if (ok[r]) delete ok[r]; else ok[r] = 1;
        g.share({ ok });
      } else if (name === "again") {
        g.newGame({ pack: el.getAttribute("data-pack") || "melange" });
      }
    },
    mount(g, root) {
      const k = g.kit, field = root.querySelector(".onde-form .g-field");
      /* Le clavier s'ouvre tout seul quand c'est possible (le navigateur l'exige dans un geste). */
      if (field && document.activeElement !== field) { try { field.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
      if (round(g) >= ROUNDS) {
        const n = score(g, ROUNDS);
        if (n > best(k).n) k.store.set("onde:best", { n, k: g.gen + ":" + g.setup.seed });
      }
    }
  });
})();
