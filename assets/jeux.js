/* Entre Nous : socle des jeux à deux.

   Chaque jeu se joue sur UN téléphone (qu'on se passe) ou sur DEUX (chacun le sien, dans
   la même pièce ou à distance). Ce fichier fournit ce que les jeux ont en commun : la
   présentation, l'invitation, l'état partagé entre les deux téléphones (salon chiffré sur
   le même relais que les tests), l'enregistrement et la reprise. Un jeu ne s'occupe que de
   son écran et de ses règles ; il s'écrit une seule fois pour les deux façons de jouer.

   ÉCRIRE UN JEU (jeux/<id>.js, chargé avant ce fichier ; styles dans jeux/<id>.css,
   classes préfixées par l'id ; contenu dans window.GAME_DATA[id])

     (window.GAMES = window.GAMES || []).push({
       id: "onde",                 // [a-z0-9]+ ; la page du jeu est #jeu-onde
       v: 1,                       // à augmenter si la forme de l'état change : les parties et invitations d'avant sont jetées
       title: "Sur la même longueur d'onde",
       hook: "Est-ce qu'on pense au même mot ?",       // titre de la carte d'accueil et de la présentation
       blurb: "Une phrase pour la carte d'accueil.",
       meta: "10 manches · 5 min",
       intro: ["Paragraphe.", "Paragraphe."],           // présentation du jeu
       glyph: '<circle class="ink-a" cx="18" cy="24" r="13"/>',   // intérieur d'un SVG 48 x 48 (classes ink-a, ink-b, ring-a, ring-b)
       live: true,                 // true : partie en direct, les deux doivent être là en même temps.
                                   // false : chacun joue de son côté, en même temps ou non, et le résultat s'ouvre quand les deux ont fini.
       options: [{ id: "deck", label: "Paquet", def: "leger", choices: [{ id: "leger", name: "Léger", hint: "Pour rire.", adult: false }] }],
                                   // facultatif : choix proposés sur la présentation ; ils arrivent dans g.setup
       view(g) { return "<p>…</p>"; },                  // HTML de l'écran de jeu : fonction pure de g, rappelée à chaque changement
       act(g, name, el, ev) {},                         // clic sur un élément data-act="name" de l'écran de jeu
       input(g, el, ev) {}, submit(g, form, ev) {}, key(g, ev) {},   // facultatifs (le submit est déjà neutralisé)
       mount(g, root) { return () => {}; },             // facultatif : après chaque rendu (root = le <main> du jeu) ; peut renvoyer
                                                        // un nettoyage, appelé avant le rendu suivant et en quittant la page
       extra(kit) { return ""; }, extraAct(kit, name, el, ev) {}     // facultatifs : bloc en bas de la présentation quand aucune
                                                                     // partie n'est en cours (liste gardée, galerie) et ses clics
     });

   LA POIGNÉE g
     g.duo            true sur deux téléphones
     g.me             "a" ou "b" sur deux téléphones (qui a créé la partie est "a") ; null sur un seul
     g.gen            numéro de la manche de jeu en cours dans cette partie (1, 2, 3…)
     g.setup          { seed, ...options } de la manche en cours, identique sur les deux téléphones
     g.S.a, g.S.b     la « tranche » de chaque joueur : un petit objet JSON que seul son propriétaire écrit
                      ({} tant qu'il n'a rien écrit dans la manche en cours). En lecture seule.
     g.sh             l'état commun de la manche ({} au départ), le dernier qui écrit gagne. En lecture seule.
     g.local          objet qui reste sur cet appareil (brouillon, avancement, « j'ai vu ») : modifie-le puis g.save().
                      Vidé à chaque nouvelle manche.
     g.set(w, patch)  fusionne patch dans la tranche du joueur w, enregistre, envoie, réaffiche.
                      Sur deux téléphones, w doit être g.me. Sur un seul, "a" et "b" sont permis.
     g.share(patch)   fusionne patch dans l'état commun, enregistre, envoie, réaffiche.
     g.save()         enregistre g.local (sans envoi ni réaffichage)        g.render()  réaffiche
     g.newGame(patch) lance la manche suivante pour tout le monde : setup = l'ancien + patch + une nouvelle seed ;
                      tranches, état commun et g.local repartent de zéro sur les deux téléphones.
     g.stop()         termine la partie sur cet appareil et revient à la présentation
     g.hold(on)       tant que c'est tenu, ce qui arrive de l'autre téléphone est enregistré mais le réaffichage
                      attend g.hold(false). À utiliser pendant un glisser ou un trait de dessin.
     g.here(w)        sur deux téléphones : le joueur w a-t-il déjà rejoint la partie ? Toujours true sur un seul.
     g.online         "ok", "wait" ou "err" : l'état de la liaison (toujours "ok" sur un seul téléphone)
     g.nm(w), g.other(w), g.kit, g.def, g.id

   RÈGLES À CONNAÎTRE
     - Un seul téléphone : g.me vaut null, c'est au jeu de savoir qui tient l'appareil (dans g.local) et de
       cacher ce que l'autre ne doit pas voir, avec kit.pass() entre les deux tours.
     - Les tranches ne se marchent jamais dessus : mets-y tout ce qui appartient à un joueur (ses réponses,
       son vote, son dessin). L'état commun sert à ce que l'un OU l'autre peut décider (carte en cours,
       phase). Si les deux y écrivent au même instant, un seul des deux objets est gardé, en entier.
     - N'appelle g.set, g.share ou g.newGame que depuis une action du joueur (ou un minuteur qu'il a lancé),
       jamais depuis view() ni en réaction automatique à ce que l'autre vient d'envoyer : les deux téléphones
       se répondraient sans fin et le relais plafonne à 250 messages par jour. Une soupape ralentit les envois
       au-delà de trente par minute.
     - g.set renvoie ta tranche entière, g.share et g.newGame l'état commun entier (jamais les deux) :
       garde-les petits. Un dessin de quelques dizaines de ko passe, découpé en plusieurs messages ;
       au-delà de 150 ko rien ne part. Retire d'une tranche ce qui ne sert plus (g.set(w, { dessin: null })).
     - Tout ce qui vient de l'autre téléphone (g.S de l'autre, g.sh, g.setup chez l'invité) est une donnée
       non sûre : passe-la par kit.esc() avant de l'afficher et vérifie sa forme avant de t'en servir.
     - view() peut être rappelée à tout moment (l'autre téléphone vient d'écrire). Un champ de saisie garde
       sa valeur, le focus et le curseur s'il porte data-keep="clé" ; la clé doit changer quand le champ
       change de sens (autre manche, autre joueur), sinon le texte de l'un réapparaîtrait chez l'autre.
     - Noms d'action réservés : ceux qui commencent par « g- », plus « copy » et « share ».

   LES OUTILS (g.kit)
     esc, nm, de, que, pl, fill, other      ceux du moteur (échappement, prénoms, élisions, pluriels, gabarits)
     store                                  stockage local du site ; préfixe tes clés par "<id>:"
     seed()                                 un entier au hasard
     rng(seed)                              générateur reproductible : renvoie une fonction qui donne des réels dans [0, 1)
     shuffle(liste, seed)                   copie mélangée, identique sur les deux téléphones pour une même seed
     who(w)                                 pastille « encre + prénom »
     pass(w, act)                           bloc « Passe le téléphone » avec un bouton data-act=act « Je suis …, à moi »
     wait(g, texte)                         bloc d'attente de l'autre (avec rappel du lien d'invitation tant qu'il n'a pas rejoint)
     buzz(motif), beep()                    vibration et bip, sans erreur s'ils sont indisponibles
     venn(p), canRoom, render()

   LES STYLES (assets/jeux.css) : .as-a / .as-b (donnent --who et --who-soft, l'encre d'un joueur), .g-title,
   .g-lead, .g-card (+ .a / .b), .g-card-text, .g-tag (+ .a / .b), .g-who, .g-field, .g-score, .g-big,
   .g-actions (rangée de boutons collée en bas, à portée de pouce), .g-pass, .g-wait, .g-note. */
