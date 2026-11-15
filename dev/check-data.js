/* Vérifie le contenu des jeux (jeux/<id>.data.js) : forme, quantités, longueurs,
   gabarits autorisés, doublons. Usage : node dev/check-data.js [match|onde|cartes|dessin|debat] */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const err = (m) => errors.push(m);

function load(id) {
  const file = path.join(ROOT, "jeux", id + ".data.js");
  if (!fs.existsSync(file)) { err(id + " : fichier jeux/" + id + ".data.js introuvable"); return null; }
  const box = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(file, "utf8"), box, { filename: file }); }
  catch (e) { err(id + " : erreur de syntaxe : " + e.message); return null; }
  const d = box.window.GAME_DATA && box.window.GAME_DATA[id];
  if (!d) err(id + " : le fichier doit définir window.GAME_DATA." + id);
  return d || null;
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9{} ]+/g, " ").replace(/\s+/g, " ").trim();

/* Un texte : chaîne, longueur bornée, gabarits permis seulement, typographie de base. */
function text(where, s, min, max, allowed, o) {
  o = o || {};
  if (typeof s !== "string") return err(where + " : texte attendu");
  if (s !== s.trim()) err(where + " : espaces en trop au début ou à la fin : « " + s + " »");
  if (s.length < min || s.length > max) err(where + " : " + s.length + " caractères (entre " + min + " et " + max + " attendus) : « " + s + " »");
  (s.match(/\{[^}]*\}/g) || []).forEach((p) => { if (allowed.indexOf(p) < 0) err(where + " : gabarit " + p + " non permis ici : « " + s + " »"); });
  if (/[{}]/.test(s.replace(/\{\w+\}/g, ""))) err(where + " : accolade isolée : « " + s + " »");
  if (/(de|que) \{(p|o|a|b)\}/i.test(s)) err(where + " : écris {de_x} ou {que_x} pour gérer l'élision : « " + s + " »");
  if (/[’‘]/.test(s)) err(where + " : apostrophe courbe, utilise ' : « " + s + " »");
  if (/"/.test(s)) err(where + " : guillemets droits, utilise « » : « " + s + " »");
  if (/\s[,.]/.test(s) || /  /.test(s)) err(where + " : espace mal placée : « " + s + " »");
  if (/[!?]{2,}|\.\.\.|[\u{1F300}-\u{1FAFF}☀-➿]/u.test(s)) err(where + " : ponctuation en rafale, points de suspension ASCII ou emoji : « " + s + " »");
  if (o.noEnd && /[.!?:;,]$/.test(s)) err(where + " : pas de ponctuation finale : « " + s + " »");
  if (o.end && !/[.!?…»]$/.test(s)) err(where + " : ponctuation finale attendue : « " + s + " »");
}

function dupes(where, list) {
  const seen = new Map();
  list.forEach((s, i) => {
    if (typeof s !== "string") return;
    const k = norm(s);
    if (seen.has(k)) err(where + " : doublon entre le n° " + (seen.get(k) + 1) + " et le n° " + (i + 1) + " : « " + s + " »");
    else seen.set(k, i);
  });
}

function group(where, g, ids) {
  if (!g || typeof g !== "object") { err(where + " : objet attendu"); return false; }
  if (ids.indexOf(g.id) < 0) err(where + " : id « " + g.id + " » inattendu (attendus : " + ids.join(", ") + ")");
  text(where + ".name", g.name, 3, 28, [], { noEnd: true });
  text(where + ".hint", g.hint, 15, 90, [], { end: true });
  if ("adult" in g && typeof g.adult !== "boolean") err(where + ".adult : booléen attendu");
  return true;
}

function ids(where, list, expected) {
  const got = (list || []).map((g) => g && g.id);
  if (!Array.isArray(list) || got.join() !== expected.join()) err(where + " : attendus dans cet ordre : " + expected.join(", ") + " (reçu : " + got.join(", ") + ")");
}

