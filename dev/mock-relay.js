/* Faux relais pour les essais : imite la partie de ntfy.sh dont le site se sert
   (dépôt d'un message, lecture en une fois, flux SSE), avec ses limites, et permet
   de simuler des pannes. Aucune dépendance.

   Usage : node dev/mock-relay.js [port]        (4199 par défaut)

   Routes imitées :
     POST /<salon>                         dépose un message (4 096 octets au plus)
     GET  /<salon>/json?poll=1&since=all   renvoie les messages en mémoire, un JSON par ligne
     GET  /<salon>/sse?since=all|<id>      flux SSE : open, puis les messages, puis keepalive
   Pilotage des essais :
     GET  /__ctl?fail=3&status=429   les 3 prochaines requêtes (hors /__ctl) échouent avec ce code
     GET  /__ctl?drop=1              coupe tous les flux SSE ouverts (comme une perte de réseau)
     GET  /__ctl?down=1 | down=0     coupe le relais (connexions refusées) / le rétablit
     GET  /__ctl?delay=400           retarde chaque réponse de 400 ms
     GET  /__ctl?keepalive=1000      intervalle des keepalive SSE, en ms (45 000 par défaut)
     GET  /__ctl?reset=1             oublie tout (messages, pannes, compteurs)
     GET  /__ctl                     renvoie l'état : compteurs et nombre de messages par salon */
const http = require("http");

const MAX_BYTES = 4096;

function createRelay() {
  let topics = new Map(); /* salon -> { msgs: [], subs: Set } */
  const ctl = { fail: 0, status: 429, down: false, delay: 0, keepalive: 45000 };
  let count = { post: 0, poll: 0, sse: 0, rejected: 0 };
  let n = 0;

  const topic = (name) => {
    if (!topics.has(name)) topics.set(name, { msgs: [], subs: new Set() });
    return topics.get(name);
  };
  const newId = () => (++n).toString(36).padStart(4, "0") + Math.random().toString(36).slice(2, 10);
  const now = () => Math.floor(Date.now() / 1000);
  const cors = (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
  };
  const json = (res, code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj) + "\n");
  };
  const since = (t, s) => {
    if (!s || s === "none") return [];
    if (s === "all") return t.msgs.slice();
    const i = t.msgs.findIndex((m) => m.id === s);
    return i < 0 ? t.msgs.slice() : t.msgs.slice(i + 1);
  };
  const state = () => {
    const per = {};
    topics.forEach((t, k) => { per[k] = { messages: t.msgs.length, subscribers: t.subs.size }; });
    return { ctl: Object.assign({}, ctl), count: Object.assign({}, count), topics: per };
  };
  const dropAll = () => {
    topics.forEach((t) => { t.subs.forEach((s) => { clearInterval(s.timer); s.res.destroy(); }); t.subs.clear(); });
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://relay");
    const parts = url.pathname.split("/").filter(Boolean);
    cors(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (parts[0] === "__ctl") {
      const q = url.searchParams;
      if (q.has("reset")) { dropAll(); topics = new Map(); count = { post: 0, poll: 0, sse: 0, rejected: 0 }; Object.assign(ctl, { fail: 0, status: 429, down: false, delay: 0, keepalive: 45000 }); }
      if (q.has("fail")) ctl.fail = parseInt(q.get("fail"), 10) || 0;
      if (q.has("status")) ctl.status = parseInt(q.get("status"), 10) || 429;
      if (q.has("down")) { ctl.down = q.get("down") === "1"; if (ctl.down) dropAll(); }
      if (q.has("delay")) ctl.delay = parseInt(q.get("delay"), 10) || 0;
      if (q.has("keepalive")) ctl.keepalive = parseInt(q.get("keepalive"), 10) || 45000;
      if (q.has("drop")) dropAll();
      return json(res, 200, state());
    }

    if (ctl.down) { req.socket.destroy(); return; }

    const go = () => {
      if (ctl.fail > 0) {
        ctl.fail--;
        count.rejected++;
        return json(res, ctl.status, { code: ctl.status * 100, http: ctl.status, error: "mock: requête refusée" });
      }
      if (!parts.length) return json(res, 404, { error: "mock: salon manquant" });
      const t = topic(parts[0]);

      if ((req.method === "POST" || req.method === "PUT") && parts.length === 1) {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const body = Buffer.concat(chunks);
          count.post++;
          if (body.length > MAX_BYTES) {
            count.rejected++;
            return json(res, 413, { http: 413, error: "mock: message de " + body.length + " octets (4096 au plus ; le vrai relais en ferait une pièce jointe illisible)" });
          }
          const m = { id: newId(), time: now(), expires: now() + 43200, event: "message", topic: parts[0], message: body.toString("utf8") };
          t.msgs.push(m);
          t.subs.forEach((s) => s.res.write("data: " + JSON.stringify(m) + "\n\n"));
          json(res, 200, m);
        });
        return;
      }

      if (req.method === "GET" && parts[1] === "json" && url.searchParams.get("poll") === "1") {
        count.poll++;
        res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(since(t, url.searchParams.get("since")).map((m) => JSON.stringify(m) + "\n").join(""));
        return;
      }

      if (req.method === "GET" && parts[1] === "sse") {
        count.sse++;
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
        const ev = (event) => JSON.stringify({ id: newId(), time: now(), event, topic: parts[0] });
        res.write("event: open\ndata: " + ev("open") + "\n\n");
        since(t, url.searchParams.get("since")).forEach((m) => res.write("data: " + JSON.stringify(m) + "\n\n"));
        const sub = { res, timer: setInterval(() => res.write("event: keepalive\ndata: " + ev("keepalive") + "\n\n"), ctl.keepalive) };
        t.subs.add(sub);
        req.on("close", () => { clearInterval(sub.timer); t.subs.delete(sub); });
        return;
      }

      json(res, 404, { error: "mock: route inconnue " + req.method + " " + url.pathname });
    };
    if (ctl.delay) setTimeout(go, ctl.delay); else go();
  });

  return { server, state, ctl };
}

module.exports = { createRelay };

if (require.main === module) {
  const port = parseInt(process.argv[2], 10) || 4199;
  createRelay().server.listen(port, () => console.log("Faux relais sur http://localhost:" + port + "/"));
}
