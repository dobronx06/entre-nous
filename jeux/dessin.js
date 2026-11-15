/* Dessine-moi : un sujet, chacun le dessine au doigt, puis les deux feuilles côte à côte.
   Tranche d'un joueur : { r: numéro du sujet, d: "dessin", q: { r, d } }, écrite une seule fois par sujet,
   quand il rend sa feuille ; q est sa feuille du sujet d'avant, pour l'autre s'il n'a pas encore vu cette paire.
   État commun : { r }, le sujet en cours pour les deux. Le premier qui touche « Sujet suivant » l'avance ;
   l'autre garde la révélation à l'écran jusqu'à son propre toucher, qui n'envoie rien.
   Sur l'appareil : g.local.cur = { r, w, t, n, s, c, z }, la feuille en cours (heure de départ, durée du chrono,
   traits, encre, épaisseur) ; g.local.p, le nombre de révélations que cet appareil a quittées ; et, dans le
   stockage du site, la galerie des paires révélées (« dessin:galerie ») et la paire à l'écran (« dessin:devant »).
   Un dessin est un texte : des traits séparés par des points. Un trait = un caractère d'outil
   (encre × 2 + épaisseur), trois caractères pour le premier point (deux fois 9 bits : une grille de 512),
   puis, par point, deux caractères d'écart (de -31 à +31) ou « A » et trois caractères pour un saut plus long. */