(function () {
  "use strict";

  window.ENGames = function (core) {
    const store = core.store, esc = core.esc, nm = core.nm, de = core.de, other = core.other, app = core.app;
    const DEFS = (window.GAMES || []).filter((d) => d && /^[a-z0-9]+$/.test(d.id || "") && typeof d.view === "function");
    const BY = {};
    DEFS.forEach((d) => { BY[d.id] = d; });

    const MAX_PARTS = 64, MAX_N = 1e15;
    const NET = { ok: "Connecté", wait: "Connexion…", err: "Hors ligne" };
    const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
    const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    const isRoom = (r, k) => /^[0-9a-f]{32}$/.test(r || "") && /^[\w-]{20,64}$/.test(k || "");
    const routeDef = (route) => { const m = /^jeu-([a-z0-9]+)$/.exec(route || ""); return (m && BY[m[1]]) || null; };
    const glyph = (d) => '<svg class="inks" viewBox="0 0 48 48" aria-hidden="true">' + (d.glyph || "") + "</svg>";
    const call = (fn) => { try { return fn(); } catch (e) { console.error(e); } };

    /* ---------- Hasard reproductible : la même seed donne le même tirage sur les deux téléphones ---------- */
    const seed = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 4294967296); } };
    const rng = (s) => {
      let a = (Number(s) >>> 0) || 1;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const shuffle = (list, s) => {
      const out = list.slice(), r = rng(s);
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), x = out[i]; out[i] = out[j]; out[j] = x; }
      return out;
    };

    /* ---------- Parties enregistrées ----------
       Une partie par jeu. Une tranche porte la marque de la manche (numéro + seed) pour laquelle
       elle a été écrite : dès que la manche change, les anciennes tranches ne comptent plus. */
    const sessions = {};
    const tok = (s) => s.gen + ":" + s.setup.seed;
    const slice = (s, w) => (s.S[w].k === tok(s) ? s.S[w].d : {});
    const okSetup = (x) => isObj(x) && (typeof x.seed === "number" || typeof x.seed === "string");
    function okSession(s, d) {
      return isObj(s) && s.id === d.id && s.v === d.v && typeof s.duo === "boolean" &&
        (s.duo ? (s.me === "a" || s.me === "b") && isObj(s.room) && isRoom(s.room.r, s.room.k) : s.me === null) &&
        (s.phase === "invite" || s.phase === "play") && isInt(s.gen, 1, 1e6) && okSetup(s.setup) && isObj(s.sh) &&
        isInt(s.st, 0, 1e9) && (s.sw === "a" || s.sw === "b") && isObj(s.S) &&
        ["a", "b"].every((w) => isObj(s.S[w]) && typeof s.S[w].k === "string" && isObj(s.S[w].d)) &&
        isObj(s.seq) && [s.seq.a, s.seq.b, s.sent].every((c) => isObj(c) && isInt(c.h, 0, MAX_N) && isInt(c.d, 0, MAX_N)) && isObj(s.local);
    }
    function load(id) {
      if (!(id in sessions)) {
        let s = store.get("g:" + id, null);
        /* Une partie illisible (ancienne version, stockage abîmé) est jetée : elle ne doit jamais bloquer la page. */
        if (s && !okSession(s, BY[id])) { store.del("g:" + id); s = null; }
        sessions[id] = s || null;
      }
      return sessions[id];
    }
    const persist = (s) => { s.at = Date.now(); store.set("g:" + s.id, s); };
    function drop(id) {
      sessions[id] = null;
      store.del("g:" + id);
      if (link && link.id === id) disconnect();
      if (pubs[id]) { clearTimeout(pubs[id].timer); delete pubs[id]; }
    }

    let invite = store.get("ginvite", null);
    if (invite && !(isObj(invite) && BY[invite.g] && invite.v === BY[invite.g].v && isRoom(invite.r, invite.k) && okSetup(invite.su) && isInt(invite.gen, 1, 1e6))) clearInvite();
    function clearInvite() { invite = null; store.del("ginvite"); }

    function options(d) {
      const saved = store.get("go:" + d.id, null), out = {};
      (d.options || []).forEach((o) => {
        const v = isObj(saved) ? saved[o.id] : null;
        out[o.id] = o.choices.some((c) => c.id === v) ? v : o.def;
      });
      return out;
    }

    /* ---------- Affichage ---------- */
    let cleanup = null, keep = {}, shown = "", held = false, waiting = false;
    const rerender = () => core.render(true);
    /* Ce qui arrive de l'autre téléphone ne doit pas casser un geste en cours. */
    function remote() { if (held) waiting = true; else rerender(); }
    function unmount() {
      if (cleanup) { const c = cleanup; cleanup = null; call(c); }
      held = false;
      waiting = false;
    }

    function changed(s, kind) {
      if (sessions[s.id] !== s) return; /* partie terminée entre-temps (minuteur attardé) */
      /* Les envois sont numérotés par l'heure : un téléphone dont le stockage a été vidé, et qui rejoint
         la même partie, repart ainsi au-dessus de ses anciens numéros au lieu d'être ignoré par l'autre. */
      if (s.duo) { s.seq[s.me][kind] = Math.max(s.seq[s.me][kind] + 1, Date.now()); publishSoon(s); }
      persist(s);
      rerender();
    }

    function handle(s) {
      return {
        kit, def: BY[s.id], id: s.id, nm, other,
        get duo() { return s.duo; },
        get me() { return s.me; },
        get gen() { return s.gen; },
        get setup() { return s.setup; },
        get sh() { return s.sh; },
        get local() { return s.local; },
        get online() { return netState(s); },
        S: { get a() { return slice(s, "a"); }, get b() { return slice(s, "b"); } },
        here: (w) => !s.duo || s.seq[w].h > 0,
        set(w, patch) {
          if ((w !== "a" && w !== "b") || (s.duo && w !== s.me)) { console.warn("Entre Nous : g.set(" + w + ") ignoré, cette tranche appartient à l'autre joueur."); return; }
          s.S[w] = { k: tok(s), d: Object.assign({}, slice(s, w), patch) };
          changed(s, "d");
        },
        share(patch) {
          s.sh = Object.assign({}, s.sh, patch);
          s.st++;
          s.sw = s.me || "a";
          changed(s, "h");
        },
        save() { if (sessions[s.id] === s) persist(s); },
        render: rerender,
        newGame(patch) {
          s.gen++;
          s.setup = Object.assign({}, s.setup, patch, { seed: seed() });
          s.sh = {};
          s.st = 0;
          s.sw = s.me || "a";
          s.local = {};
          changed(s, "h");
        },
        stop() { drop(s.id); core.render(); },
        hold(on) { held = !!on; if (!held && waiting) { waiting = false; rerender(); } }
      };
    }

    /* ---------- Deux téléphones : envoi ----------
       Ce dont je réponds part en deux photos numérotées séparément : l'en-tête « h » (manche, réglages,
       état commun tel que je le connais) et ma tranche « d ». Seule celle qui a changé repart : passer à
       la carte suivante ne renvoie pas un dessin. Le destinataire ne garde que la plus récente de chaque
       sorte : l'ordre, les doublons et les pertes n'ont donc aucune importance. */
    const pubs = {};
    const topic = (s) => core.RELAY + "entrenous-" + s.room.r;
    const pubOf = (id) => pubs[id] || (pubs[id] = { timer: null, busy: false, fails: 0, last: 0, stamps: [] });

    /* Découpe en morceaux qui, une fois chiffrés, restent sous la limite de 4 096 octets du relais. */
    function split(text) {
      const enc = new TextEncoder(), out = [];
      let i = 0;
      while (i < text.length) {
        let len = Math.min(2600, text.length - i);
        while (len > 1 && enc.encode(JSON.stringify(text.substr(i, len))).length > 2700) len = Math.floor(len * 0.8);
        const last = text.charCodeAt(i + len - 1);
        if (len > 1 && last >= 0xd800 && last <= 0xdbff) len--; /* ne pas couper un caractère double (emoji) */
        out.push(text.substr(i, len));
        i += len;
      }
      return out.length ? out : [""];
    }

    function publishSoon(s, delay) {
      const p = pubOf(s.id);
      if (p.timer || p.busy) return;
      const now = Date.now();
      p.stamps = p.stamps.filter((t) => now - t < 60000);
      /* Soupape : au-delà de trente envois par minute, un jeu fautif ne doit pas vider le quota du jour. */
      const gap = p.stamps.length >= 30 ? 5000 : 350;
      p.timer = setTimeout(() => { p.timer = null; flush(s.id); }, delay != null ? delay : Math.max(60, p.last + gap - now));
    }

    async function flush(id) {
      const s = sessions[id], p = pubOf(id);
      const late = (k) => s.sent[k] < s.seq[s.me][k];
      if (!s || !s.duo || p.busy || !(late("h") || late("d"))) return;
      p.busy = true;
      let status = 0;
      try {
        for (const t of ["h", "d"]) {
          if (!late(t)) continue;
          const n = s.seq[s.me][t];
          const parts = split(JSON.stringify(t === "h" ? { gen: s.gen, su: s.setup, sh: s.sh, st: s.st, sw: s.sw } : s.S[s.me]));
          if (parts.length > MAX_PARTS) {
            console.warn("Entre Nous : état trop volumineux, non envoyé.");
          } else {
            for (let i = 0; i < parts.length; i++) {
              const body = await core.seal(s.room, { g: s.id, v: s.v, w: s.me, t, n, p: i, c: parts.length, s: parts[i] });
              const res = await fetch(topic(s), { method: "POST", body });
              if (!res.ok) { status = res.status; throw new Error("relais " + res.status); }
            }
            p.last = Date.now();
            p.stamps.push(p.last);
          }
          if (sessions[id] === s) { s.sent[t] = Math.max(s.sent[t], n); persist(s); }
        }
        p.fails = 0;
      } catch (e) {
        p.fails++;
      }
      p.busy = false;
      paintNet();
      if (sessions[id] !== s) return;
      if (p.fails) publishSoon(s, status === 429 ? 30000 : [2000, 4000, 8000, 15000][Math.min(p.fails - 1, 3)]);
      else if (late("h") || late("d")) publishSoon(s);
    }

    /* ---------- Deux téléphones : réception ---------- */
    let link = null;

    const okSnap = (t, x) => isObj(x) && (t === "h"
      ? isInt(x.gen, 1, 1e6) && okSetup(x.su) && isObj(x.sh) && isInt(x.st, 0, 1e9) && (x.sw === "a" || x.sw === "b")
      : typeof x.k === "string" && x.k.length <= 64 && isObj(x.d));

    /* Déchiffre un message, range le morceau, et renvoie la photo quand elle est complète.
       Tout ce qui est illisible ou mal formé est ignoré : n'importe qui ayant le lien peut écrire dans le salon. */
    async function take(l, s, sealed) {
      let o;
      try { o = await core.unseal(s.room, sealed); } catch (e) { return null; }
      if (!isObj(o) || o.g !== s.id || o.v !== s.v || (o.w !== "a" && o.w !== "b") || (o.t !== "h" && o.t !== "d") || !isInt(o.n, 1, MAX_N) ||
        !isInt(o.c, 1, MAX_PARTS) || !isInt(o.p, 0, o.c - 1) || typeof o.s !== "string" || o.s.length > 4000) return null;
      const key = o.w + o.t + o.n;
      let box = l.parts[key];
      if (!box || box.c !== o.c) box = l.parts[key] = { key, w: o.w, t: o.t, n: o.n, c: o.c, got: 0, arr: [] };
      if (box.arr[o.p] == null) { box.arr[o.p] = o.s; box.got++; }
      if (box.got < box.c) {
        /* Au plus trois photos incomplètes de chaque sorte par joueur en mémoire. */
        const same = Object.keys(l.parts).map((k) => l.parts[k]).filter((b) => b.w === o.w && b.t === o.t).sort((x, y) => x.n - y.n);
        while (same.length > 3) delete l.parts[same.shift().key];
        return null;
      }
      delete l.parts[key];
      let x;
      try { x = JSON.parse(box.arr.join("")); } catch (e) { return null; }
      return okSnap(o.t, x) ? { w: o.w, t: o.t, n: o.n, x } : null;
    }

    /* Intègre une photo. L'état commun le plus récent gagne : manche, puis compteur d'écritures,
       puis, à égalité, celui du joueur « a », pour que les deux téléphones tranchent pareil. */
    function apply(s, snap) {
      const w = snap.w, t = snap.t, n = snap.n, x = snap.x;
      if (n <= s.seq[w][t]) return false;
      s.seq[w][t] = n;
      if (w === s.me) s.sent[t] = Math.max(s.sent[t], n); /* écrit depuis un autre onglet de ce téléphone */
      if (t === "d") {
        s.S[w] = { k: x.k, d: x.d };
      } else {
        const wins = x.gen !== s.gen ? x.gen > s.gen : x.st !== s.st ? x.st > s.st : x.sw === "a" && s.sw !== "a";
        if (wins) {
          const before = tok(s);
          s.gen = x.gen; s.setup = x.su; s.sh = x.sh; s.st = x.st; s.sw = x.sw;
          if (tok(s) !== before) s.local = {};
        }
      }
      /* Partie en direct : dès que l'autre arrive, on quitte l'écran d'invitation. */
      if (s.phase === "invite" && BY[s.id].live && s.seq[other(s.me)].h > 0) s.phase = "play";
      persist(s);
      return true;
    }

    function netState(s) {
      if (!s.duo) return "ok";
      const p = pubs[s.id], on = link && link.id === s.id;
      if ((p && p.fails) || (on && link.state === "err")) return "err";
      return on && link.state === "ok" ? "ok" : "wait";
    }
    /* La pastille de liaison est mise à jour sur place : un changement de réseau ne doit pas redessiner le jeu. */
    function paintNet() {
      const d = routeDef(core.route()), s = d && load(d.id);
      if (!s || !s.duo) return;
      const st = netState(s);
      app.querySelectorAll("[data-net]").forEach((el) => { el.setAttribute("data-net", st); el.textContent = NET[st]; });
    }

    function connect(s) {
      if (link && link.id === s.id && link.room === s.room.r) return;
      disconnect();
      link = { id: s.id, room: s.room.r, es: null, timer: null, dog: null, last: "", tries: 0, run: 0, state: "wait", parts: {}, hidden: 0 };
      start(link);
    }
    function quiet(l) {
      clearTimeout(l.timer);
      clearTimeout(l.dog);
      if (l.es) { l.es.close(); l.es = null; }
    }
    function disconnect() {
      if (!link) return;
      quiet(link);
      link = null;
    }
    /* Une lecture complète du salon, puis l'écoute en continu. */
    async function start(l) {
      const s = sessions[l.id];
      if (link !== l || !s) return;
      /* Un réveil (retour au premier plan, réseau revenu) peut relancer une lecture pendant qu'une autre
         est en cours : seule la dernière lancée a le droit d'ouvrir le flux. */
      const run = ++l.run, stale = () => link !== l || l.run !== run || sessions[l.id] !== s;
      try {
        const res = await fetch(topic(s) + "/json?poll=1&since=all", { cache: "no-store" });
        if (!res.ok) throw new Error("relais " + res.status);
        const mine = { h: 0, d: 0 };
        let moved = false;
        for (const line of (await res.text()).split("\n")) {
          let m = null;
          try { m = JSON.parse(line); } catch (e) { continue; }
          if (!m || m.event !== "message") continue;
          l.last = m.id;
          const snap = await take(l, s, m.message);
          if (!snap || stale()) continue;
          if (snap.w === s.me) mine[snap.t] = Math.max(mine[snap.t], snap.n);
          if (apply(s, snap)) moved = true;
        }
        if (stale()) return;
        /* Le relais oublie tout au bout de douze heures : je redépose mon dernier état s'il n'y est plus. */
        ["h", "d"].forEach((t) => { if (s.seq[s.me][t] > mine[t]) { s.sent[t] = Math.min(s.sent[t], mine[t]); publishSoon(s); } });
        if (moved) remote();
        listen(l, s);
      } catch (e) {
        if (!stale()) retry(l);
      }
    }
    function listen(l, s) {
      if (!window.EventSource) {
        /* Sans flux continu : une lecture toutes les douze secondes, pas plus (le relais compte les requêtes). */
        l.state = "ok";
        l.tries = 0;
        paintNet();
        l.timer = setTimeout(() => start(l), 12000);
        return;
      }
      const es = l.es = new EventSource(topic(s) + "/sse?since=" + (l.last || "all"));
      /* Le relais envoie un signe de vie toutes les 45 secondes : sans rien pendant 70, le flux est mort. */
      const beat = () => { clearTimeout(l.dog); l.dog = setTimeout(() => retry(l), 70000); };
      es.addEventListener("open", () => { if (link !== l) return; l.tries = 0; l.state = "ok"; paintNet(); beat(); });
      es.addEventListener("keepalive", beat);
      es.onmessage = (e) => {
        beat();
        let m = null;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (!m || m.event !== "message") return;
        l.last = m.id;
        take(l, s, m.message).then((snap) => { if (snap && link === l && sessions[l.id] === s && apply(s, snap)) remote(); });
      };
      /* On reprend la main sur les reconnexions : celles du navigateur, immédiates, épuiseraient le relais. */
      es.onerror = () => retry(l);
      beat();
    }
    function retry(l) {
      if (link !== l) return;
      quiet(l);
      l.state = l.tries >= 2 ? "err" : "wait";
      paintNet();
      l.timer = setTimeout(() => start(l), [2000, 5000, 10000, 20000, 30000][Math.min(l.tries++, 4)]);
    }
    function wake() {
      if (!link) return;
      quiet(link);
      link.tries = 0;
      start(link);
    }
    document.addEventListener("visibilitychange", () => {
      if (!link) return;
      if (document.hidden) { link.hidden = Date.now(); return; }
      /* Un téléphone verrouillé gèle le flux sans le fermer : après une vraie absence, on relit tout. */
      if (!link.es || link.es.readyState !== 1 || (link.hidden && Date.now() - link.hidden > 15000)) wake();
    });
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", (e) => { if (e.persisted) wake(); });

    /* ---------- Outils offerts aux jeux ---------- */
    let audio = null;
    const inviteUrl = (d, s) => location.origin + location.pathname + "#g=" +
      core.encode({ g: d.id, v: d.v, n: core.names(), r: s.room.r, k: s.room.k, su: s.setup, gen: s.gen });
    const inviteBox = (d, s) => core.shareBox({
      url: inviteUrl(d, s),
      label: "Le lien de la partie pour " + esc(nm("b")),
      how: core.hasQr() ? "Fais scanner ce QR code avec l'appareil photo de son téléphone, ou envoie le lien par message." : "Envoie ce lien par message.",
      text: nm("a") + " t'invite à jouer à « " + d.title + " »"
    });
    const kit = {
      esc, nm, de, other, store, seed, rng, shuffle,
      que: core.que, pl: core.pl, fill: core.fill, venn: core.venn, canRoom: core.canRoom, render: rerender,
      who: (w) => '<span class="g-who ' + (w === "b" ? "b" : "a") + '"><i class="sw ' + (w === "b" ? "b" : "a") + '"></i>' + esc(nm(w)) + "</span>",
      pass(w, act) {
        const N = esc(nm(w));
        return '<section class="g-pass as-' + (w === "b" ? "b" : "a") + '"><p class="eyebrow">Passe le téléphone</p><h1 tabindex="-1" data-focus>Au tour ' + esc(de(nm(w))) +
          ".</h1><p>Donne l'appareil à " + N + ', sans regarder l\'écran.</p><div class="actions"><button class="btn" type="button" data-act="' + esc(act) + '">Je suis ' + N + ", à moi</button></div></section>";
      },
      wait(g, text) {
        const s = sessions[g.id];
        const late = s && s.duo && s.me === "a" && !s.seq.b.h;
        return '<div class="g-wait"><p class="sync" role="status">' + esc(text) + "</p>" +
          (late ? '<details class="more"><summary>' + esc(nm("b")) + " n'a pas encore rejoint la partie ?</summary>" + inviteBox(BY[s.id], s) + "</details>" : "") + "</div>";
      },
      buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern || 200); } catch (e) { /* sans importance */ } },
      beep() {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          audio = audio || new AC();
          if (audio.state === "suspended") audio.resume();
          const o = audio.createOscillator(), v = audio.createGain(), t = audio.currentTime;
          o.frequency.value = 880;
          v.gain.setValueAtTime(0.0001, t);
          v.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
          v.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          o.connect(v);
          v.connect(audio.destination);
          o.start(t);
          o.stop(t + 0.55);
        } catch (e) { /* pas de son : sans importance */ }
      }
    };

    /* ---------- Écrans du socle ---------- */
    function card(d) {
      const s = load(d.id);
      return '<article class="card"><div class="glyph">' + glyph(d) + '</div><div class="card-body"><p class="eyebrow">' + esc(d.title) + '</p><h3><a class="card-link" href="#jeu-' + d.id + '">' + esc(d.hook) +
        '</a></h3><p class="blurb">' + esc(d.blurb) + '</p><p class="meta">' + esc(d.meta) + (core.canRoom ? " · 1 ou 2 téléphones" : "") + "</p>" +
        (s ? '<a class="card-state" href="#jeu-' + d.id + '">Partie en cours · reprendre</a>' : "") + "</div></article>";
    }

    function home() {
      const banners = DEFS.filter((d) => load(d.id)).map((d) => '<aside class="banner"><p><b>' + esc(d.title) + "</b> : une partie est en cours.</p>" +
        '<div class="banner-actions"><a class="btn small" href="#jeu-' + d.id + '">Reprendre</a><button class="link" type="button" data-act="g-drop" data-id="' + d.id + '">Abandonner</button></div></aside>').join("");
      const group = DEFS.length ? '<section class="group"><h2 class="group-title">Pour jouer</h2><div class="cards">' + DEFS.map(card).join("") + "</div></section>" : "";
      return { banners, group, count: DEFS.length };
    }

    function vIntro(d) {
      const inv = invite && invite.g === d.id, s = load(d.id);
      let start;
      if (inv) {
        start = '<div class="invite"><p><b>' + esc(nm("a")) + "</b> t'invite à jouer, chacun sur son téléphone." + (d.live ? " La partie se joue en direct." : "") +
          (s ? " Rejoindre cette partie remplacera celle que tu as en cours." : "") + "</p></div>" +
          '<div class="actions"><button class="btn" type="button" data-act="g-join">Je suis ' + esc(nm("b")) + ", je rejoins</button></div>" +
          '<p class="hint"><button class="link" type="button" data-act="g-decline">Ignorer cette invitation</button></p>';
      } else {
        const cur = options(d);
        const opts = (d.options || []).map((o) => '<div class="g-opts"><p class="g-opts-label" id="go-' + o.id + '">' + esc(o.label) + '</p><div class="g-choices" role="group" aria-labelledby="go-' + o.id + '">' +
          o.choices.map((c) => '<button class="g-choice" type="button" data-act="g-opt" data-opt="' + o.id + '" data-val="' + c.id + '" aria-pressed="' + (cur[o.id] === c.id) + '"><b>' + esc(c.name) +
            (c.adult ? ' <span class="g-tag">Adultes</span>' : "") + "</b>" + (c.hint ? "<span>" + esc(c.hint) + "</span>" : "") + "</button>").join("") + "</div></div>").join("");
        start = opts + core.namesForm("Ton prénom", "Le prénom de l'autre") + '<div class="actions">' +
          (core.canRoom ? '<button class="btn" type="button" data-act="g-start" data-mode="duo">Chacun sur son téléphone</button>' : "") +
          '<button class="btn' + (core.canRoom ? " alt" : "") + '" type="button" data-act="g-start" data-mode="solo">Sur un seul téléphone</button></div><p class="hint">' +
          (!core.canRoom ? "Vous jouez sur cet appareil, en vous le passant."
            : "Chacun sur son téléphone : tu obtiens un lien et un QR code à faire scanner. " +
              (d.live ? "La partie se joue en direct, il faut être là tous les deux en même temps." : "Chacun joue de son côté, en même temps ou non, et le résultat s'ouvre chez vous deux quand tout le monde a fini.") +
              " Ce que vous échangez passe chiffré par un relais qui ne peut pas le lire.") + "</p>";
      }
      const extra = !inv && d.extra ? call(() => d.extra(kit)) : "";
      return core.topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(d) + '</div><p class="eyebrow">' + esc(d.title) + "</p><h1>" + esc(d.hook) + "</h1>" +
        (d.intro || []).map((p) => "<p>" + esc(p) + "</p>").join("") + start + (extra ? "<div data-extra>" + extra + "</div>" : "") + "</main>";
    }

    function vInvite(d, s) {
      const B = esc(nm("b")), here = s.seq.b.h > 0;
      return core.topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(d) + '</div><p class="eyebrow">' + esc(d.title) + "</p><h1>Invite " + B + " à jouer.</h1><p>" + B +
        " ouvre ce lien sur son téléphone et rejoint la partie. " + (d.live ? "La partie se joue en direct : elle démarre dès que " + B + " est là." : "Tu peux commencer sans attendre : " + B + " jouera de son côté.") + "</p>" +
        inviteBox(d, s) + '<p class="sync' + (here ? " is-here" : "") + '" role="status">' + (here ? B + " est là." : "En attente " + esc(de(nm("b"))) + "…") + "</p>" +
        '<div class="actions"><button class="btn' + (d.live && !here ? " alt" : "") + '" type="button" data-act="g-go">' + (d.live && !here ? "Commencer sans attendre" : "Commencer") + "</button></div>" +
        '<p class="hint"><button class="link" type="button" data-act="g-stop">Annuler cette partie</button></p></main>';
    }

    function vPlay(d, s) {
      let body = call(() => d.view(handle(s)));
      if (typeof body !== "string") body = '<p class="note">Ce jeu a rencontré un problème. Tu peux arrêter la partie puis la relancer.</p>';
      const st = netState(s);
      return '<header class="top g-top"><a class="link" href="#accueil">Quitter</a><span class="g-name">' + esc(d.title) + "</span>" +
        (s.duo ? '<span class="g-net" data-net="' + st + '" role="status">' + NET[st] + "</span>" : "<span></span>") + "</header>" +
        '<main class="wrap narrow game" data-game="' + d.id + '">' + body +
        '<footer class="g-foot"><button class="link" type="button" data-act="g-stop">Arrêter la partie</button></footer></main>';
    }

    /* ---------- Branchements du moteur ---------- */
    function view(route) {
      unmount();
      /* Les champs data-keep ne sont repris que d'un rendu au suivant de la même page. */
      keep = {};
      if (route === shown) {
        app.querySelectorAll("[data-keep]").forEach((el) => {
          const o = { v: el.value, f: document.activeElement === el };
          if (o.f) { try { o.s = el.selectionStart; o.e = el.selectionEnd; } catch (e) { /* champ sans curseur */ } }
          keep[el.getAttribute("data-keep")] = o;
        });
      }
      shown = route;
      const d = routeDef(route);
      if (!d) return null;
      const s = load(d.id);
      return !s || (invite && invite.g === d.id) ? vIntro(d) : s.phase === "invite" ? vInvite(d, s) : vPlay(d, s);
    }

    function after(route) {
      const d = routeDef(route), s = d && load(d.id);
      if (s && s.duo && core.canRoom) connect(s); else disconnect();
      if (!d) return;
      app.querySelectorAll("[data-keep]").forEach((el) => {
        const o = keep[el.getAttribute("data-keep")];
        if (!o) return;
        if (typeof o.v === "string") el.value = o.v;
        if (o.f) { try { el.focus({ preventScroll: true }); if (o.s != null) el.setSelectionRange(o.s, o.e); } catch (e) { /* sans importance */ } }
      });
      if (s && s.phase === "play" && d.mount && !(invite && invite.g === d.id)) {
        const c = call(() => d.mount(handle(s), app.querySelector("main.game")));
        if (typeof c === "function") cleanup = c;
      }
    }

    function create(d, o) {
      const s = Object.assign({ id: d.id, v: d.v, sh: {}, st: 0, sw: "a", S: { a: { k: "", d: {} }, b: { k: "", d: {} } },
        seq: { a: { h: 0, d: 0 }, b: { h: 0, d: 0 } }, sent: { h: 0, d: 0 }, local: {} }, o);
      sessions[d.id] = s;
      /* Premier envoi dès l'arrivée : c'est lui qui dit à l'autre téléphone « je suis là ». */
      if (s.duo) { s.seq[s.me].h = Date.now(); publishSoon(s, 0); }
      persist(s);
      core.render();
    }

    function kitAct(act, el) {
      if (act === "g-drop") {
        if (BY[el.getAttribute("data-id")]) { drop(el.getAttribute("data-id")); core.render(true); }
        return;
      }
      const d = routeDef(core.route());
      if (!d) return;
      const s = load(d.id), inv = invite && invite.g === d.id;
      if (act === "g-opt") {
        const o = (d.options || []).find((x) => x.id === el.getAttribute("data-opt")), val = el.getAttribute("data-val");
        if (!o || !o.choices.some((c) => c.id === val)) return;
        const saved = options(d);
        saved[o.id] = val;
        store.set("go:" + d.id, saved);
        /* Mise à jour sur place : un rendu complet ferait perdre le focus et les prénoms en cours de saisie. */
        el.parentNode.querySelectorAll('[data-act="g-opt"]').forEach((b) => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
      } else if (act === "g-start" && !s && !inv) {
        core.readNames();
        const duo = el.getAttribute("data-mode") === "duo" && core.canRoom;
        create(d, { duo, me: duo ? "a" : null, room: duo ? core.newRoom() : null, phase: duo ? "invite" : "play", gen: 1, setup: Object.assign({ seed: seed() }, options(d)) });
      } else if (act === "g-join" && inv && core.canRoom) {
        const i = invite;
        clearInvite();
        if (s) drop(d.id);
        create(d, { duo: true, me: "b", room: { r: i.r, k: i.k }, phase: "play", gen: i.gen, setup: i.su });
      } else if (act === "g-decline") {
        clearInvite();
        core.render();
      } else if (act === "g-go" && s) {
        s.phase = "play";
        persist(s);
        core.render();
      } else if (act === "g-stop" && s) {
        /* Deux touchers : une partie ne doit pas disparaître sur un geste malheureux. */
        if (el.getAttribute("data-armed")) { drop(d.id); core.render(); return; }
        const label = el.textContent;
        el.setAttribute("data-armed", "1");
        el.textContent = "Toucher encore pour confirmer";
        setTimeout(() => { if (el.isConnected) { el.removeAttribute("data-armed"); el.textContent = label; } }, 4000);
      }
    }

    function playing() {
      const d = routeDef(core.route()), s = d && load(d.id);
      return s && s.phase === "play" && !(invite && invite.g === d.id) ? { d, g: handle(s) } : null;
    }

    return {
      count: DEFS.length,
      view, after, home,
      click(act, el, ev) {
        if (act.indexOf("g-") === 0) { kitAct(act, el); return true; }
        const d = routeDef(core.route());
        if (!d || act === "copy" || act === "share") return false;
        const p = playing();
        if (p) { if (p.d.act) call(() => p.d.act(p.g, act, el, ev)); return true; }
        if (d.extraAct && el.closest("[data-extra]")) { call(() => d.extraAct(kit, act, el, ev)); return true; }
        return false;
      },
      input(el, ev) { const p = playing(); if (p && p.d.input) call(() => p.d.input(p.g, el, ev)); return !!p; },
      submit(form, ev) { const p = playing(); if (p && p.d.submit) call(() => p.d.submit(p.g, form, ev)); return !!p; },
      key(ev) { const p = playing(); if (p && p.d.key) call(() => p.d.key(p.g, ev)); return !!p; },
      /* Lien d'invitation à une partie (#g=…). */
      join(raw) {
        let o = null;
        try { o = core.decode(raw); } catch (e) { o = null; }
        if (!isObj(o)) return core.fail("Ce lien d'invitation est illisible. Demande à l'autre de te le renvoyer.");
        const d = typeof o.g === "string" && BY.hasOwnProperty(o.g) ? BY[o.g] : null;
        if (!d) return core.fail("Ce lien d'invitation ne correspond à aucun jeu de cette page.");
        if (o.v !== d.v) return core.fail("Ce lien vient d'une ancienne version du jeu. Il faut relancer une partie.");
        if (!isRoom(o.r, o.k) || !okSetup(o.su) || !isInt(o.gen, 1, 1e6)) return core.fail("Ce lien d'invitation est incomplet. Demande à l'autre de te le renvoyer.");
        if (!core.canRoom) return core.fail("Ce lien ne peut s'ouvrir que sur le site, dans un navigateur.");
        const s = load(d.id);
        /* Mon propre lien, ou une partie que j'ai déjà rejointe : on y retourne simplement. */
        if (!(s && s.duo && s.room.r === o.r)) {
          core.setNames(o.n);
          invite = { g: d.id, v: d.v, r: o.r, k: o.k, su: o.su, gen: o.gen };
          store.set("ginvite", invite);
        }
        core.go("jeu-" + d.id);
      }
    };
  };
})();
