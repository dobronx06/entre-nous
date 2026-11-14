/* Rythme de vie : 4 domaines, 4 questions chacun. */
(window.TESTS = window.TESTS || []).push({
  id: "rythme",
  v: 1,
  group: "quotidien",
  kind: "accord",
  title: "Rythme de vie",
  hook: "Est-ce qu'on vit au même rythme ?",
  blurb: "Sommeil, sorties, habitudes, ponctualité : seize questions sur les petits décalages qui pèsent quand on vit ensemble.",
  minutes: 3,
  simLabel: "de rythme commun",
  intro: [
    "Seize questions sur ton rythme naturel : quand tu dors, quand tu sors, comment tu t'organises.",
    "Ces différences ne se règlent pas en changeant l'autre, mais elles se négocient très bien une fois qu'on les a nommées."
  ],
  dims: [
    { id: "sommeil", name: "Sommeil et horaires", short: "Sommeil", talk: ["De quoi as-tu besoin pour bien dormir ?"] },
    { id: "energie", name: "Énergie et sorties", short: "Sorties", talk: ["Combien de soirées libres te faut-il par semaine ?"] },
    { id: "habitudes", name: "Habitudes de vie", short: "Habitudes", talk: ["Quelle habitude aimerais-tu qu'on prenne ensemble ?"] },
    { id: "tempo", name: "Organisation du temps", short: "Tempo", talk: ["Qu'est-ce qui te stresse dans notre façon de nous organiser ?"] }
  ],
  questions: [
    { d: "sommeil", q: "L'heure idéale pour me coucher :", o: ["Avant 22 h", "Entre 22 h et 23 h 30", "Entre 23 h 30 et 1 h", "Après 1 h"] },
    { d: "sommeil", q: "Le week-end, je me lève :", o: ["Comme en semaine", "Une heure plus tard", "En fin de matinée", "Midi passé s'il le faut"] },
    { d: "sommeil", q: "Dans la chambre, il me faut :", o: ["Le noir et le silence complets", "Le noir, un peu de bruit ne me gêne pas", "Une veilleuse ou un fond sonore", "Peu importe, je dors partout"] },
    { d: "sommeil", q: "La température de la chambre :", o: ["Fraîche, fenêtre ouverte", "Plutôt fraîche", "Plutôt chaude", "Bien chaude"] },

    { d: "energie", q: "Un soir de semaine idéal :", o: ["Sortir", "Voir un ou deux amis", "Un film ou une série à deux", "Chacun tranquille de son côté"] },
    { d: "energie", q: "Le nombre de sorties par semaine qui me convient :", o: ["Trois ou plus", "Deux", "Une", "Aucune ou presque"] },
    { d: "energie", q: "Le dimanche :", o: ["Un programme prévu à l'avance", "Une sortie décidée le matin", "À la maison, à mon rythme", "En pyjama toute la journée"] },
    { d: "energie", q: "En rentrant du travail, j'ai besoin :", o: ["De raconter ma journée tout de suite", "De discuter un peu", "D'un quart d'heure de calme", "D'une bonne heure sans parler"] },

    { d: "habitudes", q: "Mon alimentation :", o: ["Très surveillée", "Équilibrée, sans me priver", "Je mange ce qui me fait envie", "Je ne m'en occupe pas"] },
    { d: "habitudes", q: "Le sport dans ma semaine :", o: ["Presque tous les jours", "Deux ou trois fois", "De temps en temps", "Jamais"] },
    { d: "habitudes", q: "L'alcool :", o: ["Jamais", "Rarement", "Le week-end", "Régulièrement"] },
    { d: "habitudes", q: "Mon téléphone au lit ou à table :", o: ["Jamais", "Rarement", "Souvent", "Toujours à portée de main"] },

    { d: "tempo", q: "À un rendez-vous, j'arrive :", o: ["En avance", "Pile à l'heure", "Avec quelques minutes de retard", "Quand j'arrive"] },
    { d: "tempo", q: "Un agenda partagé pour nous deux :", o: ["Indispensable", "Pratique", "Pas nécessaire", "Trop contraignant"] },
    { d: "tempo", q: "Préparer un départ (valise, trajet) :", o: ["Plusieurs jours avant", "La veille", "Le matin même", "Au dernier moment"] },
    { d: "tempo", q: "Ce qu'il y a à faire, je le fais :", o: ["Tout de suite", "Dans la journée", "Quand j'y pense", "Quand ça devient urgent"] }
  ]
});