(function () {
  "use strict";

  const DATA = (window.GAME_DATA && window.GAME_DATA.dessin) || {};
  const PROMPTS = (Array.isArray(DATA.prompts) ? DATA.prompts : []).filter((p) => p && typeof p.x === "string" && p.x);
  const CATS = [["tous", "Tous", "Un peu de tout."], ["portrait", "Portraits", "Chacun dessine l'autre."], ["souvenir", "Souvenirs", "Ce que vous avez vécu."],
    ["futur", "Futur", "Ce qui vous attend."], ["delire", "Délires", "Tout est permis."]];
  const TIMES = { 60: "une minute", 30: "trente secondes", 0: "tout ton temps" };
  /* Encres fixes, comme le blanc de la feuille : un dessin doit être le même sur les deux téléphones, en clair
     comme en sombre, et dans l'image enregistrée. Les trois premières sont celles du site ; la dernière est la
     gomme, du blanc de papier. */
  const INKS = ["#141829", "#2a78d6", "#eb6834", "#d6294a", "#1e9e5a", "#fab219", "#ffffff"];
  const NAMES = ["Noir", "Bleu", "Orange", "Rouge", "Vert", "Jaune", "Gomme"];
  const RUBBER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 20 3.6 15.1a1.6 1.6 0 0 1 0-2.3l8-8a1.6 1.6 0 0 1 2.3 0l5.4 5.4a1.6 1.6 0 0 1 0 2.3L11.7 20M21 20H8.5M6.5 10l7.6 7.6"/></svg>';
  /* Un dessin ne dépasse jamais MAX_TEXT caractères (quatre messages au relais) : à l'envoi il est simplifié
     jusqu'à y tenir, à la lecture le surplus est ignoré. MAX_STROKES traits réduits à leurs deux bouts y tiennent. */
  const GRID = 511, STEP = 1.5, EPS = 0.75, MAX_TEXT = 10000, MAX_STROKES = 1000, MAX_STROKE = 8000, KEEP = 12, FRONT = "dessin:devant";
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", NUM = {};
  ABC.split("").forEach((ch, i) => { NUM[ch] = i; });
  let pad = null; /* la feuille affichée, tant que l'écran de dessin est monté */
  let seen = { k: "", t: 0 }; /* l'écran affiché, et depuis quand */
  /* Un écran qui vient d'apparaître ne répond pas tout de suite : le second toucher d'un double toucher, ou un
     doigt parti vers l'écran d'avant, tomberait sinon sur ce qui a pris sa place (le chrono lancé sans le
     vouloir, un point sur la feuille, la révélation sautée). */
  const settled = (ms) => Math.abs(Date.now() - seen.t) > ms;
  /* Les boutons à deux touchers : libellé au repos, libellé armé. */
  const LABELS = { clear: ["Effacer", "Tout effacer\u00a0?"], done: ["J'ai fini", "Rendre une feuille blanche\u00a0?"], empty: ["Vider la galerie", "Toucher encore pour tout vider"] };
  let armed = { n: "", until: 0, timer: 0 };

  /* ---------- Le dessin en texte ---------- */
  const clamp = (v) => Math.max(0, Math.min(GRID, v));
  const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
  const wide = (c, z) => (c === 6 ? [22, 44] : [6, 15])[z];
  const code = (x, y) => ABC[x >> 3] + ABC[(x & 7) << 3 | y >> 6] + ABC[y & 63];

  /* Ramer-Douglas-Peucker : ne garde que les points qui s'écartent de plus de eps de la ligne brisée. Sans
     cela, un dessin d'une minute pèserait trois à dix fois plus, soit autant de messages en plus au relais. */
  function simplify(p, eps) {
    const n = p.length / 2, keep = [0, n - 1], todo = [[0, n - 1]], out = [];
    if (n < 3) return p.slice();
    while (todo.length) {
      const [i, j] = todo.pop(), ax = p[2 * i], ay = p[2 * i + 1], dx = p[2 * j] - ax, dy = p[2 * j + 1] - ay, len = dx * dx + dy * dy;
      let far = eps, at = 0;
      for (let m = i + 1; m < j; m++) {
        /* Distance au segment, et non à la droite : un aller-retour sur la même ligne doit garder son bout. */
        const px = p[2 * m] - ax, py = p[2 * m + 1] - ay, t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
        const d = Math.hypot(px - t * dx, py - t * dy);
        if (d > far) { far = d; at = m; }
      }
      if (at) { keep.push(at); todo.push([i, at], [at, j]); }
    }
    keep.sort((a, b) => a - b).forEach((i) => out.push(p[2 * i], p[2 * i + 1]));
    return out;
  }

  /* Un trait en texte. p : les coordonnées x, y à la suite, dans la grille. */
  function pack(c, z, p) {
    let x = Math.round(p[0]), y = Math.round(p[1]), out = ABC[c * 2 + z] + code(x, y);
    for (let i = 2; i < p.length; i += 2) {
      const nx = Math.round(p[i]), ny = Math.round(p[i + 1]), dx = nx - x, dy = ny - y;
      if (!dx && !dy) continue;
      out += Math.abs(dx) < 32 && Math.abs(dy) < 32 ? ABC[dx + 32] + ABC[dy + 32] : "A" + code(nx, ny);
      x = nx; y = ny;
    }
    return out;
  }

  /* Lit un trait. Ce texte vient parfois de l'autre téléphone : un caractère inconnu ou un outil hors palette
     font jeter le trait, sa longueur est bornée et chaque point est ramené dans la feuille. */
  function unpack(s) {
    const v = Array.from(s.slice(0, MAX_STROKE), (ch) => NUM[ch]), pt = (i) => [v[i] << 3 | v[i + 1] >> 3, (v[i + 1] & 7) << 6 | v[i + 2]];
    if (v.length < 4 || v.includes(undefined) || v[0] > 13) return null;
    let [x, y] = pt(1);
    const p = [x, y];
    for (let i = 4; i + 1 < v.length;) {
      if (v[i]) { x = clamp(x + v[i] - 32); y = clamp(y + v[i + 1] - 32); i += 2; }
      else if (i + 3 < v.length) { [x, y] = pt(i + 1); i += 4; }
      else break;
      if (x !== p[p.length - 2] || y !== p[p.length - 1]) p.push(x, y);
    }
    return { c: v[0] >> 1, z: v[0] & 1, p };
  }
  const decode = (d) => String(d).slice(0, MAX_TEXT).split(".").slice(0, MAX_STROKES).map(unpack).filter(Boolean);

  /* Le dessin prêt à partir. Trop lourd, il est simplifié de plus en plus fort : à la fin il ne reste que
     les deux bouts de chaque trait, ce qui tient toujours. */
  function fit(list, max) {
    let d = list.join(".");
    for (let eps = 2 * EPS; d.length > max && eps < 2000; eps *= 2) {
      d = list.map(unpack).filter(Boolean).map((s) => pack(s.c, s.z, simplify(s.p, eps))).join(".");
    }
    return d;
  }

  /* Le tracé d'un trait (syntaxe SVG, lue aussi par le canevas). Chaque sommet est arrondi, mais jamais au
     point de s'écarter de plus d'un pas de grille de la ligne brisée : là où les points sont serrés, la courbe
     va d'un milieu de segment au suivant et l'arrondi est lisse ; entre deux longs segments, l'angle reste un angle. */
  function pathOf(p) {
    const n = p.length / 2, f = (v) => Math.round(v * 10) / 10;
    let d = "M" + p[0] + " " + p[1], end = "";
    if (n < 2) return d + "h.01";
    for (let i = 1; i < n - 1; i++) {
      const x = p[2 * i], y = p[2 * i + 1], ax = p[2 * i - 2] - x, ay = p[2 * i - 1] - y, bx = p[2 * i + 2] - x, by = p[2 * i + 3] - y;
      const a = Math.hypot(ax, ay) || 1, b = Math.hypot(bx, by) || 1, most = 2 / Math.max(0.01, Math.sqrt(Math.max(0, 1 + (ax * bx + ay * by) / (a * b)) / 2));
      const ka = Math.min(0.5, most / a), kb = Math.min(0.5, most / b), from = f(x + ax * ka) + " " + f(y + ay * ka);
      d += (from === end ? "" : "L" + from) + "Q" + x + " " + y + " ";
      end = f(x + bx * kb) + " " + f(y + by * kb);
      d += end;
    }
    return d + "L" + p[2 * n - 2] + " " + p[2 * n - 1];
  }

  /* Peint des traits sur un canevas déjà à l'échelle de la grille. */
  function paint(x, strokes) {
    x.lineCap = x.lineJoin = "round";
    strokes.forEach((s) => { x.strokeStyle = INKS[s.c]; x.lineWidth = wide(s.c, s.z); x.stroke(new Path2D(pathOf(s.p))); });
  }

  /* Un dessin en SVG, construit uniquement à partir de nombres vérifiés. eps : simplification pour les vignettes. */
  const art = (d, label, eps) => '<svg class="dessin-art" viewBox="0 0 ' + GRID + " " + GRID + '" ' + (label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"') +
    '><g fill="none" stroke-linecap="round" stroke-linejoin="round">' + decode(d).map((s) => '<path stroke="' + INKS[s.c] + '" stroke-width="' + wide(s.c, s.z) + '" d="' +
      pathOf(eps ? simplify(s.p, eps) : s.p) + '"/>').join("") + "</g></svg>";

  /* ---------- Où en est la partie ---------- */
  /* Le réglage vient parfois de l'autre téléphone : une des trois durées, en toutes lettres, ou la minute par défaut. */
  const chrono = (g) => (typeof g.setup.chrono === "string" && TIMES.hasOwnProperty(g.setup.chrono) ? Number(g.setup.chrono) : 60);
  /* Le chrono d'une feuille est celui qu'elle avait au départ (cur.n) : un réglage reçu ensuite n'y change rien. */
  const remain = (cur) => Math.max(0, Math.min(cur.n, cur.n - (Date.now() - cur.t) / 1000));
  const clock = (left) => Math.floor(Math.ceil(left) / 60) + ":" + String(Math.ceil(left) % 60).padStart(2, "0");
  const tool = (cur) => [int(cur.c, 6), int(cur.z, 1)];

  /* Les sujets de la manche, dans le même ordre sur les deux téléphones. Une catégorie vide ou inconnue donne toute la liste. */
  function subjects(g) {
    const some = PROMPTS.filter((p) => p.c === g.setup.sujets);
    return g.kit.shuffle(some.length ? some : PROMPTS, Number(g.setup.seed) || 1).map((p) => p.x);
  }
  /* Le sujet tel que le lit le joueur w, qui dessine l'autre ; sans w, tel qu'on le lit à deux. */
  function subject(g, x, w) {
    const k = g.kit, o = w ? k.nm(g.other(w)) : "l'autre", s = k.fill(x, { o, de_o: k.de(o) });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* La feuille rendue par w pour le sujet r (celle du sujet en cours, ou celle d'avant, gardée dans q), ou null.
     Elle vient parfois de l'autre téléphone : une chaîne, bornée, ou rien. */
  function sheet(g, w, r) {
    const S = g.S[w], x = S.r === r ? S : S.q || {};
    return x.r === r && typeof x.d === "string" ? x.d.slice(0, MAX_TEXT) : null;
  }
  const key = (g, r) => g.gen + ":" + String(g.setup.seed).slice(0, 20) + ":" + r;
  /* La paire du sujet r, telle qu'elle est révélée puis rangée dans la galerie ; null tant qu'une feuille manque. */
  function pair(g, list, r) {
    const d = ["a", "b"].map((w) => sheet(g, w, r));
    return r < list.length && d[0] != null && d[1] != null ? { k: key(g, r), x: subject(g, list[r]), n: [g.kit.nm("a"), g.kit.nm("b")], d } : null;
  }
  /* La galerie contient aussi ce que l'autre a envoyé : même méfiance à la relecture. */
  function gallery(k) {
    const list = k.store.get("dessin:galerie", null), two = (x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string";
    return (Array.isArray(list) ? list : []).filter((p) => p && typeof p.k === "string" && typeof p.x === "string" && two(p.n) && two(p.d)).slice(-KEEP);
  }
  function remember(k, p) {
    const list = gallery(k);
    if (!list.some((q) => q.k === p.k)) k.store.set("dessin:galerie", list.concat(p).slice(-KEEP));
  }

  function stage(g) {
    const k = g.kit, list = subjects(g), n = list.length, c = g.local.cur;
    /* Le sujet en cours : le plus avancé de l'état commun et des feuilles déjà rendues. Un téléphone qui rejoint
       la partie avec un stockage neuf n'a plus l'état commun ; il retrouve ainsi le sujet que l'autre a dessiné. */
    const drawn = (w) => (typeof g.S[w].d === "string" ? int(g.S[w].r, n - 1) : 0);
    const r = Math.max(Math.min(int(g.sh.r, Infinity), n), drawn("a"), drawn("b"));
    const a = r < n && sheet(g, "a", r) != null, b = r < n && sheet(g, "b", r) != null;
    /* Qui doit dessiner : moi sur deux téléphones ; sur un seul, « a » puis « b ». */
    const w = r >= n ? null : g.duo ? ((g.me === "a" ? a : b) ? null : g.me) : !a ? "a" : !b ? "b" : null;
    const mine = w && c && c.r === r && c.w === w && typeof c.t === "number" && [0, 30, 60].includes(c.n) && Array.isArray(c.s) && c.s.every((s) => typeof s === "string");
    /* La révélation à l'écran. Un appareil ne quitte une révélation que sur son propre toucher. Si l'autre a
       relancé une pile, la paire qui était à l'écran y reste, relue dans la galerie. S'il est passé au sujet
       suivant, la plus récente des révélations que cet appareil n'a pas quittées (p les compte ; sans compte,
       il est à jour) reste affichée ou, s'il n'était pas là, s'affiche d'abord : elle est relue dans les
       tranches tant qu'elles la contiennent, sinon dans la galerie, où elle a été rangée en s'affichant. */
    let all = null, show = null, at = r;
    const kept = (id) => (all = all || gallery(k)).find((x) => x.k === id), front = k.store.get(FRONT, null);
    const old = typeof front === "string" && front.indexOf(g.gen - 1 + ":") === 0 && kept(front);
    const p = Number.isInteger(g.local.p) && g.local.p >= 0 ? Math.min(g.local.p, r) : r;
    for (let q = r - 1; !old && !show && q >= p; q--) {
      show = pair(g, list, q) || kept(key(g, q));
      if (show) at = q;
    }
    if (old) at = int(parseInt(front.slice(front.lastIndexOf(":") + 1), 10), 1e6);
    return { list, r, w, cur: mine ? c : null, show: old || show || pair(g, list, r), late: !!old || at < r, old: !!old, at };
  }

  /* L'image à garder : le sujet, les deux feuilles et les prénoms, aux couleurs du thème clair quel que soit le thème. */
  function picture(p) {
    const cv = document.createElement("canvas"), x = cv.getContext("2d"), S = 540, css = getComputedStyle(document.documentElement);
    const write = (text, left, top, px, weight, face, max) => {
      const font = (size) => { x.font = weight + " " + size + "px " + (css.getPropertyValue(face) || "sans-serif"); };
      font(px);
      /* Un texte trop long rétrécit plutôt que de déborder. */
      font(Math.min(px, Math.floor((px * max) / x.measureText(text).width)));
      x.fillText(text, left, top);
    };
    cv.width = 2 * S + 120;
    cv.height = S + 250;
    x.fillStyle = INKS[6];
    x.fillRect(0, 0, cv.width, cv.height);
    x.textBaseline = "middle";
    x.fillStyle = INKS[0];
    write(p.x.slice(0, 120), 40, 70, 46, 700, "--display", 2 * S + 40);
    [0, 1].forEach((i) => {
      /* Chaque feuille est peinte sur son propre canevas, dont les bords rognent ce qui dépasse. */
      const leaf = document.createElement("canvas"), y = leaf.getContext("2d"), left = 40 + i * (S + 40);
      leaf.width = leaf.height = S;
      y.scale(S / GRID, S / GRID);
      paint(y, decode(p.d[i]));
      x.drawImage(leaf, left, 130);
      x.strokeStyle = x.fillStyle = INKS[i + 1];
      x.lineWidth = 5;
      x.strokeRect(left, 130, S, S);
      x.beginPath();
      if (i) x.rect(left, S + 157, 26, 26); else x.arc(left + 13, S + 170, 13, 0, 7);
      x.fill();
      x.fillStyle = INKS[0];
      write("Par " + p.n[i].slice(0, 24), left + 40, S + 171, 32, 600, "--body", S - 40);
    });
    x.fillStyle = "#646b82";
    x.textAlign = "right";
    write("Dessine-moi · Entre Nous", cv.width - 40, S + 218, 24, 500, "--body", S);
    return cv;
  }

  /* Enregistre l'image : feuille de partage du téléphone quand elle accepte les fichiers, téléchargement sinon.
     Tout est fait dans le geste du joueur, sans attente, sinon le navigateur refuse le partage. */
  function save(p) {
    const url = picture(p).toDataURL("image/png"), name = "dessine-moi.png";
    const download = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    try {
      const bin = atob(url.slice(url.indexOf(",") + 1)), file = new File([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], name, { type: "image/png" });
      if (!navigator.canShare({ files: [file] })) throw new Error("partage de fichiers indisponible");
      navigator.share({ files: [file], title: p.x }).catch((e) => { if (!e || e.name !== "AbortError") download(); });
    } catch (e) {
      download();
    }
  }

  /* Deux touchers pour confirmer : le premier arme le bouton n et change son libellé pendant trois secondes ; le
     second, s'il arrive dans ce délai, renvoie true. L'armement vit ici et non sur le bouton : un réaffichage (la
     feuille de l'autre qui arrive) refait le bouton, et le second toucher doit encore compter. */
  const label = (n) => LABELS[n][armed.n === n && Date.now() < armed.until ? 1 : 0];
  function arm(n) {
    const was = armed.n;
    clearTimeout(armed.timer);
    armed = { n, until: Date.now() + 3000, timer: n && setTimeout(arm, 3000, "") };
    [was, n].forEach((x) => x && document.querySelectorAll('[data-act="' + x + '"]').forEach((el) => { el.textContent = label(x); }));
  }
  function twice(n) {
    const ok = armed.n === n && Date.now() < armed.until;
    arm(ok ? "" : n);
    return ok;
  }

  /* Rend la feuille : le dessin part une seule fois, en entier, dans la tranche du joueur. La feuille du sujet
     d'avant l'accompagne, allégée s'il le faut pour que le tout ne pèse pas plus qu'un seul dessin : si l'autre
     avait posé son téléphone avant la révélation, il la trouvera encore là en revenant. */
  function submit(g) {
    const st = stage(g);
    if (!st.cur) return;
    const d = fit(st.cur.s, MAX_TEXT), was = sheet(g, st.w, st.r - 1), q = was == null ? null : fit(was.split("."), MAX_TEXT - d.length);
    delete g.local.cur;
    g.set(st.w, { r: st.r, d, q: q != null && d.length + q.length <= MAX_TEXT ? { r: st.r - 1, d: q } : null });
  }

  /* La pile est finie : tous les sujets sont passés et cet appareil a quitté la dernière révélation. */
  function over(g) {
    const st = stage(g);
    return !st.show && st.list.length > 0 && st.r >= st.list.length;
  }

  /* ---------- Écrans ---------- */
  function vReady(g, st) {
    const k = g.kit, secs = chrono(g), o = g.other(st.w), O = k.esc(k.nm(o));
    return '<div class="dessin as-' + st.w + '" data-screen="pret-' + st.r + "-" + st.w + '"><p class="dessin-step">' + (!st.r && g.gen > 1 ? "Nouvelle pile · " : "") + "Sujet " + (st.r + 1) +
      '</p><p class="dessin-who">' + k.who(st.w) + " dessine</p>" +
      '<h1 class="g-title" tabindex="-1" data-focus>Un sujet, ' + TIMES[secs] + '.</h1><p class="g-lead">' +
      (secs ? "Le chrono démarre dès que le sujet s'affiche." : "Pas de chrono\u00a0: tu rends ta feuille quand tu veux.") + '</p><p class="hint">' + O +
      (!g.duo ? " dessinera le même sujet juste après, sans avoir vu ta feuille."
        : sheet(g, o, st.r) != null ? " a déjà rendu sa feuille. Tu la verras à côté de la tienne dès que tu auras fini."
          : " dessine le même sujet de son côté. Vos deux feuilles se retrouvent ensuite côte à côte.") +
      '</p><div class="g-actions"><button class="btn" type="button" data-act="start">Voir le sujet</button></div></div>';
  }

  function vDraw(g, st) {
    const k = g.kit, secs = st.cur.n, left = remain(st.cur), [c, z] = tool(st.cur);
    const inks = INKS.map((ink, i) => '<button class="dessin-pick' + (i < 6 ? " dessin-ink" : "") + '" type="button" data-act="ink" data-v="' + i + '" aria-pressed="' + (c === i) +
      '" aria-label="' + NAMES[i] + '"' + (i < 6 ? ' style="--c:' + ink + '">' : ">" + RUBBER) + "</button>").join("");
    const sizes = ["Trait fin", "Trait épais"].map((label, i) => '<button class="dessin-pick" type="button" data-act="size" data-v="' + i + '" aria-pressed="' + (z === i) +
      '" aria-label="' + label + '"><i class="dessin-dot"></i></button>').join("");
    return '<div class="dessin dessin-draw as-' + st.w + '" data-screen="dessin-' + st.r + "-" + st.w + '"><div class="dessin-head"><h1 class="dessin-subject" tabindex="-1" data-focus>' + k.esc(subject(g, st.list[st.r], st.w)) + "</h1>" +
      (secs ? '<p class="dessin-time" role="timer" aria-label="Temps restant">' + clock(left) + "</p>" : "") + '</div><div class="dessin-desk">' +
      (secs ? '<div class="progress dessin-clock" aria-hidden="true"><span style="width:' + (100 * left) / secs + '%"></span></div>' : "") +
      '<canvas class="dessin-sheet" width="' + GRID + '" height="' + GRID + '" role="img" aria-label="Ta feuille de dessin"></canvas></div>' +
      '<div class="dessin-tools"><div class="dessin-row" role="group" aria-label="Encres et gomme">' + inks + '</div><div class="dessin-row"><span class="dessin-sizes" role="group" aria-label="Épaisseur du trait">' + sizes +
      '</span><button class="dessin-do" type="button" data-act="undo">Annuler</button><button class="dessin-do" type="button" data-act="clear">' + label("clear") + "</button></div></div>" +
      '<div class="g-actions"><button class="btn" type="button" data-act="done">' + label("done") + "</button></div></div>";
  }

  function vWait(g, st) {
    const k = g.kit, o = k.nm(g.other(g.me));
    return '<div class="dessin as-' + g.me + '" data-screen="attente-' + st.r + '"><p class="dessin-step">Sujet ' + (st.r + 1) + '</p><h1 class="g-title" tabindex="-1" data-focus>' + k.esc(subject(g, st.list[st.r], g.me)) +
      '</h1><p class="g-lead">Ta feuille est rendue. La voici, en attendant celle ' + k.esc(k.de(o)) + '.</p><div class="dessin-mine">' + art(sheet(g, g.me, st.r), "Ton dessin") + "</div>" +
      k.wait(g, "En attente du dessin " + k.de(o) + "…") + "</div>";
  }

  function vReveal(g, st) {
    const k = g.kit, p = st.show;
    /* « Par » : sous « L'autre au réveil », un prénom seul se lirait comme celui du modèle. */
    const fig = (w, i) => '<figure class="dessin-fig as-' + w + '"><figcaption>Par ' + k.who(w) + "</figcaption>" + art(p.d[i], "Le dessin " + k.esc(k.de(k.nm(w)))) + "</figure>";
    return '<div class="dessin" data-screen="revelation-' + st.at + '"><p class="dessin-step">' + (st.old ? "Pile précédente · " : "") + "Sujet " + (st.at + 1) + '</p><h1 class="g-title" tabindex="-1" data-focus>' + k.esc(p.x.slice(0, 120)) +
      '</h1><div class="dessin-pair">' + fig("a", 0) + fig("b", 1) + '</div><p class="dessin-keep"><button class="btn alt small" type="button" data-act="image">Enregistrer l\'image</button></p>' +
      (st.late && g.duo ? '<p class="hint">' + k.esc(k.nm(g.other(g.me))) + (st.old ? " a relancé une pile de sujets. Touche le bouton quand tu as fini de regarder." : " t'attend pour la suite.") + "</p>" : "") +
      '<div class="g-actions"><button class="btn" type="button" data-act="next">' + (st.old ? "Voir la nouvelle pile" : st.at + 1 < st.list.length ? "Sujet suivant" : "Terminer") + "</button></div></div>";
  }

  function vEnd(g) {
    const cur = CATS.some((c) => c[0] === g.setup.sujets) ? g.setup.sujets : "tous", kept = g.def.extra(g.kit);
    return '<div class="dessin" data-screen="fin"><p class="eyebrow">Fin de la pile</p><h1 class="g-title" tabindex="-1" data-focus>Vous avez tout dessiné.</h1>' +
      '<p class="g-lead">' + (kept ? "Vos derniers dessins sont gardés sur cet appareil, juste en dessous. " : "") + "On mélange les sujets et on recommence\u00a0?</p>" +
      '<div class="g-opts"><p class="g-opts-label">Rejouer avec</p><div class="g-choices">' + CATS.map((c) => '<button class="g-choice" type="button" data-act="again" data-v="' + c[0] + '"' +
        (cur === c[0] ? ' aria-current="true"' : "") + "><b>" + c[1] + "</b></button>").join("") + "</div></div>" + kept + "</div>";
  }

  (window.GAMES = window.GAMES || []).push({
    id: "dessin",
    v: 1,
    title: "Dessine-moi",
    hook: "Est-ce qu'on a le même coup de crayon ?",
    blurb: "Un sujet tombe, chacun le dessine au doigt en une minute, puis vos deux dessins s'affichent côte à côte.",
    meta: (PROMPTS.length > 1 ? PROMPTS.length + " sujets · " : "") + "1 min par dessin",
    intro: [
      "Un sujet s'affiche : « Votre premier rendez-vous », « L'animal que vous formez à deux ». Chacun le dessine au doigt, sans montrer sa feuille, puis les deux dessins se retrouvent côte à côte.",
      "Aucun talent requis, c'est souvent plus drôle sans. Les dessins que vous révélez sont gardés dans une galerie, sur cet appareil seulement."
    ],
    glyph: '<rect class="ink-b" x="19" y="9" width="24" height="24" rx="3"/><path class="ring-a" d="M5 36c9 2 17-3 19-10s-2-10-6-8-4 10 2 14 14 3 23-6"/>',
    live: true,
    options: [
      { id: "chrono", label: "Temps", def: "60", choices: [{ id: "60", name: "Une minute" }, { id: "30", name: "Trente secondes" }, { id: "0", name: "Sans chrono" }] },
      { id: "sujets", label: "Sujets", def: "tous", choices: CATS.map((c) => ({ id: c[0], name: c[1], hint: c[2] })) }
    ],
    view(g) {
      const st = stage(g);
      if (st.show) return vReveal(g, st);
      /* Le fichier des sujets n'est pas arrivé sur cet appareil : surtout pas de fausse fin de pile, ni de « Rejouer ». */
      if (!st.list.length) return '<div class="dessin" data-screen="vide"><h1 class="g-title" tabindex="-1" data-focus>Les sujets ne sont pas arrivés.</h1><p class="g-lead">Recharge la page\u00a0: la partie reprendra où elle en était.</p></div>';
      if (st.r >= st.list.length) return vEnd(g);
      if (st.cur) return vDraw(g, st);
      /* Sur un seul téléphone, le second ne prend l'appareil qu'une fois la feuille du premier cachée. */
      if (st.w) return g.duo || st.w === "a" ? vReady(g, st) : '<div class="dessin" data-screen="passe-' + st.r + '">' + g.kit.pass("b", "start") + '<p class="hint">Dès que tu touches le bouton, le sujet s\'affiche' + (chrono(g) ? " et le chrono démarre" : "") + ".</p></div>";
      return vWait(g, st);
    },
    act(g, name, el) {
      const st = stage(g), cur = st.cur, v = el.getAttribute("data-v");
      /* Après le passage du téléphone, une seconde entière : le bouton « à moi » apparaît là où était la feuille,
         sous un doigt qui dessinait peut-être encore quand le chrono l'a rendue. */
      if (name === "start" && st.w && !cur && settled(!g.duo && st.w === "b" ? 1000 : 400)) {
        g.local.cur = { r: st.r, w: st.w, t: Date.now(), n: chrono(g), s: [], c: 0, z: 0 };
        g.local.p = st.r;
        g.save();
        g.render();
        /* Un bip de départ : il annonce le chrono et, sur iPhone, c'est ce geste qui autorise le bip de fin. */
        if (g.local.cur.n) g.kit.beep();
      } else if ((name === "ink" || name === "size") && cur) {
        if (name === "ink") cur.c = int(parseInt(v, 10), 6); else cur.z = int(parseInt(v, 10), 1);
        g.save();
        /* Sur place : un rendu complet referait la feuille et ferait perdre le focus. */
        el.parentNode.querySelectorAll('[data-act="' + name + '"]').forEach((b) => b.setAttribute("aria-pressed", b === el));
      } else if (cur && pad && (name === "undo" || (name === "clear" && twice(name)))) {
        /* Tout effacer demande deux touchers : une minute de dessin ne doit pas disparaître sur un geste malheureux. */
        pad.commit();
        cur.s.length = name === "undo" ? Math.max(0, cur.s.length - 1) : 0;
        g.save();
        pad.redraw();
      } else if (name === "done" && cur) {
        if (pad) pad.commit();
        /* Une feuille blanche ne part ni sur un seul toucher, ni dans la seconde où elle s'affiche : « J'ai fini »
           est là où était « Voir le sujet », sous un doigt qui a pu toucher trois fois. */
        if (cur.s.length || (settled(1000) && twice(name))) submit(g);
      } else if (name === "next" && st.show && settled(1000)) {
        /* Une seconde entière ici : le chrono peut rendre la feuille à l'instant où le doigt part vers « J'ai fini ».
           Si l'autre est déjà passé à la suite, il n'y a rien à lui envoyer : cet appareil le rejoint. */
        g.kit.store.del(FRONT);
        if (!st.old) g.local.p = st.at + 1;
        if (st.late) { g.save(); g.render(); } else g.share({ r: st.r + 1 });
      } else if (name === "image" && st.show) {
        /* Même délai : ce bouton apparaît au milieu de ce qui était la feuille. */
        if (settled(1000)) save(st.show);
      } else if ((name === "image" || name === "empty") && over(g)) {
        g.def.extraAct(g.kit, name, el);
      } else if (name === "again" && over(g)) {
        g.newGame({ sujets: CATS.some((c) => c[0] === v) ? v : "tous" });
      }
    },
    over,
    mount(g, root) {
      const k = g.kit, st = stage(g), cur = st.cur, cv = root.querySelector(".dessin-sheet"), screen = root.querySelector("[data-screen]");
      /* Un écran se reconnaît à sa pile autant qu'à son nom : le « Sujet 1 » d'une partie relancée est un nouvel
         écran. Une révélation, elle, reste le même écran quand l'autre relance une pile pendant qu'on la regarde. */
      const name = st.show ? st.show.k : screen ? key(g, screen.getAttribute("data-screen")) : seen.k;
      if (seen.k !== name) {
        seen = { k: name, t: Date.now() };
        if (armed.n) arm("");
        /* Les deux feuilles ne font leur entrée qu'à la première apparition de la révélation, pas à chaque réaffichage. */
        if (st.show) root.querySelector(".dessin-pair").classList.add("is-new");
      }
      /* Le compte des révélations quittées part du sujet où cet appareil se trouve, dès qu'il y a rendu une feuille
         ou qu'il en voit la révélation (ou, dans act, qu'il s'y met à dessiner). Pas avant : un téléphone qui
         rejoint la partie affiche d'abord le sujet 1, le temps de relire le salon. */
      if (!Number.isInteger(g.local.p) && !st.old && (st.show || !st.w)) { g.local.p = st.at; g.save(); }
      /* La paire à l'écran est rangée dans la galerie, et notée comme celle qu'on regarde : si l'autre relance
         une pile, g.local est vidé, et c'est cette note qui la garde sous les yeux. */
      if (st.show) {
        remember(k, st.show);
        if (!st.old && k.store.get(FRONT, null) !== st.show.k) k.store.set(FRONT, st.show.k);
      } else if (k.store.get(FRONT, null) != null) {
        k.store.del(FRONT);
      }
      if (!cv || !cur) return;
      const x = cv.getContext("2d"), secs = cur.n, time = root.querySelector(".dessin-time"), bar = root.querySelector(".dessin-clock span");
      let live = null, box = null;
      cv.width = cv.height = Math.round(cv.clientWidth * Math.min(window.devicePixelRatio || 1, 3)) || GRID;
      x.scale(cv.width / GRID, cv.width / GRID);
      const redraw = () => { x.fillStyle = INKS[6]; x.fillRect(0, 0, GRID, GRID); paint(x, cur.s.map(unpack).filter(Boolean)); };
      const dab = (ax, ay, cx, cy, bx, by) => { x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo(cx, cy, bx, by); x.stroke(); };
      const at = (e) => [clamp(((e.clientX - box.left) / box.width) * GRID), clamp(((e.clientY - box.top) / box.height) * GRID)];
      /* Fin d'un trait : simplifié, rangé, enregistré. Un réaffichage ou un rechargement retrouve alors la feuille telle quelle. */
      const commit = () => {
        if (!live) return;
        cur.s.push(pack(live.c, live.z, simplify(live.p, EPS)));
        live = null;
        g.save();
      };
      const down = (e) => {
        /* Un seul trait à la fois, quel que soit le doigt : un pouce qui tient le téléphone, posé ailleurs sur
           l'écran, ne doit pas empêcher de dessiner. */
        if (live || e.button > 0 || cur.s.length >= MAX_STROKES || !settled(400)) return;
        e.preventDefault();
        if (armed.n) arm("");
        box = cv.getBoundingClientRect();
        const [c, z] = tool(cur), p = at(e);
        live = { id: e.pointerId, c, z, p };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* sans importance */ }
        /* Ce qui arrive de l'autre téléphone attendra la fin du trait. */
        g.hold(true);
        x.strokeStyle = INKS[c];
        x.lineWidth = wide(c, z);
        dab(p[0], p[1], p[0], p[1], p[0] + 0.01, p[1]);
      };
      const move = (e) => {
        if (!live || e.pointerId !== live.id) return;
        const all = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        (all.length ? all : [e]).forEach((ev) => {
          const q = at(ev), p = live.p, n = p.length;
          if (Math.hypot(q[0] - p[n - 2], q[1] - p[n - 1]) < STEP) return;
          /* Pendant le geste, une courbe d'un milieu de segment au suivant : le trait reste lisse même tracé vite. */
          dab(n < 4 ? p[0] : (p[n - 4] + p[n - 2]) / 2, n < 4 ? p[1] : (p[n - 3] + p[n - 1]) / 2, p[n - 2], p[n - 1], (p[n - 2] + q[0]) / 2, (p[n - 1] + q[1]) / 2);
          p.push(q[0], q[1]);
          /* Un trait interminable est rangé par tronçons : chacun reste rapide à simplifier, et assez court pour être relu en entier. */
          if (p.length >= MAX_STROKE / 2) {
            const next = { id: live.id, c: live.c, z: live.z, p: q };
            commit();
            live = next;
          }
        });
      };
      const up = (e) => {
        if (!live || e.pointerId !== live.id) return;
        commit();
        redraw();
        g.hold(false);
      };
      cv.addEventListener("pointerdown", down);
      cv.addEventListener("pointermove", move);
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => cv.addEventListener(type, up));
      /* Sur iPhone, c'est ce qui empêche la loupe et la sélection de texte sous un doigt qui s'attarde. */
      cv.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
      /* Le chrono court depuis l'heure de départ enregistrée : recharger la page ne le remet pas à zéro. À zéro,
         la feuille part telle quelle (c'est le minuteur que le joueur a lancé, pas une réaction à l'autre téléphone). */
      const timer = secs && setInterval(() => {
        const left = remain(cur);
        if (left) {
          time.textContent = clock(left);
          time.classList.toggle("is-late", left <= 10);
          bar.style.width = (100 * left) / secs + "%";
          return;
        }
        /* Le minuteur s'arrête là et rend la main à l'affichage. Si cette feuille n'est plus celle de la partie
           (une nouvelle pile est arrivée pendant un trait), il ne sonne pas et ne rend rien. */
        clearInterval(timer);
        commit();
        const mine = stage(g).cur === cur;
        g.hold(false);
        if (mine) { k.buzz([120, 60, 120]); k.beep(); submit(g); }
      }, 250);
      redraw();
      pad = { commit, redraw };
      return () => { clearInterval(timer); commit(); pad = null; };
    },
    extra(k) {
      const list = gallery(k);
      return list.length ? '<details class="more dessin-gal"><summary>Vos dessins (' + list.length + ')</summary><p class="hint">Vos dernières paires, gardées sur cet appareil (' + KEEP +
        ' au plus). Touche une paire pour enregistrer son image.</p><div class="dessin-thumbs">' + list.map((p, i) => '<button class="dessin-thumb" type="button" data-act="image" data-v="' + i +
          '" aria-label="Enregistrer l\'image\u00a0: ' + k.esc(p.x.slice(0, 120)) + '">' + art(p.d[0], "", 3) + art(p.d[1], "", 3) + "<span>" + k.esc(p.x.slice(0, 120)) + "</span></button>").reverse().join("") +
        '</div><p><button class="link" type="button" data-act="empty">' + label("empty") + "</button></p></details>" : "";
    },
    extraAct(k, name, el) {
      const p = gallery(k)[int(parseInt(el.getAttribute("data-v"), 10), KEEP)];
      if (name === "image" && p) {
        save(p);
      } else if (name === "empty" && twice(name)) {
        k.store.del("dessin:galerie");
        k.render();
      }
    }
  });
})();
