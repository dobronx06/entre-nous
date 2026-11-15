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
       meta: "10 thèmes · 5 min",
       intro: ["Paragraphe.", "Paragraphe."],           // présentation du jeu
       glyph: '<circle class="ink-a" cx="18" cy="24" r="13"/>',   // intérieur d'un SVG 48 x 48 (classes ink-a, ink-b, ring-a, ring-b)
       live: true,                 // true : partie en direct, les deux doivent être là en même temps.
                                   // false : chacun joue de son côté, en même temps ou non, et le résultat s'ouvre quand les deux ont fini.
       options: [{ id: "deck", label: "Paquet", def: "leger", duo: false,
                   choices: [{ id: "leger", name: "Léger", hint: "Pour rire.", adult: false }] }],
                                   // facultatif : choix proposés sur la présentation ; ils arrivent dans g.setup.
                                   // duo: true n'affiche l'option que là où l'on peut jouer sur deux téléphones.
       view(g) { return "<p>…</p>"; },                  // HTML de l'écran de jeu : fonction pure de g, rappelée à chaque changement
       act(g, name, el, ev) {},                         // clic sur un élément data-act="name" de l'écran de jeu
       input(g, el, ev) {}, submit(g, form, ev) {}, key(g, ev) {},   // facultatifs (le submit est déjà neutralisé)
       mount(g, root) { return () => {}; },             // facultatif : après chaque rendu (root = le <main> du jeu) ; peut
                                                        // retourner un nettoyage, appelé avant le rendu suivant et en quittant la page
       extra(kit) { return ""; }, extraAct(kit, name, el, ev) {},    // facultatifs : bloc en bas de la présentation quand aucune
                                                                     // partie n'est en cours (liste gardée, galerie) et ses clics
       over(g) { return false; }                        // facultatif : true quand la manche en cours est terminée ; l'accueil
                                                        // ne propose alors plus de « reprendre » cette partie
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
     g.set(w, patch)  fusionne patch dans la tranche du joueur w, enregistre, envoie, réaffiche. Ne retourne rien.
                      Sur deux téléphones, w doit être g.me. Sur un seul, "a" et "b" sont permis.
     g.share(patch)   fusionne patch dans l'état commun, enregistre, envoie, réaffiche. Ne retourne rien.
     g.save()         enregistre g.local (sans envoi ni réaffichage)        g.render()  réaffiche
     g.newGame(patch) lance la manche suivante pour tout le monde : setup = l'ancien + patch + une nouvelle seed ;
                      tranches, état commun et g.local repartent de zéro sur les deux téléphones.
     g.stop()         termine la partie sur cet appareil (l'autre téléphone en est prévenu) et revient à la présentation
     g.hold(on)       tant que c'est tenu, ce qui arrive de l'autre téléphone est enregistré mais le réaffichage
                      attend g.hold(false). À utiliser pendant un glisser ou un trait de dessin. (Pendant un simple
                      appui, le socle diffère déjà le réaffichage tout seul.)
     g.here(w)        sur deux téléphones : le joueur w a-t-il déjà rejoint la partie ? Toujours true sur un seul.
     g.online         "ok", "wait", "err" ou "full" (relais saturé) : l'état de la liaison au moment du rendu (toujours "ok" sur un seul
                      téléphone). Un changement de liaison ne rappelle PAS view() : pour un affichage qui suit en
                      direct, place un élément <span data-net></span>, dont le socle met à jour le texte sur place.
     g.nm(w), g.other(w), g.kit, g.def, g.id
                      Les prénoms (g.nm, kit.nm et tout ce qui les utilise) sont ceux de la partie : fixés à sa
                      création et transmis par l'invitation, ils ne changent pas si on modifie ceux de l'accueil.

   RÈGLES À CONNAÎTRE
     - Un seul téléphone : g.me vaut null, c'est au jeu de savoir qui tient l'appareil (dans g.local) et de
       cacher ce que l'autre ne doit pas voir, avec kit.pass() entre les deux tours.
     - Les tranches ne se marchent jamais dessus : mets-y tout ce qui appartient à un joueur (ses réponses,
       son vote, son dessin). L'état commun sert à ce que l'un OU l'autre peut décider (carte en cours,
       phase). Si les deux y écrivent au même instant, un seul des deux objets est gardé, en entier.
     - N'appelle g.set, g.share ou g.newGame que depuis une action du joueur (ou un minuteur qu'il a lancé),
       jamais depuis view() ni en réaction automatique à ce que l'autre vient d'envoyer : les deux téléphones
       se répondraient sans fin et le relais plafonne à 250 messages par jour. Une soupape étale les envois
       au-delà de trente messages d'affilée (un toutes les huit secondes, puis un par minute passé
       quatre-vingts dans l'heure).
     - g.set envoie ta tranche entière, g.share et g.newGame envoient l'état commun entier avec g.setup
       (jamais les deux à la fois) : garde-les petits. g.setup doit rester sous 4 000 caractères (sinon
       g.newGame est refusé), et l'état commun plus g.setup sous 7 ko (sinon il ne part plus) ; une tranche peut aller jusqu'à 60 ko (un dessin), découpée en messages
       de 2,6 ko, mais chaque message compte : le relais accepte 60 requêtes d'affilée puis une toutes
       les cinq secondes pour les deux téléphones d'un même réseau, et 250 messages par jour. Vise
       quelques ko par envoi et retire ce qui ne sert plus (g.set(w, { dessin: null })).
     - Tout ce qui est rangé dans la partie peut venir de l'autre téléphone, ou de quiconque a le lien
       d'invitation : la tranche de l'autre, la tienne quand elle est restaurée depuis le relais, g.sh,
       g.setup (des deux côtés) et les prénoms. Passe chaque texte par kit.esc() avant de l'afficher et
       vérifie forme, type et bornes avant de t'en servir. Une valeur mal formée ne doit jamais bloquer l'écran.
     - Un secret n'est secret qu'à l'écran : sur deux téléphones, la tranche de l'autre est enregistrée sur ce
       téléphone (en clair dans le stockage du navigateur) dès qu'elle arrive. Ne l'affiche pas trop tôt, et
       ne promets pas aux joueurs plus que « l'autre ne le verra pas ».
     - view() peut être rappelée à tout moment (l'autre téléphone vient d'écrire). Un champ de saisie garde
       sa valeur, le focus et le curseur s'il porte data-keep="clé" ; la clé doit changer quand le champ
       change de sens (autre manche, autre joueur), sinon le texte de l'un réapparaîtrait chez l'autre.
       Le bouton qui avait le focus le garde si l'écran n'a pas changé.
     - Donne à l'élément racine de chaque écran (le premier enfant de ce que retourne view) un attribut
       data-screen="nom" (par exemple "ecrire-3", "resultat") : quand ce nom change, le socle remonte en haut
       de la page et laisse le focus aller à l'élément data-focus du nouvel écran. Cet élément racine reçoit
       la même mise en page en colonne que l'écran de jeu (assets/jeux.css).
     - Noms d'action réservés : ceux qui commencent par « g- », plus « copy » et « share ».

   LES OUTILS (g.kit)
     esc, de, que, pl, fill, other          ceux du moteur (échappement, élisions, pluriels, gabarits)
     nm(w)                                  le prénom du joueur w dans la partie affichée
     store                                  stockage local du site ; préfixe tes clés par "<id>:"
     seed()                                 un entier au hasard
     rng(seed)                              générateur reproductible : retourne une fonction qui donne des réels dans [0, 1)
     shuffle(liste, seed)                   copie mélangée, identique sur les deux téléphones pour une même seed
     who(w)                                 pastille « encre + prénom »
     pass(w, act)                           bloc « Passe le téléphone » avec un bouton data-act=act « Je suis …, à moi »
     wait(g, texte)                         bloc d'attente de l'autre (avec rappel du lien d'invitation tant qu'il n'a pas rejoint)
     buzz(motif), beep()                    vibration et bip, sans erreur s'ils sont indisponibles. Le son est
                                            débloqué au premier toucher sur la page du jeu (exigence d'iOS).
     venn(p), canRoom, render()

   LES STYLES (assets/jeux.css) : .as-a / .as-b (donnent --who et --who-soft, l'encre d'un joueur), .g-title,
   .g-lead, .g-card (+ .a / .b), .g-card-text, .g-tag (+ .a / .b), .g-who, .g-field, .g-score, .g-big,
   .g-actions (rangée de boutons collée en bas, à portée de pouce), .g-pass, .g-wait, .g-note, .g-link
   (un lien-bouton de 44 px de haut). */
(function () {
  "use strict";

  window.ENGames = function (core) {
    const store = core.store, esc = core.esc, de = core.de, other = core.other, app = core.app;
    const DEFS = (window.GAMES || []).filter((d) => d && /^[a-z0-9]+$/.test(d.id || "") && typeof d.view === "function");
    /* Sans prototype : une adresse comme #jeu-constructor ne doit trouver aucun jeu. */
    const BY = Object.create(null);
    DEFS.forEach((d) => { BY[d.id] = d; });

    /* Bornes : une tranche jusqu'à 24 morceaux (60 ko), l'en-tête (état commun et réglages) jusqu'à 3. */
    const MAX_PARTS = 24, HEAD_PARTS = 3, GEN_MAX = 1e6, ST_MAX = 1e9, N_MAX = 1e15, DAY = 864e5;
    const NET = { ok: "En ligne", wait: "Connexion…", err: "Hors ligne", full: "Relais saturé" };
    const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
    const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    const isStr = (x, max) => typeof x === "string" && x.length <= max;
    const isRoom = (r, k) => isStr(r, 32) && /^[0-9a-f]{32}$/.test(r) && isStr(k, 64) && /^[\w-]{20,64}$/.test(k);
    const cleanNames = (n) => [0, 1].map((i) => (Array.isArray(n) && typeof n[i] === "string" ? n[i].trim().slice(0, 20) : ""));
    const routeDef = (route) => { const m = /^jeu-([a-z0-9]+)$/.exec(route || ""); return (m && BY[m[1]]) || null; };
    const onRoute = (id) => { const d = routeDef(core.route()); return !!d && d.id === id; };
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
    const sessions = Object.create(null);
    const tok = (s) => s.gen + ":" + s.setup.seed;
    const slice = (s, w) => (s.S[w].k === tok(s) ? s.S[w].d : {});
    /* Les réglages voyagent dans chaque en-tête et dans le lien d'invitation : 4 000 caractères au plus. */
    const SETUP_MAX = 4000;
    const okSetup = (x) => isObj(x) && (Number.isFinite(x.seed) || isStr(x.seed, 40)) && JSON.stringify(x).length <= SETUP_MAX;
    const okCount = (c) => isObj(c) && isInt(c.h, 0, N_MAX) && isInt(c.d, 0, N_MAX);
    function okSession(s, d) {
      return !!d && isObj(s) && s.id === d.id && s.v === d.v && typeof s.duo === "boolean" &&
        (s.duo ? (s.me === "a" || s.me === "b") && isObj(s.room) && isRoom(s.room.r, s.room.k) && (s.phase === "invite" || s.phase === "play")
          : s.me === null && s.phase === "play") &&
        Array.isArray(s.n) && s.n.length === 2 && s.n.every((x) => isStr(x, 20)) &&
        isInt(s.gen, 1, GEN_MAX) && okSetup(s.setup) && isObj(s.sh) && isInt(s.st, 0, ST_MAX) && (s.sw === "a" || s.sw === "b") &&
        isObj(s.S) && ["a", "b"].every((w) => isObj(s.S[w]) && typeof s.S[w].k === "string" && isObj(s.S[w].d)) &&
        isObj(s.seq) && okCount(s.seq.a) && okCount(s.seq.b) && okCount(s.sent) && isInt(s.gone, 0, N_MAX) && isObj(s.local);
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

    /* Prénom du joueur w dans une partie (même repli que le moteur quand il est vide). */
    const nmOf = (n, w) => (n[w === "b" ? 1 : 0] || "").trim() || (w === "b" ? "Partenaire 2" : "Partenaire 1");
    /* La partie de la page affichée, s'il y en a une : ses prénoms priment sur ceux de l'accueil. */
    const shownSession = () => { const d = routeDef(core.route()); return d ? load(d.id) : null; };
    const nm = (w) => { const s = shownSession(); return s ? nmOf(s.n, w) : core.nm(w); };

    let invite = store.get("ginvite", null);
    if (invite && !(isObj(invite) && BY[invite.g] && invite.v === BY[invite.g].v && isRoom(invite.r, invite.k) && okSetup(invite.su) &&
      isInt(invite.gen, 1, GEN_MAX) && Array.isArray(invite.n))) clearInvite();
    function clearInvite() { invite = null; store.del("ginvite"); }

    /* Les salons que ce téléphone a créés : rouvrir son propre lien ne doit pas en faire l'invité. */
    const mine = () => { const m = store.get("g:mine", null); return Array.isArray(m) ? m.filter((x) => typeof x === "string") : []; };

    function options(d) {
      const saved = store.get("go:" + d.id, null), out = {};
      (d.options || []).forEach((o) => {
        const v = isObj(saved) ? saved[o.id] : null;
        out[o.id] = o.choices.some((c) => c.id === v) ? v : o.def;
      });
      return out;
    }

    /* ---------- Affichage ---------- */
    let cleanup = null, keep = {}, focusWas = null, shown = "", screen = "", held = false, waiting = false;
    let pressing = 0, pressTimer = null, armed = null;
    const rerender = () => core.render(true);
    /* Ce qui arrive de l'autre téléphone ne doit casser ni un geste ni un appui en cours. */
    function remote() {
      if (pressing && Date.now() - pressing > 3000) pressing = 0; /* appui jamais relâché : on n'attend plus */
      if (held || pressing) waiting = true; else rerender();
    }
    function flushWaiting() { if (waiting && !held && !pressing) { waiting = false; rerender(); } }
    app.addEventListener("pointerdown", () => { if (routeDef(core.route())) pressing = Date.now(); }, true);
    const release = () => {
      if (!pressing) return;
      pressing = 0;
      clearTimeout(pressTimer);
      /* Le clic suit le relâchement : on lui laisse le temps d'arriver sur le bouton touché. */
      pressTimer = setTimeout(flushWaiting, 120);
    };
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);

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
      /* Un minuteur attardé ne doit pas redessiner une autre page que celle du jeu. */
      if (onRoute(s.id)) rerender();
    }

    function stop(s) {
      if (s.duo && core.canRoom) bye(s);
      drop(s.id);
    }

    function handle(s) {
      return {
        kit, def: BY[s.id], id: s.id, other,
        nm: (w) => nmOf(s.n, w),
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
          if (s.st >= ST_MAX) { console.warn("Entre Nous : état commun à sa limite, écriture ignorée."); return; }
          s.sh = Object.assign({}, s.sh, patch);
          s.st++;
          s.sw = s.me || "a";
          changed(s, "h");
        },
        save() { if (sessions[s.id] === s) persist(s); },
        render() { if (onRoute(s.id)) rerender(); },
        newGame(patch) {
          const su = Object.assign({}, s.setup, patch, { seed: seed() });
          if (s.gen >= GEN_MAX || !okSetup(su)) { console.warn("Entre Nous : manche suivante impossible (limite atteinte ou réglages trop volumineux)."); return; }
          s.gen++;
          s.setup = su;
          s.sh = {};
          s.st = 0;
          s.sw = s.me || "a";
          s.local = {};
          changed(s, "h");
        },
        stop() { if (sessions[s.id] === s) { stop(s); if (onRoute(s.id)) core.render(); } },
        hold(on) { held = !!on; flushWaiting(); }
      };
    }

    /* ---------- Deux téléphones : envoi ----------
       Ce dont je réponds part en deux photos numérotées séparément : l'en-tête « h » (manche, réglages,
       état commun tel que je le connais) et ma tranche « d ». Seule celle qui a changé repart : passer à
       la carte suivante ne renvoie pas un dessin. Le destinataire ne garde que la plus récente de chaque
       sorte : l'ordre, les doublons et les pertes n'ont donc aucune importance. */
    const pubs = Object.create(null);
    const topic = (s) => core.RELAY + "entrenous-" + s.room.r;
    const pubOf = (id) => pubs[id] || (pubs[id] = { timer: null, busy: false, fails: 0, full: 0, last: 0, prog: {} });
    const pending = (s) => s.duo && (s.sent.h < s.seq[s.me].h || s.sent.d < s.seq[s.me].d);

    /* Requête au relais avec un délai maximal : une requête qui ne répond jamais ne doit rien bloquer. */
    async function relay(url, opt, ms, read) {
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      let timer = null;
      const limit = new Promise((resolve, reject) => { timer = setTimeout(() => { if (ctl) ctl.abort(); reject(new Error("délai dépassé")); }, ms); });
      try {
        return await Promise.race([limit, (async () => {
          const res = await fetch(url, ctl ? Object.assign({ signal: ctl.signal }, opt) : opt);
          if (!res.ok) { const e = new Error("relais " + res.status); e.status = res.status; throw e; }
          return read ? res.text() : "";
        })()]);
      } finally { clearTimeout(timer); }
    }

    /* Soupape commune à tous les jeux : trente messages d'affilée, puis un toutes les huit secondes ;
       au-delà de quatre-vingts dans l'heure, un par minute. Les deux téléphones d'un même réseau restent
       ainsi sous ce que le relais accepte (60 d'affilée, puis douze par minute), et un jeu qui s'emballe
       ne vide pas le quota du jour (250 messages) en une soirée. Retourne l'attente nécessaire, ou 0. */
    const bucket = { tokens: 30, at: Date.now() }, hour = [];
    function token() {
      const now = Date.now();
      while (hour.length && now - hour[0] > 3600000) hour.shift();
      if (hour.length >= 80 && now - hour[hour.length - 1] < 60000) return hour[hour.length - 1] + 60000 - now;
      bucket.tokens = Math.min(30, bucket.tokens + (now - bucket.at) / 8000);
      bucket.at = now;
      if (bucket.tokens < 1) return Math.ceil((1 - bucket.tokens) * 8000);
      bucket.tokens -= 1;
      hour.push(now);
      return 0;
    }

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
    const headOf = (s) => ({ gen: s.gen, su: s.setup, sh: s.sh, st: s.st, sw: s.sw });

    function publishSoon(s, delay) {
      if (!core.canRoom) return;
      const p = pubOf(s.id);
      if (p.timer || p.busy) return;
      p.timer = setTimeout(() => { p.timer = null; flush(s.id); }, delay != null ? delay : Math.max(60, p.last + 350 - Date.now()));
    }

    async function flush(id) {
      const s = sessions[id], p = pubOf(id);
      if (!s || !s.duo || p.busy || !pending(s)) return;
      const late = (t) => s.sent[t] < s.seq[s.me][t];
      p.busy = true;
      let status = 0, wait = 0, left = 0;
      try {
        for (const t of ["h", "d"]) {
          if (!late(t)) continue;
          const n = s.seq[s.me][t];
          const parts = split(JSON.stringify(t === "h" ? headOf(s) : s.S[s.me]));
          if (parts.length > (t === "h" ? HEAD_PARTS : MAX_PARTS)) {
            console.warn("Entre Nous : " + (t === "h" ? "état commun" : "tranche") + " trop volumineux, non envoyé.");
            s.sent[t] = n;
            persist(s);
            continue;
          }
          /* Une photo interrompue (refus, panne, soupape) reprend au morceau où elle s'était arrêtée. */
          let pr = p.prog[t];
          if (!pr || pr.n !== n || pr.c !== parts.length) pr = p.prog[t] = { n, c: parts.length, i: 0 };
          left = parts.length - pr.i;
          while (pr.i < parts.length) {
            wait = token();
            if (wait) throw new Error("soupape");
            const body = await core.seal(s.room, { g: s.id, v: s.v, w: s.me, t, n, p: pr.i, c: parts.length, s: parts[pr.i] });
            await relay(topic(s), { method: "POST", body }, 15000);
            pr.i++;
            left--;
            p.last = Date.now();
          }
          if (sessions[id] === s) { s.sent[t] = Math.max(s.sent[t], n); persist(s); }
        }
        p.fails = 0;
        p.full = 0;
      } catch (e) {
        if (!wait) { p.fails++; status = e.status || 0; p.full = status === 429 ? p.full + 1 : 0; }
      }
      p.busy = false;
      paintNet();
      if (sessions[id] !== s) return;
      /* Après un refus pour excès de requêtes, on attend que le reste puisse passer d'un coup (le relais
         rend une requête toutes les cinq secondes), avec un léger décalage pour que les deux téléphones
         ne réessaient pas au même instant. */
      const jitter = Math.floor(Math.random() * 3000);
      if (wait) publishSoon(s, wait);
      else if (p.full) publishSoon(s, Math.max(30000, left * 5500) + jitter);
      else if (p.fails) publishSoon(s, [2000, 4000, 8000, 15000][Math.min(p.fails - 1, 3)] + jitter);
      else if (pending(s)) publishSoon(s);
    }

    /* Prévient l'autre téléphone que je quitte la partie, après avoir envoyé ce qui ne l'était pas encore
       (un dernier g.share juste avant g.stop). Sans attendre de réponse : la page peut se fermer. */
    async function bye(s) {
      const out = [];
      ["h", "d"].forEach((t) => {
        if (s.sent[t] >= s.seq[s.me][t]) return;
        const parts = split(JSON.stringify(t === "h" ? headOf(s) : s.S[s.me]));
        if (parts.length <= HEAD_PARTS) parts.forEach((x, i) => out.push({ g: s.id, v: s.v, w: s.me, t, n: s.seq[s.me][t], p: i, c: parts.length, s: x }));
      });
      out.push({ g: s.id, v: s.v, w: s.me, t: "x", n: Math.max(Date.now(), s.seq[s.me].h + 1), p: 0, c: 1, s: "" });
      try {
        for (const o of out) await fetch(topic(s), { method: "POST", body: await core.seal(s.room, o), keepalive: true });
      } catch (e) { /* tant pis : l'autre verra seulement que je ne joue plus */ }
    }

    /* Ce qui n'avait pas pu partir repart dès que possible : à l'ouverture du site, au retour du réseau. */
    function resume(now) {
      if (!core.canRoom) return;
      DEFS.forEach((d) => {
        const s = load(d.id), p = pubs[d.id];
        if (!s || !pending(s)) return;
        if (now && p && p.timer && !p.busy) { clearTimeout(p.timer); p.timer = null; }
        publishSoon(s, now ? 0 : 1500);
      });
    }

    /* ---------- Deux téléphones : réception ---------- */
    let link = null;

    const okSnap = (t, x) => isObj(x) && (t === "h"
      ? isInt(x.gen, 1, GEN_MAX) && okSetup(x.su) && isObj(x.sh) && isInt(x.st, 0, ST_MAX) && (x.sw === "a" || x.sw === "b")
      : typeof x.k === "string" && x.k.length <= 64 && isObj(x.d));

    /* Déchiffre un message, range le morceau, et retourne la photo quand elle est complète.
       Tout ce qui est illisible ou mal formé est ignoré : n'importe qui ayant le lien peut écrire dans le salon. */
    async function take(l, s, sealed) {
      let o;
      try { o = await core.unseal(s.room, sealed); } catch (e) { return null; }
      /* Un numéro venu du futur (au-delà d'un jour d'écart d'horloge) figerait les compteurs : refusé. */
      if (!isObj(o) || o.g !== s.id || o.v !== s.v || (o.w !== "a" && o.w !== "b") || ["h", "d", "x"].indexOf(o.t) < 0 ||
        !isInt(o.n, 1, Math.min(N_MAX, Date.now() + DAY)) || !isInt(o.c, 1, o.t === "d" ? MAX_PARTS : HEAD_PARTS) ||
        !isInt(o.p, 0, o.c - 1) || typeof o.s !== "string" || o.s.length > 4000) return null;
      if (o.t === "x") return o.s === "" ? { w: o.w, t: "x", n: o.n, x: null } : null;
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
       puis, à égalité, celui du joueur « a », pour que les deux téléphones tranchent pareil. Cet ordre
       ne dépend pas des numéros d'envoi : un joueur qui revient avec une partie neuve retrouve ainsi
       l'état qu'il avait lui-même écrit en dernier. */
    function apply(s, snap) {
      const w = snap.w, t = snap.t, n = snap.n, x = snap.x;
      if (t === "x") {
        if (w === s.me || n <= s.gone) return false;
        s.gone = n;
        persist(s);
        return true;
      }
      let moved = false;
      if (n > s.seq[w][t]) {
        /* Ma propre tranche ne revient du relais que dans une partie neuve, tant que je n'y ai rien écrit
           moi-même (mes numéros d'envoi, tirés de l'heure, sont postérieurs à la création de la partie). */
        if (t === "d" && (w !== s.me || s.seq[w].d < (s.t0 || Infinity))) { s.S[w] = { k: x.k, d: x.d }; moved = true; }
        if (w === s.me) s.sent[t] = Math.max(s.sent[t], n);
        s.seq[w][t] = n;
        moved = moved || w !== s.me;
      }
      if (t === "h") {
        const wins = x.gen !== s.gen ? x.gen > s.gen : x.st !== s.st ? x.st > s.st : x.sw === "a" && s.sw !== "a";
        if (wins) {
          const before = tok(s);
          s.gen = x.gen; s.setup = x.su; s.sh = x.sh; s.st = x.st; s.sw = x.sw;
          if (tok(s) !== before) s.local = {};
          moved = true;
        }
      }
      /* Partie en direct : dès que l'autre arrive, on quitte l'écran d'invitation. */
      if (s.phase === "invite" && BY[s.id].live && s.seq[other(s.me)].h > 0) { s.phase = "play"; moved = true; }
      if (moved) persist(s);
      return moved;
    }
    /* L'autre a-t-il arrêté la partie depuis la dernière fois qu'il s'y est montré ? */
    const left = (s) => s.duo && s.gone > s.seq[other(s.me)].h;

    function netState(s) {
      if (!s.duo) return "ok";
      const p = pubs[s.id], on = link && link.id === s.id;
      if (p && p.full) return "full";
      if ((p && p.fails) || (on && link.state === "err")) return "err";
      return on && link.state === "ok" ? "ok" : "wait";
    }
    /* La pastille de liaison est mise à jour sur place : un changement de réseau ne doit pas redessiner le jeu. */
    function paintNet() {
      const s = shownSession();
      if (!s || !s.duo) return;
      const st = netState(s);
      app.querySelectorAll("[data-net]").forEach((el) => { el.setAttribute("data-net", st); el.textContent = NET[st]; });
      /* Une attente qui ne peut pas aboutir (relais injoignable) le dit, au lieu de pulser pour rien. */
      app.querySelectorAll("[data-wait]").forEach((el) => {
        const bad = st === "err" || st === "full";
        el.classList.toggle("is-err", bad);
        el.textContent = bad ? "Pas de connexion au relais pour l'instant. Nouvel essai dans quelques secondes." : el.getAttribute("data-wait");
      });
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
      link.run++;
      link = null;
    }
    /* Une lecture complète du salon, puis l'écoute en continu. */
    async function start(l) {
      const s = sessions[l.id];
      if (link !== l || !s) return;
      /* Un réveil (retour au premier plan, réseau revenu) peut relancer une lecture pendant qu'une autre
         est en cours : seule la dernière lancée a le droit de lire les messages et d'ouvrir le flux. */
      const run = ++l.run, stale = () => link !== l || l.run !== run || sessions[l.id] !== s;
      try {
        const text = await relay(topic(s) + "/json?poll=1&since=all", { cache: "no-store" }, 20000, true);
        if (stale()) return;
        const seen = { h: 0, d: 0 };
        let moved = false;
        for (const line of text.split("\n")) {
          let m = null;
          try { m = JSON.parse(line); } catch (e) { continue; }
          if (!m || m.event !== "message" || typeof m.message !== "string") continue;
          if (typeof m.id === "string") l.last = m.id;
          const snap = await take(l, s, m.message);
          if (stale()) return;
          if (!snap) continue;
          if (snap.w === s.me && snap.t !== "x") seen[snap.t] = Math.max(seen[snap.t], snap.n);
          if (apply(s, snap)) moved = true;
        }
        /* Le relais oublie tout au bout de douze heures : je redépose mon dernier état s'il n'y est plus. */
        ["h", "d"].forEach((t) => { if (s.seq[s.me][t] > seen[t] && s.sent[t] > seen[t]) s.sent[t] = seen[t]; });
        if (pending(s)) publishSoon(s);
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
      const run = l.run, es = l.es = new EventSource(topic(s) + "/sse?since=" + encodeURIComponent(l.last || "all"));
      const mineNow = () => link === l && l.run === run && sessions[l.id] === s;
      /* Le relais envoie un signe de vie toutes les 45 secondes : sans rien pendant 70, le flux est mort. */
      const beat = () => { clearTimeout(l.dog); l.dog = setTimeout(() => retry(l), 70000); };
      es.addEventListener("open", () => { if (!mineNow()) return; l.tries = 0; l.state = "ok"; paintNet(); beat(); });
      es.addEventListener("keepalive", beat);
      es.onmessage = (e) => {
        if (!mineNow()) return;
        beat();
        let m = null;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (!m || m.event !== "message" || typeof m.message !== "string") return;
        if (typeof m.id === "string") l.last = m.id;
        take(l, s, m.message).then((snap) => { if (snap && mineNow() && apply(s, snap)) remote(); });
      };
      /* On reprend la main sur les reconnexions : celles du navigateur, immédiates, épuiseraient le relais. */
      es.onerror = () => { if (mineNow()) retry(l); };
      beat();
    }
    function retry(l) {
      if (link !== l) return;
      quiet(l);
      l.run++;
      l.state = l.tries >= 2 ? "err" : "wait";
      paintNet();
      l.timer = setTimeout(() => start(l), [2000, 5000, 10000, 20000, 30000][Math.min(l.tries++, 4)]);
    }
    function wake() {
      resume(true);
      if (!link) return;
      quiet(link);
      link.tries = 0;
      start(link);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (link) link.hidden = Date.now(); return; }
      resume(true);
      if (!link) return;
      /* Un téléphone verrouillé gèle le flux sans le fermer : après une vraie absence, on relit tout. */
      if (!link.es || link.es.readyState !== 1 || (link.hidden && Date.now() - link.hidden > 15000)) wake();
    });
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", (e) => { if (e.persisted) wake(); });

    /* ---------- Outils offerts aux jeux ---------- */
    let audio = null;
    /* iOS ne joue un son que si le contexte audio a été débloqué pendant un geste : on le fait au premier toucher. */
    const unlock = () => {
      if (!routeDef(core.route()) || (audio && audio.state === "running")) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = audio || new AC();
        if (audio.state === "suspended") audio.resume();
      } catch (e) { /* pas de son : sans importance */ }
    };
    ["touchend", "click", "keydown"].forEach((ev) => document.addEventListener(ev, unlock, true));

    const inviteUrl = (d, s) => location.origin + location.pathname + "#g=" +
      core.encode({ g: d.id, v: d.v, n: s.n, r: s.room.r, k: s.room.k, su: s.setup, gen: s.gen });
    const inviteBox = (d, s) => core.shareBox({
      url: inviteUrl(d, s),
      label: "Le lien de la partie pour " + esc(nmOf(s.n, "b")),
      how: core.hasQr() ? "Fais scanner ce QR code avec l'appareil photo de son téléphone, ou envoie le lien par message." : "Envoie ce lien par message.",
      text: nmOf(s.n, "a") + " t'invite à jouer à « " + d.title + " »"
    });
    const ink = (w) => (w === "b" ? "b" : "a");
    const kit = {
      esc, nm, de, other, store, seed, rng, shuffle,
      que: core.que, pl: core.pl, fill: core.fill, venn: core.venn, canRoom: core.canRoom, render: rerender,
      who: (w) => '<span class="g-who ' + ink(w) + '"><i class="sw ' + ink(w) + '"></i>' + esc(nm(w)) + "</span>",
      pass(w, act) {
        const N = esc(nm(w));
        return '<section class="g-pass as-' + ink(w) + '"><p class="eyebrow">Passe le téléphone</p><h1 tabindex="-1" data-focus>Au tour ' + esc(de(nm(w))) +
          ".</h1><p>Donne l'appareil à " + N + ', sans regarder l\'écran.</p><div class="actions"><button class="btn" type="button" data-act="' + esc(act) + '"><i class="sw ' + ink(w) +
          '"></i>Je suis ' + N + ", à moi</button></div></section>";
      },
      wait(g, text) {
        const s = sessions[g.id];
        const late = s && s.duo && s.me === "a" && !s.seq.b.h;
        return '<div class="g-wait"><p class="sync" role="status">' + esc(text) + "</p>" +
          (late ? '<details class="more"><summary>' + esc(nmOf(s.n, "b")) + " n'a pas encore rejoint la partie\u00a0?</summary>" + inviteBox(BY[s.id], s) + "</details>" : "") + "</div>";
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

    /* ---------- Confirmation en deux touchers ----------
       Arrêter ou abandonner une partie demande un second toucher, au moins 0,4 s et au plus 4 s après le
       premier : un double toucher accidentel ne suffit pas. L'état survit aux réaffichages. */
    const ARM_LABEL = "Toucher encore pour confirmer";
    const isArmed = (key) => !!armed && armed.key === key && Date.now() - armed.at < 4000;
    function confirm(key, el) {
      if (isArmed(key)) {
        if (Date.now() - armed.at < 400) return false;
        armed = null;
        return true;
      }
      const a = armed = { key, at: Date.now() };
      el.textContent = ARM_LABEL;
      el.setAttribute("data-armed", "1");
      setTimeout(() => {
        if (armed !== a) return;
        armed = null;
        app.querySelectorAll("[data-label]").forEach((b) => { b.textContent = b.getAttribute("data-label"); b.removeAttribute("data-armed"); });
      }, 4000);
      return false;
    }
    const stopBtn = (key, act, label, id) => '<button class="link g-link" type="button" data-act="' + act + '"' + (id ? ' data-id="' + id + '"' : "") +
      ' data-label="' + label + '"' + (isArmed(key) ? ' data-armed="1">' + ARM_LABEL : ">" + label) + "</button>";

    /* ---------- Écrans du socle ---------- */
    /* Partie à reprendre : il y en a une, et sa manche n'est pas terminée. */
    function open(d) {
      const s = load(d.id);
      return !!s && !(d.over && call(() => d.over(handle(s))));
    }
    function card(d) {
      return '<article class="card"><div class="glyph">' + glyph(d) + '</div><div class="card-body"><p class="eyebrow">' + esc(d.title) + '</p><h3><a class="card-link" href="#jeu-' + d.id + '">' + esc(d.hook) +
        '</a></h3><p class="blurb">' + esc(d.blurb) + '</p><p class="meta">' + esc(d.meta) + (core.canRoom ? " · 1 ou 2 téléphones" : "") + "</p>" +
        (open(d) ? '<a class="card-state" href="#jeu-' + d.id + '">Partie en cours · reprendre</a>' : "") + "</div></article>";
    }

    function home() {
      const banners = DEFS.filter(open).map((d) => '<aside class="banner"><p><b>' + esc(d.title) + "</b>\u00a0: une partie est en cours.</p>" +
        '<div class="banner-actions"><a class="btn small" href="#jeu-' + d.id + '">Reprendre</a>' + stopBtn("g-drop:" + d.id, "g-drop", "Abandonner", d.id) + "</div></aside>").join("");
      const group = DEFS.length ? '<section class="group"><h2 class="group-title">Pour jouer</h2><div class="cards">' + DEFS.map(card).join("") + "</div></section>" : "";
      return { banners, group, count: DEFS.length };
    }

    function vIntro(d) {
      const inv = invite && invite.g === d.id, s = load(d.id);
      let start;
      if (inv) {
        const A = esc(nmOf(invite.n, "a")), B = esc(nmOf(invite.n, "b"));
        start = '<div class="invite"><p><b>' + A + "</b> t'invite à jouer, chacun sur son téléphone." + (d.live ? " La partie se joue en direct." : "") +
          (s ? " Rejoindre cette partie remplacera celle que tu as en cours." : "") + "</p></div>" +
          '<div class="actions"><button class="btn" type="button" data-act="g-join">Je suis ' + B + ", je rejoins</button></div>" +
          '<p class="hint"><button class="link g-link" type="button" data-act="g-decline">Ignorer cette invitation</button></p>';
      } else {
        const cur = options(d);
        const opts = (d.options || []).filter((o) => !o.duo || core.canRoom).map((o) => '<div class="g-opts"><p class="g-opts-label" id="go-' + o.id + '">' + esc(o.label) +
          '</p><div class="g-choices" role="group" aria-labelledby="go-' + o.id + '">' +
          o.choices.map((c) => '<button class="g-choice" type="button" data-act="g-opt" data-opt="' + o.id + '" data-val="' + c.id + '" aria-pressed="' + (cur[o.id] === c.id) + '"><b>' + esc(c.name) +
            (c.adult ? ' <span class="g-tag">Adultes</span>' : "") + "</b>" + (c.hint ? "<span>" + esc(c.hint) + "</span>" : "") + "</button>").join("") + "</div></div>").join("");
        start = opts + core.namesForm("Ton prénom", "Le prénom de l'autre") + '<div class="actions">' +
          (core.canRoom ? '<button class="btn" type="button" data-act="g-start" data-mode="duo">Chacun sur son téléphone</button>' : "") +
          '<button class="btn' + (core.canRoom ? " alt" : "") + '" type="button" data-act="g-start" data-mode="solo">Sur un seul téléphone</button></div><p class="hint">' +
          (!core.canRoom ? "Vous jouez sur cet appareil, en vous le passant."
            : "Chacun sur son téléphone\u00a0: tu obtiens un lien et un QR code à faire scanner. " +
              (d.live ? "La partie se joue en direct, au même moment sur vos deux téléphones." : "Chacun joue de son côté, en même temps ou non, et le résultat s'ouvre chez vous deux quand tout le monde a fini.") +
              " Ce que vous échangez passe chiffré par un relais qui ne peut pas le lire.") + "</p>";
      }
      const extra = !inv && d.extra ? call(() => d.extra(kit)) : "";
      return core.topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(d) + '</div><p class="eyebrow">' + esc(d.title) + "</p><h1>" + esc(d.hook) + "</h1>" +
        (d.intro || []).map((p) => "<p>" + esc(p) + "</p>").join("") + start + (extra ? "<div data-extra>" + extra + "</div>" : "") + "</main>";
    }

    function vInvite(d, s) {
      const B = esc(nmOf(s.n, "b")), here = s.seq.b.h > 0, st = netState(s);
      return core.topbar(false) + '<main class="wrap narrow intro"><div class="glyph big">' + glyph(d) + '</div><p class="eyebrow">' + esc(d.title) + "</p><h1>Invite " + B + " à jouer.</h1><p>" + B +
        " ouvre ce lien sur son téléphone et rejoint la partie. " + (d.live ? "La partie se joue en direct\u00a0: elle démarre dès " + esc(core.que(nmOf(s.n, "b"))) + " est là."
          : "Tu peux commencer sans attendre\u00a0: " + B + " jouera de son côté.") + "</p>" +
        inviteBox(d, s) + (here ? '<p class="sync is-here" role="status">' + B + " est là.</p>"
          : '<p class="sync" role="status" data-wait="En attente ' + esc(de(nmOf(s.n, "b"))) + '…">En attente ' + esc(de(nmOf(s.n, "b"))) + "…</p>") +
        '<p class="hint">Liaison avec le relais\u00a0: <span class="g-net" data-net="' + st + '">' + NET[st] + "</span></p>" +
        '<div class="actions"><button class="btn' + (d.live && !here ? " alt" : "") + '" type="button" data-act="g-go">' + (d.live && !here ? "Commencer sans attendre" : "Commencer") + "</button></div>" +
        '<p class="hint">' + stopBtn("g-stop:" + d.id, "g-stop", "Annuler cette partie") + "</p></main>";
    }

    function vPlay(d, s) {
      let body = call(() => d.view(handle(s)));
      if (typeof body !== "string") body = '<p class="note">Ce jeu a rencontré un problème. Tu peux arrêter la partie puis la relancer.</p>';
      const st = netState(s);
      const gone = left(s) ? '<p class="g-note g-gone" role="status"><b>' + esc(nmOf(s.n, other(s.me))) + "</b> a arrêté la partie de son côté. " +
        '<button class="link g-link" type="button" data-act="g-end">Arrêter aussi</button></p>' : "";
      return '<header class="top g-top"><a class="link g-link" href="#accueil">Quitter</a><span class="g-name">' + esc(d.title) + "</span>" +
        (s.duo ? '<span class="g-net" data-net="' + st + '" role="status">' + NET[st] + "</span>" : "<span></span>") + "</header>" +
        '<main class="wrap narrow game" data-game="' + d.id + '">' + gone + body +
        '<footer class="g-foot">' + stopBtn("g-stop:" + d.id, "g-stop", "Arrêter la partie") + "</footer></main>";
    }

    /* ---------- Branchements du moteur ---------- */
    /* Ce qui identifie un bouton d'un rendu à l'autre, pour lui rendre le focus. */
    const ATTRS = ["data-act", "data-k", "data-w", "data-val", "data-opt", "data-id", "data-pack", "data-i"];
    function view(route) {
      unmount();
      keep = {};
      focusWas = null;
      /* Les champs data-keep et le bouton qui a le focus ne sont repris que d'un rendu au suivant de la même page. */
      if (route === shown) {
        app.querySelectorAll("[data-keep]").forEach((el) => {
          const o = { v: el.value, f: document.activeElement === el };
          if (o.f) { try { o.s = el.selectionStart; o.e = el.selectionEnd; } catch (e) { /* champ sans curseur */ } }
          keep[el.getAttribute("data-keep")] = o;
        });
        const a = document.activeElement;
        if (a && a !== document.body && app.contains(a) && a.hasAttribute("data-act") && !a.hasAttribute("data-keep")) {
          focusWas = ATTRS.filter((n) => a.hasAttribute(n)).map((n) => "[" + n + '="' + String(a.getAttribute(n)).replace(/["\\]/g, "\\$&") + '"]').join("");
        }
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
      /* Un nouvel écran du jeu commence en haut de page (le moteur, lui, garde le défilement entre deux rendus). */
      const scr = d && app.querySelector("main.game [data-screen]"), name = scr ? d.id + ":" + scr.getAttribute("data-screen") : "";
      const same = name === screen;
      if (name && screen && !same) window.scrollTo(0, 0);
      screen = name;
      if (!d) return;
      app.querySelectorAll("[data-keep]").forEach((el) => {
        const o = keep[el.getAttribute("data-keep")];
        if (!o) return;
        if (typeof o.v === "string") el.value = o.v;
        if (o.f) { try { el.focus({ preventScroll: true }); if (o.s != null) el.setSelectionRange(o.s, o.e); } catch (e) { /* sans importance */ } }
      });
      if (focusWas && same) {
        let el = null;
        try { el = app.querySelector(focusWas); } catch (e) { el = null; }
        if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
      }
      if (s && s.phase === "play" && d.mount && !(invite && invite.g === d.id)) {
        const c = call(() => d.mount(handle(s), app.querySelector("main.game")));
        if (typeof c === "function") cleanup = c;
      }
    }

    function create(d, o) {
      const s = Object.assign({ id: d.id, v: d.v, sh: {}, st: 0, sw: "a", S: { a: { k: "", d: {} }, b: { k: "", d: {} } },
        seq: { a: { h: 0, d: 0 }, b: { h: 0, d: 0 } }, sent: { h: 0, d: 0 }, gone: 0, t0: Date.now(), local: {} }, o);
      sessions[d.id] = s;
      /* Premier envoi dès l'arrivée : c'est lui qui dit à l'autre téléphone « je suis là ». */
      if (s.duo) { s.seq[s.me].h = Date.now(); publishSoon(s, 0); }
      persist(s);
      core.render();
    }

    function kitAct(act, el) {
      if (act === "g-drop") {
        const id = el.getAttribute("data-id");
        if (BY[id] && load(id) && confirm("g-drop:" + id, el)) { stop(load(id)); core.render(true); }
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
        const duo = el.getAttribute("data-mode") === "duo" && core.canRoom, room = duo ? core.newRoom() : null;
        if (duo) store.set("g:mine", mine().concat(room.r).slice(-30));
        create(d, { duo, me: duo ? "a" : null, room, n: cleanNames(core.names()), phase: duo ? "invite" : "play", gen: 1, setup: Object.assign({ seed: seed() }, options(d)) });
      } else if (act === "g-join" && inv && core.canRoom) {
        const i = invite, n = cleanNames(i.n);
        clearInvite();
        if (s) stop(s);
        /* Sur le téléphone de l'invité, « Ton prénom » est le sien : on ne remplit l'accueil que s'il est vide. */
        const cur = core.names();
        if (!cur[0] && !cur[1]) core.setNames([n[1], n[0]]);
        create(d, { duo: true, me: "b", room: { r: i.r, k: i.k }, n, phase: "play", gen: i.gen, setup: i.su });
      } else if (act === "g-decline") {
        clearInvite();
        core.render();
      } else if (act === "g-go" && s) {
        s.phase = "play";
        persist(s);
        core.render();
      } else if (act === "g-stop" && s) {
        if (confirm("g-stop:" + d.id, el)) { stop(s); core.render(); }
      } else if (act === "g-end" && s) {
        stop(s);
        core.render();
      }
    }

    function playing() {
      const d = routeDef(core.route()), s = d && load(d.id);
      return s && s.phase === "play" && !(invite && invite.g === d.id) ? { d, g: handle(s) } : null;
    }

    resume(false);

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
      /* Lien d'invitation à une partie (#g=…). Tout y est vérifié : le lien peut avoir été fabriqué. */
      join(raw) {
        let o = null;
        try { o = core.decode(raw); } catch (e) { o = null; }
        if (!isObj(o)) return core.fail("Ce lien d'invitation est illisible. Demande à l'autre de te le renvoyer.");
        const d = typeof o.g === "string" ? BY[o.g] : null;
        if (!d) return core.fail("Ce lien d'invitation ne correspond à aucun jeu de cette page.");
        if (o.v !== d.v) return core.fail("Ce lien vient d'une ancienne version du jeu. Il faut relancer une partie.");
        if (!isRoom(o.r, o.k) || !okSetup(o.su) || !isInt(o.gen, 1, GEN_MAX)) return core.fail("Ce lien d'invitation est incomplet. Demande à l'autre de te le renvoyer.");
        if (!core.canRoom) return core.fail("Ce lien ne peut s'ouvrir que sur le site, dans un navigateur.");
        const s = load(d.id);
        /* Une partie que j'ai déjà rejointe, ou la mienne : on y retourne simplement. */
        if (s && s.duo && s.room.r === o.r) return core.go("jeu-" + d.id);
        if (mine().indexOf(o.r) >= 0) return core.fail("Ce lien est celui d'une partie que tu as lancée puis arrêtée sur ce téléphone. Lance une nouvelle partie pour inviter l'autre.");
        invite = { g: d.id, v: d.v, r: o.r, k: o.k, su: o.su, gen: o.gen, n: cleanNames(o.n) };
        store.set("ginvite", invite);
        core.go("jeu-" + d.id);
      }
    };
  };
})();
