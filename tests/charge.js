/* Charge mentale : 24 tâches, toutes en miroir (« qui s'en occupe le plus ? »).
   share: true ajoute au rapport la répartition vue par chacun. */
(function () {
  var TASKS = {
    maison: [
      "Passer l'aspirateur et laver les sols",
      "Lancer, étendre et ranger le linge",
      "Nettoyer la salle de bain et les toilettes",
      "Sortir les poubelles et gérer le tri",
      "Ranger ce qui traîne",
      "Changer les draps"
    ],
    cuisine: [
      "Décider de ce qu'on mange",
      "Faire les courses",
      "Cuisiner au quotidien",
      "Faire la vaisselle ou vider le lave-vaisselle",
      "Vérifier ce qui manque (frigo, produits ménagers)",
      "Préparer le repas quand on reçoit"
    ],
    papiers: [
      "Payer les factures et suivre les comptes",
      "Faire les démarches administratives (impôts, assurances)",
      "Prendre les rendez-vous (médecin, garage, artisans)",
      "Gérer les pannes et les réparations",
      "Comparer et acheter les gros équipements",
      "Entretenir la voiture ou gérer les transports"
    ],
    orga: [
      "Penser aux anniversaires et aux cadeaux",
      "Organiser les vacances et les week-ends",
      "Garder le lien avec la famille et les amis (appels, invitations)",
      "Planifier la semaine (qui fait quoi, et quand)",
      "S'occuper au quotidien des enfants, des animaux ou des plantes",
      "Anticiper ce qui arrive (rentrée, fêtes, échéances)"
    ]
  };
  var questions = [];
  Object.keys(TASKS).forEach(function (d) {
    TASKS[d].forEach(function (q) { questions.push({ d: d, t: "mir", q: q }); });
  });

  (window.TESTS = window.TESTS || []).push({
    id: "charge",
    v: 1,
    group: "quotidien",
    kind: "accord",
    verdict: true,
    share: true,
    title: "Charge mentale",
    hook: "Qui fait quoi, vraiment ?",
    blurb: "Vingt-quatre tâches de la maison passées en revue. Chacun dit qui s'en occupe : le rapport compare vos deux versions et la part que chacun pense porter.",
    minutes: 4,
    simLabel: "de même vision",
    lead: "Qui s'en occupe le plus ?",
    intro: [
      "Pour chaque tâche, tu indiques qui s'en occupe le plus aujourd'hui : toi, l'autre, ou les deux à égalité. Pense à qui y pense et l'organise, pas seulement à qui l'exécute.",
      "On surestime presque toujours sa propre part, parce qu'on voit mieux ses efforts que ceux de l'autre. Le rapport met vos deux versions côte à côte."
    ],
    headline: function (p) {
      return p >= 85 ? "Vous voyez la répartition de la même façon."
        : p >= 70 ? "Presque la même vision de qui fait quoi."
        : p >= 55 ? "Vos visions de la répartition divergent."
        : "Vous ne décrivez pas la même maison.";
    },
    dims: [
      { id: "maison", name: "La maison", short: "Maison", talk: ["Quelle tâche te pèse le plus, et laquelle te dérange le moins ?"] },
      { id: "cuisine", name: "Les repas et les courses", short: "Repas", talk: ["Qu'aimerais-tu ne plus avoir à décider ?"] },
      { id: "papiers", name: "Les papiers et la logistique", short: "Papiers", talk: ["Quelle démarche aimerais-tu me confier entièrement ?"] },
      { id: "orga", name: "L'organisation et les proches", short: "Organisation", talk: ["Qu'est-ce que tu portes sans que je le voie ?"] }
    ],
    questions: questions
  });
})();
