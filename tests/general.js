/* Test général : le tour d'horizon. 12 thèmes, 3 questions chacun.
   more: identifiant du test qui approfondit le thème. */
(window.TESTS = window.TESTS || []).push({
  id: "general",
  v: 1,
  group: "commencer",
  kind: "accord",
  title: "Test général",
  hook: "Est-ce qu'on est faits pour s'entendre ?",
  blurb: "Le tour d'horizon en 36 questions : rythme, argent, projets, valeurs, disputes, affection. Le rapport indique ensuite quels tests approfondir.",
  minutes: 8,
  simLabel: "de compatibilité",
  intro: [
    "Douze thèmes de la vie à deux, trois questions chacun. C'est le test à faire en premier : il donne une vue d'ensemble et repère les sujets qui méritent un test complet.",
    "Réponds pour toi, sans chercher à deviner ce que l'autre dirait. Tu peux passer une question qui ne te concerne pas."
  ],
  dims: [
    { id: "rythme", name: "Rythme de vie", short: "Rythme", more: "rythme", talk: ["À quoi ressemble ta journée idéale, du réveil au coucher ?"] },
    { id: "maison", name: "La vie à la maison", short: "Maison", more: "charge", talk: ["Qu'est-ce qui te pèse le plus dans la vie à la maison ?"] },
    { id: "social", name: "Vie sociale", short: "Social", more: "perso", talk: ["De combien de temps avec les autres as-tu besoin pour te sentir bien ?"] },
    { id: "argent", name: "L'argent", short: "Argent", more: "argent", talk: ["Qu'est-ce qui te rassure, et qu'est-ce qui t'inquiète, quand on parle d'argent ?"] },
    { id: "projets", name: "Les grands projets", short: "Projets", more: "parents", talk: ["Décris notre vie dans cinq ans si tout se passe comme tu le souhaites."] },
    { id: "valeurs", name: "Valeurs et convictions", short: "Valeurs", more: "valeurs", talk: ["Sur quoi ne transigerais-tu jamais ?"] },
    { id: "dialogue", name: "Se parler", short: "Dialogue", more: "amour", talk: ["Qu'est-ce qui t'aide à parler de ce que tu ressens ?"] },
    { id: "conflits", name: "Les désaccords", short: "Conflits", more: "conflits", talk: ["De quoi as-tu besoin juste après une dispute ?"] },
    { id: "affection", name: "Affection et intimité", short: "Affection", more: "desir", talk: ["Quel geste de ma part te fait le plus de bien ?"] },
    { id: "liberte", name: "Fusion et indépendance", short: "Liberté", more: "attachement", talk: ["De quel espace as-tu besoin pour te sentir bien avec moi ?"] },
    { id: "loisirs", name: "Loisirs et vacances", short: "Loisirs", more: "voyages", talk: ["Quelle activité aimerais-tu qu'on fasse ensemble plus souvent ?"] },
    { id: "nous", name: "Nous deux aujourd'hui", short: "Nous", mood: true, more: "bilan", talk: ["Qu'est-ce qui te ferait du bien dans notre couple en ce moment ?"] }
  ],
  questions: [
    { d: "rythme", q: "Je suis plutôt :", o: ["Du matin, très tôt", "Plutôt du matin", "Plutôt du soir", "Oiseau de nuit"] },
    { d: "rythme", q: "Le week-end, côté énergie :", o: ["Il me faut un programme", "J'aime prévoir une activité", "Je préfère improviser", "J'ai besoin de ne rien faire"] },
    { d: "rythme", q: "Mon rapport à la ponctualité :", o: ["Toujours en avance", "À l'heure", "Quelques minutes de retard", "L'heure est une indication"] },

    { d: "maison", q: "Mon seuil de tolérance au désordre :", o: ["Très bas", "Plutôt bas", "Plutôt haut", "Très haut"] },
    { d: "maison", t: "nom", q: "Entre nous, les tâches ménagères devraient être :", o: ["Partagées à égalité, quoi qu'il arrive", "Partagées selon le temps de chacun", "Réparties selon les goûts de chacun", "Faites par celui que ça dérange"] },
    { d: "maison", q: "Chez nous, avoir un espace rien qu'à moi :", o: ["Indispensable", "Appréciable", "Pas nécessaire", "Je préfère tout partager"] },

    { d: "social", q: "Une soirée réussie :", o: ["Une grande fête", "Un dîner à plusieurs", "Un tête-à-tête", "Chacun son activité, côte à côte"] },
    { d: "social", q: "Voir du monde, pour moi :", o: ["Ça me recharge", "J'aime bien, à petite dose", "Ça me fatigue vite", "Je préfère éviter"] },
    { d: "social", q: "Nos familles dans notre vie :", o: ["Très présentes", "Présentes", "À distance raisonnable", "Le moins possible"] },

    { d: "argent", q: "Devant une rentrée d'argent imprévue :", o: ["Je mets tout de côté", "J'épargne l'essentiel", "Je me fais plaisir avec une bonne partie", "Je dépense tout"] },
    { d: "argent", q: "Dans un couple, l'argent devrait être :", o: ["Entièrement mis en commun", "Surtout commun", "Surtout séparé", "Entièrement séparé"] },
    { d: "argent", q: "Un gros achat, ça se décide :", o: ["Toujours à deux", "À deux au-delà d'un certain montant", "Chacun pour son argent", "Sur un coup de cœur"] },

    { d: "projets", w: 2, q: "Je nous imagine avec des enfants (ou d'autres enfants) :", o: ["Sans aucun doute", "Probablement", "Probablement pas", "Certainement pas"] },
    { d: "projets", w: 2, q: "Dans cinq ans, je nous vois vivre :", o: ["Au même endroit", "Dans la même région, ailleurs", "Dans une autre région", "Dans un autre pays"] },
    { d: "projets", w: 2, q: "Officialiser notre couple (mariage, PACS) :", o: ["C'est important pour moi", "J'aimerais bien", "Ça m'est égal", "Je n'en ai pas envie"] },

    { d: "valeurs", t: "nom", q: "Ce qui passe en premier dans ma vie :", o: ["La famille", "Le couple", "Le travail", "Ma liberté"] },
    { d: "valeurs", q: "Mes convictions (politiques, religieuses, écologiques) :", o: ["Elles guident mes choix au quotidien", "Elles comptent beaucoup", "Elles restent en arrière-plan", "Je n'en ai pas de très arrêtées"] },
    { d: "valeurs", q: "Dire toute la vérité à l'autre :", o: ["Toujours, même si ça blesse", "Presque toujours", "Pas quand ça ferait du mal pour rien", "Chacun a droit à ses secrets"] },

    { d: "dialogue", q: "Parler de ce que je ressens :", o: ["Facile, je le fais spontanément", "Plutôt facile", "Difficile, il me faut du temps", "Très difficile"] },
    { d: "dialogue", t: "nom", q: "Quand l'autre me raconte un souci, j'ai tendance à :", o: ["Chercher une solution", "Écouter sans rien proposer", "Lui changer les idées", "Relativiser"] },
    { d: "dialogue", q: "Nos vraies discussions (autre chose que l'organisation) :", o: ["Tous les jours", "Plusieurs fois par semaine", "De temps en temps", "Rarement"] },

    { d: "conflits", q: "Quand on n'est pas d'accord, je préfère :", o: ["Régler ça tout de suite", "En parler dans la journée", "Laisser passer quelques jours", "Éviter le sujet"] },
    { d: "conflits", t: "nom", q: "Dans une dispute, ce qui compte le plus pour moi :", o: ["Qu'on me comprenne", "Trouver une solution", "Que ça s'arrête vite", "Avoir le dernier mot"] },
    { d: "conflits", q: "Après une dispute :", o: ["J'oublie vite", "Il me faut quelques heures", "Il me faut quelques jours", "J'y repense longtemps"] },

    { d: "affection", q: "Les câlins et les gestes tendres :", o: ["Tout le temps", "Souvent", "Parfois", "Rarement"] },
    { d: "affection", q: "La place de la sexualité dans un couple :", o: ["Essentielle", "Importante", "Secondaire", "Peu importante"] },
    { d: "affection", q: "Dire « je t'aime » :", o: ["Plusieurs fois par jour", "Tous les jours", "De temps en temps", "Je le montre plutôt que je ne le dis"] },

    { d: "liberte", q: "Passer une soirée chacun de son côté :", o: ["J'en ai besoin souvent", "De temps en temps, ça fait du bien", "Rarement", "Je préfère qu'on soit ensemble"] },
    { d: "liberte", q: "Savoir où est l'autre et avec qui :", o: ["J'en ai besoin", "J'aime autant", "Ça m'est égal", "Chacun vit sa vie"] },
    { d: "liberte", q: "Partir en week-end sans l'autre :", o: ["Naturel", "Possible de temps en temps", "Exceptionnel", "Je n'aime pas l'idée"] },

    { d: "loisirs", t: "nom", q: "Des vacances idéales :", o: ["Farniente", "Découvertes et visites", "Sport et aventure", "À la maison, au calme"] },
    { d: "loisirs", q: "Nos loisirs :", o: ["On fait presque tout ensemble", "Beaucoup en commun", "Quelques-uns en commun", "Chacun les siens"] },
    { d: "loisirs", t: "nom", q: "Le soir, les écrans :", o: ["Ensemble devant la même chose", "Chacun le sien, côte à côte", "Chacun dans son coin", "Le moins possible"] },

    { d: "nous", q: "Aujourd'hui, notre couple me fait :", o: ["Beaucoup de bien", "Plutôt du bien", "Ni bien ni mal", "Du mal"] },
    { d: "nous", q: "Avec l'autre, je me sens libre d'être moi-même :", o: ["Toujours", "Souvent", "Rarement", "Jamais"] },
    { d: "nous", w: 2, q: "Je nous vois encore ensemble dans dix ans :", o: ["Sans aucun doute", "Probablement", "Je ne sais pas", "Probablement pas"] }
  ]
});
