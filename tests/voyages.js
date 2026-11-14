/* Voyages : 3 domaines, 5 questions chacun. */
(window.TESTS = window.TESTS || []).push({
  id: "voyages",
  v: 1,
  group: "projets",
  kind: "accord",
  title: "Voyages",
  hook: "Est-ce qu'on voyage bien ensemble ?",
  blurb: "Destination, rythme, préparation, budget : quinze questions à se poser avant de réserver les prochaines vacances.",
  minutes: 3,
  simLabel: "d'envies communes",
  intro: [
    "Quinze questions sur ta façon de voyager. Les vacances concentrent en quelques jours tous les sujets de la vie à deux : le rythme, l'argent, l'organisation.",
    "Réponds selon ce que tu préfères vraiment, pas selon vos dernières vacances."
  ],
  dims: [
    { id: "style", name: "Le style de voyage", short: "Style", talk: ["Raconte ton meilleur souvenir de voyage : qu'est-ce qui l'a rendu si bon ?"] },
    { id: "orga", name: "La préparation", short: "Préparation", talk: ["Qu'aimes-tu qu'on prévoie, et qu'aimes-tu laisser au hasard ?"] },
    { id: "confort", name: "Budget et confort", short: "Confort", talk: ["Sur quoi préfères-tu dépenser en vacances, et sur quoi économiser ?"] }
  ],
  questions: [
    { d: "style", t: "nom", q: "La destination qui me fait rêver :", o: ["Une plage et du soleil", "Une grande ville à explorer", "La montagne ou la pleine nature", "Un pays lointain et dépaysant"] },
    { d: "style", q: "Le rythme sur place :", o: ["Tout voir, debout tôt", "Une ou deux visites par jour", "Une activité de temps en temps", "Ne rien faire du tout"] },
    { d: "style", q: "Rencontrer des gens en voyage :", o: ["C'est ce que je préfère", "Volontiers", "Si ça se présente", "Je préfère qu'on reste entre nous"] },
    { d: "style", q: "La cuisine locale :", o: ["Je goûte tout", "Je goûte presque tout", "Avec prudence", "Je cherche ce que je connais"] },
    { d: "style", q: "La durée idéale d'un voyage :", o: ["Un long week-end", "Une semaine", "Deux ou trois semaines", "Plusieurs mois"] },

    { d: "orga", q: "Avant de partir :", o: ["Tout est réservé et planifié", "Les grandes lignes sont prévues", "Seulement le premier hébergement", "Rien, on verra sur place"] },
    { d: "orga", t: "mir", q: "Qui organise nos voyages ?" },
    { d: "orga", q: "Un imprévu (retard, réservation annulée) :", o: ["Ça fait partie de l'aventure", "Ça m'agace un moment", "Ça me stresse beaucoup", "Ça me gâche le voyage"] },
    { d: "orga", q: "Les photos :", o: ["Je photographie tout", "Quelques-unes pour le souvenir", "Très peu", "Aucune, je profite"] },
    { d: "orga", t: "nom", q: "Pour le trajet, je préfère :", o: ["L'avion, pour aller vite et loin", "Le train dès que possible", "La voiture, pour être libres", "Peu importe"] },

    { d: "confort", q: "L'hébergement :", o: ["Camping ou bivouac", "Auberge ou logement simple", "Bel hôtel ou belle location", "Le grand luxe"] },
    { d: "confort", q: "Le budget vacances :", o: ["Le minimum, pour partir plus souvent", "Raisonnable", "Confortable, c'est une priorité", "On ne compte pas"] },
    { d: "confort", q: "Les souvenirs et les achats sur place :", o: ["Jamais", "Un petit objet", "Quelques achats", "Une valise en plus"] },
    { d: "confort", q: "Partir :", o: ["Toujours à deux", "Surtout à deux", "Souvent avec des amis ou la famille", "En groupe, c'est mieux"] },
    { d: "confort", q: "Se séparer une journée pendant le voyage pour faire chacun ce qu'on aime :", o: ["Bonne idée", "Pourquoi pas", "Dommage", "Hors de question"] }
  ]
});
