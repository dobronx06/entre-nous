/* Personnalité : les cinq grands traits, 5 phrases chacun. Phrases originales.
   r: true = phrase inversée. */
(window.TESTS = window.TESTS || []).push({
  id: "perso",
  v: 1,
  group: "cerveau",
  kind: "profil",
  title: "Personnalités",
  hook: "Est-ce qu'on a le même caractère ?",
  blurb: "Ouverture, rigueur, extraversion, conciliation, émotivité : vos deux profils sur les cinq grands traits, et ce que vos différences changent au quotidien.",
  minutes: 5,
  simLabel: "de ressemblance",
  lead: "Cette phrase te ressemble-t-elle ?",
  scale: ["Pas du tout moi", "Plutôt pas moi", "Entre les deux", "Plutôt moi", "Tout à fait moi"],
  levels: ["Bas", "Moyen", "Élevé"],
  intro: [
    "Vingt-cinq phrases pour situer chacun sur les cinq grands traits de personnalité utilisés en psychologie.",
    "Aucun profil n'est meilleur qu'un autre, et un couple n'a pas besoin de se ressembler. Le rapport montre où vous vous complétez et où ça peut frotter."
  ],
  note: "Version courte inspirée du modèle des cinq grands traits. Elle donne une tendance, pas une évaluation professionnelle.",
  dims: [
    {
      id: "ouverture", name: "Ouverture", short: "Ouverture",
      desc: "Curiosité, imagination, goût des idées et de la nouveauté.",
      gap: "{hi} a besoin de nouveauté et d'idées, {lo} de repères. {hi} amène de l'air, {lo} de la stabilité : alternez découvertes et valeurs sûres.",
      both: "Deux esprits curieux : nourrissez votre couple de projets et de découvertes.",
      none: "Vous aimez tous les deux le concret et le connu : votre vie n'a pas besoin de surprises pour être bonne."
    },
    {
      id: "rigueur", name: "Rigueur", short: "Rigueur",
      desc: "Organisation, persévérance, sens de l'engagement.",
      gap: "{hi} planifie et range, {lo} improvise. C'est une source classique d'agacement : répartissez les tâches selon vos forces plutôt que d'attendre que l'autre change.",
      both: "Vous êtes tous les deux organisés : la maison tourne rond, pensez à lâcher prise de temps en temps.",
      none: "L'organisation n'est le fort d'aucun de vous : quelques routines partagées vous éviteront les oublis."
    },
    {
      id: "extraversion", name: "Extraversion", short: "Extraversion",
      desc: "Énergie tirée des autres, goût de l'action et de la parole.",
      gap: "{hi} se recharge au contact des autres, {lo} dans le calme. Vous n'avez pas à tout faire ensemble : {hi} peut sortir sans {lo}, sans que ce soit un problème.",
      both: "Vous aimez tous les deux le monde et le mouvement : gardez aussi des moments rien qu'à deux.",
      none: "Vous préférez tous les deux le calme : votre cocon vous suffit."
    },
    {
      id: "conciliation", name: "Conciliation", short: "Conciliation",
      desc: "Confiance, empathie, envie d'éviter les heurts.",
      gap: "{hi} cède plus facilement pour éviter un conflit, {lo} dit les choses plus franchement. Veillez à ce que {hi} exprime aussi ses désaccords.",
      both: "Vous êtes tous les deux conciliants : peu de heurts, mais prenez soin de dire quand quelque chose ne va pas.",
      none: "Vous êtes tous les deux francs et directs : les discussions peuvent être vives, mais rien ne reste caché."
    },
    {
      id: "emotivite", name: "Sensibilité au stress", short: "Émotivité",
      desc: "Tendance à s'inquiéter, à douter et à ressentir fortement les contrariétés.",
      gap: "{hi} ressent le stress plus fortement. {lo} peut aider en écoutant sans minimiser, et {hi} en disant ce qui rassure.",
      both: "Vous êtes tous les deux sensibles au stress : évitez les grandes discussions quand vous êtes fatigués, et rassurez-vous souvent.",
      none: "Vous gardez tous les deux votre calme : un vrai confort dans les périodes difficiles."
    }
  ],
  questions: [
    { d: "ouverture", q: "J'aime les idées qui bousculent ma façon de penser." },
    { d: "rigueur", q: "Je finis ce que je commence." },
    { d: "extraversion", q: "Je vais facilement vers les inconnus." },
    { d: "conciliation", q: "Je fais facilement confiance aux gens." },
    { d: "emotivite", q: "Je m'inquiète facilement." },

    { d: "ouverture", q: "Je m'intéresse à l'art, à la musique ou à la littérature." },
    { d: "rigueur", q: "Mes affaires sont rangées et mes papiers à jour." },
    { d: "extraversion", q: "J'aime être au centre de l'attention." },
    { d: "conciliation", q: "Je me mets facilement à la place des autres." },
    { d: "emotivite", q: "Mon humeur change vite." },

    { d: "ouverture", q: "J'ai beaucoup d'imagination." },
    { d: "rigueur", q: "Je prépare les choses à l'avance." },
    { d: "extraversion", q: "Je parle beaucoup." },
    { d: "conciliation", q: "Je cède volontiers pour éviter un conflit." },
    { d: "emotivite", q: "Un imprévu peut me gâcher la journée." },

    { d: "ouverture", q: "J'aime essayer des plats, des lieux ou des activités que je ne connais pas." },
    { d: "rigueur", q: "On peut compter sur moi pour tenir un engagement." },
    { d: "extraversion", q: "Après une soirée animée, j'ai encore de l'énergie." },
    { d: "conciliation", q: "J'aime rendre service." },
    { d: "emotivite", q: "Je doute souvent de moi." },

    { d: "ouverture", r: true, q: "Je préfère mes habitudes aux expériences nouvelles." },
    { d: "rigueur", r: true, q: "Je remets souvent à plus tard." },
    { d: "extraversion", r: true, q: "Dans un groupe, je préfère rester en retrait." },
    { d: "conciliation", r: true, q: "Je dis ce que je pense, même si ça froisse." },
    { d: "emotivite", r: true, q: "Je reste calme sous la pression." }
  ],
  summary: function (pa, pb, N) {
    var ds = this.dims.filter(function (d) { return pa[d.id] != null && pb[d.id] != null; });
    var byGap = ds.slice().sort(function (x, y) { return Math.abs(pa[x.id] - pb[x.id]) - Math.abs(pa[y.id] - pb[y.id]); });
    var near = byGap[0], far = byGap[byGap.length - 1];
    var top = function (p) { return ds.slice().sort(function (x, y) { return p[y.id] - p[x.id]; })[0]; };
    return [{
      title: "Vos deux caractères",
      html: "<p><b>" + N.a + "</b> : trait le plus marqué, " + top(pa).name.toLowerCase() + ". <b>" + N.b + "</b> : " + top(pb).name.toLowerCase() + ".</p>" +
        "<p>Vous vous ressemblez le plus sur : " + near.name.toLowerCase() + ". Vous différez le plus sur : " + far.name.toLowerCase() + ".</p>"
    }];
  }
});
