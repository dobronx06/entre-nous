/* L'histoire à quatre mains : une première phrase tirée au sort, puis une phrase chacun, à tour de rôle.
   Chacun ne voit que la dernière phrase de l'autre (et la première de l'histoire), jamais le reste.
   Tranche d'un joueur : { s: [ses phrases, dans l'ordre], fin: 1 }. Chaque phrase part une seule fois, au
   moment où elle est écrite. L'ordre de passage se déduit des deux comptes : qui commence dépend de la seed,
   puis on alterne ; c'est à celui qui a le moins de phrases (à égalité, à celui qui a commencé).
   fin : ce joueur a lu toute l'histoire. Sur deux téléphones, on ne relance que lorsque les deux l'ont lue.
   Réglages : longueur (8, 12 ou 16 phrases), puis, après un « Rejouer », deck (la seed de la première partie)
   et at (combien d'histoires déjà commencées), pour ne resservir une première phrase qu'une fois toutes passées.
   Sur l'appareil : g.local.ok, le nombre de phrases au moment où le joueur suivant a pris le téléphone (un seul
   téléphone) ; g.local.r, où en est la lecture. Les histoires finies sont gardées ici (« Nos histoires »). */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.histoire) || {};
  const STARTS = (Array.isArray(DATA.starts) ? DATA.starts : []).filter((s) => typeof s === "string" && s.trim());
  const LENGTHS = ["8", "12", "16"], MAX = 200, KEEP = 10, LIST = "histoire:liste";
  const int = (x, max) => (Number.isInteger(x) && x >= 0 && x <= max ? x : 0);
  const seedOf = (g) => Number(g.setup.seed) >>> 0 || 1;
  const token = (g) => g.gen + ":" + g.setup.seed;
  const size = (g) => (LENGTHS.indexOf(String(g.setup.longueur)) >= 0 && typeof g.setup.longueur !== "object" ? Number(g.setup.longueur) : 12);
  const first = (g) => (seedOf(g) % 2 ? "b" : "a");
  const clean = (s) => s.replace(/\s+/g, " ").trim().slice(0, MAX);
  /* Typographie française pour le texte brut (le partage) : esc() s'en charge pour l'écran. */
  const typo = (s) => s.replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« ");

  /* La première phrase : chaque paquet garde le même ordre d'une partie à la suivante (deck), et « Rejouer »
     passe à la suivante (at). */
  function opening(g) {
    if (!STARTS.length) return null;
    const deck = Number(g.setup.deck) || seedOf(g);
    return g.kit.shuffle(STARTS, deck)[int(g.setup.at, 1e6) % STARTS.length];
  }
  /* Les phrases d'un joueur, telles qu'elles sont arrivées (peut-être de l'autre téléphone) : bornées et en texte. */
  const lines = (g, w) => (Array.isArray(g.S[w].s) ? g.S[w].s.slice(0, 16) : []).map((x) => (typeof x === "string" ? clean(x) : ""));

  /* L'histoire telle qu'elle est : les phrases dans l'ordre, alternées, sans trou. Des comptes incohérents
     (valeurs trafiquées) sont ramenés à ce qui peut s'enchaîner. */
  function stage(g) {
    const N = size(g), f = first(g), o = g.other(f), A = lines(g, f), B = lines(g, o);
    const n = { [f]: Math.min(A.length, B.length + 1) };
    n[o] = Math.min(B.length, n[f]);
    const list = [];
    for (let i = 0; i < N; i++) {
      const w = i % 2 ? o : f;
      if (i >> 1 >= n[w]) break;
      list.push({ w, t: (w === f ? A : B)[i >> 1] });
    }
    const i = list.length, w = i < N ? (i % 2 ? o : f) : null;
    return { N, list, i, w, n, start: opening(g) };
  }
  /* Ce joueur a lu toute l'histoire. */
  const read = (g, st) => st.i >= st.N && int(g.local.r, 1e6) > st.N;
  const ready = (g) => !g.duo || !!g.S[g.other(g.me)].fin;
  /* La dernière phrase de l'autre, que le joueur w doit continuer : sinon, la première de l'histoire. */
  const last = (st, w) => { for (let i = st.i - 1; i >= 0; i--) if (st.list[i].w !== w) return st.list[i]; return null; };

  /* ---------- Histoires gardées sur l'appareil (et ce que l'autre y a écrit : même méfiance à la relecture) ---------- */
  const two = (x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string";
  function kept(k) {
    const list = k.store.get(LIST, null);
    return (Array.isArray(list) ? list : []).filter((h) => h && typeof h.k === "string" && typeof h.t === "string" && two(h.n) && Array.isArray(h.s) &&
      h.s.every((x) => Array.isArray(x) && (x[0] === "a" || x[0] === "b") && typeof x[1] === "string")).slice(-KEEP);
  }
  function remember(g, st) {
    const k = g.kit, list = kept(k), key = token(g);
    if (list.some((h) => h.k === key)) return;
    k.store.set(LIST, list.concat({ k: key, t: st.start, n: [k.nm("a").slice(0, 20), k.nm("b").slice(0, 20)], s: st.list.map((x) => [x.w, x.t]) }).slice(-KEEP));
  }
  const entry = (g, st) => ({ t: st.start, n: [g.kit.nm("a"), g.kit.nm("b")], s: st.list.map((x) => [x.w, x.t]) });

  /* Le texte de l'histoire, chaque phrase dans l'encre de qui l'a écrite. */
  function prose(k, h) {
    const who = (w) => '<span class="g-who ' + w + '"><i class="sw ' + w + '"></i>' + k.esc(h.n[w === "b" ? 1 : 0].slice(0, 20)) + "</span>";
    return '<p class="histoire-legend">' + who("a") + who("b") + '</p><p class="histoire-text"><span class="histoire-s">' + k.esc(h.t.slice(0, MAX)) + "</span> " +
      h.s.slice(0, 16).map((x) => '<span class="histoire-s as-' + x[0] + '"><span class="sr">' + k.esc(h.n[x[0] === "b" ? 1 : 0].slice(0, 20) + " : ") + "</span>" + k.esc(x[1].slice(0, MAX) || "…") + "</span>").join(" ") + "</p>";
  }
  const plain = (h) => typo(h.t + " " + h.s.map((x) => x[1]).filter(Boolean).join(" ") + "\n\n— " + h.n[0] + " et " + h.n[1] + ", « L'histoire à quatre mains »");
  const keepBtn = (i) => '<p class="histoire-keep"><button class="btn alt small" type="button" data-act="partager"' + (i != null ? ' data-i="' + i + '"' : "") +
    ">Enregistrer le texte</button><span class=\"histoire-msg\" role=\"status\"></span></p>";

  /* Feuille de partage du téléphone pour du texte ; sinon presse-papiers ; sinon le texte, sélectionné, à copier à la main.
     Tout part dans le geste du joueur, sans attente : sinon le navigateur refuse le partage. */
  function send(text, el) {
    const box = el.parentNode, msg = box.querySelector(".histoire-msg"), say = (t) => { if (msg) msg.textContent = t; };
    const manual = () => {
      let ta = box.querySelector("textarea");
      if (!ta) { ta = document.createElement("textarea"); ta.className = "g-field histoire-raw"; ta.readOnly = true; ta.rows = 6; ta.setAttribute("aria-label", "Le texte de l'histoire"); box.appendChild(ta); }
      ta.value = text;
      ta.focus();
      try { ta.setSelectionRange(0, text.length); } catch (e) { ta.select(); }
      say("Le texte est juste en dessous : copie-le pour le garder.");
    };
    const copy = () => {
      try { navigator.clipboard.writeText(text).then(() => say("Texte copié : colle-le où tu veux."), manual); } catch (e) { manual(); }
    };
    if (typeof navigator.share === "function") {
      try { navigator.share({ title: "L'histoire à quatre mains", text }).catch((e) => { if (!e || e.name !== "AbortError") copy(); }); } catch (e) { copy(); }
    } else copy();
  }

  /* Deux touchers pour tout effacer, entre 0,45 et 4 secondes d'écart. */
  let armed = 0;
  const EMPTY = ["Tout effacer", "Toucher encore pour effacer"];

  /* L'écran affiché et depuis quand : un bouton qui apparaît sous le doigt reste inerte une demi-seconde. */
  let seen = { k: "", at: 0 };
  const HOLD = '[data-act="moi"], [data-act="lire"], [data-act="suite"]';

  /* ---------- Écrans ---------- */
  const top = (g, label, n, of) => '<p class="histoire-step">' + (g.gen > 1 && !n && label.indexOf("Phrase") === 0 ? "Nouvelle histoire · " : "") + label +
    '</p><div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + of + '" aria-valuenow="' + n + '"><span style="width:' + (100 * n) / of + '%"></span></div>';
  const card = (k, x, label) => '<div class="g-card histoire-card' + (x.w ? " " + x.w : "") + '">' + (x.w ? '<p class="histoire-by">' + label + "</p>" : '<p class="g-tag">' + label + "</p>") +
    '<p class="g-card-text">' + k.esc(x.t || "…") + "</p></div>";

  function vWrite(g, st) {
    const k = g.kit, w = st.w, o = g.other(w), O = k.nm(o), prev = last(st, w), end = st.i === st.N - 1;
    return '<div class="histoire as-' + w + '" data-screen="ecrire-' + st.i + "-" + w + '">' + top(g, "Phrase " + (st.i + 1) + " sur " + st.N, st.i, st.N) +
      '<p class="histoire-who">' + k.who(w) + ' écrit</p><h1 class="g-title" tabindex="-1" data-focus>' + (end ? "À toi de la finir." : !st.i ? "À toi de lancer l'histoire." : "À toi d'écrire la suite.") + "</h1>" +
      (prev ? '<p class="histoire-start"><span class="eyebrow">La première phrase</span> ' + k.esc(st.start) + "</p>" + card(k, prev, "La dernière phrase " + k.esc(k.de(O)))
        : card(k, { t: st.start }, "La première phrase")) +
      '<form class="histoire-form"><textarea class="g-field histoire-field" name="phrase" rows="4" maxlength="' + MAX + '" data-keep="phrase-' + g.gen + "-" + seedOf(g) + "-" + st.i + "-" + w +
      '" enterkeyhint="done" placeholder="Ta phrase" aria-label="' + k.esc(k.nm(w) + ", ta phrase " + (st.i + 1) + " sur " + st.N) + '" aria-describedby="histoire-aide"></textarea>' +
      '<p class="hint" id="histoire-aide"><span class="histoire-count">' + MAX + " signes au plus.</span> " +
      k.esc(end ? "C'est la dernière phrase : à toi de trouver la chute." : O + " ne verra que celle-ci, pas le reste de l'histoire.") + "</p>" +
      '<div class="g-actions"><button class="btn" type="submit">' + (end ? "Finir l'histoire" : "Ajouter ma phrase") + "</button></div></form></div>";
  }

  function vWait(g, st) {
    const k = g.kit, O = k.nm(st.w), mine = last(st, st.w);
    return '<div class="histoire as-' + g.me + '" data-screen="attente-' + st.i + '">' + top(g, "Phrase " + (st.i + 1) + " sur " + st.N, st.i, st.N) +
      '<h1 class="g-title" tabindex="-1" data-focus>Au tour ' + k.esc(k.de(O)) + ".</h1>" +
      (mine ? '<p class="g-lead">Ta phrase est partie. ' + k.esc(O) + " ne verra qu'elle.</p>" + card(k, mine, "Ta dernière phrase")
        : '<p class="g-lead">' + k.esc(O) + " lance l'histoire. Tu ne verras que sa phrase, pour écrire la suite.</p>") +
      k.wait(g, O + " écrit la phrase " + (st.i + 1) + "…") + "</div>";
  }

  function vPass(g, st) {
    const k = g.kit;
    return '<div class="histoire" data-screen="passe-' + st.i + "-" + st.w + '">' + g.kit.pass(st.w, "moi") + '<p class="hint">' +
      k.esc("Phrase " + (st.i + 1) + " sur " + st.N + ". " + (st.i ? "Tu ne verras que la dernière phrase " + k.de(k.nm(g.other(st.w))) + "." : "C'est toi qui lances l'histoire.")) + "</p></div>";
  }

  function vDone(g) {
    return '<div class="histoire" data-screen="fin"><p class="eyebrow">Dernière phrase écrite</p><h1 class="g-title" tabindex="-1" data-focus>L\'histoire est complète.</h1><p class="g-lead">' +
      (g.duo ? "Vous allez la découvrir phrase par phrase, chacun sur son téléphone." : "Posez le téléphone entre vous deux : vous allez la découvrir phrase par phrase.") +
      '</p><div class="g-actions"><button class="btn" type="button" data-act="lire">Lire l\'histoire</button></div></div>';
  }

  function vRead(g, st, r) {
    const k = g.kit, x = r ? st.list[r - 1] : { t: st.start }, prev = r > 1 ? st.list[r - 2].t : r === 1 ? st.start : "";
    return '<div class="histoire" data-screen="lire-' + r + '">' + top(g, r ? "Phrase " + r + " sur " + st.N : "Lecture", r, st.N) +
      (prev ? '<p class="histoire-prev">' + k.esc(prev || "…") + "</p>" : "") +
      '<div class="histoire-now" tabindex="-1" data-focus>' + card(k, x, x.w ? k.who(x.w) : "La première phrase") + "</div>" +
      '<div class="g-actions"><button class="btn" type="button" data-act="suite">' + (r < st.N ? "Suivante" : "Toute l'histoire") + "</button></div></div>";
  }

  function vAll(g, st) {
    const k = g.kit, cur = String(size(g));
    const choice = (n) => '<button class="g-choice" type="button" data-act="again" data-val="' + n + '"' + (cur === n ? ' aria-current="true"' : "") + "><b>" + n + " phrases</b></button>";
    return '<div class="histoire" data-screen="histoire"><p class="eyebrow">Votre histoire</p><h1 class="g-title" tabindex="-1" data-focus>Voilà ce que vous avez écrit.</h1>' +
      prose(k, entry(g, st)) + keepBtn(null) + '<p class="hint">Elle est aussi gardée sur cet appareil, dans « Nos histoires », sur la présentation du jeu.</p>' +
      (ready(g) ? '<div class="g-opts"><p class="g-opts-label">Une autre histoire</p><div class="g-choices">' + LENGTHS.map(choice).join("") + "</div></div>"
        : k.wait(g, "Vous pourrez recommencer dès " + k.que(k.nm(g.other(g.me))) + " aura lu l'histoire.")) + "</div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "histoire",
    v: 1,
    title: "L'histoire à quatre mains",
    hook: "Et si on écrivait une histoire sans savoir où elle va ?",
    blurb: "Une première phrase, puis une phrase chacun, en ne voyant que la dernière de l'autre. À la fin, vous lisez tout.",
    meta: (STARTS.length ? STARTS.length + " débuts · " : "") + "10 min",
    intro: [
      "Une première phrase tombe : « Le pigeon qui entra dans la banque demanda à parler au directeur. » Chacun à son tour écrit la suivante, en ne voyant que la dernière phrase de l'autre, jamais le reste.",
      "Quand toutes les phrases sont écrites, vous découvrez l'histoire entière, phrase par phrase. Elle a rarement le sens prévu, et c'est tout l'intérêt."
    ],
    glyph: '<rect class="ink-a" x="7" y="9" width="22" height="7" rx="3.5"/><rect class="ink-b" x="19" y="21" width="22" height="7" rx="3.5"/><rect class="ink-a" x="7" y="33" width="16" height="7" rx="3.5"/>',
    live: true,
    options: [{
      id: "longueur", label: "Longueur", def: "12",
      choices: [{ id: "8", name: "8 phrases", hint: "Une histoire courte." }, { id: "12", name: "12 phrases", hint: "Le bon compromis." }, { id: "16", name: "16 phrases", hint: "Pour s'égarer." }]
    }],
    view(g) {
      const st = stage(g);
      /* Le fichier des débuts n'est pas arrivé sur cet appareil : surtout pas d'histoire sans début. */
      if (!st.start) return '<div class="histoire" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les débuts d\'histoire ne sont pas arrivés.</h1><p class="g-lead">Recharge la page : la partie reprendra où elle en était.</p></div>';
      if (st.w) {
        if (g.duo) return st.w === g.me ? vWrite(g, st) : vWait(g, st);
        return g.local.ok === st.i ? vWrite(g, st) : vPass(g, st);
      }
      const r = g.local.r;
      if (!Number.isInteger(r) || r < 0) return vDone(g);
      return r > st.N ? vAll(g, st) : vRead(g, st, r);
    },
    submit(g, form) {
      const st = stage(g), w = st.w, field = form.querySelector("[name=phrase]");
      if (!w || !field || !st.start || (g.duo ? w !== g.me : g.local.ok !== st.i)) return;
      const text = clean(field.value);
      if (!text) { field.focus(); return; }
      g.set(w, { s: lines(g, w).slice(0, st.n[w]).concat(text) });
    },
    input(g, el) {
      if (el.name !== "phrase") return;
      const c = el.form && el.form.querySelector(".histoire-count");
      if (c) c.textContent = (MAX - el.value.length) + " signes restants.";
    },
    act(g, name, el) {
      const st = stage(g), r = g.local.r, calm = Date.now() - seen.at >= 450;
      if (name === "moi" && st.w && !g.duo && g.local.ok !== st.i && calm) {
        g.local.ok = st.i;
        g.save();
        g.render();
      } else if (name === "lire" && !st.w && st.start && !Number.isInteger(r) && calm) {
        g.local.r = 0;
        g.save();
        g.render();
      } else if (name === "suite" && !st.w && Number.isInteger(r) && r >= 0 && r <= st.N && calm) {
        g.local.r = r + 1;
        g.save();
        /* Dernière phrase lue sur deux téléphones : l'autre apprend que j'ai fini (un message, sur mon toucher). */
        if (g.duo && r === st.N && !g.S[g.me].fin) g.set(g.me, { fin: 1 }); else g.render();
      } else if (name === "partager" && read(g, st)) {
        send(plain(entry(g, st)), el);
      } else if (name === "again" && read(g, st) && ready(g)) {
        const v = el.getAttribute("data-val");
        g.newGame({ longueur: LENGTHS.indexOf(v) >= 0 ? v : "12", deck: Number(g.setup.deck) || seedOf(g), at: (int(g.setup.at, 1e6) + 1) % 1e6 });
      }
    },
    over(g) { return read(g, stage(g)); },
    mount(g, root) {
      const st = stage(g), scr = root.querySelector("[data-screen]"), name = token(g) + ":" + (scr ? scr.getAttribute("data-screen") : ""), now = Date.now();
      if (name !== seen.k) seen = { k: name, at: now };
      /* Le bouton qui prend la place de celui qu'on vient de toucher ne répond pas tout de suite : un double
         toucher sur « Ajouter ma phrase » ne doit pas faire passer le téléphone sans que personne l'ait pris. */
      const wait = seen.at + 450 - now, held = wait > 0 ? root.querySelectorAll(HOLD) : [];
      held.forEach((b) => { b.disabled = true; });
      const timer = held.length && setTimeout(() => held.forEach((b) => { b.disabled = false; }), wait);
      const field = root.querySelector(".histoire-field");
      if (field) {
        if (field.value) g.def.input(g, field);
        if (document.activeElement !== field) { try { field.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
      }
      /* L'histoire se garde dès qu'elle est complète, même si personne ne l'a encore lue. */
      if (st.start && !st.w) remember(g, st);
      return () => clearTimeout(timer);
    },
    extra(k) {
      const list = kept(k);
      return list.length ? '<details class="more histoire-kept"><summary>Nos histoires (' + list.length + ')</summary><p class="hint">Vos ' + KEEP +
        " dernières histoires, gardées sur cet appareil seulement.</p>" + list.map((h, i) => '<details class="histoire-old"><summary>' + k.esc(h.n[0].slice(0, 20) + " et " + h.n[1].slice(0, 20) + " · " + (h.t.length > 60 ? h.t.slice(0, 58).replace(/\s+\S*$/, "") + "…" : h.t)) + "</summary>" + prose(k, h) + keepBtn(i) + "</details>").reverse().join("") +
        '<p><button class="link g-link" type="button" data-act="vider">' + EMPTY[Date.now() - armed < 4000 ? 1 : 0] + "</button></p></details>" : "";
    },
    extraAct(k, name, el) {
      if (name === "partager") {
        const h = kept(k)[int(parseInt(el.getAttribute("data-i"), 10), KEEP)];
        if (h) send(plain(h), el);
      } else if (name === "vider") {
        const dt = Date.now() - armed;
        if (dt >= 450 && dt < 4000) { armed = 0; k.store.del(LIST); k.render(); return; }
        if (dt < 450) return;
        armed = Date.now();
        el.textContent = EMPTY[1];
        setTimeout(() => { if (Date.now() - armed >= 4000) document.querySelectorAll('[data-act="vider"]').forEach((b) => { b.textContent = EMPTY[0]; }); }, 4050);
      }
    }
  });
})();