const CHECKS = {
  match(d) {
    const want = ["sorties", "maison", "voyages", "fous", "table", "couette"];
    ids("match.decks", d.decks, want);
    const all = [];
    (d.decks || []).forEach((k, i) => {
      const w = "match.decks[" + i + "]";
      if (!group(w, k, want)) return;
      if (!Array.isArray(k.items) || k.items.length !== 36) err(w + " : 36 envies attendues (" + (k.items || []).length + ")");
      (k.items || []).forEach((s, j) => { text(w + ".items[" + j + "]", s, 12, 80, [], { noEnd: true }); all.push(s); });
      if ((k.id === "couette") !== (k.adult === true)) err(w + " : seul le paquet « couette » porte adult: true");
    });
    dupes("match", all);
    return (d.decks || []).map((k) => k.id + " " + (k.items || []).length).join(", ");
  },
  onde(d) {
    const want = ["classique", "nous", "absurde"], size = { classique: 70, nous: 50, absurde: 40 };
    ids("onde.packs", d.packs, want);
    const all = [];
    (d.packs || []).forEach((k, i) => {
      const w = "onde.packs[" + i + "]";
      if (!group(w, k, want)) return;
      if (!Array.isArray(k.themes) || k.themes.length !== size[k.id]) err(w + " : " + size[k.id] + " thèmes attendus (" + (k.themes || []).length + ")");
      (k.themes || []).forEach((s, j) => { text(w + ".themes[" + j + "]", s, 6, 60, k.id === "nous" ? ["{a}", "{b}", "{de_a}", "{de_b}"] : [], { noEnd: true }); all.push(s); });
    });
    dupes("onde", all);
    return (d.packs || []).map((k) => k.id + " " + (k.themes || []).length).join(", ");
  },
  cartes(d) {
    const want = ["leger", "profond", "coquin"];
    const quota = { leger: { q: [30, 60], d: [12, 60], 2: [8, 60] }, profond: { q: [40, 60], d: [0, 6], 2: [10, 60] }, coquin: { q: [24, 60], d: [14, 60], 2: [10, 60] } };
    ids("cartes.decks", d.decks, want);
    const all = [];
    (d.decks || []).forEach((k, i) => {
      const w = "cartes.decks[" + i + "]";
      if (!group(w, k, want)) return;
      if (!Array.isArray(k.cards) || k.cards.length !== 60) err(w + " : 60 cartes attendues (" + (k.cards || []).length + ")");
      const n = { q: 0, d: 0, 2: 0 };
      (k.cards || []).forEach((c, j) => {
        const cw = w + ".cards[" + j + "]";
        if (!c || ["q", "d", "2"].indexOf(c.t) < 0) return err(cw + " : t doit valoir \"q\", \"d\" ou \"2\"");
        n[c.t]++;
        text(cw + ".x", c.x, 20, 170, c.t === "2" ? [] : ["{o}", "{de_o}", "{que_o}"], { end: true });
        all.push(c.x);
      });
      const qt = quota[k.id];
      if (qt) Object.keys(qt).forEach((t) => { if (n[t] < qt[t][0] || n[t] > qt[t][1]) err(w + " : " + n[t] + " cartes de type " + t + " (entre " + qt[t][0] + " et " + qt[t][1] + " attendues)"); });
      if ((k.id === "coquin") !== (k.adult === true)) err(w + " : seul le paquet « coquin » porte adult: true");
    });
    dupes("cartes", all);
    return (d.decks || []).map((k) => k.id + " " + (k.cards || []).length).join(", ");
  },
  dessin(d) {
    const cats = ["portrait", "souvenir", "futur", "delire"], n = {};
    if (!Array.isArray(d.prompts) || d.prompts.length !== 80) err("dessin.prompts : 80 sujets attendus (" + (d.prompts || []).length + ")");
    (d.prompts || []).forEach((p, j) => {
      const w = "dessin.prompts[" + j + "]";
      if (!p || cats.indexOf(p.c) < 0) return err(w + " : c doit valoir " + cats.join(", "));
      n[p.c] = (n[p.c] || 0) + 1;
      text(w + ".x", p.x, 8, 70, ["{o}", "{de_o}"], { noEnd: true });
    });
    cats.forEach((c) => { if (n[c] !== 20) err("dessin : 20 sujets attendus dans la catégorie " + c + " (" + (n[c] || 0) + ")"); });
    dupes("dessin", (d.prompts || []).map((p) => p && p.x));
    return (d.prompts || []).length + " sujets";
  },
  debat(d) {
    if (!Array.isArray(d.topics) || d.topics.length !== 100) err("debat.topics : 100 sujets attendus (" + (d.topics || []).length + ")");
    (d.topics || []).forEach((s, j) => text("debat.topics[" + j + "]", s, 20, 100, [], { noEnd: true }));
    dupes("debat", d.topics || []);
    return (d.topics || []).length + " sujets";
  }
};

const todo = process.argv[2] ? [process.argv[2]] : Object.keys(CHECKS);
todo.forEach((id) => {
  if (!CHECKS[id]) return err("jeu inconnu : " + id);
  const d = load(id);
  if (d) console.log(id + " : " + CHECKS[id](d));
});
if (errors.length) {
  console.log("\n" + errors.length + " problème(s) :\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log("Contenu valide.");
