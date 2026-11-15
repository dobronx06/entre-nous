/* Sur la même longueur d'onde : un thème, un mot chacun sans se concerter, dix manches.
   Tranche d'un joueur : { w: [mot de la manche 0, mot de la manche 1, …], ok: { "3": 1 }, fin: 1 }.
   - ok compte, manche par manche, les fois où le couple a contredit le verdict du jeu (« On compte
     quand même », « Finalement non »). Le plus grand des deux compteurs décide : impair, le verdict
     est inversé. Chacun n'écrit que le sien, donc deux décisions prises au même instant, sur la même
     manche ou sur deux manches, ne s'écrasent jamais.
   - fin : ce joueur a vu le résultat. Sur deux téléphones, on ne relance que lorsque les deux l'ont vu.
   Réglages : pack, puis, après un « Rejouer », deck (la seed de la première partie) et at (où en est
   chaque paquet), pour ne pas resservir les thèmes qu'on vient de voir.
   Chaque appareil avance à son rythme d'une révélation à la suivante (g.local.r), mais une manche
   ne se révèle que lorsque les deux mots sont là. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.onde) || { packs: [] };
  const ROUNDS = 10;
  const MIX = [["classique", 4], ["nous", 4], ["absurde", 2]];
  const LEVELS = [
    [9, "Télépathie confirmée."],
    [7, "Presque la même fréquence."],
    [5, "Bonne réception."],
    [3, "Ça capte par moments."],
    [0, "Deux planètes, et c'est très bien comme ça."]
  ];
  const pack = (id) => DATA.packs.find((p) => p.id === id);
  /* Un entier borné lu dans un objet venu de l'autre téléphone (ou restauré depuis le relais) : sinon 0. */
  const int = (o, key) => { const n = o && typeof o === "object" ? o[key] : 0; return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; };
  const seedOf = (g) => Number(g.setup.seed) || 1;
  const token = (g) => g.gen + ":" + g.setup.seed;

  /* Deux réponses comptent pour la même si elles ne diffèrent que par la casse, les accents, les
     articles en tête, le pluriel ou une faute de frappe. */
  const ARTICLE = /^(?:le|la|les|l|un|une|des|du|de|d|a|au|aux|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)$/;
  /* Un mot : des lettres ou des chiffres, dans n'importe quelle écriture. Passé par RegExp() pour qu'un
     navigateur qui ignore \p{…} garde le jeu, en alphabet latin, au lieu de rejeter tout le fichier. */
  let WORD = /[a-z0-9]+/g;
  try { WORD = new RegExp("[\\p{L}\\p{N}][\\p{L}\\p{N}\\p{M}]*", "gu"); } catch (e) { /* alphabet latin seulement */ }
  function norm(s) {
    const t = s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(WORD) || [];
    while (t.length > 1 && ARTICLE.test(t[0])) t.shift();
    return t.map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w)).join(" ");
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
  /* 2 : le même mot. 1 : le même à une faute de frappe près (le couple peut le refuser). 0 : deux mots. */
  function same(a, b) {
    const raw = (s) => s.normalize("NFC").trim().toLowerCase();
    /* Deux réponses identiques comptent toujours, même faites d'un emoji ou de signes. */
    if (raw(a) === raw(b)) return 2;
    const x = norm(a), y = norm(b);
    if (!x || !y) return 0;
    /* Un espace ou un trait d'union de plus ne fait pas un autre mot : « week-end », « weekend ». */
    if (x.replace(/ /g, "") === y.replace(/ /g, "")) return 2;
    /* La faute de frappe ne vaut que pour les lettres : « 22h30 » n'est pas « 23h30 ». */
    const digits = (s) => (s.match(/\d+/g) || []).join(" "), letters = (s) => s.replace(/[\d ]/g, "").length;
    const n = Math.min(letters(x), letters(y));
    return digits(x) === digits(y) && n >= 5 && distance(x, y) <= (n >= 9 ? 2 : 1) ? 1 : 0;
  }

  /* Ce que la partie prend dans chaque paquet. */
  const plan = (g) => (pack(g.setup.pack) ? [[g.setup.pack, ROUNDS]] : MIX);
  /* Les dix thèmes de la partie, tirés de la même façon sur les deux téléphones. Chaque paquet garde
     le même ordre d'une partie à la suivante (deck) et « Rejouer » y reprend où l'on s'était arrêté
     (at) : un thème ne revient qu'une fois son paquet épuisé. */
  function themes(g) {
    const k = g.kit, deck = Number(g.setup.deck) || seedOf(g);
    let list = [];
    plan(g).forEach(([id, n]) => {
      const p = pack(id), all = p ? k.shuffle(p.themes, deck + DATA.packs.indexOf(p)) : [];
      for (let i = 0; i < Math.min(n, all.length); i++) list.push(all[(int(g.setup.at, id) + i) % all.length]);
    });
    if (!pack(g.setup.pack)) list = k.shuffle(list, seedOf(g));
    const map = { a: k.nm("a"), b: k.nm("b"), de_a: k.de(k.nm("a")), de_b: k.de(k.nm("b")) };
    return list.map((t) => k.fill(t, map));
  }

  /* Les mots viennent parfois de l'autre téléphone : dix au plus, et seulement des chaînes courtes. */
  const words = (g, w) => (Array.isArray(g.S[w].w) ? g.S[w].w.slice(0, ROUNDS) : []).map((x) => (typeof x === "string" && x.trim() ? x.slice(0, 40) : null));
  const flips = (g, r) => Math.max(int(g.S.a.ok, r), int(g.S.b.ok, r));
  /* auto : le verdict du jeu. sure : mot pour mot le même, rien à discuter. flip : le couple a contredit le jeu. */
  function result(g, r) {
    const a = words(g, "a")[r], b = words(g, "b")[r];
    if (a == null || b == null) return null;
    const m = same(a, b), flip = m < 2 && flips(g, r) % 2 === 1;
    return { a, b, auto: m > 0, sure: m === 2, flip, ok: (m > 0) !== flip };
  }
  const score = (g, upTo) => { let n = 0; for (let r = 0; r < upTo; r++) { const x = result(g, r); if (x && x.ok) n++; } return n; };
  const done = (g) => { for (let r = 0; r < ROUNDS; r++) if (!result(g, r)) return false; return true; };
  const round = (g) => Math.min(Math.max(parseInt(g.local.r, 10) || 0, 0), ROUNDS);
  /* Qui doit écrire maintenant : moi sur deux téléphones ; sur un seul, celui qui n'a pas encore
     écrit, en alternant qui commence. Renvoie null quand les deux mots sont là. */
  function writer(g, r) {
    if (g.duo) return words(g, g.me)[r] == null ? g.me : null;
    const first = r % 2 ? "b" : "a", second = g.other(first);
    return words(g, first)[r] == null ? first : words(g, second)[r] == null ? second : null;
  }
  /* Relancer emmène l'autre téléphone dans la nouvelle partie : on attend qu'il ait vu le résultat de celle-ci. */
  const ready = (g) => !g.duo || !!g.S[g.other(g.me)].fin;
  /* Le record gardé sur l'appareil : { n, k, was }, k étant la partie qui l'a établi et was le record
     d'avant elle. Renvoie n et le record à battre : tant que la partie en cours est celle du record,
     son score peut encore bouger (un point accordé puis repris), c'est donc was qui compte. */
  function best(g) {
    const b = g.kit.store.get("onde:best", null), n = b && Number.isInteger(b.n) ? b.n : -1;
    return { n, was: n >= 0 && b.k === token(g) ? (Number.isInteger(b.was) ? b.was : -1) : n };
  }

  /* Haut d'écran : où l'on en est et, sur la révélation, le score (à droite, pour ne pas finir sous les boutons). */
  const top = (g, r, right) => '<div class="onde-top"><p class="onde-step">' + (!r && g.gen > 1 && !right ? "Nouvelle partie · " : "") + "Manche " + (r + 1) + " sur " + ROUNDS + "</p>" + (right || "") +
    '</div><div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + ROUNDS + '" aria-valuenow="' + r + '"><span style="width:' + (100 * r) / ROUNDS + '%"></span></div>';

  function vWrite(g, r, w, theme) {
    const k = g.kit, oth = k.nm(g.other(w));
    /* Sur un seul téléphone, qui écrit en second ouvre la révélation et garde l'appareil pour commencer la manche suivante. */
    const second = !g.duo && words(g, g.other(w))[r] != null;
    return '<div class="onde as-' + w + '" data-screen="ecrire-' + r + "-" + w + '">' + top(g, r) + '<p class="onde-who">' + k.who(w) + ' écrit</p><h1 class="g-title" tabindex="-1" data-focus>' + k.esc(theme) + "</h1>" +
      '<form class="onde-form"><input class="g-field" name="mot" data-keep="mot-' + g.gen + "-" + seedOf(g) + "-" + r + "-" + w + '" maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Ton mot" aria-label="' +
      k.esc(k.nm(w) + ", ton mot pour « " + theme + " »") + '"><p class="hint">' + k.esc("Un mot ou deux, sans rien dire à voix haute. " + oth +
        (second ? " a déjà écrit le sien : les deux mots s'affichent dès que tu valides." : " ne le verra qu'une fois le sien écrit." + (g.duo ? "" : " Ensuite, passe-lui le téléphone."))) + "</p>" +
      '<div class="g-actions"><button class="btn" type="submit">Valider</button></div></form></div>';
  }

  function vWait(g, r, theme) {
    const k = g.kit;
    return '<div class="onde as-' + g.me + '" data-screen="attente-' + r + '">' + top(g, r) + '<h1 class="g-title">' + k.esc(theme) + '</h1><p class="g-lead" tabindex="-1" data-focus>Tu as écrit\u00a0: <b>' + k.esc(words(g, g.me)[r]) + "</b></p>" +
      k.wait(g, "En attente du mot " + k.de(k.nm(g.other(g.me))) + "…") + "</div>";
  }

  function vReveal(g, r, theme) {
    const k = g.kit, x = result(g, r);
    const cell = (w) => '<div class="g-card ' + w + '">' + k.who(w) + '<p class="g-card-text">' + k.esc(x[w]) + "</p></div>";
    /* data-on dit ce que le bouton veut obtenir : s'il change de sens sous le doigt, le toucher ne défait rien. */
    const ask = x.sure ? "" : '<div class="onde-ask"><p class="hint">' +
      (x.flip ? (x.auto ? "Vous avez décidé que ça ne comptait pas." : "Vous avez décidé que ça comptait.") : x.auto ? "Pas tout à fait le même mot\u00a0?" : "Deux façons de dire la même chose\u00a0?") +
      '</p><button class="link" type="button" data-act="force" data-on="' + (x.flip ? 0 : 1) + '">' + (x.flip ? (x.auto ? "Finalement si" : "Finalement non") : x.auto ? "On ne compte pas" : "On compte quand même") + "</button></div>";
    return '<div class="onde" data-screen="revele-' + r + '">' + top(g, r, '<p class="onde-score">Score\u00a0: <b>' + score(g, r + 1) + "</b> sur " + (r + 1) + "</p>") + '<p class="eyebrow">' + k.esc(theme) +
      '</p><div class="onde-pair">' + cell("a") + cell("b") + '</div><div class="onde-venn">' + k.venn(x.ok ? 100 : 0) + '</div><h1 class="g-title onde-verdict" tabindex="-1" data-focus>' + (x.ok ? "Même longueur d'onde." : "Pas cette fois.") + "</h1>" + ask +
      '<div class="g-actions"><button class="btn" type="button" data-act="next">' + (r === ROUNDS - 1 ? "Voir le résultat" : "Manche suivante") + "</button></div></div>";
  }

  function vEnd(g, list) {
    const k = g.kit, n = score(g, ROUNDS), was = best(g).was, cur = pack(g.setup.pack) ? g.setup.pack : "melange";
    const word = (x, w) => '<span><i class="sw ' + w + '"></i><span class="sr">' + k.esc(k.nm(w) + " : ") + "</span>" + k.esc(x[w]) + "</span>";
    const choice = (id, name) => '<button class="g-choice" type="button" data-act="again" data-pack="' + id + '"' + (cur === id ? ' aria-current="true"' : "") + "><b>" + k.esc(name) + "</b></button>";
    return '<div class="onde" data-screen="resultat"><p class="eyebrow">Résultat</p><div class="onde-venn">' + k.venn(10 * n) + '</div><p class="g-big">' + n + "<span> / " + ROUNDS + '</span></p><h1 class="g-title" tabindex="-1" data-focus>' +
      LEVELS.find((l) => n >= l[0])[1] + '</h1><p class="g-lead">' + (n > was ? "Nouveau record." : "Votre record\u00a0: " + was + " sur " + ROUNDS + ".") + '</p><ul class="onde-list">' + list.map((t, r) => {
        const x = result(g, r);
        return x ? '<li><span class="st ' + (x.ok ? "ok" : "gap") + '"><i aria-hidden="true">' + (x.ok ? "=" : "≠") + '</i><span class="sr">' + (x.ok ? "Pareil" : "Différent") + '</span></span><p class="onde-theme">' + k.esc(t) +
          '</p><p class="onde-words">' + word(x, "a") + word(x, "b") + "</p></li>" : "";
      }).join("") + "</ul>" + (ready(g)
        ? '<div class="g-opts"><p class="g-opts-label">Rejouer avec</p><div class="g-choices">' + choice("melange", "Mélange") + DATA.packs.map((p) => choice(p.id, p.name)).join("") + "</div></div>"
        : k.wait(g, "Vous pourrez rejouer dès " + k.que(k.nm(g.other(g.me))) + " aura vu le résultat.")) + "</div>";
  }

  /* La révélation à l'écran : quand elle est apparue, et quand la décision du couple y a changé pour la dernière fois. */
  let seen = { key: "", flip: false, at: 0, flipAt: 0 };

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
      /* Le fichier des thèmes n'est pas arrivé sur cet appareil : surtout pas de faux résultat, ni de « Rejouer ». */
      if (list.length < ROUNDS) return '<div class="onde" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les thèmes ne sont pas arrivés.</h1><p class="g-lead">Recharge la page\u00a0: la partie reprendra où elle en était.</p></div>';
      if (r >= ROUNDS) return vEnd(g, list);
      const w = writer(g, r);
      if (w) return vWrite(g, r, w, list[r]);
      return result(g, r) ? vReveal(g, r, list[r]) : vWait(g, r, list[r]);
    },
    submit(g, form) {
      const r = round(g), w = r < ROUNDS && writer(g, r), field = form.querySelector("[name=mot]");
      const word = field ? field.value.trim().replace(/\s+/g, " ").slice(0, 40) : "";
      if (!w || !field) return;
      if (!word) { field.focus(); return; }
      const list = words(g, w);
      for (let i = 0; i <= r; i++) if (list[i] === undefined) list[i] = null;
      list[r] = word;
      g.set(w, { w: list });
    },
    act(g, name, el) {
      const r = round(g), x = r < ROUNDS ? result(g, r) : null;
      if (name === "next" && x) {
        g.local.r = r + 1;
        g.save();
        /* Dernière révélation sur deux téléphones : l'autre apprend que j'ai vu le résultat (un message, sur mon toucher). */
        if (g.duo && r === ROUNDS - 1 && !g.S[g.me].fin) g.set(g.me, { fin: 1 }); else g.render();
      } else if (name === "force" && x && !x.sure) {
        /* Rien à faire si c'est déjà décidé ainsi (l'autre vient de toucher le même bouton), ni dans la seconde
           qui suit un changement : le bouton vient de changer de sens, ce toucher visait l'ancien. */
        if (x.flip === (el.getAttribute("data-on") === "1") || Date.now() - seen.flipAt < 1000) return;
        const w = g.me || "a", ok = {};
        for (let i = 0; i < ROUNDS; i++) if (int(g.S[w].ok, i)) ok[i] = int(g.S[w].ok, i);
        ok[r] = flips(g, r) + 1;
        g.set(w, { ok });
      } else if (name === "again" && r >= ROUNDS && ready(g) && themes(g).length === ROUNDS) {
        const id = el.getAttribute("data-pack"), at = {};
        DATA.packs.forEach((p) => { at[p.id] = int(g.setup.at, p.id); });
        plan(g).forEach(([p, n]) => { at[p] = (at[p] + n) % pack(p).themes.length; });
        g.newGame({ pack: pack(id) ? id : "melange", deck: Number(g.setup.deck) || seedOf(g), at });
      }
    },
    over(g) { return round(g) >= ROUNDS; },
    mount(g, root) {
      const field = root.querySelector(".onde-form .g-field"), pair = root.querySelector(".onde-pair");
      let timer = null;
      /* Le clavier s'ouvre tout seul quand c'est possible (le navigateur l'exige dans un geste). */
      if (field && document.activeElement !== field) { try { field.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
      if (pair) {
        const r = round(g), key = token(g) + ":" + r, flip = result(g, r).flip, now = Date.now(), next = root.querySelector('[data-act="next"]');
        /* Les deux cartes ne font leur entrée qu'à la première apparition de la révélation, pas à chaque réaffichage. */
        if (key !== seen.key) { seen = { key, flip, at: now, flipAt: 0 }; pair.classList.add("is-new"); }
        else if (flip !== seen.flip) { seen.flip = flip; seen.flipAt = now; }
        /* « Manche suivante » prend la place de « Valider » : pendant une demi-seconde il ne répond pas,
           sinon le second toucher d'un double toucher ferait sauter la révélation. */
        const wait = seen.at + 500 - now;
        if (wait > 0) { next.disabled = true; timer = setTimeout(() => { next.disabled = false; }, wait); }
      }
      /* Le record se note dès que les dix manches sont connues, même si cet appareil n'affiche pas (encore) le résultat. */
      if (done(g)) {
        const n = score(g, ROUNDS), b = best(g), high = Math.max(n, b.was);
        if (high !== b.n) g.kit.store.set("onde:best", { n: high, k: token(g), was: b.was });
      }
      return () => clearTimeout(timer);
    }
  });
})();
