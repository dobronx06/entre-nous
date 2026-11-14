/* Désir et intimité : 5 domaines, 4 questions chacun. Formulations sobres,
   toute question peut être passée. */
(window.TESTS = window.TESTS || []).push({
  id: "desir",
  v: 1,
  group: "couple",
  kind: "accord",
  title: "Désir et intimité",
  hook: "Est-ce qu'on a les mêmes envies ?",
  blurb: "Fréquence, tendresse, nouveauté, limites : vingt questions pour parler d'un sujet qu'on aborde rarement à froid.",
  minutes: 5,
  simLabel: "d'envies partagées",
  intro: [
    "Vingt questions sur votre vie intime : ce dont chacun a envie, ce qui est facile ou difficile à dire, ce qui met à l'aise.",
    "Réponds avec sincérité plutôt que pour faire plaisir. Si une question te gêne, passe-la : elle ne sera pas comparée."
  ],
  note: "Ce test montre à chacun les réponses de l'autre. Vos réponses restent sur l'appareil. Aucune réponse n'est meilleure qu'une autre : l'objectif est de savoir où vous en êtes, chacun.",
  dims: [
    { id: "envies", name: "Envies et fréquence", short: "Envies", talk: ["À quel moment te sens-tu le plus proche de moi ?", "Qu'est-ce qui fait monter ou retomber ton envie ?"] },
    { id: "parole", name: "En parler", short: "Parole", talk: ["Qu'est-ce qui rendrait ces conversations plus faciles pour toi ?"] },
    { id: "tendresse", name: "Tendresse et séduction", short: "Tendresse", talk: ["Quel geste tendre te manque en ce moment ?"] },
    { id: "nouveaute", name: "Nouveauté et fantasmes", short: "Nouveauté", talk: ["Y a-t-il quelque chose que tu aimerais essayer, sans oser le proposer ?"] },
    { id: "cadre", name: "Limites et confort", short: "Confort", talk: ["Qu'est-ce qui t'aide à te sentir en confiance dans ces moments ?"] }
  ],
  questions: [
    { d: "envies", q: "La fréquence idéale de nos rapports :", o: ["Plusieurs fois par semaine", "Une fois par semaine environ", "Deux ou trois fois par mois", "Plus rarement"] },
    { d: "envies", q: "Mon désir en ce moment :", o: ["Très présent", "Présent", "En retrait", "Presque absent"] },
    { d: "envies", q: "Chez moi, le désir vient :", o: ["Spontanément, sans raison", "Facilement si l'ambiance s'y prête", "Après un moment de tendresse", "Seulement quand tout est réuni"] },
    { d: "envies", t: "nom", q: "Le moment que je préfère :", o: ["Le matin", "En journée, quand l'occasion se présente", "Le soir", "Peu importe"] },

    { d: "parole", q: "Dire ce qui me plaît pendant un moment intime :", o: ["Facile", "Plutôt facile", "Plutôt difficile", "Très difficile"] },
    { d: "parole", q: "Dire non quand je n'ai pas envie :", o: ["Facile, sans culpabilité", "Facile, avec un peu de gêne", "Difficile", "Je préfère me forcer que refuser"] },
    { d: "parole", q: "Quand l'autre me dit non :", o: ["Je l'accepte sans problème", "Ça me déçoit un peu", "Je le prends pour moi", "Ça me blesse vraiment"] },
    { d: "parole", q: "Reparler ensuite de ce qui s'est bien ou mal passé :", o: ["Volontiers", "Si l'autre en a envie", "Ça me gêne", "Je préfère éviter"] },

    { d: "tendresse", q: "Les câlins sans arrière-pensée :", o: ["Indispensables", "Importants", "Agréables", "Pas vraiment mon truc"] },
    { d: "tendresse", q: "Continuer à se séduire (tenues, messages, rendez-vous) :", o: ["Très important", "Important", "De temps en temps", "Inutile entre nous"] },
    { d: "tendresse", q: "S'embrasser longuement :", o: ["Tous les jours", "Souvent", "Parfois", "Rarement"] },
    { d: "tendresse", q: "Pour dormir :", o: ["Collés toute la nuit", "Collés pour s'endormir", "Chacun de son côté du lit", "Idéalement chacun son lit"] },

    { d: "nouveaute", q: "Changer nos habitudes (lieux, moments, façons de faire) :", o: ["J'en ai très envie", "Volontiers", "Un peu", "Je préfère ce qu'on connaît"] },
    { d: "nouveaute", q: "Partager mes fantasmes :", o: ["Je le fais déjà", "J'aimerais le faire", "Ça me gêne", "Je préfère les garder pour moi"] },
    { d: "nouveaute", q: "Les accessoires, les jeux ou les scénarios :", o: ["J'adore", "Ça m'intrigue", "Sans plus", "Pas pour moi"] },
    { d: "nouveaute", t: "nom", q: "Les films ou lectures érotiques dans notre couple :", o: ["À partager à deux", "Chacun de son côté, sans tabou", "Chacun de son côté, sans en parler", "Je préfère qu'il n'y en ait pas"] },

    { d: "cadre", q: "Quand quelque chose ne me convient pas, je le dis :", o: ["Tout de suite", "Juste après", "Bien plus tard", "Jamais"] },
    { d: "cadre", q: "Le regard de l'autre sur mon corps :", o: ["Je suis très à l'aise", "Plutôt à l'aise", "Plutôt mal à l'aise", "Très mal à l'aise"] },
    { d: "cadre", t: "nom", q: "Après une longue période sans rapports :", o: ["On en parle ouvertement", "On attend que ça revienne", "Je m'inquiète sans le dire", "Ça ne me pose pas de question"] },
    { d: "cadre", w: 2, q: "Notre vie intime actuelle me convient :", o: ["Tout à fait", "Plutôt", "Pas vraiment", "Pas du tout"] }
  ]
});
