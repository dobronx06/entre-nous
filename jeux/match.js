/* Le match des envies : chacun trie les idées d'un paquet, et seules celles que les deux veulent
   sont révélées.
   Tranche d'un joueur : { v: "0212…" }, une réponse par idée dans l'ordre du paquet (0 non,
   1 pourquoi pas, 2 carrément), envoyée en une seule fois quand il a fini. D'ici là, ses réponses
   restent un brouillon sur l'appareil : g.local.d, dans l'ordre d'affichage ; g.local.end, quand il
   s'arrête avant la fin ; g.local.go, quand le second joueur a repris le téléphone ; g.local.rev,
   quand il rouvre le résultat précédent. Rien ne part sans « Valider mes réponses ». L'état commun ne sert pas.
   Relancer un paquet glisse dans les réglages le résultat du précédent (setup.prev) : le téléphone
   dont le joueur ne l'a pas quitté lui-même le garde à l'écran jusqu'à ce qu'il passe à la suite.
   Sur l'appareil : « match:liste », les envies communes gardées ; « match:vu », le dernier résultat quitté. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.match) || {};
  /* Un paquet vide n'est pas proposé : le jeu ne montre que ce qu'il peut faire jouer. */
  const DECKS = (Array.isArray(DATA.decks) ? DATA.decks : []).filter((d) => d && Array.isArray(d.items) && d.items.length);
  const LIST = "match:liste", SEEN = "match:vu";
  const ANSWERS = ["Non", "Pourquoi pas", "Carrément"];
  /* Distance, en pixels, à partir de laquelle un glisser vaut réponse ; en deçà, la carte revient. */
  const REACH = 80;
  const OUT = ["translate(-60%, 0) rotate(-9deg)", "translate(60%, 0) rotate(9deg)", "translate(0, -45%)"];
  /* Un écran qui vient d'apparaître ne répond pas tout de suite : le toucher qui arrive visait l'ancien. */
  const LOCK = 500;
  /* drawn : l'état que montre l'écran ; screen et lock : l'écran affiché, et jusqu'à quand il ignore les touchers. */
  let flight = 0, grip = null, drawn = "", screen = "", lock = 0;

  const byId = (id) => DECKS.find((d) => d.id === id);
  /* Un paquet inconnu (réglage venu de l'autre téléphone) retombe sur le premier, pareil des deux côtés. */
  const deck = (g) => byId(g.setup.deck) || DECKS[0] || null;
  const order = (g, dk) => g.kit.shuffle(dk.items.map((_, i) => i), g.setup.seed);
  const tok = (g) => (g.gen + ":" + g.setup.seed).slice(0, 40);
  const spot = (g) => tok(g) + "/" + (typeof g.local.d === "string" ? g.local.d.length : 0);
  /* Des réponses ne comptent que complètes et bien formées : tout le reste veut dire « pas fini ». */
  const vec = (g, w, dk) => { const v = g.S[w].v; return typeof v === "string" && v.length === dk.items.length && /^[012]+$/.test(v) ? v : null; };
  const draft = (g, dk) => (typeof g.local.d === "string" && /^[012]*$/.test(g.local.d) ? g.local.d.slice(0, dk.items.length) : "");
  /* Tout a reçu une réponse, ou le joueur s'arrête là : reste à valider, ou à revenir en arrière. */
  const ended = (g, dk) => !!g.local.end || draft(g, dk).length === dk.items.length;
  /* Sur un seul téléphone, celui qui commence change à chaque paquet : l'appareil est déjà dans
     les mains de qui vient de finir le précédent. */
  const first = (g) => (g.gen % 2 ? "a" : "b");
  function turn(g, dk) {
    if (g.duo) return vec(g, g.me, dk) ? null : g.me;
    const f = first(g);
    return !vec(g, f, dk) ? f : !vec(g, g.other(f), dk) ? g.other(f) : null;
  }

  /* Ce que les deux veulent, idée par idée : 0 dès que l'un a dit non, sinon 1 à 3 (3 : deux
     « carrément »). Rien d'autre ne sort des réponses : ni total par joueur, ni envie restée seule. */
  function mask(g, dk) {
    const a = vec(g, "a", dk), b = vec(g, "b", dk);
    return a && b ? Array.from(a, (x, i) => (+x && +b[i] ? +x + +b[i] - 1 : 0)).join("") : null;
  }
  /* Le résultat du paquet précédent, joint par celui qui a relancé : on ne s'y fie qu'après contrôle. */
  function prev(g) {
    const p = g.setup.prev, dk = p && typeof p === "object" ? byId(p.d) : null;
    return dk && typeof p.k === "string" && p.k.length <= 40 && typeof p.m === "string" && p.m.length === dk.items.length && /^[0-3]+$/.test(p.m) ? { k: p.k, dk, m: p.m } : null;
  }
  /* Le résultat précédent à montrer avant le paquet en cours : celui que ce joueur n'a pas quitté lui-même
     (miss : l'autre a relancé pendant qu'il le lisait, ou en son absence), ou celui qu'il a voulu revoir. */
  function past(g) {
    const p = prev(g);
    if (!p) return null;
    p.miss = g.kit.store.get(SEEN, "") !== p.k;
    return p.miss || g.local.rev ? p : null;
  }

  /* ---------- « Nos envies » : la liste gardée sur l'appareil ---------- */
  function wishes(k) {
    const x = k.store.get(LIST, []);
    return (Array.isArray(x) ? x : []).filter((it) => it && typeof it.t === "string" && it.t)
      .map((it) => ({ t: it.t, d: String(it.d), s: it.s === 3 || it.s === 2 ? it.s : 1, f: it.f === true }));
  }
  /* Ajoute les envies communes d'un paquet, sans doublon : appelé à chaque affichage d'un résultat. */
  function keep(k, dk, m) {
    const list = wishes(k);
    let dirty = false;
    dk.items.forEach((t, i) => {
      const s = +m[i], it = list.find((x) => x.t === t);
      if (!s || (it && it.s >= s)) return;
      if (it) it.s = s; else list.push({ t, d: dk.id, s, f: false });
      dirty = true;
    });
    if (dirty) k.store.set(LIST, list);
  }
  /* « Fait » se coche sur place : un réaffichage refermerait la liste et ferait perdre le focus. */
  function fait(k, el) {
    const list = wishes(k), dk = byId(el.getAttribute("data-d")), i = parseInt(el.getAttribute("data-i"), 10);
    const it = dk ? list.find((x) => x.t === dk.items[i]) : list[i];
    if (!it) return;
    it.f = !it.f;
    k.store.set(LIST, list);
    el.setAttribute("aria-pressed", String(it.f));
    el.closest("li").classList.toggle("is-done", it.f);
  }
  /* Deux touchers pour ce qui ne se rattrape pas : le premier arme le bouton, le second confirme. */
  function sure(el, label) {
    if (el.getAttribute("data-armed")) return true;
    const was = el.textContent;
    el.setAttribute("data-armed", "1");
    el.textContent = label;
    setTimeout(() => {
      if (!el.isConnected) return;
      el.removeAttribute("data-armed");
      el.textContent = was;
    }, 4000);
    return false;
  }

  /* ---------- Répondre ---------- */
  /* Fin du paquet pour un joueur : ses réponses partent en une fois, rangées dans l'ordre du paquet ;
     les idées qu'il n'a pas vues comptent pour un non. */
  function finish(g, w, dk, d) {
    const v = dk.items.map(() => "0");
    order(g, dk).forEach((i, p) => { if (d[p]) v[i] = d[p]; });
    g.local.d = "";
    g.local.end = 0;
    g.set(w, { v: v.join("") });
  }
  /* La dernière réponse ne part pas d'elle-même : elle aussi doit pouvoir se reprendre. */
  function reply(g, a) {
    const dk = deck(g), w = dk && turn(g, dk);
    if (!w || ended(g, dk)) return;
    g.local.d = draft(g, dk) + a;
    g.save();
    g.render();
  }
  /* Le tampon de la carte annonce la réponse que donnerait le geste en cours. */
  function stamp(card, a, t) {
    const s = card.querySelector(".match-stamp");
    s.textContent = ANSWERS[a];
    s.className = "match-stamp k" + a + (t >= 1 ? " is-on" : "");
    s.style.opacity = Math.min(t, 1).toFixed(2);
  }
  /* La carte part du côté de sa réponse, puis la suivante arrive. La réponse n'est notée qu'à
     l'atterrissage, et seulement si rien n'a bougé entre-temps (paquet relancé depuis l'autre téléphone). */
  function fly(g, a) {
    const card = document.querySelector(".match-card"), at = spot(g);
    if (!card || flight || !(a >= 0 && a <= 2)) return;
    /* Un bouton ou une touche l'emporte sur un glisser resté en suspens. */
    grip = null;
    const land = () => { flight = 0; g.hold(false); if (spot(g) === at) reply(g, a); else g.render(); };
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { land(); return; }
    g.hold(true);
    stamp(card, a, 1);
    card.classList.add("is-out");
    card.style.transform = OUT[a];
    card.style.opacity = "0";
    flight = setTimeout(land, 180);
  }

  /* ---------- Écrans ---------- */
  const head = (g, w, word, at, p, n) => '<p class="match-head">' + g.kit.who(w) + "<span>" + word + '</span><span class="match-count">' + at + " / " + n + "</span></p>" +
    '<div class="progress" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + p + '"><span style="width:' + (100 * p) / n + '%"></span></div>';

  /* L'aide ne s'affiche qu'à la première carte : ensuite, la place revient à la carte. Le résultat précédent
     s'y rouvre aussi, sur sa propre ligne : jamais là où « Revenir à la précédente » se touche en série. */
  function vCard(g, dk, w) {
    const k = g.kit, n = dk.items.length, p = draft(g, dk).length;
    const btn = (a, cls) => '<button class="btn' + cls + '" type="button" data-act="rep" data-k="' + a + '">' + ANSWERS[a] + "</button>";
    return '<div class="match as-' + w + '" data-screen="carte-' + w + '">' + head(g, w, "répond", p + 1, p, n) +
      '<div class="match-stage" data-left="' + Math.min(n - p, 3) + '"><div class="g-card match-card"><span class="g-tag">' + k.esc(dk.name) + '</span><h1 class="g-card-text" tabindex="-1" data-focus>' + k.esc(dk.items[order(g, dk)[p]]) +
      '</h1><span class="match-stamp" aria-hidden="true"></span></div></div>' +
      (p ? "" : '<p class="hint">' + k.esc("Tu peux aussi faire glisser la carte : à gauche, non ; à droite, pourquoi pas") + '<span class="match-up">' + k.esc(" ; vers le haut, carrément") +
        '</span>.<span class="match-keys"> Au clavier, les flèches font la même chose.</span></p>' +
        (prev(g) ? '<p class="match-prev"><button class="link" type="button" data-act="review">Revoir le résultat précédent</button></p>' : "")) +
      '<div class="g-actions match-acts">' + btn(0, " alt") + btn(1, " match-soft") + btn(2, "") + '<p class="match-more">' +
      (p ? '<button class="link" type="button" data-act="undo">Revenir à la précédente</button>' : "") +
      '<button class="link" type="button" data-act="stop">J\'arrête là</button></p></div></div>';
  }

  /* Avant l'envoi, un dernier écran : c'est le seul endroit d'où les réponses partent, et on peut encore en revenir. */
  function vEnd(g, dk, w) {
    const k = g.kit, n = dk.items.length, p = draft(g, dk).length, left = n - p;
    return '<div class="match as-' + w + '" data-screen="fin-' + w + '">' + head(g, w, "a répondu", p, p, n) + '<h1 class="g-title" tabindex="-1" data-focus>' +
      (left ? "Tu t'arrêtes là\u00a0?" : "C'était la dernière.") + '</h1><p class="g-lead">' +
      k.esc(left ? (left > 1 ? "Les " + left + " idées que tu n'as pas vues compteront" : "L'idée que tu n'as pas vue comptera") + " comme un non." : "Encore un doute ? Tu peux revenir sur ta dernière réponse avant de valider.") +
      '</p><div class="g-actions match-acts"><button class="btn" type="button" data-act="send">Valider mes réponses</button><p class="match-more"><button class="link" type="button" data-act="undo">' +
      (left ? "Continuer le paquet" : "Revenir à la dernière carte") + "</button></p></div></div>";
  }

  function vWait(g, dk) {
    const k = g.kit, o = k.nm(g.other(g.me));
    return '<div class="match as-' + g.me + '" data-screen="attente"><p class="eyebrow">' + k.esc(dk.name) + '</p><h1 class="g-title" tabindex="-1" data-focus>C\'est noté.</h1><p class="g-lead">' +
      k.esc("Le résultat s'ouvrira ici dès " + k.que(o) + " aura fini ce paquet. Tu peux fermer la page et revenir plus tard : rien ne se perd.") + "</p>" +
      k.wait(g, "En attente des réponses " + k.de(o) + "…") + "</div>";
  }

  const row = (k, t, top, done, ref, from) => "<li" + (done ? ' class="is-done"' : "") + '><div class="match-idea">' + (top ? '<span class="g-tag match-duo">Coup de cœur à deux</span>' : "") + "<p>" + k.esc(t) + "</p>" +
    (from ? '<span class="match-from">' + k.esc(from) + "</span>" : "") + '</div><button class="match-done" type="button" data-act="fait" ' + ref + ' aria-label="' + k.esc("Fait : " + t) + '" aria-pressed="' + !!done + '">Fait</button></li>';

  /* Le résultat d'un paquet : celui qui vient de se jouer, ou le précédent (old : 1 s'il attend encore d'être
     quitté, 2 s'il a été rouvert). Les deux portent le même nom d'écran : quand l'autre relance pendant qu'on
     lit, la page ne remonte pas, et seul le bas de l'écran change. */
  function vResult(g, dk, m, old) {
    const k = g.kit, list = wishes(k), n = m.replace(/0/g, "").length, top = m.split("3").length - 1;
    const lead = !n ? "Ça arrive, et ça ne dit rien de vous deux." + (old ? "" : " Ce paquet n'était pas le vôtre : essayez-en un autre.")
      : n === 1 ? (top ? "Et c'est un coup de cœur à deux." : "Une seule, mais c'est la vôtre.")
        : (top ? "Dont " + k.pl(top, "coup de cœur", "coups de cœur") + " à deux. " : "") + "Reste à choisir par laquelle commencer.";
    const ideas = dk.items.map((t, i) => ({ t, i, s: +m[i] })).filter((x) => x.s).sort((x, y) => y.s - x.s)
      .map((x) => row(k, x.t, x.s > 2, list.some((it) => it.t === x.t && it.f), 'data-d="' + k.esc(dk.id) + '" data-i="' + x.i + '"')).join("");
    const again = () => '<div class="g-opts"><p class="g-opts-label">Jouer un autre paquet</p><div class="g-choices">' + DECKS.map((d) => '<button class="g-choice" type="button" data-act="again" data-deck="' + k.esc(d.id) + '"' +
      (d === dk ? ' aria-current="true"' : "") + "><b>" + k.esc(d.name) + (d.adult === true ? ' <span class="g-tag">Adultes</span>' : "") + "</b></button>").join("") + "</div>" +
      (g.duo ? '<p class="hint" role="status">Le paquet choisi démarre aussi chez ' + k.esc(k.nm(g.other(g.me))) + ".</p>" : "") + "</div>";
    const next = () => '<div class="g-actions match-acts">' + (old === 1 ? '<p class="hint">' + k.esc("Le paquet suivant est déjà lancé : « " + deck(g).name + " ».") + "</p>" : "") +
      '<button class="btn" type="button" data-act="ok">' + (old === 1 ? "Passer au paquet suivant" : "Revenir au paquet en cours") + "</button></div>";
    return '<div class="match" data-screen="resultat"><p class="eyebrow">' + (old ? "Paquet précédent" : "Résultat") + " · " + k.esc(dk.name) + '</p><div class="match-venn">' + k.venn(Math.round((100 * n) / m.length)) +
      '</div><h1 class="g-title" tabindex="-1" data-focus>' + (n ? '<span class="g-big">' + n + "</span> " + (n > 1 ? "envies" : "envie") + " en commun" : "Rien en commun, cette fois.") + '</h1><p class="g-lead">' + k.esc(lead) + "</p>" +
      (n ? '<ul class="match-list">' + ideas + '</ul><p class="hint">' + k.esc((n > 1 ? "Elles sont gardées" : "Elle est gardée") + " sur cet appareil, dans « Nos envies » : la liste vous attend sur la page du jeu, une fois la partie arrêtée.") + "</p>" : "") +
      (old ? next() : again()) + "</div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "match",
    v: 1,
    title: "Le match des envies",
    hook: "Est-ce qu'on a envie des mêmes choses ?",
    blurb: "Des idées de sorties, de voyages, de projets : chacun répond de son côté, et seules les envies que vous partagez sont révélées.",
    meta: "6 paquets · 5 min",
    intro: [
      "Les idées d'un paquet défilent une à une : une sortie, un voyage, un projet un peu fou. Pour chacune, tu réponds « non », « pourquoi pas » ou « carrément », sans que l'autre voie tes réponses.",
      "À la fin, seules les envies que vous partagez sont révélées, et gardées dans une liste à cocher. Les refus restent secrets : une envie qui n'est pas partagée n'apparaît nulle part."
    ],
    glyph: '<rect class="ink-a" x="6" y="10" width="22" height="30" rx="4" transform="rotate(-9 17 25)"/><rect class="ink-b" x="20" y="8" width="22" height="30" rx="4" transform="rotate(9 31 23)"/>',
    live: false,
    options: DECKS.length ? [{ id: "deck", label: "Paquet", def: (byId("sorties") || DECKS[0]).id, choices: DECKS.map((d) => ({ id: d.id, name: d.name, hint: d.hint, adult: d.adult === true })) }] : [],
    view(g) {
      const k = g.kit, dk = deck(g);
      if (!dk) return '<div class="match" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les cartes manquent.</h1><p class="g-lead">Le jeu n\'a pas pu charger ses paquets. Recharge la page, puis relance une partie.</p></div>';
      const old = past(g), m = mask(g, dk), w = turn(g, dk);
      if (old) return vResult(g, old.dk, old.m, old.miss ? 1 : 2);
      if (!w) return m ? vResult(g, dk, m, 0) : vWait(g, dk);
      if (!g.duo && w !== first(g) && !g.local.go) {
        return '<div class="match" data-screen="passage">' + k.pass(w, "go") + '<p class="hint">' + k.esc("Les réponses " + k.de(k.nm(g.other(w))) + " restent secrètes : seules vos envies communes seront révélées.") + "</p></div>";
      }
      return ended(g, dk) ? vEnd(g, dk, w) : vCard(g, dk, w);
    },
    act(g, name, el) {
      /* L'écran est resté figé pendant un geste alors que l'autre téléphone a relancé un paquet : ce toucher
         visait l'ancien. On montre le nouveau, sans rien faire d'autre. */
      if (drawn !== spot(g)) { g.render(); return; }
      const k = g.kit, dk = deck(g), old = past(g), m = dk && mask(g, dk), w = dk && turn(g, dk), d = dk ? draft(g, dk) : "", id = el.getAttribute("data-deck");
      if (name === "rep") {
        fly(g, parseInt(el.getAttribute("data-k"), 10));
      } else if (name === "undo" && w && (d || g.local.end)) {
        /* Après « J'arrête là », revenir ne défait aucune réponse : on retrouve la carte laissée. */
        if (!g.local.end) g.local.d = d.slice(0, -1);
        g.local.end = 0;
        g.save();
        g.render();
      } else if (name === "stop" && w) {
        g.local.end = 1;
        g.save();
        g.render();
      } else if (name === "send" && w && ended(g, dk)) {
        finish(g, w, dk, d);
      } else if (name === "go") {
        g.local.go = 1;
        g.save();
        g.render();
      } else if (name === "ok" && old) {
        k.store.set(SEEN, old.k);
        g.local.rev = 0;
        g.save();
        g.render();
      } else if (name === "review" && prev(g)) {
        g.local.rev = 1;
        g.save();
        g.render();
      } else if (name === "fait") {
        fait(k, el);
      } else if (name === "again" && m && !old && byId(id)) {
        /* Sans liaison, l'autre a peut-être déjà relancé, et même joué : deux relances de même rang se
           départagent au profit d'une seule, et le paquet de l'autre serait perdu. */
        if (g.duo && g.online !== "ok") {
          el.closest(".g-opts").querySelector(".hint").textContent = "La connexion est coupée pour le moment. Réessaie dans un instant\u00a0: le paquet doit démarrer sur vos deux téléphones.";
          return;
        }
        /* Quitter le résultat de soi-même, c'est l'avoir vu : il ne sera pas remontré d'office. */
        k.store.set(SEEN, tok(g));
        g.newGame({ deck: id, prev: { k: tok(g), d: dk.id, m } });
      }
    },
    /* Un paquet est fini dès que son résultat peut s'afficher : l'accueil ne propose plus de le reprendre. */
    over(g) {
      const dk = deck(g);
      return !!dk && !!mask(g, dk);
    },
    key(g, ev) {
      const a = ["ArrowLeft", "ArrowRight", "ArrowUp"].indexOf(ev.key);
      if (a < 0 || ev.metaKey || ev.ctrlKey || ev.altKey || !document.querySelector(".match-card")) return;
      ev.preventDefault();
      /* Une touche restée enfoncée ne doit pas faire défiler tout le paquet. */
      if (ev.repeat || Date.now() < lock) return;
      if (drawn !== spot(g)) g.render(); else fly(g, a);
    },
    mount(g, root) {
      const k = g.kit, dk = deck(g), old = past(g), m = dk && mask(g, dk), scr = root.querySelector(".match"), card = root.querySelector(".match-card");
      const name = scr.getAttribute("data-screen") + "|" + tok(g);
      drawn = spot(g);
      if (name !== screen) { screen = name; lock = Date.now() + LOCK; }
      /* Tant que les touchers s'enchaînent sur un écran tout juste apparu, aucun ne compte, y compris sur
         « Arrêter la partie » en bas de page : un doigt resté sur le rythme de l'écran d'avant ne lit pas. */
      root.addEventListener("click", (e) => {
        if (Date.now() >= lock) return;
        lock = Date.now() + LOCK;
        e.stopPropagation();
        e.preventDefault();
      }, true);
      /* Les envies communes rejoignent la liste de l'appareil dès que leur résultat est affiché. */
      if (old) keep(k, old.dk, old.m);
      else if (m) keep(k, dk, m);
      if (!card) return;
      /* Quand la page dépasse de l'écran, un pouce posé sur la carte veut souvent la faire défiler : le
         geste vers le haut est alors rendu au navigateur, et « carrément » ne se donne qu'au bouton. */
      const flat = document.documentElement.scrollHeight > window.innerHeight;
      scr.classList.toggle("is-flat", flat);
      const aim = (e) => {
        const x = e.clientX - grip.x, y = e.clientY - grip.y, up = -y > Math.abs(x);
        return { x, y, a: up ? 2 : x < 0 ? 0 : 1, far: !up ? Math.abs(x) : flat && grip.finger ? 0 : -y };
      };
      card.addEventListener("pointerdown", (e) => {
        if (flight || !e.isPrimary || e.button) return;
        grip = { x: e.clientX, y: e.clientY, id: e.pointerId, finger: e.pointerType !== "mouse" };
        /* Sans capture (navigateur ancien), le geste reste suivi tant que le doigt est sur la carte. */
        try { card.setPointerCapture(e.pointerId); } catch (err) { /* voir ci-dessus */ }
        card.classList.remove("is-back");
        /* Ce qu'envoie l'autre téléphone attendra la fin du geste pour s'afficher. */
        g.hold(true);
      });
      card.addEventListener("pointermove", (e) => {
        if (!grip || e.pointerId !== grip.id) return;
        const o = aim(e);
        card.style.transform = "translate(" + o.x + "px," + o.y + "px) rotate(" + (o.x / 22).toFixed(1) + "deg)";
        stamp(card, o.a, o.far / REACH);
      });
      const drop = (e) => {
        if (!grip || e.pointerId !== grip.id) return;
        const o = aim(e);
        grip = null;
        if (drawn !== spot(g)) { g.render(); return; }
        if (e.type === "pointerup" && o.far >= REACH) { fly(g, o.a); return; }
        card.classList.add("is-back");
        card.style.transform = "";
        stamp(card, o.a, 0);
        g.hold(false);
      };
      card.addEventListener("pointerup", drop);
      card.addEventListener("pointercancel", drop);
      return () => { clearTimeout(flight); flight = 0; grip = null; };
    },
    extra(k) {
      const list = wishes(k);
      return list.length ? '<details class="more match-keep"><summary>Nos envies <span class="g-tag">' + list.length + '</span></summary><p class="hint">' +
        k.esc("Les envies que vous partagez, gardées sur cet appareil. Cochez celles que vous avez réalisées.") + '</p><ul class="match-list">' +
        list.map((it, i) => row(k, it.t, it.s > 2, it.f, 'data-i="' + i + '"', (byId(it.d) || {}).name)).join("") +
        '</ul><p><button class="link" type="button" data-act="vider">Vider la liste</button></p></details>' : "";
    },
    extraAct(k, name, el) {
      if (name === "fait") fait(k, el);
      else if (name === "vider" && sure(el, "Toucher encore pour tout effacer")) {
        /* Mise à jour sur place : un réaffichage ferait disparaître le bloc sans un mot, et le focus avec lui. */
        const box = el.closest("[data-extra]");
        k.store.del(LIST);
        box.innerHTML = '<p class="hint" role="status" tabindex="-1">La liste est vide.</p>';
        box.firstChild.focus();
      }
    }
  });
})();
