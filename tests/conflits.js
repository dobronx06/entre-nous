/* Nos façons de nous disputer : 5 réflexes, 4 phrases chacun, notées par fréquence. */
(function () {
  var NAMES = { attaque: "monter au front", retrait: "se retirer", compromis: "chercher l'accord" };
  var DUOS = {
    "attaque+attaque": "Deux tempéraments qui montent au front : vos disputes s'enflamment vite. Une pause convenue à l'avance est votre meilleure alliée.",
    "attaque+retrait": "L'un pousse pour régler le problème, l'autre se retire pour se protéger, et chacun aggrave la réaction de l'autre. Mettez-vous d'accord sur une pause courte, avec une heure de reprise.",
    "attaque+compromis": "L'un s'emporte, l'autre cherche la solution. Cela fonctionne tant que la personne qui apaise ne finit pas par se taire pour avoir la paix.",
    "retrait+retrait": "Peu de cris, mais des sujets qui restent en suspens. Le risque n'est pas la dispute, c'est le non-dit.",
    "compromis+retrait": "L'un cherche à discuter, l'autre a besoin de temps. Laissez ce temps, à condition qu'il ait une fin annoncée.",
    "compromis+compromis": "Vous cherchez tous les deux l'accord en premier : vos désaccords se règlent le plus souvent dans la discussion."
  };
  function reflex(p) {
    return ["attaque", "retrait", "compromis"].sort(function (x, y) { return (p[y] || 0) - (p[x] || 0); })[0];
  }

  (window.TESTS = window.TESTS || []).push({
    id: "conflits",
    v: 1,
    group: "couple",
    kind: "profil",
    title: "Nos disputes",
    hook: "Comment est-ce qu'on se dispute ?",
    blurb: "Monter au front, se retirer, chercher l'accord, réparer, ressasser : le réflexe de chacun quand le ton monte, et ce que donne votre duo.",
    minutes: 4,
    simLabel: "de réflexes communs",
    lead: "Quand on se dispute, à quelle fréquence ?",
    scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Presque toujours"],
    levels: ["Rare", "Occasionnel", "Fréquent"],
    intro: [
      "Vingt phrases qui décrivent ce qu'on fait quand le ton monte. Tu indiques à quelle fréquence chacune t'arrive, en pensant à vos dernières disputes.",
      "Tous les couples se disputent. Ce qui compte, c'est la manière : le rapport décrit vos réflexes et la façon dont ils se combinent."
    ],
    note: "Ce test parle de disputes ordinaires. Si tu as peur des réactions de ton ou ta partenaire, ce n'est pas une affaire de style : en France, le 3919 répond gratuitement et anonymement, 24 h sur 24.",
    dims: [
      {
        id: "attaque", name: "Monter au front", short: "Attaque",
        desc: "Hausser le ton, critiquer, vouloir avoir raison.",
        gap: "{hi} monte vite dans les tours, {lo} beaucoup moins. Pour {lo}, le ton compte autant que les mots : parler moins fort aide le message à passer.",
        both: "Vous montez tous les deux vite dans les tours : convenez d'un mot qui veut dire « pause », et respectez-le.",
        none: "Vos disputes restent calmes dans le ton, pour l'un comme pour l'autre."
      },
      {
        id: "retrait", name: "Se retirer", short: "Retrait",
        desc: "Se taire, s'éloigner, attendre que ça passe.",
        gap: "{hi} se retire quand ça chauffe, ce que {lo} peut vivre comme de l'indifférence. Annoncer « j'ai besoin de vingt minutes, je reviens » change tout.",
        both: "Vous évitez tous les deux l'affrontement : peu d'éclats, mais des sujets qui ne se règlent pas. Donnez-vous rendez-vous pour en parler.",
        none: "Aucun de vous ne fuit la discussion."
      },
      {
        id: "compromis", name: "Chercher l'accord", short: "Accord",
        desc: "Écouter, reconnaître sa part, proposer une solution.",
        gap: "{hi} cherche plus souvent le terrain d'entente. Veillez à ce que l'effort ne repose pas toujours sur la même personne.",
        both: "Vous cherchez tous les deux l'accord : c'est votre meilleur atout.",
        none: "Chercher un terrain d'entente n'est un réflexe pour aucun de vous : essayez de reformuler ce que l'autre vient de dire avant de répondre."
      },
      {
        id: "reparation", name: "Réparer", short: "Réparation",
        desc: "Faire le premier pas, s'excuser, apaiser.",
        gap: "{hi} fait plus souvent le premier pas. {lo} peut prendre le relais de temps en temps : c'est un geste qui compte.",
        both: "Vous savez tous les deux revenir l'un vers l'autre : vos disputes laissent peu de traces.",
        none: "Le premier pas ne vient facilement d'aucun côté : décidez à l'avance d'un rituel de réconciliation."
      },
      {
        id: "rancune", name: "Ressasser", short: "Rancune",
        desc: "Garder en tête, bouder, y repenser longtemps.",
        gap: "{hi} garde les disputes en tête plus longtemps. Pour {hi}, une dispute n'est finie que lorsqu'on en a reparlé au calme.",
        both: "Vous ressassez tous les deux : prenez l'habitude de clore chaque dispute à voix haute (« c'est réglé pour moi, et pour toi ? »).",
        none: "Une fois la dispute passée, vous tournez la page tous les deux."
      }
    ],
    questions: [
      { d: "attaque", q: "Je hausse le ton." },
      { d: "retrait", q: "Je me tais et j'attends que ça passe." },
      { d: "compromis", q: "Je propose une solution qui convient aux deux." },
      { d: "reparation", q: "Je fais le premier pas pour me réconcilier." },
      { d: "rancune", q: "Je repense à la dispute pendant des jours." },

      { d: "attaque", q: "Je ressors d'anciens reproches." },
      { d: "retrait", q: "Je quitte la pièce." },
      { d: "compromis", q: "J'essaie de comprendre le point de vue de l'autre avant de répondre." },
      { d: "reparation", q: "Je m'excuse quand j'ai dépassé les bornes." },
      { d: "rancune", q: "Je boude." },

      { d: "attaque", q: "Je cherche à prouver que j'ai raison." },
      { d: "retrait", q: "Je fais comme si de rien n'était." },
      { d: "compromis", q: "Je reconnais ma part de responsabilité." },
      { d: "reparation", q: "Je détends l'atmosphère par un geste ou une blague." },
      { d: "rancune", q: "Je garde en mémoire la liste de ce qui m'a fait mal." },

      { d: "attaque", q: "Je dis des choses que je regrette ensuite." },
      { d: "retrait", q: "Je réponds « rien » quand on me demande ce qui ne va pas." },
      { d: "compromis", q: "Je cède sur ce qui compte moins pour moi." },
      { d: "reparation", q: "Je reviens sur le sujet au calme pour le clore vraiment." },
      { d: "rancune", q: "Je pardonne en paroles, mais pas vraiment au fond." }
    ],
    summary: function (pa, pb, N) {
      var ra = reflex(pa), rb = reflex(pb);
      return [
        {
          title: "Le premier réflexe de chacun",
          html: "<p><b>" + N.a + "</b> : " + NAMES[ra] + ".</p><p><b>" + N.b + "</b> : " + NAMES[rb] + ".</p>"
        },
        { title: "Votre duo", html: "<p>" + DUOS[[ra, rb].sort().join("+")] + "</p>" }
      ];
    }
  });
})();
