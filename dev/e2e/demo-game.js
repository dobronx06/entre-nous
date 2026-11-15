/* Jeu d'essai du socle (assets/jeux.js). Il n'est jamais chargé par le site : les essais
   l'injectent avant les scripts de la page. Il affiche l'état brut et offre un bouton par
   fonction du socle. */
(window.GAMES = window.GAMES || []).push({
  id: "demo",
  v: 1,
  title: "Démo",
  hook: "Un jeu d'essai pour le socle",
  blurb: "Chaque bouton exerce une fonction du socle.",
  meta: "essai",
  intro: ["Ce jeu n'existe que pour les essais automatiques."],
  glyph: '<circle class="ink-a" cx="18" cy="24" r="12"/><circle class="ink-b" cx="30" cy="24" r="12"/>',
  live: true,
  options: [{ id: "mode", label: "Mode", def: "x", choices: [{ id: "x", name: "Mode X", hint: "Le premier." }, { id: "y", name: "Mode Y", hint: "Le second.", adult: true }] }],
  view(g) {
    const k = g.kit, me = g.me || "a";
    const state = { duo: g.duo, me: g.me, gen: g.gen, setup: g.setup, a: g.S.a, b: g.S.b, sh: g.sh, local: g.local, hereA: g.here("a"), hereB: g.here("b"), online: g.online };
    const btn = (act, label, w) => '<button class="btn small" type="button" data-act="' + act + '"' + (w ? ' data-w="' + w + '"' : "") + ">" + label + "</button>";
    return '<div class="as-' + me + '"><pre id="state" hidden>' + k.esc(JSON.stringify(state)) + "</pre>" +
      '<p id="who">' + k.who("a") + k.who("b") + "</p>" +
      '<input class="g-field" id="note" data-keep="note-' + g.gen + '" aria-label="Note">' +
      '<div class="actions">' + btn("inc", "+1 a", "a") + btn("inc", "+1 b", "b") + btn("mine", "+1 moi") + btn("sh", "commun") + btn("big", "gros") +
      btn("new", "nouvelle manche") + btn("local", "local") + btn("hold", "tenir") + btn("release", "lâcher") + btn("end", "fin") + "</div>" +
      k.pass("b", "noop") + k.wait(g, "En attente " + k.de(k.nm(g.other(me))) + "…") + "</div>";
  },
  act(g, name, el) {
    const me = g.me || "a";
    const bump = (w) => g.set(w, { n: (g.S[w].n || 0) + 1 });
    if (name === "inc") bump(el.getAttribute("data-w"));
    else if (name === "mine") bump(me);
    else if (name === "sh") g.share({ k: (g.sh.k || 0) + 1, by: me });
    /* Environ 12 ko, avec des accents et des caractères doubles pour éprouver le découpage. */
    else if (name === "big") g.set(me, { blob: "é\u{1F600}\"\\".repeat(1500) + "fin" });
    else if (name === "new") g.newGame({ mode: "y" });
    else if (name === "local") { g.local.seen = (g.local.seen || 0) + 1; g.save(); g.render(); }
    else if (name === "hold") g.hold(true);
    else if (name === "release") g.hold(false);
    else if (name === "end") g.stop();
  },
  mount() {
    window.__mounts = (window.__mounts || 0) + 1;
    return () => { window.__cleanups = (window.__cleanups || 0) + 1; };
  }
});
