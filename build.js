/* Assemble le site en une seule page autonome (styles et scripts intégrés).
   Usage : node build.js  ->  artifact/entre-nous.html */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const html = read("index.html");
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

const out = [
  "<title>Entre Nous</title>",
  '<meta name="claude:viewport-fit-sides" content="cover">',
  fonts,
  "<style>\n" + read("assets/styles.css") + "</style>",
  '<div id="app"></div>',
  ...scripts.map((s) => "<script>\n" + read(s).replace(/<\/script/g, "<\\/script") + "</script>")
].join("\n");

fs.mkdirSync(path.join(root, "artifact"), { recursive: true });
fs.writeFileSync(path.join(root, "artifact/entre-nous.html"), out + "\n");
console.log("artifact/entre-nous.html : " + (out.length / 1024).toFixed(1) + " Ko, " + scripts.length + " scripts");
