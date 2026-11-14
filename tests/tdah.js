/* Traits TDAH : 3 domaines, 6 phrases chacun, notées par fréquence.
   Phrases originales, sans valeur diagnostique. */
(window.TESTS = window.TESTS || []).push({
  id: "tdah",
  v: 1,
  group: "cerveau",
  kind: "profil",
  title: "Traits TDAH",
  hook: "Est-ce que nos cerveaux tournent pareil ?",
  blurb: "Attention, agitation, émotions : comparez vos modes de fonctionnement et repérez ce qui frotte au quotidien. Ce n'est pas un diagnostic.",
  minutes: 4,
  simLabel: "de ressemblance",
  lead: "À quelle fréquence ?",
  scale: ["Jamais", "Rarement", "Parfois", "Souvent", "Très souvent"],
  levels: ["Peu marqué", "Modéré", "Marqué"],
  intro: [
    "Dix-huit phrases sur l'attention, l'agitation et les émotions. Tu indiques à quelle fréquence chacune t'arrive, en pensant aux six derniers mois.",
    "Le rapport compare vos deux profils et propose des ajustements pour le quotidien à deux."
  ],
  note: "Ce questionnaire n'a aucune valeur médicale. Tout le monde connaît ces difficultés par moments. Un TDAH se diagnostique auprès d'un médecin, en tenant compte de l'enfance et des conséquences au quotidien.",
  dims: [
    {
      id: "attention", name: "Attention et organisation", short: "Attention",
      desc: "La capacité à rester sur une tâche, à s'organiser et à ne rien oublier.",
      gap: "{hi} oublie, se disperse ou sous-estime le temps plus souvent. Ce n'est pas de la mauvaise volonté : un agenda commun et des listes visibles marchent mieux que les rappels oraux {de_lo}.",
      both: "Vous vous dispersez tous les deux : notez tout (agenda commun, alarmes, liste sur le frigo) plutôt que de compter sur la mémoire de l'autre.",
      none: "L'organisation et l'attention ne posent de difficulté à aucun de vous."
    },
    {
      id: "agitation", name: "Agitation et impulsivité", short: "Agitation",
      desc: "Le besoin de bouger, de parler et d'agir tout de suite.",
      gap: "{hi} a besoin de bouger et décide vite, {lo} avance plus lentement. Pour les décisions importantes, laissez passer une nuit ; pour le reste, laissez {hi} aller à son rythme.",
      both: "Deux tempéraments rapides : on ne s'ennuie pas, mais donnez-vous une règle pour les grosses dépenses et les grandes décisions.",
      none: "Vous êtes tous les deux d'un tempérament calme et patient."
    },
    {
      id: "emotions", name: "Émotions et motivation", short: "Émotions",
      desc: "L'intensité des émotions, la sensibilité aux critiques et les variations d'énergie.",
      gap: "Les émotions {de_hi} montent plus vite et plus fort. {lo} peut éviter les remarques à chaud et attendre que la vague soit passée pour parler du fond.",
      both: "Vous vivez tous les deux les choses intensément : convenez d'un mot pour faire une pause quand ça déborde, et reprenez plus tard.",
      none: "Vos émotions restent stables, pour l'un comme pour l'autre."
    }
  ],
  questions: [
    { d: "attention", q: "Je commence une tâche, puis une autre, et je me retrouve avec plusieurs choses à moitié faites." },
    { d: "agitation", q: "Rester longtemps sans bouger sur une chaise m'est difficile." },
    { d: "emotions", q: "Mes émotions montent très vite et très fort." },
    { d: "attention", q: "Je perds mes clés, mon téléphone ou mes papiers." },
    { d: "agitation", q: "Je coupe la parole ou je finis les phrases des autres." },
    { d: "emotions", q: "Une remarque ou une critique peut me miner pendant des heures." },
    { d: "attention", q: "Pendant qu'on me parle, mon esprit part ailleurs sans que je le décide." },
    { d: "agitation", q: "J'achète ou je décide sur un coup de tête." },
    { d: "emotions", q: "Je peux passer des heures sur ce qui me passionne, et ne pas réussir à démarrer le reste." },
    { d: "attention", q: "J'oublie des rendez-vous ou des choses que j'avais promis de faire." },
    { d: "agitation", q: "J'ai l'impression d'avoir un moteur interne qui ne s'arrête pas." },
    { d: "emotions", q: "Mon énergie et ma motivation changent beaucoup d'un jour à l'autre." },
    { d: "attention", q: "Je repousse les tâches ennuyeuses jusqu'à la dernière limite." },
    { d: "agitation", q: "Attendre mon tour (file d'attente, embouteillage) me met à bout." },
    { d: "emotions", q: "Je m'ennuie vite et j'ai besoin de nouveauté." },
    { d: "attention", q: "J'ai du mal à estimer le temps qu'une chose va me prendre." },
    { d: "agitation", q: "Je parle beaucoup, parfois plus que je ne le voudrais." },
    { d: "emotions", q: "Le soir, mes pensées tournent trop pour que je m'endorme facilement." }
  ],
  summary: function (pa, pb, N, h) {
    var ga = h.global(pa), gb = h.global(pb), diff = Math.abs(ga - gb), hi = ga >= gb ? N.a : N.b;
    var verdict = diff < 10 ? "Vos cerveaux tournent à peu près au même régime : vos traits sont d'une intensité comparable."
      : diff < 25 ? hi + " a des traits un peu plus marqués."
      : hi + " a des traits nettement plus marqués.";
    return [{
      title: "Au même régime ?",
      html: "<p>" + verdict + "</p>" +
        "<p><b>" + N.a + "</b> : " + ga + " sur 100 (" + h.level(this, ga).toLowerCase() + "). <b>" + N.b + "</b> : " + gb + " sur 100 (" + h.level(this, gb).toLowerCase() + ").</p>" +
        "<p>Ces chiffres résument vos réponses, rien de plus : un score élevé ne suffit pas à parler de TDAH, et un score bas ne l'exclut pas.</p>"
    }];
  }
});
