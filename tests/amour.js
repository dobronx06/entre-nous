/* Nos façons d'aimer : 5 manières de recevoir de l'affection, 4 situations chacune. */
(window.TESTS = window.TESTS || []).push({
  id: "amour",
  v: 1,
  group: "liens",
  kind: "profil",
  title: "Nos façons d'aimer",
  hook: "Qu'est-ce qui nous touche vraiment ?",
  blurb: "Mots, temps, coups de main, attentions, contact : ce qui fait que chacun se sent aimé, et comment viser juste.",
  minutes: 4,
  simLabel: "de sensibilités communes",
  lead: "À quel point ça te touche ?",
  scale: ["Ça ne me fait rien", "Un peu", "Ça me fait plaisir", "Ça me touche beaucoup", "Rien ne me touche autant"],
  levels: ["Peu sensible", "Sensible", "Très sensible"],
  intro: [
    "Vingt situations du quotidien. Pour chacune, tu indiques à quel point elle te touche quand elle vient de ton ou ta partenaire.",
    "On donne souvent l'affection sous la forme qu'on aimerait recevoir. Le rapport montre ce qui compte vraiment pour chacun."
  ],
  dims: [
    {
      id: "mots", name: "Les mots", short: "Mots",
      desc: "Compliments, encouragements, messages tendres.",
      tip: "dire ce que tu ressens avec des mots précis, et l'écrire de temps en temps",
      gap: "{hi} a besoin d'entendre les choses, {lo} beaucoup moins. Pour {hi}, un compliment dit à voix haute compte plus qu'il n'y paraît.",
      both: "Vous êtes tous les deux sensibles aux mots : ne gardez pas vos compliments pour vous.",
      none: "Les grandes déclarations ne sont pas votre langue : vous vous le montrez autrement."
    },
    {
      id: "temps", name: "Le temps partagé", short: "Temps",
      desc: "Des moments à deux, avec une attention entière.",
      tip: "bloquer du temps rien que pour vous deux, téléphones rangés",
      gap: "Pour {hi}, l'amour se mesure d'abord au temps passé ensemble. {lo} peut penser en faire assez autrement : rien ne remplace un vrai moment à deux.",
      both: "Le temps à deux compte énormément pour l'un comme pour l'autre : protégez-le dans vos agendas.",
      none: "Vous n'avez pas besoin d'être souvent ensemble pour vous sentir proches."
    },
    {
      id: "gestes", name: "Les coups de main", short: "Services",
      desc: "Les tâches prises en charge, l'aide concrète.",
      tip: "prendre en charge une corvée sans attendre qu'on le demande",
      gap: "Pour {hi}, un coup de main est une preuve d'amour. {lo} y voit plutôt de la logistique : une corvée prise en charge fera pourtant plus d'effet qu'un bouquet.",
      both: "Vous vous montrez votre amour en vous facilitant la vie : continuez à vous le dire quand vous le remarquez.",
      none: "L'aide pratique ne dit pas grand-chose de vos sentiments, et c'est vrai pour vous deux."
    },
    {
      id: "attentions", name: "Les attentions", short: "Attentions",
      desc: "Les cadeaux et les petites surprises qui montrent qu'on a pensé à l'autre.",
      tip: "noter ses envies et arriver avec une petite surprise, même minuscule",
      gap: "{hi} est sensible aux petites attentions, {lo} y accorde peu d'importance. Pas besoin de dépenser : c'est le fait d'y avoir pensé qui compte pour {hi}.",
      both: "Vous aimez tous les deux les surprises : un détail rapporté de la journée suffit à faire mouche.",
      none: "Les cadeaux ne sont pas votre langue : inutile de vous mettre la pression aux anniversaires."
    },
    {
      id: "contact", name: "Le contact", short: "Contact",
      desc: "Câlins, mains tenues, proximité physique.",
      tip: "multiplier les gestes tendres dans la journée, sans raison particulière",
      gap: "{hi} a besoin de contact physique, {lo} moins. Trouvez des gestes qui conviennent aux deux, et dites-vous quand vous en avez envie ou pas.",
      both: "Le contact compte beaucoup pour vous deux : un geste tendre vaut souvent mieux qu'un long discours.",
      none: "Vous êtes tous les deux peu tactiles : vous vous sentez proches sans vous toucher beaucoup."
    }
  ],
  questions: [
    { d: "mots", q: "Recevoir un message tendre au milieu de la journée." },
    { d: "temps", q: "Une soirée entière à deux, téléphones rangés." },
    { d: "gestes", q: "Qu'on s'occupe d'une corvée à ma place sans que je le demande." },
    { d: "attentions", q: "Recevoir un petit cadeau sans occasion particulière." },
    { d: "contact", q: "Qu'on me prenne dans les bras en rentrant." },

    { d: "mots", q: "Entendre « j'ai de la chance de t'avoir »." },
    { d: "temps", q: "Qu'on m'écoute raconter ma journée sans rien faire d'autre en même temps." },
    { d: "gestes", q: "Qu'on me prépare à manger quand je rentre tard." },
    { d: "attentions", q: "Qu'on se souvienne d'une envie que j'avais mentionnée, et qu'on me l'offre." },
    { d: "contact", q: "Se tenir la main en marchant." },

    { d: "mots", q: "Qu'on me dise précisément ce qu'on aime chez moi." },
    { d: "temps", q: "Partir se promener ou faire une activité rien que nous deux." },
    { d: "gestes", q: "Qu'on règle pour moi un problème pénible (un papier, une réparation)." },
    { d: "attentions", q: "Qu'on me rapporte quelque chose d'un voyage ou d'une sortie." },
    { d: "contact", q: "S'endormir l'un contre l'autre." },

    { d: "mots", q: "Recevoir une lettre ou un petit mot écrit à la main." },
    { d: "temps", q: "Que l'autre libère du temps pour moi dans une semaine chargée." },
    { d: "gestes", q: "Qu'on anticipe ce dont je vais avoir besoin." },
    { d: "attentions", q: "Un cadeau d'anniversaire choisi avec soin." },
    { d: "contact", q: "Un massage ou des caresses, sans raison." }
  ],
  summary: function (pa, pb, N, h) {
    var ta = h.top(this, pa, 2), tb = h.top(this, pb, 2);
    var line = function (name, top) {
      return "<p><b>Pour toucher " + name + "</b> (" + top[0].name.toLowerCase() + ", puis " + top[1].name.toLowerCase() + ") : " + top[0].tip + ".</p>";
    };
    return [{
      title: "Comment viser juste",
      html: line(N.a, ta) + line(N.b, tb) + "<p>" +
        (ta[0] === tb[0]
          ? "Vous êtes d'abord sensibles à la même chose : ce que tu aimes recevoir fera aussi plaisir à l'autre."
          : "Vos premières sensibilités sont différentes. On donne souvent ce qu'on aimerait recevoir, et on passe à côté : donne à l'autre dans sa langue, pas dans la tienne.") +
        "</p>"
    }];
  }
});
