/* Les cartes à piocher : une pile de questions, de défis et de cartes à deux, que le couple
   fait défiler ensemble. La pile se déduit des réglages (paquet, lieu, seed) : elle est donc
   la même sur les deux téléphones et seule la position voyage.
   État commun : { i }, le rang de la carte affichée ; i = taille de la pile quand le paquet
   est fini. Rien dans les tranches : aucune carte n'appartient à un joueur et il n'y a rien
   à cacher. Sur l'appareil : g.local.pick, quand on a ouvert le choix d'un autre paquet.
   Un message par carte piochée, pas plus. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.cartes) || { decks: [] };
  const KINDS = { q: "Question", d: "Défi", 2: "À deux" };
  const MIX = { id: "melange", name: "Mélange", hint: "Léger et profond, battus ensemble." };
  const deck = (id) => DATA.decks.find((d) => d.id === id);
  /* Les paquets proposés : le mélange se range avant le paquet réservé aux adultes, dont il ne contient rien. */
  const DECKS = DATA.decks.filter((d) => !d.adult).concat(MIX, DATA.decks.filter((d) => d.adult));
  /* Le paquet de la manche. Ce réglage vient parfois de l'autre téléphone : inconnu, il retombe sur le paquet léger. */
  const chosen = (g) => DECKS.find((d) => d.id === g.setup.deck) || deck("leger") || MIX;
  /* Le jeu se déclare avant que le socle sache si l'on peut jouer sur deux téléphones : même test que le moteur
     (un vrai site, hors d'un cadre, avec le chiffrement du navigateur). Sinon, la présentation ne promet pas de jouer à distance. */
  let two = /^https?:$/.test(location.protocol) && !!(window.crypto && window.crypto.subtle);
  try { two = two && window.self === window.top; } catch (e) { two = false; }

  /* La pile de la manche : mêmes cartes, même ordre et même premier joueur sur les deux téléphones.
     Les cartes pour une seule personne alternent de l'un à l'autre, quelles que soient les cartes
     à deux glissées entre elles. Le mélange tire la moitié de chaque paquet pour garder la même longueur. */
  function pile(g) {
    const k = g.kit, seed = Number(g.setup.seed) >>> 0, far = g.duo && g.setup.lieu === "distance";
    const cards = (id) => ((deck(id) || {}).cards || []).filter((c) => c && KINDS.hasOwnProperty(c.t) && typeof c.x === "string" && !(far && c.near));
    const half = (id, s) => { const all = k.shuffle(cards(id), s); return all.slice(0, Math.ceil(all.length / 2)); };
    const id = chosen(g).id;
    let w = seed % 2 ? "b" : "a";
    return k.shuffle(id === "melange" ? half("leger", seed + 1).concat(half("profond", seed + 2)) : cards(id), seed).map((c) => {
      const who = c.t === "2" ? null : w;
      if (who) w = g.other(w);
      return { t: c.t, x: c.x, w: who };
    });
  }
  /* La position vient parfois de l'autre téléphone : tout ce qui n'est pas un rang de la pile ramène à la première carte. */
  const rank = (g, n) => (Number.isInteger(g.sh.i) && g.sh.i >= 0 && g.sh.i <= n ? g.sh.i : 0);
  /* Le jeu n'écrit que ce qui est à lui : ce qu'un autre a glissé dans l'état commun ou dans les réglages ne doit pas
     repartir avec chaque carte (une clé laissée à undefined disparaît à l'enregistrement et à l'envoi). */
  const only = (old, keep) => Object.keys(old).reduce((o, key) => { if (!(key in o)) o[key] = undefined; return o; }, keep);

  /* Ce que cet appareil vient d'afficher, pour faire entrer la carte du bon côté et pour savoir ce qui a
     changé sous le doigt (mine : le changement vient d'un geste fait ici). focus : le bouton du choix
     d'un paquet qui avait le focus au moment où l'écran a été réaffiché. */
  let last = null, mine = false, lock = 0, focus = -1;

  /* L'écran vient de changer sous le doigt (lock, posé dans mount) : pendant une demi-seconde, un toucher vise encore l'ancien. */
  const late = () => Date.now() < lock;

  function move(g, step) {
    const n = pile(g).length, i = rank(g, n) + step;
    if (!n || i < 0 || i > n || late()) return;
    mine = true;
    g.local.pick = false;
    g.share(only(g.sh, { i }));
  }

  function vCard(g, list, i) {
    const k = g.kit, n = list.length, c = list[i], w = c.w, o = w ? k.nm(g.other(w)) : "", oth = g.other(g.me);
    const text = w ? k.fill(c.x, { o, de_o: k.de(o), que_o: k.que(o) }) : c.x;
    const whose = !w ? "Pour vous deux" : !g.duo ? "Pour " + k.nm(w) : (w === g.me ? "À toi" : "À " + k.nm(w)) + (c.t === "d" ? " de jouer" : " de répondre");
    /* L'attente de l'autre se place au-dessus de la carte : le rappel du lien d'invitation s'y déplie sans passer sous les boutons. */
    return '<div class="cartes' + (w ? " as-" + w : "") + '" data-screen="carte-' + i + '">' + (g.duo && !g.here(oth) ? k.wait(g, "En attente " + k.de(k.nm(oth)) + "…") : "") +
      '<p class="cartes-step"><span>' + k.esc(chosen(g).name) + ' · <button class="link" type="button" data-act="pick" aria-label="Changer de paquet">changer</button></span><span class="cartes-count"><span aria-hidden="true">' + (i + 1) + "\u00a0/\u00a0" + n +
      '</span><span class="sr">Carte ' + (i + 1) + " sur " + n + '</span></span></p><div class="cartes-stack" data-left="' + Math.min(n - 1 - i, 2) + '">' +
      '<article class="g-card cartes-card' + (w ? " " + w : "") + (g.duo && w === g.me ? " me" : "") + '" data-t="' + c.t + '" data-i="' + i + '"><p class="cartes-head" id="cartes-head"><span class="cartes-for">' +
      '<span class="cartes-inks">' + (w ? '<i class="sw ' + w + '"></i>' : '<i class="sw a"></i><i class="sw b"></i>') + "</span>" + k.esc(whose) + '</span><span class="g-tag">' + KINDS[c.t] + "</span></p>" +
      '<h1 class="g-card-text cartes-text' + (text.length > 110 ? " long" : "") + '" tabindex="-1" data-focus aria-describedby="cartes-head">' + k.esc(text) + "</h1></article></div>" +
      '<div class="g-actions"><button class="btn alt" type="button" data-act="prev"' + (i ? "" : " disabled") + '>Précédente</button><button class="btn" type="button" data-act="next">' +
      (i === n - 1 ? "Finir le paquet" : "Carte suivante") + "</button></div></div>";
  }

  /* Le choix d'un paquet, en trois occasions : le paquet est vide, il est fini, ou on veut en changer en route.
     Le retour à la carte tient la rangée du bas, à la place de « Précédente » et « Carte suivante » : aucun paquet
     ne s'affiche jamais là où le pouce vient de toucher, et un toucher de trop n'en ouvre pas un autre. */
  function vDecks(g, n, i) {
    const k = g.kit, d = chosen(g), cur = n ? d.id : "";
    const back = (act, text) => '<div class="g-actions"><button class="btn alt" type="button" data-act="' + act + '">' + text + "</button></div>";
    const [screen, where, title, lead, label, foot] = !n
      ? ["vide", "", "Ce paquet est vide.", "Il n'y a aucune carte à piocher ici pour le moment.", "Piocher plutôt dans", ""]
      : i === n
        ? ["fin", " · fin du paquet", "Vous avez vidé le paquet.", k.pl(n, "carte", "cartes") + ", et sûrement une ou deux découvertes. On continue\u00a0?" + (g.duo ? " Le paquet choisi s'ouvre sur vos deux téléphones." : ""),
          "Continuer avec", back("prev", "Revenir à la dernière carte")]
        : ["paquets", " · carte " + (i + 1) + " sur " + n, "On change de paquet\u00a0?", "La pioche repart à la première carte du paquet choisi" + (g.duo ? ", sur vos deux téléphones." : "."),
          "Piocher dans", back("pick", "Revenir à la carte")];
    return '<div class="cartes cartes-end" data-screen="' + screen + '"><div class="glyph big"><svg class="inks" viewBox="0 0 48 48" aria-hidden="true">' + g.def.glyph + '</svg></div><p class="eyebrow">' + k.esc(d.name) + where +
      '</p><h1 class="g-title" tabindex="-1" data-focus>' + title + '</h1><p class="g-lead">' + lead + "</p>" +
      (DATA.decks.length ? '<div class="g-opts"><p class="g-opts-label">' + label + '</p><div class="g-choices">' + DECKS.map((x) =>
        '<button class="g-choice" type="button" data-act="deck" data-deck="' + k.esc(x.id) + '" aria-pressed="' + (x.id === cur) + '"><b>' + k.esc(x.name) + (x.adult ? ' <span class="g-tag">Adultes</span>' : "") +
        "</b><span>" + k.esc(x.id === cur ? "Le même paquet, rebattu." : x.hint) + "</span></button>").join("") + "</div></div>" : "") + foot + "</div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "cartes",
    v: 1,
    title: "Les cartes à piocher",
    hook: "Qu'est-ce qu'on ne s'est jamais demandé ?",
    blurb: "Chacun son tour, une carte : une question à laquelle répondre, un défi à relever, un moment à partager. Trois paquets : du léger, du profond et du coquin.",
    meta: "180 cartes · ni score ni chrono",
    intro: [
      "Une carte s'affiche : une question à laquelle répondre à voix haute, un petit défi à relever, ou une carte à jouer à deux. Les questions et les défis s'adressent à l'un de vous, chacun son tour : la carte dit pour qui elle est. Ensuite, on pioche la suivante.",
      (two ? "Posez un téléphone entre vous, ou prenez chacun le vôtre, même à distance pendant un appel : la même carte s'affiche des deux côtés." : "Posez le téléphone entre vous et lisez la carte à voix haute.") +
        " Pas de score, pas de chrono, et on a le droit de passer une carte."
    ],
    glyph: '<rect class="ink-a" x="15" y="8" width="18" height="28" rx="4" transform="rotate(-14 24 40)"/><rect class="ink-b" x="15" y="8" width="18" height="28" rx="4" transform="rotate(14 24 40)"/>',
    live: true,
    options: [{ id: "deck", label: "Paquet", def: "leger", choices: DECKS }].concat(two ? {
      id: "lieu", label: "Vous êtes", def: "ensemble",
      choices: [
        { id: "ensemble", name: "Côte à côte", hint: "Dans la même pièce : toutes les cartes du paquet." },
        { id: "distance", name: "À distance", hint: "En appel : sans les cartes qui demandent d'être ensemble." }
      ]
    } : []),
    view(g) {
      const list = pile(g), n = list.length, i = rank(g, n);
      return !n || i === n || g.local.pick ? vDecks(g, n, i) : vCard(g, list, i);
    },
    act(g, name, el) {
      if (name === "next") move(g, 1);
      else if (name === "prev") move(g, -1);
      else if (late()) return;
      else if (name === "pick") { g.local.pick = !g.local.pick; g.save(); g.render(); }
      else if (name === "deck") { mine = true; g.newGame(only(g.setup, { deck: el.getAttribute("data-deck"), lieu: g.setup.lieu === "distance" ? "distance" : "ensemble" })); }
    },
    over(g) { const n = pile(g).length; return rank(g, n) === n; },
    key(g, ev) {
      if (g.local.pick || ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey || /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      if (ev.key === "ArrowRight") move(g, 1);
      else if (ev.key === "ArrowLeft") move(g, -1);
    },
    mount(g, root) {
      const card = root.querySelector(".cartes-card"), now = { k: g.gen + ":" + g.setup.seed, i: rank(g, pile(g).length), c: !!card };
      const turned = last && (last.k !== now.k || last.i !== now.i), kept = focus;
      /* Ce qui est sous le doigt n'est plus ce qu'il visait : l'autre vient de piocher, ou l'écran est passé
         d'une carte au choix d'un paquet (ou l'inverse), d'ici ou de l'autre téléphone. */
      if (last && (last.c !== now.c || (card && turned && !mine))) lock = Date.now() + 500;
      if (turned && card) card.classList.add(last.k === now.k && now.i < last.i ? "back" : "next");
      last = now;
      mine = false;
      focus = -1;
      if (!card) {
        /* Chaque carte piochée par l'autre réaffiche le choix d'un paquet : le bouton atteint au clavier garde le focus. */
        const btns = Array.from(root.querySelectorAll(".cartes-end button"));
        if (btns[kept]) btns[kept].focus({ preventScroll: true });
        return () => { focus = btns.indexOf(document.activeElement); };
      }
      /* Glisser la carte d'un doigt : vers la gauche pour la suivante, vers la droite pour revenir.
         Un second doigt annule le geste : deux doigts posés ou écartés ne sont pas un glissement. */
      let id = null, x0 = 0, y0 = 0;
      card.addEventListener("pointerdown", (e) => { id = e.isPrimary && e.pointerType !== "mouse" ? e.pointerId : null; x0 = e.clientX; y0 = e.clientY; });
      card.addEventListener("pointercancel", () => { id = null; });
      card.addEventListener("pointerup", (e) => {
        const dx = e.clientX - x0, dy = e.clientY - y0, ok = e.pointerId === id;
        id = null;
        if (ok && Math.abs(dx) >= 50 && Math.abs(dx) > 2 * Math.abs(dy)) move(g, dx < 0 ? 1 : -1);
      });
    }
  });
})();
