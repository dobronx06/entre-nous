/* Qui de nous deux ? Toutes les questions sont en miroir : chacun répond
   « moi » ou « l'autre », et le rapport compare les deux versions. */
(window.TESTS = window.TESTS || []).push({
  id: "quidenous",
  v: 1,
  group: "commencer",
  kind: "accord",
  verdict: true,
  title: "Qui de nous deux ?",
  hook: "Est-ce qu'on se voit de la même façon ?",
  blurb: "Vingt-quatre questions légères : qui s'entête le plus, qui a fait le premier pas, qui dépense le plus. Le rapport compare vos deux versions.",
  minutes: 4,
  simLabel: "de versions identiques",
  intro: [
    "Pour chaque question, tu désignes l'un de vous deux. L'autre fait pareil de son côté, et le rapport montre où vos versions concordent.",
    "C'est le test le plus léger de la série : idéal pour commencer."
  ],
  headline: function (p) {
    return p >= 85 ? "Vous racontez la même histoire."
      : p >= 70 ? "Presque la même version des faits."
      : p >= 55 ? "Deux versions qui se discutent."
      : "Chacun a sa version de l'histoire.";
  },
  dims: [
    { id: "quotidien", name: "Au quotidien", short: "Quotidien", talk: ["Donne un exemple récent qui explique ta réponse."] },
    { id: "caractere", name: "Caractère", short: "Caractère", talk: ["Raconte la dernière fois où ça s'est vu."] },
    { id: "social", name: "Avec les autres", short: "Social", talk: ["Que diraient vos amis si on leur posait la question ?"] },
    { id: "amour", name: "En amour", short: "Amour", talk: ["Raconte ta version : comment tu t'en souviens ?"] }
  ],
  questions: [
    { d: "quotidien", t: "mir", q: "Qui met le plus de temps à se préparer ?" },
    { d: "quotidien", t: "mir", q: "Qui laisse le plus de bazar derrière soi ?" },
    { d: "quotidien", t: "mir", q: "Qui dépense le plus facilement ?" },
    { d: "quotidien", t: "mir", q: "Qui s'endort en premier devant un film ?" },
    { d: "quotidien", t: "mir", q: "Qui cuisine le mieux ?" },
    { d: "quotidien", t: "mir", q: "Qui passe le plus de temps sur son téléphone ?" },

    { d: "caractere", t: "mir", q: "Qui s'entête le plus ?" },
    { d: "caractere", t: "mir", q: "Qui s'énerve le plus vite ?" },
    { d: "caractere", t: "mir", q: "Qui a le plus le sens de l'organisation ?" },
    { d: "caractere", t: "mir", q: "Qui s'inquiète le plus ?" },
    { d: "caractere", t: "mir", q: "Qui se perd le plus facilement en chemin ?" },
    { d: "caractere", t: "mir", q: "Qui fait preuve de la plus grande mauvaise foi ?" },

    { d: "social", t: "mir", q: "Qui est le plus à l'aise en soirée ?" },
    { d: "social", t: "mir", q: "Qui fait le plus rire l'autre ?" },
    { d: "social", t: "mir", q: "Qui raconte le mieux les histoires ?" },
    { d: "social", t: "mir", q: "Qui arrive le plus souvent en retard ?" },
    { d: "social", t: "mir", q: "Qui oublie le plus les anniversaires ?" },
    { d: "social", t: "mir", q: "Qui a le plus de mal à dire non ?" },

    { d: "amour", t: "mir", q: "Qui a fait le premier pas ?" },
    { d: "amour", t: "mir", q: "Qui dit « je t'aime » le plus souvent ?" },
    { d: "amour", t: "mir", q: "Qui ressent le plus de jalousie ?" },
    { d: "amour", t: "mir", q: "Qui a le plus la fibre romantique ?" },
    { d: "amour", t: "mir", q: "Qui s'excuse en premier après une dispute ?" },
    { d: "amour", t: "mir", q: "Qui réclame le plus de câlins ?" }
  ]
});
