/* Captures d'écran du jeu « Le mot interdit » pour contrôle visuel : une partie à deux téléphones en
   clair et en sombre, puis, sur un seul téléphone, le passage de l'appareil, et les petits écrans.
   Usage : EN_PW=… node dev/e2e/shots-interdit.js   ->  dev/e2e/shots/interdit-*.png */
const path = require("path");
const { setup, sleep, ROOT } = require("./lib");

const KEY = "en:g:interdit";
const DATA = path.join(ROOT, "jeux", "interdit.data.js"), GAME = path.join(ROOT, "jeux", "interdit.js");
function style() {
  document.addEventListener("DOMContentLoaded", () => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "jeux/interdit.css";
    document.head.appendChild(l);
  });
}
async function phone(env, name, o) {
  const p = await env.phone(name, o);
  await p.ctx.addInitScript({ path: DATA });
  await p.ctx.addInitScript({ path: GAME });
  await p.ctx.addInitScript(style);
  return p;
}
const on = (p, name) => p.page.waitForFunction((n) => { const el = document.querySelector(".interdit"); return el && el.getAttribute("data-screen") === n; }, name, { timeout: 8000 });
async function tap(p, act) {
  await p.page.waitForSelector('.interdit [data-act="' + act + '"]');
  await sleep(700);
  await p.page.click('.interdit [data-act="' + act + '"]');
}
/* Il reste `left` secondes au tour en cours sur ce téléphone. */
async function jump(p, left, dur) {
  const loaded = p.page.waitForEvent("load");
  await p.page.evaluate((o) => {
    const s = JSON.parse(localStorage.getItem(o.key));
    s.local.t.at = Date.now() - (o.dur - o.left) * 1000;
    localStorage.setItem(o.key, JSON.stringify(s));
    location.reload();
  }, { key: KEY, left, dur: dur || 60 }).catch(() => {});
  await loaded;
  await p.page.waitForSelector(".interdit");
}
async function solo(p, env) {
  await p.page.goto(env.base + "#jeu-interdit");
  await p.page.fill("#name-a", "Alex");
  await p.page.fill("#name-b", "Inès");
  await p.page.click('[data-act="g-start"][data-mode="solo"]');
  await on(p, "passe-0");
}

(async () => {
  const env = await setup({ net: true });
  for (const dark of [false, true]) {
    const tag = dark ? "sombre" : "clair";
    const a = await phone(env, "a-" + tag, { dark }), b = await phone(env, "b-" + tag, { dark });
    await a.page.goto(env.base + "#jeu-interdit");
    await a.page.fill("#name-a", "Alex");
    await a.page.fill("#name-b", "Inès");
    await sleep(500);
    await a.shot("interdit-01-presentation-" + tag);
    await a.page.click('[data-act="g-start"][data-mode="duo"]');
    const link = await a.page.locator(".share[data-url]").getAttribute("data-url");
    await b.page.goto(link);
    await b.page.click('[data-act="g-join"]');
    await on(a, "pret-0");
    await on(b, "pret-0");
    await sleep(400);
    await a.shot("interdit-02-pret-fait-deviner-" + tag);
    await b.shot("interdit-03-pret-devine-" + tag);
    await tap(a, "go");
    await on(b, "devine-0");
    await sleep(500);
    await a.shot("interdit-04-carte-" + tag);
    await b.shot("interdit-05-chrono-" + tag);
    await tap(a, "ok");
    await tap(a, "ok");
    await tap(a, "pass");
    await jump(a, 25);
    await b.page.waitForFunction(() => /mi-temps/.test(document.getElementById("app").innerText), null, { timeout: 8000 });
    await sleep(300);
    await a.shot("interdit-06-carte-mi-temps-" + tag);
    await b.shot("interdit-07-chrono-mi-temps-" + tag);
    await jump(b, -9);
    await sleep(300);
    await b.shot("interdit-08-bilan-absent-" + tag);
    await jump(a, 0.5);
    await on(b, "pret-1");
    await sleep(1000);
    await b.shot("interdit-09-bilan-a-toi-" + tag);
    await a.shot("interdit-10-bilan-attente-" + tag);
    for (let t = 1; t < 6; t++) {
      const s = t % 2 ? b : a, o = s === a ? b : a;
      await tap(s, "go");
      await on(s, "jeu-" + t);
      for (let i = 0; i < t % 3 + 1; i++) await tap(s, i === 1 ? "pass" : "ok");
      await jump(s, 0.5);
      await on(o, t < 5 ? "pret-" + (t + 1) : "fin");
    }
    await on(b, "fin");
    await sleep(1000);
    await b.shot("interdit-11-resultat-" + tag);
  }

  const one = await phone(env, "seul");
  await solo(one, env);
  await one.shot("interdit-12-seul-passe");
  await tap(one, "moi");
  await on(one, "pret-0");
  await one.shot("interdit-13-seul-pret");

  for (const [w, h] of [[390, 844], [320, 568]]) {
    for (const dark of [false, true]) {
      const tag = w + "x" + h + "-" + (dark ? "sombre" : "clair");
      const p = await phone(env, "petit-" + tag, { viewport: { width: w, height: h }, fullPage: false, dark });
      await solo(p, env);
      await tap(p, "moi");
      await tap(p, "go");
      await on(p, "jeu-0");
      await sleep(400);
      await p.shot("interdit-14-carte-" + tag);
      await tap(p, "ok");
      await jump(p, 0.5);
      await on(p, "passe-1");
      await sleep(1000);
      await p.shot("interdit-15-passe-" + tag);
    }
  }
  await env.close();
})().catch((e) => { console.error(e); process.exit(1); });
