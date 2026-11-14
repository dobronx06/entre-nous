/* Projet bébé et parentalité : 5 domaines, 4 questions chacun.
   Valable avant un premier enfant comme pour des parents. */
(window.TESTS = window.TESTS || []).push({
  id: "parents",
  v: 1,
  group: "projets",
  kind: "accord",
  title: "Projet bébé et parentalité",
  hook: "Est-ce qu'on veut la même famille ?",
  blurb: "Envie d'enfant, organisation, éducation, place des grands-parents, vie de couple : les questions à se poser avant, ou à se reposer une fois parents.",
  minutes: 5,
  simLabel: "d'alignement",
  intro: [
    "Vingt questions sur l'envie d'enfant et la façon d'être parents. Elles valent pour un premier enfant comme pour le suivant.",
    "Si vous êtes déjà parents, réponds en pensant à ce que tu souhaites, pas seulement à ce qui se passe aujourd'hui."
  ],
  dims: [
    { id: "envie", name: "L'envie d'enfant", short: "Envie", talk: ["Qu'est-ce qui te fait envie, et qu'est-ce qui te fait peur, dans l'idée d'être parent ?"] },
    { id: "orga", name: "L'organisation", short: "Organisation", talk: ["À quoi ressemblerait une semaine type avec un enfant, selon toi ?"] },
    { id: "educ", name: "L'éducation", short: "Éducation", talk: ["Que voudrais-tu reprendre de ton éducation, et que changerais-tu ?"] },
    { id: "famille", name: "La famille autour", short: "Entourage", talk: ["Quelle place veux-tu donner à nos familles auprès d'un enfant ?"] },
    { id: "couple", name: "Le couple, une fois parents", short: "Couple", talk: ["Comment protégerait-on notre couple avec un enfant à la maison ?"] }
  ],
  questions: [
    { d: "envie", w: 2, q: "Devenir parent (ou le redevenir), pour moi :", o: ["Un rêve", "Une envie", "Une possibilité", "Pas pour moi"] },
    { d: "envie", w: 2, q: "Le calendrier idéal :", o: ["Le plus tôt possible", "Dans un an ou deux", "Dans plusieurs années", "Je ne sais pas, ou jamais"] },
    { d: "envie", w: 2, q: "La famille que j'imagine :", o: ["Sans enfant", "Un enfant", "Deux enfants", "Trois enfants ou plus"] },
    { d: "envie", t: "nom", q: "Si un enfant ne venait pas naturellement :", o: ["On irait vers la PMA", "On irait vers l'adoption", "On tenterait les deux", "On accepterait une vie sans enfant"] },

    { d: "orga", q: "Le congé parental :", o: ["Chacun en prend une longue part", "Chacun en prend une part, selon ses possibilités", "Surtout l'un des deux", "Le moins possible, on fait garder"] },
    { d: "orga", t: "mir", q: "Qui se lèverait (ou se lève) le plus souvent la nuit ?" },
    { d: "orga", t: "nom", q: "Le mode de garde idéal avant l'école :", o: ["La crèche", "Une assistante maternelle", "Un parent à la maison", "Les grands-parents"] },
    { d: "orga", t: "mir", q: "Qui lèverait le pied côté travail ?" },

    { d: "educ", q: "Devant un caprice :", o: ["On tient bon, toujours", "On tient bon le plus souvent", "On négocie", "On cède pour avoir la paix"] },
    { d: "educ", q: "Les punitions :", o: ["Nécessaires", "Utiles parfois", "En dernier recours", "Jamais"] },
    { d: "educ", q: "La réussite scolaire :", o: ["Une priorité", "Importante", "Moins importante que l'épanouissement", "Chaque enfant fait ce qu'il peut"] },
    { d: "educ", q: "Les repas, le sommeil, les horaires :", o: ["Un cadre strict", "Un cadre avec des exceptions", "De la souplesse", "L'enfant se régule"] },

    { d: "famille", q: "La place des grands-parents :", o: ["Très présents, chaque semaine", "Présents régulièrement", "De temps en temps", "À distance"] },
    { d: "famille", q: "Les conseils de nos familles sur l'éducation :", o: ["Bienvenus", "Écoutés poliment", "Tolérés", "À éviter"] },
    { d: "famille", w: 2, q: "Transmettre une religion ou une culture familiale :", o: ["Essentiel", "Important", "Au choix de l'enfant", "Non"] },
    { d: "famille", q: "Confier l'enfant pour partir en week-end à deux :", o: ["Dès les premiers mois", "Après la première année", "Quand l'enfant sera grand", "Je ne me vois pas le faire"] },

    { d: "couple", q: "Une fois parents, notre couple :", o: ["Reste la priorité", "Compte autant que les enfants", "Passe après les enfants quelques années", "Passe après les enfants, c'est normal"] },
    { d: "couple", q: "Du temps à deux, sans enfant :", o: ["Chaque semaine", "Chaque mois", "Quelques fois par an", "Quand ce sera possible"] },
    { d: "couple", q: "L'enfant dans notre lit ou notre chambre :", o: ["Pas question", "Les premiers mois seulement", "Tant qu'il en a besoin", "Aucun problème"] },
    { d: "couple", t: "nom", q: "Ce qui m'inquiète le plus :", o: ["Le manque de sommeil et de temps", "L'argent", "Notre couple", "Ne pas être à la hauteur"] }
  ]
});
