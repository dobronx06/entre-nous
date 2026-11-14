/* Bilan de couple : 72 questions, 12 domaines. Chaque question propose des réponses
   ordonnées ; le rapport mesure la distance entre les deux réponses.
   t: "mir" = question miroir (moi / l'autre), t: "nom" = réponses sans ordre,
   w: 2 = sujet décisif (pèse double dans le choix des conversations). */
(window.TESTS = window.TESTS || []).push({
  id: "bilan",
  v: 1,
  group: "couple",
  kind: "accord",
  title: "Bilan de couple",
  hook: "Est-ce qu'on est bien dans notre couple ?",
  blurb: "Douze domaines de la vie à deux passés en revue. Le rapport montre où vous êtes d'accord et de quoi il vaut mieux parler.",
  minutes: 15,
  simLabel: "d'alignement",
  intro: [
    "Chacun répond de son côté, sans voir les réponses de l'autre. À la fin, le rapport compare vos réponses question par question : accords, réponses proches et écarts.",
    "Réponds pour toi, sans chercher la bonne réponse ni deviner ce que l'autre dirait. Si une question ne te concerne pas, tu peux la passer."
  ],
  note: "Ce test montre à chacun les réponses de l'autre. Si tu as peur de la réaction de ton ou ta partenaire, ne le fais pas à deux. En France, le 3919 répond gratuitement et anonymement, 24 h sur 24.",
  dims: [
    { id: "quotidien", name: "Le quotidien à la maison", short: "Quotidien", talk: ["Qu'est-ce qui te pèse le plus à la maison en ce moment ?", "Quelle tâche aimerais-tu qu'on répartisse autrement dès cette semaine ?"] },
    { id: "temps", name: "Le temps à deux et le temps pour soi", short: "Temps", talk: ["À quoi ressemblerait une semaine où tu aurais assez de temps avec moi, et assez pour toi ?", "Quel moment à deux te manque le plus ?"] },
    { id: "entourage", name: "Famille et amis", short: "Entourage", talk: ["Avec qui aimerais-tu qu'on passe plus de temps, ou moins ?", "Qu'est-ce que j'ignore sur ta façon de vivre les moments avec ma famille ?"] },
    { id: "travail", name: "Le travail et les ambitions", short: "Travail", talk: ["Où aimerais-tu en être professionnellement dans cinq ans ?", "Qu'est-ce que je pourrais faire pour mieux te soutenir dans ton travail ?"] },
    { id: "argent", name: "L'argent", short: "Argent", talk: ["Qu'est-ce que l'argent représente pour toi : de la sécurité, de la liberté, du plaisir ?", "Quelle dépense de l'autre as-tu du mal à comprendre ?"] },
    { id: "logement", name: "Où et comment vivre", short: "Logement", talk: ["Décris l'endroit où tu nous imagines dans dix ans.", "À quoi ne renoncerais-tu jamais dans un lieu de vie ?"] },
    { id: "enfants", name: "Les enfants", short: "Enfants", talk: ["Qu'est-ce qui te fait envie, et qu'est-ce qui te fait peur, dans l'idée d'être parent ?", "Que voudrais-tu reprendre de ta propre enfance, et surtout pas ?"] },
    { id: "valeurs", name: "Les valeurs", short: "Valeurs", talk: ["Sur quoi ne ferais-tu jamais de compromis ?", "Quelle conviction a le plus changé chez toi ces dernières années ?"] },
    { id: "disputes", name: "La communication et les disputes", short: "Disputes", talk: ["Qu'est-ce qui t'aide à redescendre quand le ton monte ?", "Quelle phrase de moi te blesse plus que je ne le crois ?"] },
    { id: "confiance", name: "La confiance et la fidélité", short: "Confiance", talk: ["Qu'est-ce qui te fait te sentir en sécurité avec moi ?", "Où places-tu la limite entre vie privée et secret ?"] },
    { id: "intimite", name: "L'intimité et la tendresse", short: "Intimité", talk: ["Qu'est-ce qui te donne envie de te rapprocher de moi ?", "Qu'aimerais-tu qu'on fasse plus souvent, ou autrement ?"] },
    { id: "climat", name: "Comment on se sent", short: "Climat", mood: true, talk: ["De quoi aurais-tu besoin pour te sentir mieux dans notre couple ?", "Quel est ton meilleur souvenir de nous cette année ?"] }
  ],
  questions: [
    /* Le quotidien */
    { d: "quotidien", t: "mir", q: "Le ménage, le linge, les courses : qui en fait le plus ?" },
    { d: "quotidien", t: "mir", q: "La liste invisible des choses à ne pas oublier (papiers, rendez-vous, anniversaires) : qui la porte ?" },
    { d: "quotidien", q: "La répartition actuelle des tâches me paraît :", o: ["Tout à fait juste", "Plutôt juste", "Plutôt déséquilibrée", "Franchement déséquilibrée"] },
    { d: "quotidien", q: "Mon niveau d'exigence pour le rangement et la propreté :", o: ["Tout doit être net en permanence", "J'aime que ce soit rangé, sans obsession", "Un peu de bazar ne me gêne pas", "Le bazar, je ne le vois même pas"] },
    { d: "quotidien", q: "Les repas à la maison, idéalement :", o: ["On cuisine presque tous les jours", "On cuisine souvent, avec des raccourcis", "Du simple et rapide la plupart du temps", "Livraison et restaurant dès que possible"] },
    { d: "quotidien", q: "Quand une tâche n'est pas faite, je préfère :", o: ["Le dire tout de suite", "Attendre le bon moment pour en parler", "La faire moi-même sans rien dire", "Laisser couler"] },

    /* Le temps */
    { d: "temps", q: "Le temps qu'on passe vraiment à deux en ce moment :", o: ["Beaucoup trop peu", "Un peu trop peu", "Juste ce qu'il faut", "Un peu trop, j'ai besoin d'air"] },
    { d: "temps", q: "Mon besoin de moments en solo :", o: ["Très grand, plusieurs fois par semaine", "Régulier", "De temps en temps", "Très faible, je préfère qu'on soit ensemble"] },
    { d: "temps", q: "Un week-end idéal :", o: ["Programme chargé, des sorties et du monde", "Une ou deux sorties, le reste tranquille", "À la maison, avec une petite sortie", "Rien de prévu, on ne bouge pas"] },
    { d: "temps", q: "Les vacances :", o: ["Toujours tous les deux", "Surtout à deux, parfois avec d'autres", "Souvent avec des amis ou la famille", "Partir chacun de son côté ne me gêne pas"] },
    { d: "temps", q: "Les écrans (téléphone, séries, jeux) quand on est ensemble :", o: ["Ça prend beaucoup trop de place", "Ça prend un peu trop de place", "C'est équilibré", "Ce n'est pas un sujet pour moi"] },
    { d: "temps", q: "Avoir des loisirs ou des sorties chacun de son côté :", o: ["Indispensable, chaque semaine", "Important, régulièrement", "De temps en temps", "Je préfère qu'on fasse presque tout ensemble"] },

    /* Famille et amis */
    { d: "entourage", q: "La fréquence idéale pour voir nos familles :", o: ["Chaque semaine", "Deux ou trois fois par mois", "Une fois par mois environ", "Quelques fois par an"] },
    { d: "entourage", q: "La place de nos familles dans nos décisions de couple :", o: ["Leur avis compte beaucoup", "On les écoute, puis on décide", "On les informe une fois décidé", "Ça ne les regarde pas"] },
    { d: "entourage", q: "Je me sens à l'aise avec la famille de mon ou ma partenaire :", o: ["Tout à fait", "Plutôt", "Pas vraiment", "Pas du tout"] },
    { d: "entourage", q: "Recevoir du monde à la maison :", o: ["Le plus souvent possible", "Régulièrement", "De temps en temps", "Rarement, la maison est notre refuge"] },
    { d: "entourage", q: "Les soirées entre amis, idéalement :", o: ["Toujours ensemble", "Le plus souvent ensemble", "Autant ensemble que séparément", "Le plus souvent chacun avec les siens"] },
    { d: "entourage", q: "Si un proche critique mon ou ma partenaire :", o: ["Je prends sa défense immédiatement", "Je prends sa défense, puis on en reparle à deux", "J'écoute sans prendre parti", "Je préfère ne pas m'en mêler"] },

    /* Le travail */
    { d: "travail", q: "La place du travail dans ma vie :", o: ["Une priorité absolue", "Important, mais pas au détriment du reste", "Surtout un moyen de bien vivre", "Le moins possible"] },
    { d: "travail", w: 2, q: "Si l'un de nous reçoit une belle offre dans une autre ville :", o: ["On déménage sans hésiter", "On étudie sérieusement la question", "Seulement si l'autre y gagne aussi", "On reste là où est notre vie"] },
    { d: "travail", q: "Travailler le soir ou le week-end :", o: ["Normal quand il le faut", "Acceptable de temps en temps", "À éviter autant que possible", "Hors de question"] },
    { d: "travail", q: "Je me sens soutenu dans mes projets professionnels par mon ou ma partenaire :", o: ["Tout à fait", "Plutôt", "Pas vraiment", "Pas du tout"] },
    { d: "travail", q: "Si l'un de nous veut tout quitter pour se reconvertir ou monter sa boîte :", o: ["On fonce, on s'adaptera", "Oui, avec un plan et une échéance", "Seulement si nos finances restent stables", "Trop risqué pour nous"] },
    { d: "travail", q: "Parler boulot à la maison :", o: ["J'en ai besoin tous les jours", "Volontiers, un moment", "Le moins possible", "La maison n'est pas faite pour ça"] },

    /* L'argent */
    { d: "argent", q: "Comptes bancaires : la formule qui me convient le mieux :", o: ["Tout sur un compte joint", "Un compte joint pour le foyer, chacun garde le reste", "Des comptes séparés et un partage des factures", "Des comptes séparés, celui qui peut paie"] },
    { d: "argent", q: "Quand nos revenus sont différents, les dépenses communes se paient :", o: ["Moitié-moitié, strictement", "À peu près moitié-moitié, avec de la souplesse", "En proportion des revenus", "Celui qui gagne le plus paie l'essentiel"] },
    { d: "argent", q: "Mon rapport à l'épargne :", o: ["J'épargne d'abord, je dépense ce qui reste", "J'épargne régulièrement", "Quand il en reste à la fin du mois", "L'argent est fait pour être dépensé"] },
    { d: "argent", q: "À partir de quel montant on se consulte avant un achat personnel ?", o: ["Dès 50 €", "Autour de 200 €", "Autour de 500 €", "Jamais, chacun fait ce qu'il veut de son argent"] },
    { d: "argent", q: "Emprunter (crédit conso, découvert) pour se faire plaisir :", o: ["Jamais", "Exceptionnellement", "Pourquoi pas si on peut rembourser", "Aucun problème"] },
    { d: "argent", q: "Parler d'argent entre nous :", o: ["Facile, on en parle ouvertement", "Plutôt facile", "Un peu tendu", "On évite le sujet"] },

    /* Le logement */
    { d: "logement", w: 2, q: "L'endroit où je me vois vivre dans dix ans :", o: ["En plein centre d'une grande ville", "En ville, dans un quartier calme", "Dans une petite ville ou en périphérie", "À la campagne ou en pleine nature"] },
    { d: "logement", w: 2, q: "Partir vivre à l'étranger :", o: ["J'en rêve", "Pourquoi pas quelques années", "Seulement s'il le faut vraiment", "Non, ma vie est ici"] },
    { d: "logement", q: "Acheter un logement :", o: ["Une priorité, dès que possible", "Un objectif à moyen terme", "Si l'occasion se présente", "Pas important, louer me convient"] },
    { d: "logement", q: "Vivre près de nos familles :", o: ["Indispensable", "Préférable", "Sans importance", "Je préfère garder de la distance"] },
    { d: "logement", q: "Chez nous, la décoration et l'aménagement :", o: ["J'y tiens beaucoup, j'ai des idées précises", "J'aime donner mon avis", "Peu importe tant que c'est confortable", "Je laisse l'autre décider"] },
    { d: "logement", q: "Un animal à la maison :", o: ["Oui, c'est indispensable", "Oui, pourquoi pas", "Plutôt non", "Non, vraiment pas"] },

    /* Les enfants */
    { d: "enfants", w: 2, q: "Avoir des enfants (ou en avoir d'autres) :", o: ["Oui, c'est sûr", "Plutôt oui", "Plutôt non", "Non, c'est sûr"] },
    { d: "enfants", w: 2, q: "Le bon moment pour un (prochain) enfant :", o: ["Dès maintenant", "D'ici deux ou trois ans", "Plus tard, rien ne presse", "Jamais ou plus jamais"] },
    { d: "enfants", w: 2, q: "Le nombre d'enfants idéal dans une famille :", o: ["Aucun", "Un", "Deux", "Trois ou plus"] },
    { d: "enfants", q: "L'éducation, plutôt :", o: ["Un cadre strict et des règles claires", "Des règles fermes, mais expliquées", "Peu de règles, beaucoup de dialogue", "L'enfant apprend surtout par lui-même"] },
    { d: "enfants", q: "À l'arrivée d'un enfant, côté travail :", o: ["Chacun garde son activité à temps plein", "Chacun réduit un peu son temps de travail", "L'un des deux réduit ou s'arrête un temps", "L'un des deux reste durablement à la maison"] },
    { d: "enfants", q: "Les écrans pour les enfants :", o: ["Aucun avant longtemps", "Très encadrés", "Avec modération", "Ce n'est pas un problème"] },

    /* Les valeurs */
    { d: "valeurs", w: 2, q: "Le mariage (ou le PACS) :", o: ["Essentiel pour moi", "Important", "Agréable mais pas nécessaire", "Sans intérêt"] },
    { d: "valeurs", w: 2, q: "La place de la religion ou de la spiritualité dans ma vie :", o: ["Centrale", "Importante", "Discrète", "Absente"] },
    { d: "valeurs", q: "Nos opinions politiques :", o: ["Je tiens à ce qu'on soit du même bord", "Je préfère qu'on soit proches", "Des désaccords ne me gênent pas", "Je ne m'y intéresse pas"] },
    { d: "valeurs", q: "L'écologie dans nos choix de tous les jours (transports, alimentation, achats) :", o: ["Une priorité, quitte à se priver", "Un critère important", "On fait attention quand c'est simple", "Ce n'est pas un critère"] },
    { d: "valeurs", t: "nom", q: "Réussir sa vie, c'est avant tout :", o: ["Fonder une famille unie", "S'accomplir dans ce qu'on fait", "Être libre de son temps", "Profiter de chaque jour"] },
    { d: "valeurs", q: "Un petit mensonge pour éviter une dispute :", o: ["Jamais acceptable", "À éviter", "Parfois utile", "Tout à fait acceptable"] },

    /* Les disputes */
    { d: "disputes", q: "Quand quelque chose me contrarie :", o: ["J'en parle tout de suite", "J'en parle une fois au calme", "J'attends que l'autre le remarque", "Je le garde pour moi"] },
    { d: "disputes", q: "Pendant une dispute, j'ai tendance à :", o: ["Hausser le ton", "Argumenter jusqu'au bout", "Chercher vite un compromis", "Me fermer ou quitter la pièce"] },
    { d: "disputes", q: "Après une dispute, on se réconcilie :", o: ["Dans l'heure", "Dans la journée", "En quelques jours", "Certains sujets ne se referment jamais"] },
    { d: "disputes", t: "mir", q: "Qui fait le plus souvent le premier pas pour se réconcilier ?" },
    { d: "disputes", q: "Quand je parle de ce que je ressens, je me sens écouté :", o: ["Toujours", "Souvent", "Rarement", "Jamais"] },
    { d: "disputes", q: "Les mêmes reproches reviennent d'une dispute à l'autre :", o: ["Jamais", "Rarement", "Souvent", "Tout le temps"] },

    /* La confiance */
    { d: "confiance", q: "Regarder le téléphone de l'autre :", o: ["Normal, on n'a rien à cacher", "Acceptable si on demande avant", "Seulement en cas de gros doute", "Jamais, c'est privé"] },
    { d: "confiance", q: "Garder contact avec ses ex :", o: ["Aucun problème", "Acceptable si c'est transparent", "Ça me met mal à l'aise", "Je préfère que non"] },
    { d: "confiance", w: 2, q: "Pour moi, l'infidélité commence :", o: ["Dès les messages ambigus", "À un flirt assumé", "À un baiser", "À une relation sexuelle"] },
    { d: "confiance", w: 2, q: "Si l'un de nous était infidèle :", o: ["Ce serait la fin immédiate", "Probablement la fin", "On essaierait de reconstruire", "Tout dépendrait de la situation"] },
    { d: "confiance", q: "Je peux tout dire à mon ou ma partenaire sans craindre sa réaction :", o: ["Tout à fait", "Plutôt", "Pas vraiment", "Pas du tout"] },
    { d: "confiance", q: "La jalousie entre nous :", o: ["Absente", "Légère", "Présente, elle crée des tensions", "Envahissante"] },

    /* L'intimité */
    { d: "intimite", q: "La fréquence de nos rapports en ce moment :", o: ["J'en voudrais beaucoup plus", "J'en voudrais un peu plus", "Elle me convient", "J'en voudrais moins"] },
    { d: "intimite", q: "Les gestes tendres au quotidien (câlins, baisers, mots doux) :", o: ["J'en ai besoin sans arrêt", "J'en ai besoin souvent", "De temps en temps me suffit", "J'en ai peu besoin"] },
    { d: "intimite", q: "Parler de nos envies et de ce qui nous plaît :", o: ["Facile et naturel", "Possible, avec un peu de gêne", "Difficile", "On n'en parle jamais"] },
    { d: "intimite", t: "mir", q: "Qui prend le plus souvent l'initiative des moments intimes ?" },
    { d: "intimite", q: "Essayer de nouvelles choses dans notre vie intime :", o: ["J'adore", "Volontiers", "À petites doses", "Je préfère nos habitudes"] },
    { d: "intimite", q: "Les marques d'affection en public :", o: ["J'aime beaucoup", "J'aime bien", "Avec discrétion", "Je préfère éviter"] },

    /* Le climat (réponses classées du mieux au moins bien) */
    { d: "climat", q: "En ce moment, dans notre couple, je me sens :", o: ["Très bien", "Plutôt bien", "Entre deux", "Mal"] },
    { d: "climat", q: "Je sens que je compte pour l'autre :", o: ["Tous les jours", "Souvent", "Rarement", "Presque jamais"] },
    { d: "climat", q: "On rit ensemble :", o: ["Tous les jours", "Souvent", "Rarement", "Presque jamais"] },
    { d: "climat", q: "Quand je pense à nous dans cinq ans :", o: ["Ça m'enthousiasme", "Ça me rassure", "Ça me laisse des doutes", "Ça m'inquiète"] },
    { d: "climat", q: "Face aux difficultés, on forme une équipe :", o: ["Toujours", "Souvent", "Rarement", "Jamais"] },
    { d: "climat", w: 2, q: "Si c'était à refaire, je choisirais la même personne :", o: ["Sans hésiter", "Probablement", "Je ne sais pas", "Probablement pas"] }
  ]
});
