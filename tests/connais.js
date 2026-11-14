/* Tu me connais vraiment ? Chaque thème donne deux écrans : ta réponse, puis
   ce que tu penses que l'autre répondra. Le rapport compare les intuitions de
   chacun aux vraies réponses de l'autre.
   Dans la phrase « devine », {p} = prénom de l'autre, {de_p} = « de Tom » / « d'Inès ». */
(function () {
  var ITEMS = [
    { q: "Mon dimanche idéal :", g: "Le dimanche idéal {de_p} :", o: ["Grasse matinée et canapé", "Une balade en pleine nature", "Un repas avec des amis ou la famille", "Des projets et du bricolage"] },
    { q: "Si je gagnais 10 000 € demain :", g: "Si {p} gagnait 10 000 € demain :", o: ["Je mettrais tout de côté", "Je partirais en voyage", "Je gâterais mes proches", "Je m'offrirais un gros plaisir"] },
    { q: "Ce qui me stresse le plus :", g: "Ce qui stresse le plus {p} :", o: ["Le travail", "L'argent", "Les tensions avec les proches", "La santé"] },
    { q: "Pour me remonter le moral, il faut :", g: "Pour remonter le moral {de_p}, il faut :", o: ["M'écouter", "Me changer les idées", "Me laisser tranquille un moment", "Me prendre dans les bras"] },
    { q: "Mon plus gros défaut :", g: "Le plus gros défaut {de_p}, selon {p} :", o: ["L'impatience", "L'entêtement", "La susceptibilité", "La désorganisation"] },
    { q: "Ma plus grande fierté :", g: "La plus grande fierté {de_p} :", o: ["Mon parcours professionnel", "Mes relations (famille, amis)", "Ce que j'ai surmonté", "Ce que je sais créer ou réparer"] },
    { q: "En vacances, je préfère :", g: "En vacances, {p} préfère :", o: ["Ne rien faire au soleil", "Visiter du matin au soir", "Le sport et l'aventure", "Rester à la maison"] },
    { q: "Le cadeau qui me ferait le plus plaisir :", g: "Le cadeau qui ferait le plus plaisir à {p} :", o: ["Une expérience (concert, week-end)", "Un objet dont j'ai besoin", "Une surprise faite à la main", "De quoi choisir moi-même"] },
    { q: "Ce qui m'agace le plus chez les autres :", g: "Ce qui agace le plus {p} chez les autres :", o: ["Le retard", "Le mensonge", "Le manque d'écoute", "La négativité"] },
    { q: "Moi, le matin :", g: "{p}, le matin :", o: ["Debout tôt et en forme", "Ça va après un café", "Pas un mot avant 10 h", "Le matin n'existe pas"] },
    { q: "Devant un conflit, mon premier réflexe :", g: "Devant un conflit, le premier réflexe {de_p} :", o: ["En parler tout de suite", "Prendre du recul", "Faire comme si de rien n'était", "M'énerver"] },
    { q: "Ce qui compte le plus pour moi dans un couple :", g: "Ce qui compte le plus pour {p} dans un couple :", o: ["La confiance", "La complicité", "Le désir", "Les projets communs"] },
    { q: "Pour une soirée film, je choisis :", g: "Pour une soirée film, {p} choisit :", o: ["Une comédie", "Un thriller ou un film d'horreur", "Une romance ou un drame", "De la science-fiction ou du fantastique"] },
    { q: "Mon plus grand rêve :", g: "Le plus grand rêve {de_p} :", o: ["Voyager longtemps", "Réussir un projet professionnel", "Fonder ou agrandir une famille", "Avoir un endroit bien à moi"] },
    { q: "Si on était séparés un mois, ce qui me manquerait le plus :", g: "Si vous étiez séparés un mois, ce qui manquerait le plus à {p} :", o: ["Nos discussions", "Les câlins", "Rire ensemble", "Le quotidien à deux"] }
  ];

  var questions = [];
  ITEMS.forEach(function (it) {
    questions.push({ d: "moi", t: "nom", q: it.q, o: it.o });
    questions.push({ d: "toi", t: "nom", guess: true, q: it.g, o: it.o });
  });

  (window.TESTS = window.TESTS || []).push({
    id: "connais",
    v: 1,
    group: "commencer",
    kind: "devine",
    title: "Tu me connais vraiment ?",
    hook: "Est-ce qu'on se connaît par cœur ?",
    blurb: "Quinze thèmes : tu réponds pour toi, puis tu devines ce que l'autre répondra. Le rapport montre qui connaît le mieux l'autre, et où sont les surprises.",
    minutes: 6,
    simLabel: "de bonnes intuitions",
    units: [ITEMS.length, "thèmes"],
    words: {
      ok: ["bonne intuition", "bonnes intuitions"],
      near: ["réponse voisine", "réponses voisines"],
      gap: ["surprise", "surprises"]
    },
    intro: [
      "Pour chaque thème, deux écrans : d'abord ta propre réponse, puis celle que tu attends de l'autre. L'autre fait la même chose de son côté.",
      "Le rapport compare tes intuitions aux vraies réponses de l'autre, et inversement. Les surprises sont les meilleurs sujets de discussion."
    ],
    headline: function (p) {
      return p >= 85 ? "Vous vous connaissez par cœur."
        : p >= 70 ? "Vous vous connaissez bien."
        : p >= 55 ? "Il vous reste des choses à découvrir."
        : "Vous avez encore beaucoup à apprendre l'un de l'autre.";
    },
    dims: [
      { id: "moi", name: "Ta réponse", short: "Moi" },
      { id: "toi", name: "Ton intuition", short: "L'autre" }
    ],
    questions: questions
  });
})();
