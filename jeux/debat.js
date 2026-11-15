/* Le débat idiot : un sujet absurde, un camp imposé à chacun, un temps de parole chacun, puis le vote.
   État commun : { k, ph, by }, le rang du sujet dans la liste mélangée par la seed, sa phase : "sujet"
   (annonce), "pour" puis "contre" (temps de parole), "vote", "fin", et le joueur qui l'a lancée. Sur
   un seul téléphone, il porte aussi les verdicts, décidés ensemble : v: { "3": "a" }.
   Tranche d'un joueur (deux téléphones) : { v: { "3": "b" } }, son vote secret pour chaque sujet.
   Réglages de la manche : duree (30, 60 ou 90 secondes) et, après « Rejouer », vus : les sujets déjà
   passés à l'écran (leurs rangs dans le fichier), pour ne pas les resservir.
   Sur l'appareil, g.local.t = { k, ph, at, mine, z } : l'instant où CET appareil a vu la phase commencer
   (les horloges des deux téléphones ne sont jamais comparées), s'il l'a lancée lui-même (lui seul passe
   alors à la suite quand le temps est écoulé) et s'il a déjà signalé la fin du temps ; g.local.e =
   { n, at } : l'écran affiché et l'instant où il est apparu. Le score se déduit des votes, il n'est
   pas stocké. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.debat) || {};
  const TOPICS = (Array.isArray(DATA.topics) ? DATA.topics : []).filter((t) => typeof t === "string" && t.trim());
  const PHASES = ["sujet", "pour", "contre", "vote", "fin"];
  const TIMES = { 30: "Trente secondes", 60: "Une minute", 90: "Une minute trente" };
  const HINTS = { 30: "Droit au but.", 60: "Le format classique.", 90: "Pour les grandes envolées." };
  /* Secondes laissées au téléphone qui a lancé le temps de parole pour passer à la suite, avant de proposer de le faire ici. */
  const GRACE = 3;
  /* Un toucher arrivé juste après un changement d'écran visait l'écran d'avant (« J'ai fini » à la dernière
     seconde, doigt impatient) : pendant ce délai, en millisecondes, il est ignoré. */
  const SETTLE = 600;
  /* Sous ce reste de chrono, en secondes, une phase que l'autre téléphone vient de clore s'est finie à zéro
     chez lui : ce n'est pas un « J'ai fini » touché en avance. */
  const NEAR = 1.5;
  const RING = 339.3; /* périmètre de l'anneau du chrono (rayon 54) */
  /* Le bouton qui avait le focus quand l'écran a été redessiné, pour le lui rendre s'il y est encore. */
  let kept = null;

  const seed = (g) => Number(g.setup.seed) || 1;
  /* L'ordre des sujets de la manche, le même sur les deux téléphones : ceux qu'on n'a pas encore vus, mélangés
     par la seed, puis les déjà vus, du plus ancien au plus récent. La liste des vus vient des réglages,
     donc parfois de l'autre téléphone : on n'en garde que des rangs valables, une fois chacun. */
  function order(g) {
    const seen = (Array.isArray(g.setup.vus) ? g.setup.vus.slice(0, TOPICS.length) : []).filter((i, j, a) => Number.isInteger(i) && i >= 0 && i < TOPICS.length && a.indexOf(i) === j);
    const fresh = TOPICS.map((t, i) => i).filter((i) => seen.indexOf(i) < 0);
    return { ids: g.kit.shuffle(fresh, seed(g)).concat(seen), fresh: fresh.length };
  }
  const topics = (g) => order(g).ids.map((i) => TOPICS[i]);
  /* La durée vient parfois de l'autre téléphone : hors des trois choix, une minute. */
  const dur = (g) => (TIMES.hasOwnProperty(g.setup.duree) ? Number(g.setup.duree) : 60);
  /* Pile ou face tiré de la seed et du rang du sujet : le même tirage sur les deux téléphones. */
  const pour = (g, k) => (g.kit.rng(seed(g) + 7919 * (k + 1))() < 0.5 ? "a" : "b");

  /* k et ph viennent parfois de l'autre téléphone : hors des valeurs connues, on reprend au début du sujet. */
  function state(g, n) {
    const k = Number.isInteger(g.sh.k) && g.sh.k >= 0 && g.sh.k < n ? g.sh.k : 0;
    return { k, ph: k === g.sh.k && PHASES.indexOf(g.sh.ph) > 0 ? g.sh.ph : "sujet" };
  }

  /* Un vote ne compte que s'il désigne l'un des deux joueurs ou l'égalité. */
  const okVote = (x) => x === "a" || x === "b" || x === "=";
  const pick = (o, k) => (o && typeof o === "object" && okVote(o[k]) ? o[k] : null);
  /* Les votes valables des sujets précédents, recopiés avant d'y ajouter celui du sujet k. */
  const votes = (o, k) => { const out = {}; for (let j = 0; j < k; j++) if (pick(o, j)) out[j] = pick(o, j); return out; };

  /* Verdict d'un sujet, null tant qu'il manque un vote. Sur un téléphone, il se décide ensemble. Sur deux,
     les deux votes secrets doivent désigner la même personne : sinon, personne ne gagne. */
  function verdict(g, k) {
    if (!g.duo) { const w = pick(g.sh.v, k); return w ? { w } : null; }
    const a = pick(g.S.a.v, k), b = pick(g.S.b.v, k);
    return a && b ? { w: a === b ? a : "=", a, b } : null;
  }
  /* Sujets débattus jusqu'au sujet k et points de chacun : tout se recalcule à partir des votes. */
  function tally(g, k) {
    const t = { rows: [], a: 0, b: 0 };
    for (let j = 0; j <= k; j++) { const x = verdict(g, j); if (x) { t.rows.push({ j, w: x.w }); if (x.w !== "=") t[x.w]++; } }
    return t;
  }

  /* Secondes restantes pour qui parle, comptées depuis l'instant où cet appareil a vu la phase commencer. */
  function left(g, st) {
    const t = g.local.t, now = Date.now();
    return dur(g) - (t && t.k === st.k && t.ph === st.ph && t.at <= now ? (now - t.at) / 1000 : 0);
  }
  /* Où en est le chrono : 0 il tourne, 1 temps écoulé, 2 écoulé depuis assez longtemps pour ne plus attendre personne. */
  const stage = (s) => (s <= -GRACE ? 2 : s <= 0 ? 1 : 0);

  const after = (ph) => (ph === "pour" ? "contre" : "vote");
  /* Change de sujet ou de phase pour les deux téléphones. Réservé aux gestes du joueur et à la fin d'un
     temps de parole lancé sur cet appareil : jamais en réaction à ce que l'autre vient d'envoyer.
     Si les deux lancent la même phase au même instant, le socle ne garde qu'un des deux états : « by »
     désigne alors un seul téléphone, celui qui enchaînera à la fin du temps. */
  function move(g, k, ph) {
    g.local.t = { k, ph, at: Date.now(), mine: 1 };
    g.share({ k, ph, by: g.me });
  }

  /* Fin du temps : vibration, bip, et un éclair de l'encre de qui parlait. L'éclair vit hors de l'écran
     de jeu, qui est redessiné au même instant pour la phase suivante. */
  function signal(g, w) {
    const el = document.createElement("div");
    el.className = "debat-flash as-" + w;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
    g.kit.buzz([200, 100, 200]);
    g.kit.beep();
  }

  const step = (g, k) => '<p class="debat-step">Débat ' + (tally(g, k - 1).rows.length + 1) + "</p>";
  const motion = (g, text) => '<p class="debat-motion">' + g.kit.esc(text) + ".</p>";
  const score = (g, t, won) => '<div class="g-score">' + ["a", "b"].map((w) => "<div" + (won === w ? ' class="debat-won as-' + w + '"' : "") + ">" + g.kit.who(w) + "<b>" + t[w] + "</b></div>").join("") + "</div>";

  function vTopic(g, list, k) {
    const kit = g.kit, p = pour(g, k), c = g.other(p), P = kit.nm(p), oth = g.duo ? g.other(g.me) : "";
    const side = (w, camp) => '<div class="debat-side as-' + w + (g.me === w ? " me" : "") + '">' + kit.who(w) + "<b>" + camp + "</b></div>";
    const lead = (!g.duo ? "Camps imposés, quoi que vous en pensiez : " + P + " ouvre le débat, " + kit.nm(c) + " répond."
      : g.me === p ? "Tu es pour, quoi que tu en penses : tu ouvres le débat." : "Tu es contre, quoi que tu en penses : " + P + " ouvre le débat, tu réponds.") + " " + TIMES[dur(g)] + " chacun.";
    return '<div class="debat" data-screen="sujet-' + k + '">' + step(g, k) + '<div class="g-card debat-topic"><h1 class="g-card-text" tabindex="-1" data-focus>' + kit.esc(list[k]) + ".</h1></div>" +
      '<div class="debat-sides">' + side(p, "Pour") + side(c, "Contre") + '</div><p class="g-lead">' + kit.esc(lead) + "</p>" +
      /* Le débat se joue en direct : pas de chrono pour quelqu'un qui n'a pas encore rejoint la partie. */
      (g.duo && !g.here(oth) ? kit.wait(g, "En attente " + kit.de(kit.nm(oth)) + "…")
        : '<div class="g-actions"><button class="btn" type="button" data-act="go">C\'est parti</button>' +
          (k < list.length - 1 ? '<button class="btn alt" type="button" data-act="skip">Autre sujet</button>' : "") + "</div>") + "</div>";
  }

  function vSpeak(g, list, st) {
    const kit = g.kit, k = st.k, w = st.ph === "pour" ? pour(g, k) : g.other(pour(g, k)), oth = kit.nm(g.other(w));
    const s = left(g, st), talk = !g.duo || g.me === w;
    const hint = s <= 0 ? "Temps écoulé." : !g.duo ? (st.ph === "pour" ? oth + " répond juste après." : "Ensuite, vous votez.")
      : talk ? "À toi de convaincre " + oth + "." : "Écoute " + kit.nm(w) + " sans l'interrompre.";
    /* Tant que le chrono tourne, seul qui parle peut l'arrêter. Une fois le temps largement écoulé, n'importe
       qui peut passer à la suite : le téléphone qui devait le faire est peut-être parti. */
    const btn = stage(s) === 2 ? "Passer à la suite" : s > 0 && talk ? "J'ai fini" : "";
    return '<div class="debat as-' + w + '" data-screen="' + st.ph + "-" + k + '">' + step(g, k) +
      '<h1 class="g-title debat-speaker" tabindex="-1" data-focus>' + kit.esc(kit.nm(w) + " plaide " + st.ph + ".") + "</h1>" +
      '<div class="debat-clock" role="timer" aria-label="Secondes restantes"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="debat-track" cx="60" cy="60" r="54"/>' +
      (s > 0 ? '<circle class="debat-ring" cx="60" cy="60" r="54" style="stroke-dashoffset:' + (RING * (1 - s / dur(g))).toFixed(1) + '"/>' : "") +
      '</svg><p class="g-big debat-num">' + Math.max(0, Math.ceil(s)) + "</p></div>" + motion(g, list[k]) + (s <= 0 ? '<p class="debat-over" role="status">' : '<p class="hint">') + kit.esc(hint) + "</p>" +
      (btn ? '<div class="g-actions"><button class="btn" type="button" data-act="done">' + btn + "</button></div>" : "") + "</div>";
  }

  function vVote(g, list, k) {
    const kit = g.kit, p = pour(g, k), oth = g.duo ? g.other(g.me) : "";
    if (g.duo && pick(g.S[g.me].v, k)) {
      return '<div class="debat" data-screen="attente-' + k + '">' + step(g, k) + motion(g, list[k]) + '<h1 class="g-title" tabindex="-1" data-focus>A voté.</h1>' +
        kit.wait(g, "En attente du vote " + kit.de(kit.nm(oth)) + "…") + "</div>";
    }
    const btn = (v, camp) => '<button class="debat-pick' + (camp ? " as-" + v : "") + '" type="button" data-act="vote" data-v="' + v + '">' +
      (camp ? '<i class="sw ' + v + '"></i><b>' + kit.esc(kit.nm(v)) + "</b><span>" + camp + "</span>" : "<b>Égalité</b>") + "</button>";
    return '<div class="debat" data-screen="vote-' + k + '">' + step(g, k) + motion(g, list[k]) + '<h1 class="g-title" tabindex="-1" data-focus>Qui a le mieux plaidé\u00a0?</h1>' +
      '<p class="g-lead">' + kit.esc(g.duo ? "Ton vote reste secret jusqu'à celui " + kit.de(kit.nm(oth)) + "." : "Mettez-vous d'accord, si c'est encore possible.") + "</p>" +
      '<div class="debat-picks">' + btn(p, "pour") + btn(g.other(p), "contre") + btn("=") + "</div>" +
      (g.duo && pick(g.S[oth].v, k) ? '<p class="hint">' + kit.esc(kit.nm(oth) + " a déjà voté.") + "</p>" : "") + "</div>";
  }

  function vVerdict(g, list, k, x) {
    const kit = g.kit, last = k >= list.length - 1, selfish = x.a === "a" && x.b === "b", polite = x.a === "b" && x.b === "a";
    const title = x.w !== "=" ? kit.nm(x.w) + " remporte ce débat." : selfish ? "Mauvaise foi partagée." : polite ? "Trop de politesse pour gagner." : "Égalité.";
    const lead = x.w !== "=" ? (g.duo ? "Même " + kit.nm(g.other(x.w)) + " le reconnaît." : "") : selfish ? "Chacun a voté pour soi : égalité."
      : polite ? "Chacun a voté pour l'autre : égalité." : x.a !== x.b ? "Vos votes ne concordent pas : personne ne marque." : "Personne ne l'emporte, d'un commun accord.";
    const cast = (w) => "<p>" + kit.who(w) + " " + kit.esc(x[w] === "=" ? "a voté égalité" : "a voté pour " + kit.nm(x[w])) + "</p>";
    /* Le score d'abord : sur un petit écran, c'est le détail des votes qui passe sous la rangée de boutons. */
    return '<div class="debat" data-screen="verdict-' + k + '">' + step(g, k) + motion(g, list[k]) + '<h1 class="g-title" tabindex="-1" data-focus>' + kit.esc(title) + "</h1>" +
      (lead ? '<p class="g-lead">' + kit.esc(lead) + "</p>" : "") + score(g, tally(g, k), x.w) + (g.duo ? '<div class="debat-cast">' + cast("a") + cast("b") + "</div>" : "") +
      '<div class="g-actions">' + (last ? "" : '<button class="btn" type="button" data-act="next">Sujet suivant</button>') +
      '<button class="btn' + (last ? "" : " alt") + '" type="button" data-act="end">' + (last ? "Voir le résultat" : "Terminer") + "</button></div></div>";
  }

  function vEnd(g, list, k) {
    const kit = g.kit, t = tally(g, k), n = t.rows.length, ties = n - t.a - t.b, w = t.a > t.b ? "a" : t.b > t.a ? "b" : "";
    return '<div class="debat" data-screen="fin"><p class="eyebrow">Résultat</p><h1 class="g-title" tabindex="-1" data-focus>' +
      kit.esc(!n ? "Aucun débat tranché." : w ? kit.nm(w) + " remporte la partie." : "Égalité parfaite.") + "</h1>" +
      (n ? '<p class="g-lead">' + kit.pl(n, "débat", "débats") + (ties ? ", dont " + ties + " sans vainqueur" : "") + ".</p>" : "") + score(g, t, w) +
      '<ul class="debat-list">' + t.rows.map((r) => "<li>" + motion(g, list[r.j]) + (r.w === "=" ? '<span class="g-tag">Égalité</span>' : kit.who(r.w)) + "</li>").join("") + "</ul>" +
      '<div class="g-actions"><button class="btn" type="button" data-act="again">Rejouer</button></div></div>';
  }

  (window.GAMES = window.GAMES || []).push({
    id: "debat",
    v: 1,
    title: "Le débat idiot",
    hook: "Qui de nous deux peut défendre n'importe quoi ?",
    blurb: "Un sujet absurde tombe et le site vous impose un camp, pour ou contre : chacun son temps de parole pour convaincre, puis vous votez.",
    meta: (TOPICS.length ? TOPICS.length + " sujets · " : "") + "3 min par débat",
    intro: [
      "Un sujet absurde tombe : « Un chat, ça se vouvoie ». Le site décide qui est pour et qui est contre, quoi que vous en pensiez vraiment.",
      "Chacun son tour, vous plaidez, chrono en main. Puis vous votez pour dire qui a le mieux plaidé. La mauvaise foi est permise, et même recommandée."
    ],
    glyph: '<path class="ink-a" d="M17 6a13 13 0 1 1-7.5 23.6L4 36l.4-13.6A13 13 0 0 1 17 6z"/><path class="ink-b" d="M24 18h16a4 4 0 0 1 4 4v22l-7-6H24a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z"/>',
    live: true,
    options: [{ id: "duree", label: "Temps de parole", def: "60", choices: ["30", "60", "90"].map((id) => ({ id, name: TIMES[id], hint: HINTS[id] })) }],
    view(g) {
      const list = topics(g), st = state(g, list.length), x = verdict(g, st.k);
      if (!list.length) return '<p class="g-note" data-screen="vide">Les sujets de débat ne sont pas arrivés jusqu\'ici. Recharge la page pour réessayer.</p>';
      return st.ph === "sujet" ? vTopic(g, list, st.k) : st.ph === "fin" ? vEnd(g, list, st.k)
        : st.ph !== "vote" ? vSpeak(g, list, st) : x ? vVerdict(g, list, st.k, x) : vVote(g, list, st.k);
    },
    act(g, name, el) {
      const n = TOPICS.length, o = order(g), st = state(g, n), k = st.k, last = k >= n - 1, v = el.getAttribute("data-v");
      if (!n) return;
      /* Le bip du départ sert aussi à obtenir le droit de sonner à la fin du temps : le navigateur ne
         l'accorde que pendant un geste. */
      if (name === "go" && st.ph === "sujet") { g.kit.beep(); move(g, k, "pour"); }
      else if (name === "skip" && st.ph === "sujet" && !last) move(g, k + 1, "sujet");
      else if (name === "done" && (st.ph === "pour" || st.ph === "contre")) { g.kit.beep(); move(g, k, after(st.ph)); }
      else if (name === "vote" && st.ph === "vote" && okVote(v) && !verdict(g, k)) {
        if (!g.duo) g.share({ v: Object.assign(votes(g.sh.v, k), { [k]: v }) });
        else if (!pick(g.S[g.me].v, k)) g.set(g.me, { v: Object.assign(votes(g.S[g.me].v, k), { [k]: v }) });
      } else if (name === "next" && st.ph === "vote" && verdict(g, k) && !last) move(g, k + 1, "sujet");
      else if (name === "end" && st.ph === "vote" && verdict(g, k)) move(g, k, "fin");
      /* Les sujets passés à l'écran pendant cette manche vont au bout de la liste des déjà vus : ils reviendront les derniers. */
      else if (name === "again" && st.ph === "fin") g.newGame({ vus: o.ids.slice(Math.max(k + 1, o.fresh)).concat(o.ids.slice(0, k + 1)) });
    },
    over(g) { return state(g, TOPICS.length).ph === "fin"; },
    mount(g, root) {
      const scr = root.querySelector(".debat"), num = root.querySelector(".debat-num"), ring = root.querySelector(".debat-ring"), born = Date.now();
      if (!scr) return;
      const st = state(g, TOPICS.length), w = st.ph === "pour" ? pour(g, st.k) : g.other(pour(g, st.k)), name = scr.getAttribute("data-screen");
      const key = name + "/" + Array.from(scr.querySelectorAll("[data-act]"), (b) => b.getAttribute("data-act")).join();
      /* Ce que l'écran affiche : le chrono qui tourne (0), le temps écoulé (1), ou la proposition de passer à la suite (2). */
      const drawn = ring ? 0 : root.querySelector('[data-act="done"]') ? 2 : 1;
      let t = g.local.t, e = g.local.e, lock = null, asked = false, off = false, timer = 0, seen = born;
      /* Première fois que cet appareil voit cette phase : son chrono part de maintenant. */
      if (!t || t.k !== st.k || t.ph !== st.ph) t = { k: st.k, ph: st.ph, at: born };
      /* Première fois qu'il affiche cet écran, avec ces boutons. */
      if (!e || e.n !== key) e = { n: key, at: born };
      if (t !== g.local.t || e !== g.local.e) { g.local.t = t; g.local.e = e; g.save(); }
      /* Les touchers qui suivent de trop près l'apparition de ces boutons sont arrêtés avant d'en atteindre un,
         y compris « Arrêter la partie », que le socle place là où se trouvait la rangée du bas. Au clavier
         (detail à 0), l'appui ne peut pas viser l'écran d'avant : le focus n'est plus sur un bouton. */
      root.addEventListener("click", (ev) => {
        const age = Date.now() - e.at;
        if (ev.detail && age >= 0 && age < SETTLE) { ev.preventDefault(); ev.stopPropagation(); }
      }, true);
      /* L'autre téléphone a écrit pendant qu'on choisissait au clavier : le focus revient sur le même bouton. */
      const same = kept && kept.n === name && Array.from(scr.querySelectorAll("[data-act]")).find((b) => b.getAttribute("data-act") === kept.act && b.getAttribute("data-v") === kept.v);
      if (same) same.focus({ preventScroll: true });
      /* Cet écran a vu le chrono tourner jusqu'à maintenant. Rouvert ou réveillé après coup (retour de l'accueil,
         autre application), il ne sait pas encore si l'autre téléphone a déjà enchaîné : il ne signale rien
         et n'envoie rien. */
      const live = () => !drawn && Date.now() - seen < 1500;
      /* Une minute sans toucher l'écran : il ne doit pas se mettre en veille au milieu d'une plaidoirie. */
      const awake = () => {
        if (lock || asked || document.hidden || !navigator.wakeLock) return;
        asked = true;
        navigator.wakeLock.request("screen").then((l) => {
          asked = false;
          lock = l;
          l.addEventListener("release", () => { lock = null; });
          if (off) l.release();
        }, () => { /* refusé (page intégrée, batterie faible) : tant pis */ });
      };
      if (num && drawn < 2) {
        timer = setInterval(() => {
          const s = left(g, st), now = stage(s), n = String(Math.ceil(s)), ok = live();
          seen = Date.now();
          if (now === 1 && !t.z) {
            t.z = 1;
            if (ok) {
              signal(g, w);
              /* Seul l'appareil où la phase a été lancée enchaîne tout seul : ce minuteur est né d'un geste fait ici. */
              if (t.mine && (!g.duo || g.sh.by === g.me)) { move(g, st.k, after(st.ph)); return; }
            }
            g.save();
          }
          if (now !== drawn) { g.render(); return; }
          if (now) return;
          if (num.textContent !== n) num.textContent = n;
          ring.style.strokeDashoffset = (RING * (1 - s / dur(g))).toFixed(1);
          awake();
        }, 200);
      }
      return () => {
        const to = state(g, TOPICS.length), el = document.activeElement;
        clearInterval(timer);
        off = true;
        if (lock) lock.release();
        kept = scr.contains(el) && el.hasAttribute("data-act") ? { n: name, act: el.getAttribute("data-act"), v: el.getAttribute("data-v") } : null;
        /* L'autre téléphone, parti un instant plus tôt, a enchaîné à la fin de son chrono : celui d'ici
           n'arrivera jamais à zéro, c'est donc maintenant qu'il signale la fin du temps. */
        if (live() && !t.z && g.local.t === t && to.k === st.k && to.ph === after(st.ph) && left(g, st) < NEAR) signal(g, w);
      };
    }
  });
})();
