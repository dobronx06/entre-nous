/* Styles d'attachement : deux curseurs (besoin d'être rassuré, besoin de distance),
   8 phrases chacun. r: true = phrase inversée. */
(function () {
  var STYLES = {
    secure: { name: "sécure", txt: "À l'aise avec la proximité comme avec l'autonomie, sans inquiétude excessive pour la relation." },
    anxieux: { name: "anxieux", txt: "Un fort besoin de signes que tout va bien, et du mal à supporter le silence ou la distance." },
    evitant: { name: "évitant", txt: "Un grand besoin d'autonomie, des émotions gardées pour soi, et une gêne quand la relation devient très proche." },
    craintif: { name: "craintif", txt: "Une envie de proximité mêlée de crainte, avec des allers-retours entre rapprochement et retrait." }
  };
  var DUOS = {
    "secure+secure": "Deux styles sécures : la base la plus confortable. Vos désaccords portent sur des sujets, pas sur le lien lui-même.",
    "anxieux+secure": "Un duo qui fonctionne bien quand la personne sécure rassure sans s'agacer, et que la personne anxieuse dit son besoin au lieu de tester l'autre.",
    "evitant+secure": "La personne sécure peut laisser de l'espace sans le vivre comme un rejet. En échange, la personne évitante a tout à gagner à dire ce qu'elle ressent, même en peu de mots.",
    "craintif+secure": "La stabilité de l'un aide l'autre à faire confiance. Cela demande de la constance : mêmes réactions, mêmes repères, jour après jour.",
    "anxieux+anxieux": "Deux inquiétudes qui peuvent s'emballer l'une l'autre. Quand la tension monte, faites une pause et dites chacun ce dont vous avez besoin, plutôt que ce que l'autre a mal fait.",
    "anxieux+evitant": "Le duo le plus classique : l'un poursuit, l'autre s'éloigne, et chacun renforce la réaction de l'autre. Pour en sortir, la personne évitante annonce quand elle reviendra, et la personne anxieuse laisse ce délai sans relancer.",
    "anxieux+craintif": "Beaucoup d'intensité et d'inquiétude des deux côtés. Mettez-vous d'accord, au calme, sur les gestes qui rassurent chacun.",
    "evitant+evitant": "Peu de conflits, mais le risque de vivre en parallèle. Créez des rendez-vous réguliers où chacun parle de soi, même brièvement.",
    "craintif+evitant": "Chacun protège sa distance, pour des raisons différentes. Avancez par petites confidences, à un rythme qui convient aux deux.",
    "craintif+craintif": "Vous avez tous les deux envie de proximité et peur d'être blessés. Aller lentement et tenir ses promesses compte plus que les grands gestes."
  };
  function style(p) {
    var x = p.anxiete >= 50, y = p.evitement >= 50;
    return x && y ? "craintif" : x ? "anxieux" : y ? "evitant" : "secure";
  }

  (window.TESTS = window.TESTS || []).push({
    id: "attachement",
    v: 1,
    group: "liens",
    kind: "profil",
    title: "Styles d'attachement",
    hook: "Comment on s'attache l'un à l'autre ?",
    blurb: "Besoin d'être rassuré, besoin d'espace : deux curseurs qui expliquent beaucoup de malentendus. Le rapport situe chacun et décrit votre duo.",
    minutes: 4,
    simLabel: "de ressemblance",
    lead: "Es-tu d'accord ?",
    scale: ["Pas du tout d'accord", "Plutôt pas d'accord", "Entre les deux", "Plutôt d'accord", "Tout à fait d'accord"],
    levels: ["Faible", "Moyen", "Élevé"],
    quad: {
      x: "anxiete", y: "evitement",
      xl: "Besoin d'être rassuré", yl: "Besoin de distance",
      ll: "Sécure", lr: "Anxieux", ul: "Évitant", ur: "Craintif"
    },
    intro: [
      "Seize phrases sur ta façon de vivre les relations amoureuses. Réponds en pensant à ce que tu ressens le plus souvent, pas à ce que tu aimerais ressentir.",
      "La théorie de l'attachement décrit deux tendances : s'inquiéter pour le lien, et se protéger de la proximité. Le rapport situe chacun sur ces deux axes."
    ],
    note: "Un style d'attachement n'est ni un diagnostic ni une étiquette définitive : il évolue avec les expériences et avec la relation.",
    dims: [
      {
        id: "anxiete", name: "Besoin d'être rassuré", short: "Inquiétude",
        desc: "La crainte de perdre l'autre ou de compter moins pour lui.",
        gap: "{hi} s'inquiète plus vite pour la relation. Des signes simples {de_lo} (un message, un « tout va bien entre nous ») désamorcent beaucoup de choses.",
        both: "Vous vous inquiétez tous les deux facilement pour la relation : rassurez-vous à voix haute, souvent, sans attendre que l'autre le demande.",
        none: "Vous êtes tous les deux sereins sur la solidité du lien."
      },
      {
        id: "evitement", name: "Besoin de distance", short: "Distance",
        desc: "L'inconfort face à la dépendance et aux émotions partagées.",
        gap: "{hi} a besoin de plus d'espace et se confie moins. Ce n'est pas un rejet : {lo} peut proposer un moment précis pour parler plutôt que d'insister à chaud.",
        both: "Vous gardez tous les deux vos émotions pour vous, au risque de vivre côte à côte. Fixez-vous un moment régulier pour parler de vous.",
        none: "La proximité vous est facile à tous les deux."
      }
    ],
    questions: [
      { d: "anxiete", q: "Quand l'autre met du temps à répondre à un message, j'imagine vite le pire." },
      { d: "evitement", q: "Je préfère régler mes problèmes de mon côté plutôt que d'en parler." },
      { d: "anxiete", q: "J'ai besoin qu'on me répète qu'on m'aime." },
      { d: "evitement", q: "Quand la relation devient très fusionnelle, j'ai besoin de prendre du recul." },
      { d: "anxiete", q: "J'ai peur que l'autre finisse par se lasser de moi." },
      { d: "evitement", q: "Montrer mes émotions me met mal à l'aise." },
      { d: "anxiete", q: "Après une dispute, je ne suis pas tranquille tant que tout n'est pas réglé." },
      { d: "evitement", q: "Dépendre de quelqu'un m'inquiète." },
      { d: "anxiete", q: "Je m'inquiète de tenir à l'autre plus que l'autre ne tient à moi." },
      { d: "evitement", q: "Quand l'autre va mal, je ne sais pas trop comment réconforter." },
      { d: "anxiete", q: "Quand l'autre a besoin d'espace, je le vis comme un rejet." },
      { d: "evitement", q: "Je garde une partie de ma vie rien que pour moi." },
      { d: "anxiete", q: "Je guette les petits signes qui montreraient que quelque chose ne va pas entre nous." },
      { d: "evitement", q: "Les grandes déclarations me gênent plus qu'elles ne me touchent." },
      { d: "anxiete", r: true, q: "Passer quelques jours loin l'un de l'autre ne m'inquiète pas." },
      { d: "evitement", r: true, q: "Demander de l'aide à mon ou ma partenaire m'est facile." }
    ],
    summary: function (pa, pb, N) {
      var sa = style(pa), sb = style(pb);
      var duo = DUOS[[sa, sb].sort().join("+")];
      return [
        {
          title: "Vos deux styles",
          html: "<p><b>" + N.a + "</b> : style <b>" + STYLES[sa].name + "</b>. " + STYLES[sa].txt + "</p>" +
            "<p><b>" + N.b + "</b> : style <b>" + STYLES[sb].name + "</b>. " + STYLES[sb].txt + "</p>"
        },
        { title: "Votre duo", html: "<p>" + duo + "</p>" }
      ];
    }
  });
})();
