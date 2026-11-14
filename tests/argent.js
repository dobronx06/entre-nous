/* Notre rapport à l'argent : 5 domaines, 4 questions chacun. */
(window.TESTS = window.TESTS || []).push({
  id: "argent",
  v: 1,
  group: "quotidien",
  kind: "accord",
  title: "Notre rapport à l'argent",
  hook: "Est-ce qu'on compte de la même façon ?",
  blurb: "Dépenser ou épargner, comptes communs ou séparés, risque, transparence : ce que chacun attend vraiment côté argent.",
  minutes: 5,
  simLabel: "d'alignement",
  intro: [
    "Vingt questions sur votre façon de gagner, de dépenser, d'épargner et d'en parler. L'argent est l'un des premiers sujets de dispute dans un couple, souvent parce qu'on n'en discute qu'au moment d'un problème.",
    "Réponds selon ce que tu fais vraiment, pas selon ce qu'il faudrait faire."
  ],
  dims: [
    { id: "profil", name: "Dépenser ou épargner", short: "Dépenses", talk: ["Quel achat récent t'a fait vraiment plaisir, et lequel regrettes-tu ?"] },
    { id: "commun", name: "L'organisation à deux", short: "Commun", talk: ["Quelle organisation te paraîtrait la plus juste entre nous ?"] },
    { id: "risque", name: "Risque et projets", short: "Projets", talk: ["Quel projet aimerais-tu qu'on finance en premier ?"] },
    { id: "parole", name: "Transparence", short: "Parole", talk: ["Qu'est-ce qui rend l'argent difficile à aborder entre nous ?"] },
    { id: "sens", name: "Ce que l'argent représente", short: "Sens", talk: ["Qu'as-tu appris sur l'argent dans ta famille ?"] }
  ],
  questions: [
    { d: "profil", q: "En fin de mois, il me reste :", o: ["Toujours de quoi épargner", "Souvent un peu", "Rarement quelque chose", "Je suis souvent à découvert"] },
    { d: "profil", q: "Un achat plaisir à 150 € :", o: ["J'y réfléchis des semaines", "J'y réfléchis quelques jours", "Je l'achète si j'en ai envie", "Je l'ai déjà acheté"] },
    { d: "profil", q: "Mes comptes, je les regarde :", o: ["Tous les jours", "Chaque semaine", "Une fois par mois", "Le moins possible"] },
    { d: "profil", q: "Comparer les prix avant d'acheter :", o: ["Toujours, pour tout", "Pour les gros achats", "Rarement", "Jamais, je prends ce qui me plaît"] },

    { d: "commun", q: "La part de nos revenus mise en commun :", o: ["Tout", "La majorité", "De quoi payer les charges", "Rien"] },
    { d: "commun", t: "nom", q: "Si l'un gagne beaucoup plus que l'autre :", o: ["Tout se partage, le niveau de vie est commun", "Celui qui gagne plus contribue plus", "Chacun paie la moitié", "Chacun vit selon ses moyens"] },
    { d: "commun", t: "mir", q: "Qui gère les comptes du foyer ?" },
    { d: "commun", q: "Avoir chacun de l'argent sans comptes à rendre :", o: ["Indispensable", "Important", "Pas nécessaire", "Contraire à l'idée du couple"] },

    { d: "risque", q: "Mon épargne, je la préfère :", o: ["Disponible et sans risque", "Surtout sécurisée", "En partie investie", "Investie, quitte à prendre des risques"] },
    { d: "risque", q: "S'endetter pour un projet (logement, entreprise) :", o: ["Aucun problème", "Si c'est bien calculé", "Avec beaucoup de prudence", "J'évite à tout prix"] },
    { d: "risque", t: "nom", w: 2, q: "Notre priorité financière des prochaines années :", o: ["Acheter un logement", "Constituer une épargne de sécurité", "Voyager et profiter", "Financer un projet (enfant, entreprise, études)"] },
    { d: "risque", q: "Prêter de l'argent à un proche :", o: ["Oui, sans hésiter", "Oui, si on en parle avant", "Seulement une petite somme", "Non, ça finit mal"] },

    { d: "parole", q: "Connaître précisément les revenus et les économies de l'autre :", o: ["Indispensable", "Normal", "Pas nécessaire", "Ça ne me regarde pas"] },
    { d: "parole", w: 2, q: "Un achat que l'autre désapprouverait :", o: ["J'en parle avant", "J'en parle après", "Je minimise le prix", "Je ne dis rien"] },
    { d: "parole", q: "Nos discussions d'argent se terminent :", o: ["Sereinement", "Plutôt bien", "Souvent en tension", "On les évite"] },
    { d: "parole", q: "Faire un point budget ensemble :", o: ["Chaque mois", "Quelques fois par an", "Seulement en cas de problème", "Jamais"] },

    { d: "sens", t: "nom", q: "L'argent, pour moi, c'est avant tout :", o: ["De la sécurité", "De la liberté", "Du plaisir", "Une preuve de réussite"] },
    { d: "sens", q: "Gagner plus en travaillant plus :", o: ["Oui, sans hésiter", "Oui, pendant quelques années", "Seulement si c'est nécessaire", "Non, le temps vaut plus"] },
    { d: "sens", t: "nom", q: "Dans ma famille, l'argent était :", o: ["Un sujet d'inquiétude", "Un sujet tabou", "Un sujet dont on parlait librement", "Jamais un problème"] },
    { d: "sens", q: "Offrir et inviter :", o: ["J'adore gâter les autres", "Volontiers pour les grandes occasions", "Avec mesure", "Chacun paie sa part"] }
  ]
});
