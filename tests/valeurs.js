/* Nos valeurs : 8 familles de valeurs, 3 phrases chacune, notées par importance. */
(window.TESTS = window.TESTS || []).push({
  id: "valeurs",
  v: 1,
  group: "liens",
  kind: "profil",
  title: "Nos valeurs",
  hook: "Est-ce qu'on a les mêmes valeurs ?",
  blurb: "Famille, réussite, liberté, engagement : ce qui compte le plus pour chacun, et là où vos priorités se rejoignent.",
  minutes: 5,
  simLabel: "de valeurs communes",
  lead: "Quelle importance pour toi ?",
  scale: ["Pas important", "Peu important", "Assez important", "Très important", "Essentiel"],
  levels: ["Secondaire", "Important", "Central"],
  intro: [
    "Vingt-quatre phrases, huit familles de valeurs. Pour chacune, tu indiques l'importance qu'elle a dans ta vie, pas celle qu'elle devrait avoir.",
    "Le rapport classe vos valeurs, montre celles que vous partagez et celles où vos priorités divergent."
  ],
  dims: [
    {
      id: "famille", name: "Famille et transmission", short: "Famille",
      desc: "La place des proches et de ce qu'on transmet.",
      gap: "{hi} place la famille plus haut, {lo} un peu moins. Parlez du temps et de l'énergie que chacun veut y consacrer, surtout autour des fêtes et des grandes décisions.",
      both: "La famille est un pilier pour vous deux : un socle solide pour vos projets.",
      none: "Ni l'un ni l'autre ne met la famille au centre : vous construisez votre vie d'abord à deux."
    },
    {
      id: "reussite", name: "Réussite et ambition", short: "Réussite",
      desc: "L'envie de réussir, de progresser et de voir son travail reconnu.",
      gap: "{hi} a besoin d'objectifs ambitieux, {lo} beaucoup moins. Cela se joue dans le temps donné au travail : mettez-vous d'accord sur ce qui reste protégé.",
      both: "Vous avez tous les deux de l'ambition : veillez à ce qu'il reste de la place pour le couple dans vos agendas.",
      none: "La carrière n'est une priorité pour aucun de vous : vous cherchez votre équilibre ailleurs."
    },
    {
      id: "securite", name: "Sécurité et stabilité", short: "Sécurité",
      desc: "Le besoin de prévoir, d'épargner et d'éviter les mauvaises surprises.",
      gap: "{hi} a besoin de filets de sécurité, {lo} supporte mieux l'incertitude. Avant un grand changement, {hi} aura besoin d'un plan.",
      both: "Vous aimez tous les deux savoir où vous allez : vos décisions seront réfléchies et vos finances suivies.",
      none: "L'incertitude ne vous fait pas peur. Gardez seulement un œil sur l'épargne."
    },
    {
      id: "liberte", name: "Liberté et indépendance", short: "Liberté",
      desc: "Le besoin de décider par soi-même et de garder un espace à soi.",
      gap: "{hi} tient beaucoup à son indépendance, {lo} en a moins besoin. Ce n'est pas un manque d'amour : précisez ensemble ce qui relève du « nous » et ce qui reste à chacun.",
      both: "Vous tenez tous les deux à votre indépendance. Cela fonctionne tant que vous gardez des rendez-vous à deux.",
      none: "Vous aimez décider et vivre les choses ensemble : votre couple est votre projet commun."
    },
    {
      id: "aventure", name: "Découverte et nouveauté", short: "Découverte",
      desc: "Le goût du voyage, du changement et de l'inconnu.",
      gap: "{hi} a soif de nouveauté, {lo} préfère les valeurs sûres. Alternez : une découverte choisie par {hi}, puis un classique choisi par {lo}.",
      both: "Vous aimez tous les deux la nouveauté : gardez toujours un projet de découverte en cours.",
      none: "Vous appréciez tous les deux vos habitudes : inutile de vous forcer à l'aventure."
    },
    {
      id: "tradition", name: "Traditions et spiritualité", short: "Traditions",
      desc: "L'attachement aux rites, à la culture d'origine et à la vie spirituelle.",
      gap: "{hi} tient aux traditions ou à la spiritualité, {lo} beaucoup moins. Le sujet ressortira aux grandes étapes (mariage, enfants, fêtes) : mieux vaut en parler avant.",
      both: "Traditions et spiritualité comptent pour vous deux. Vérifiez simplement que vous parlez des mêmes.",
      none: "Vous êtes peu attachés aux traditions : vous inventez vos propres rituels."
    },
    {
      id: "engagement", name: "Justice et engagement", short: "Engagement",
      desc: "L'envie d'agir pour les autres et de vivre selon ses convictions.",
      gap: "{hi} a besoin d'agir pour ses convictions, {lo} moins. {lo} n'a pas à s'engager autant, mais peut soutenir ce qui compte pour {hi}.",
      both: "Vous partagez le besoin d'agir pour quelque chose de plus grand que vous : un engagement commun vous rapprocherait encore.",
      none: "Les grandes causes ne dirigent pas vos choix : vous agissez surtout pour vos proches."
    },
    {
      id: "plaisir", name: "Plaisir et confort", short: "Plaisir",
      desc: "La place du plaisir immédiat, du confort et des belles choses.",
      gap: "{hi} s'accorde du plaisir facilement, {lo} se restreint davantage. C'est une source classique de frictions sur les dépenses : fixez un budget plaisir sans comptes à rendre.",
      both: "Vous savez tous les deux profiter. Gardez juste un œil commun sur le budget.",
      none: "Vous vous méfiez tous les deux du superflu : pensez quand même à vous faire plaisir."
    }
  ],
  questions: [
    { d: "famille", q: "Passer du temps avec ma famille, même quand l'agenda est plein." },
    { d: "reussite", q: "Réussir professionnellement et voir mon travail reconnu." },
    { d: "securite", q: "Avoir une vie stable, sans mauvaises surprises." },
    { d: "liberte", q: "Prendre mes décisions sans avoir à me justifier." },
    { d: "aventure", q: "Voyager et découvrir d'autres façons de vivre." },
    { d: "tradition", q: "Respecter les traditions de ma famille ou de ma culture." },
    { d: "engagement", q: "Agir pour une cause qui me dépasse (écologie, justice, solidarité)." },
    { d: "plaisir", q: "Me faire plaisir sans culpabiliser." },

    { d: "famille", q: "Transmettre quelque chose à la génération suivante." },
    { d: "reussite", q: "Me fixer des objectifs ambitieux et les atteindre." },
    { d: "securite", q: "Mettre de l'argent de côté pour l'avenir." },
    { d: "liberte", q: "Garder du temps et des projets rien qu'à moi." },
    { d: "aventure", q: "Essayer régulièrement des choses que je n'ai jamais faites." },
    { d: "tradition", q: "Avoir une vie spirituelle ou religieuse." },
    { d: "engagement", q: "Aider des gens que je ne connais pas." },
    { d: "plaisir", q: "Profiter du présent plutôt que tout planifier." },

    { d: "famille", q: "Répondre présent quand mes proches ont besoin de moi, même si ça me coûte." },
    { d: "reussite", q: "Bien gagner ma vie." },
    { d: "securite", q: "Savoir à quoi ressembleront les prochaines années." },
    { d: "liberte", q: "Pouvoir changer de vie si l'envie m'en prend." },
    { d: "aventure", q: "Sortir de ma zone de confort." },
    { d: "tradition", q: "Marquer les grandes étapes de la vie par des rituels (mariage, fêtes, cérémonies)." },
    { d: "engagement", q: "Vivre en accord avec mes convictions, même quand c'est moins confortable." },
    { d: "plaisir", q: "M'entourer de belles choses et de confort." }
  ],
  summary: function (pa, pb, N, h) {
    var ta = h.top(this, pa, 3), tb = h.top(this, pb, 3);
    var common = ta.filter(function (d) { return tb.indexOf(d) >= 0; });
    var list = function (ds) { return ds.map(function (d) { return d.name.toLowerCase(); }).join(", "); };
    return [{
      title: "Vos trois valeurs phares",
      html: "<p><b>" + N.a + "</b> : " + list(ta) + ".</p><p><b>" + N.b + "</b> : " + list(tb) + ".</p>" +
        (common.length
          ? "<p>En commun dans vos trois premières : " + list(common) + ".</p>"
          : "<p>Aucune valeur commune dans vos trois premières. Vos priorités diffèrent : cela demande d'en parler, pas forcément de s'en inquiéter.</p>")
    }];
  }
});
