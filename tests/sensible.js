/* Hypersensibilité : 4 domaines, 4 phrases chacun. Phrases originales. */
(window.TESTS = window.TESTS || []).push({
  id: "sensible",
  v: 1,
  group: "cerveau",
  kind: "profil",
  title: "Hypersensibilité",
  hook: "Est-ce qu'on est aussi sensibles l'un que l'autre ?",
  blurb: "Sens, émotions, saturation, empathie : seize phrases pour comparer ce que chacun perçoit et encaisse, et ajuster le quotidien.",
  minutes: 3,
  simLabel: "de ressemblance",
  lead: "Cette phrase te ressemble-t-elle ?",
  scale: ["Pas du tout moi", "Plutôt pas moi", "Entre les deux", "Plutôt moi", "Tout à fait moi"],
  levels: ["Peu marquée", "Modérée", "Marquée"],
  intro: [
    "Seize phrases sur ta sensibilité : à ce qui t'entoure, à tes émotions, à celles des autres.",
    "Une sensibilité élevée n'est ni un défaut ni une fragilité. Le rapport montre où vos seuils diffèrent, pour que chacun comprenne ce que l'autre perçoit."
  ],
  note: "L'hypersensibilité n'est pas un diagnostic médical : c'est un trait de tempérament, plus ou moins marqué selon les personnes.",
  dims: [
    {
      id: "sens", name: "Sensibilité sensorielle", short: "Sens",
      desc: "La réaction aux bruits, aux lumières, aux odeurs et aux matières.",
      gap: "{hi} perçoit les bruits, les lumières ou les odeurs plus fort. Ce n'est pas de la comédie : baisser le son ou la lumière coûte peu à {lo} et change beaucoup pour {hi}.",
      both: "Vous êtes tous les deux très réceptifs à votre environnement : soignez l'ambiance de la maison, elle compte pour vous deux.",
      none: "L'environnement vous dérange peu, l'un comme l'autre."
    },
    {
      id: "emotion", name: "Intensité émotionnelle", short: "Émotions",
      desc: "La force avec laquelle les joies, les peines et les critiques sont ressenties.",
      gap: "{hi} ressent les choses plus intensément. Une remarque anodine pour {lo} peut toucher {hi} longtemps : choisissez le moment et les mots.",
      both: "Vous vivez tous les deux les émotions intensément : c'est une grande richesse, à condition de vous laisser le temps de redescendre.",
      none: "Vos émotions restent mesurées, pour l'un comme pour l'autre."
    },
    {
      id: "saturation", name: "Saturation", short: "Saturation",
      desc: "Le besoin de calme quand il y a trop de choses à la fois.",
      gap: "{hi} sature plus vite quand tout s'accumule. Prévoir des temps calmes dans les journées chargées évite bien des tensions.",
      both: "Vous saturez tous les deux vite : n'empilez pas les obligations, et prévoyez des sas de calme.",
      none: "Les journées chargées vous fatiguent peu, l'un comme l'autre."
    },
    {
      id: "empathie", name: "Empathie", short: "Empathie",
      desc: "La capacité à capter l'humeur et les besoins des autres.",
      gap: "{hi} capte l'humeur des autres et s'en imprègne. {lo} peut dire les choses plus clairement, et {hi} demander au lieu de deviner.",
      both: "Vous captez tous les deux très vite l'humeur de l'autre : attention à ne pas vous transmettre vos inquiétudes.",
      none: "Vous avez tous les deux besoin qu'on vous dise les choses : dites-les clairement."
    }
  ],
  questions: [
    { d: "sens", q: "Les bruits forts ou soudains me font sursauter plus que les autres." },
    { d: "emotion", q: "Un film, une musique ou un paysage peut me bouleverser." },
    { d: "saturation", q: "Quand j'ai trop de choses à faire en même temps, je perds mes moyens." },
    { d: "empathie", q: "Je sens l'ambiance d'une pièce dès que j'y entre." },

    { d: "sens", q: "Je remarque tout de suite une odeur, une lumière ou une température qui change." },
    { d: "emotion", q: "Je pleure facilement." },
    { d: "saturation", q: "Après une journée chargée, j'ai besoin de m'isoler au calme." },
    { d: "empathie", q: "L'humeur des autres déteint sur moi." },

    { d: "sens", q: "Les vêtements qui grattent ou qui serrent me sont insupportables." },
    { d: "emotion", q: "Une critique me touche longtemps." },
    { d: "saturation", q: "Les changements me secouent, même quand ils sont positifs." },
    { d: "empathie", q: "Je devine ce dont quelqu'un a besoin sans qu'il le dise." },

    { d: "sens", q: "La caféine, la faim ou le manque de sommeil me perturbent fortement." },
    { d: "emotion", q: "Je ressens les joies et les peines plus fort que mon entourage." },
    { d: "saturation", q: "Qu'on me regarde faire quelque chose me fait perdre mes moyens." },
    { d: "empathie", q: "Les scènes violentes à l'écran me sont pénibles." }
  ],
  summary: function (pa, pb, N, h) {
    var ga = h.global(pa), gb = h.global(pb), diff = Math.abs(ga - gb), hi = ga >= gb ? N.a : N.b;
    var verdict = diff < 10 ? "Vos sensibilités sont d'une intensité comparable."
      : diff < 25 ? hi + " a une sensibilité un peu plus marquée."
      : hi + " a une sensibilité nettement plus marquée.";
    return [{
      title: "Aussi sensibles l'un que l'autre ?",
      html: "<p>" + verdict + "</p>" +
        "<p><b>" + N.a + "</b> : " + ga + " sur 100 (" + h.level(this, ga).toLowerCase() + "). <b>" + N.b + "</b> : " + gb + " sur 100 (" + h.level(this, gb).toLowerCase() + ").</p>"
    }];
  }
});
