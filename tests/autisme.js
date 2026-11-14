/* Traits autistiques : 6 domaines, 5 phrases chacun. Phrases originales,
   sans valeur diagnostique. r: true = phrase inversée. */
(window.TESTS = window.TESTS || []).push({
  id: "autisme",
  v: 1,
  group: "cerveau",
  kind: "profil",
  title: "Traits autistiques",
  hook: "Est-ce qu'on est autistes au même point ?",
  blurb: "Sensorialité, codes sociaux, routines, passions : comparez vos fonctionnements domaine par domaine. Ce n'est pas un diagnostic.",
  minutes: 6,
  simLabel: "de ressemblance",
  lead: "Cette phrase te ressemble-t-elle ?",
  scale: ["Pas du tout moi", "Plutôt pas moi", "Entre les deux", "Plutôt moi", "Tout à fait moi"],
  levels: ["Peu marqué", "Modéré", "Marqué"],
  intro: [
    "Trente phrases sur six domaines où les personnes autistes décrivent souvent un fonctionnement différent. Tu indiques à quel point chacune te ressemble.",
    "Le rapport ne dit pas si l'un de vous est autiste. Il montre où vos fonctionnements se ressemblent, où ils diffèrent, et comment en tenir compte à deux."
  ],
  note: "Ce questionnaire n'a aucune valeur médicale. Beaucoup de ces traits existent aussi chez des personnes non autistes, et seul un bilan mené par des professionnels formés permet de poser un diagnostic. En France, les Centres de Ressources Autisme (CRA) orientent vers ce type de bilan.",
  dims: [
    {
      id: "social", name: "Codes sociaux", short: "Social",
      desc: "L'aisance dans les échanges informels et la lecture des signaux des autres.",
      gap: "{hi} dépense plus d'énergie dans les situations sociales. En soirée, convenez d'un signal pour partir, et {lo} peut se charger des présentations.",
      both: "Les codes sociaux vous coûtent à tous les deux : entre vous, pas besoin de faire semblant, et c'est reposant.",
      none: "Vous êtes tous les deux à l'aise avec les codes sociaux."
    },
    {
      id: "comm", name: "Communication", short: "Langage",
      desc: "Le rapport à l'implicite, au second degré et à la parole directe.",
      gap: "{hi} prend les mots au plus près de leur sens. {lo} gagnera à dire les choses clairement plutôt qu'à les sous-entendre.",
      both: "Vous préférez tous les deux une parole directe : dites les choses telles qu'elles sont, cela vous convient.",
      none: "Sous-entendus et second degré passent bien entre vous."
    },
    {
      id: "sens", name: "Sensorialité", short: "Sens",
      desc: "La sensibilité aux bruits, aux lumières, aux matières et aux odeurs.",
      gap: "{hi} est plus sensible aux bruits, aux lumières ou aux textures. Ce qui est un détail pour {lo} peut être épuisant pour {hi} : choisissez ensemble l'ambiance de la maison et des sorties.",
      both: "Vous êtes tous les deux très sensibles à votre environnement : faites de votre logement un endroit calme, à votre mesure.",
      none: "L'environnement sensoriel vous gêne peu, l'un comme l'autre."
    },
    {
      id: "routine", name: "Routines et prévisibilité", short: "Routines",
      desc: "Le besoin de savoir à l'avance et de garder ses habitudes.",
      gap: "{hi} a besoin de prévisibilité. Quand un plan change, {lo} peut prévenir le plus tôt possible et proposer une alternative précise.",
      both: "Vous aimez tous les deux savoir à quoi vous attendre : planifier ensemble vous fera du bien.",
      none: "L'imprévu ne vous dérange ni l'un ni l'autre."
    },
    {
      id: "interets", name: "Passions et attention aux détails", short: "Passions",
      desc: "L'intensité des centres d'intérêt et la capacité à s'y absorber.",
      gap: "{hi} peut s'absorber longtemps dans ses passions. Ce n'est pas du désintérêt pour {lo} : fixez des moments où chacun sait que l'autre est disponible.",
      both: "Vous avez tous les deux des passions intenses : respectez les temps de concentration de l'autre, et partagez vos découvertes.",
      none: "Vos centres d'intérêt restent souples, pour l'un comme pour l'autre."
    },
    {
      id: "energie", name: "Énergie sociale et camouflage", short: "Énergie",
      desc: "La fatigue après les interactions et l'effort fourni pour paraître à l'aise.",
      gap: "{hi} se fatigue vite en société et fournit des efforts qui ne se voient pas toujours. Prévoyez du temps de récupération après les sorties, sans le prendre personnellement.",
      both: "Vous avez tous les deux besoin de récupérer après avoir vu du monde : protégez vos temps calmes.",
      none: "Les moments en société vous coûtent peu d'énergie à tous les deux."
    }
  ],
  questions: [
    { d: "social", q: "Dans un groupe, j'ai du mal à savoir quand c'est à moi de parler." },
    { d: "comm", q: "Je prends souvent les phrases au pied de la lettre avant de comprendre qu'il y avait un sous-entendu." },
    { d: "sens", q: "Certains bruits que les autres ignorent (mastication, néons, tic-tac) me sont pénibles." },
    { d: "routine", q: "Un changement de programme de dernière minute me perturbe pour un bon moment." },
    { d: "interets", q: "Quand un sujet m'intéresse, je veux tout savoir dessus, jusqu'aux détails." },
    { d: "energie", q: "Après un moment en société, j'ai besoin de temps au calme pour récupérer." },

    { d: "social", q: "Les conversations pour ne rien dire (météo, banalités) me demandent un effort." },
    { d: "comm", q: "On m'a déjà reproché d'être trop direct alors que je voulais juste être précis." },
    { d: "sens", q: "Une étiquette, une couture ou une matière de vêtement peut me gâcher la journée." },
    { d: "routine", q: "J'aime faire les choses dans le même ordre, de la même façon." },
    { d: "interets", q: "Je peux rester sur une activité au point d'oublier de manger ou de dormir." },
    { d: "energie", q: "En public, j'ai l'impression de jouer un rôle pour paraître à l'aise." },

    { d: "social", q: "Je comprends mieux les gens quand ils disent les choses clairement que quand je dois deviner leur humeur." },
    { d: "comm", q: "L'ironie et le second degré m'échappent parfois." },
    { d: "sens", q: "Les lieux bruyants et bondés m'épuisent vite." },
    { d: "routine", q: "J'ai besoin de savoir à l'avance comment une journée va se dérouler." },
    { d: "interets", q: "Je remarque des détails ou des erreurs que les autres ne voient pas." },
    { d: "energie", q: "J'ai appris les codes sociaux en observant les autres plutôt que d'instinct." },

    { d: "social", q: "Soutenir le regard de quelqu'un pendant qu'on se parle m'est inconfortable." },
    { d: "comm", q: "Je préfère un message écrit à un appel téléphonique." },
    { d: "sens", q: "Je suis très sensible aux lumières vives, aux odeurs ou à la texture des aliments." },
    { d: "routine", q: "Je mange volontiers les mêmes plats, encore et encore." },
    { d: "interets", q: "J'aime classer, lister ou organiser les choses selon ma propre logique." },
    { d: "energie", q: "Il m'arrive de préparer mes phrases avant une conversation." },

    { d: "social", r: true, q: "Je me fais facilement de nouveaux amis." },
    { d: "comm", q: "Quand un sujet me passionne, je peux en parler longtemps sans voir que l'autre a décroché." },
    { d: "sens", q: "J'ai des gestes répétitifs qui m'apaisent (me balancer, triturer un objet)." },
    { d: "routine", r: true, q: "L'imprévu me stimule plus qu'il ne me stresse." },
    { d: "interets", q: "Quand je suis en pleine concentration, m'interrompre me coûte beaucoup." },
    { d: "energie", q: "Après une journée chargée, je peux me retrouver à plat au point de ne plus pouvoir parler." }
  ],
  summary: function (pa, pb, N, h) {
    var ga = h.global(pa), gb = h.global(pb), diff = Math.abs(ga - gb), hi = ga >= gb ? N.a : N.b;
    var verdict = diff < 10 ? "Vous êtes à peu près au même point : vos traits sont d'une intensité comparable."
      : diff < 25 ? hi + " a des traits un peu plus marqués."
      : hi + " a des traits nettement plus marqués.";
    return [{
      title: "Au même point ?",
      html: "<p>" + verdict + "</p>" +
        "<p><b>" + N.a + "</b> : " + ga + " sur 100 (" + h.level(this, ga).toLowerCase() + "). <b>" + N.b + "</b> : " + gb + " sur 100 (" + h.level(this, gb).toLowerCase() + ").</p>" +
        "<p>Ces chiffres résument vos réponses, rien de plus : un score élevé ne suffit pas à parler d'autisme, et un score bas ne l'exclut pas.</p>"
    }];
  }
});
