/* Halcyon OS · edición móvil (PWA).
   Same data (realm_data.json), same generator (core.js) and same trigger rules as the desktop prototype. */
(function () {
"use strict";

var D = null;
var SAVE_KEY = "halcyon_os_mobile_v1";
var INSTALL_KEY = "halcyon_install_dismissed";
var OPENED_AT = Date.now();
var $ = function (s, r) { return (r || document).querySelector(s); };
function h(tag, attrs, kids) {
  var el = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    if (k === "class") el.className = attrs[k];
    else if (k === "text") el.textContent = attrs[k];
    else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
    else el.setAttribute(k, attrs[k]);
  }
  (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return el;
}
function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function now() { return Date.now(); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ======================= INSTALL (PWA) =======================
   Android Chrome fires `beforeinstallprompt` when the app is installable.
   We keep it and, once the page has been open 10 s, show our own banner.
   The native dialog can only open from a tap, so the banner has an Instalar button. */
var deferredPrompt = null, installTimerDone = false;
function isStandalone() {
  return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}
function dismissedRecently() {
  var t = +lsGet(INSTALL_KEY) || 0;
  return now() - t < 3 * 24 * 3600 * 1000; // 3 days
}
var ua = navigator.userAgent || "";
var isAndroid = /Android/i.test(ua), isIOS = /iPhone|iPad|iPod/i.test(ua);
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  deferredPrompt = e;
  if (installTimerDone) offerInstall(); // arrived after the 10 s: show now
  refreshInstallUI();
});
window.addEventListener("appinstalled", function () {
  deferredPrompt = null; hideInstall(); lsSet(INSTALL_KEY, String(now() + 3650 * 864e5));
  toast("Instalada", "Halcyon OS ya está en tu pantalla de inicio.");
});
setTimeout(function () { installTimerDone = true; offerInstall(); }, Math.max(0, 10000 - (now() - OPENED_AT)));

function offerInstall(force) {
  if (isStandalone()) return;
  if (!force && dismissedRecently()) return;
  var text = $("#installText"), yes = $("#installYes");
  if (deferredPrompt) {
    text.textContent = "Tenla en tu pantalla de inicio, a pantalla completa y sin barra del navegador.";
    yes.textContent = "Instalar"; yes.dataset.mode = "native";
  } else if (isIOS) {
    text.textContent = "Pulsa el botón Compartir y luego «Añadir a pantalla de inicio».";
    yes.textContent = "Entendido"; yes.dataset.mode = "manual";
  } else if (isAndroid) {
    text.textContent = "Abre el menú ⋮ del navegador y pulsa «Instalar aplicación» o «Añadir a pantalla de inicio».";
    yes.textContent = "Entendido"; yes.dataset.mode = "manual";
  } else if (!force) {
    return; // desktop without native prompt: stay quiet
  } else {
    text.textContent = "Usa el icono de instalar de la barra de direcciones de tu navegador.";
    yes.textContent = "Entendido"; yes.dataset.mode = "manual";
  }
  $("#install").hidden = false;
}
function hideInstall() { $("#install").hidden = true; }
$("#installYes").addEventListener("click", function () {
  if (this.dataset.mode === "native" && deferredPrompt) {
    var p = deferredPrompt; deferredPrompt = null;
    p.prompt();
    p.userChoice.then(function (r) {
      hideInstall();
      if (r.outcome !== "accepted") lsSet(INSTALL_KEY, String(now()));
      refreshInstallUI();
    }).catch(hideInstall);
  } else { hideInstall(); lsSet(INSTALL_KEY, String(now())); }
});
$("#installNo").addEventListener("click", function () { hideInstall(); lsSet(INSTALL_KEY, String(now())); });
function refreshInstallUI() { if (current() && current().app === "config") render(); }

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}

/* ======================= STATE ======================= */
var S;
function freshState() {
  var s = { handle: "Kai", wallpaper: "anillos", volume: 0.5, vibrate: true, words: [], newWords: [], servers: [], threads: [], news: [],
    mails: [], readThreads: [], readNews: [], fired: [], visited: [], pending: [], gate: { server: "delta", a: null, b: null, c: null } };
  [D.wordsA, D.wordsB, D.wordsC].forEach(function (l) { l.forEach(function (w) { if (w.startUnlocked) s.words.push(w.id); }); });
  D.servers.forEach(function (x) { if (x.startUnlocked) s.servers.push(x.id); });
  D.threads.forEach(function (x) { if (x.startVisible) s.threads.push(x.id); });
  D.news.forEach(function (x) { if (x.startVisible) s.news.push(x.id); });
  return s;
}
function save() { lsSet(SAVE_KEY, JSON.stringify(S)); }

/* ======================= TRIGGERS ======================= */
function fire(ev) {
  D.triggers.forEach(function (t) {
    if (t.on !== ev || S.fired.indexOf(t.id) !== -1) return;
    S.fired.push(t.id);
    t.actions.forEach(function (a) {
      if (a.delay > 0) S.pending.push({ a: a, due: now() + a.delay * 1000 });
      else apply(a);
    });
  });
  save();
}
function apply(a) {
  if (a.type === "sendMail") {
    if (S.mails.some(function (m) { return m.id === a.id; })) return;
    S.mails.push({ id: a.id, at: now(), read: false });
    var m = byId(D.mails, a.id);
    toast("Correo nuevo", m.from ? m.from + ": " + m.subject : "Remitente desconocido", !m.from, function () { go({ app: "mail", id: a.id }); });
    if (!m.from) glitch(900);
  } else if (a.type === "unlockWord") {
    if (S.words.indexOf(a.id) !== -1) return;
    S.words.push(a.id); S.newWords.push(a.id);
    var w = byId(D.wordsA, a.id) || byId(D.wordsB, a.id) || byId(D.wordsC, a.id);
    toast("Palabra clave obtenida", w.text, false, function () { go({ app: "gate" }); });
  } else if (a.type === "unlockThread") {
    if (S.threads.indexOf(a.id) !== -1) return;
    S.threads.push(a.id); toast("Foro", "Hilo nuevo: " + byId(D.threads, a.id).title, false, function () { go({ app: "bbs", id: a.id }); });
  } else if (a.type === "unlockNews") {
    if (S.news.indexOf(a.id) !== -1) return;
    S.news.push(a.id); toast("Noticias", byId(D.news, a.id).title, false, function () { go({ app: "news", id: a.id }); });
  } else if (a.type === "unlockServer") {
    if (S.servers.indexOf(a.id) !== -1) return;
    S.servers.push(a.id); var sv = byId(D.servers, a.id);
    toast("Servidor disponible", sv.symbol + " " + sv.name);
  }
  save(); refresh();
}
function tick(force) {
  if (!S) return;
  var t = now(), due = [], keep = [];
  S.pending.forEach(function (p) { (force || p.due <= t ? due : keep).push(p); });
  if (!due.length) return;
  S.pending = keep;
  due.sort(function (x, y) { return x.due - y.due; }).forEach(function (p) { apply(p.a); });
  save();
}

/* ======================= TOASTS / GLITCH ======================= */
function toast(title, text, bad, onTap) {
  var el = h("div", { class: "toast" + (bad ? " bad" : ""), role: onTap ? "button" : null }, [h("b", { text: title }), text]);
  if (!onTap) el.removeAttribute("role");
  if (onTap) el.addEventListener("click", function () { el.remove(); onTap(); });
  var box = $("#toasts"); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(function () { el.remove(); }, 5200);
  if (S && S.vibrate && navigator.vibrate) { try { navigator.vibrate(bad ? [60, 40, 60, 40, 120] : 25); } catch (e) {} }
  ping(bad);
}
function glitch(ms) {
  var c = $("#glitch"); c.hidden = false; document.body.classList.add("glitching");
  var x = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
  var end = now() + ms;
  (function frame() {
    x.clearRect(0, 0, c.width, c.height);
    if (!reduced) for (var i = 0; i < 22; i++) {
      x.fillStyle = Math.random() < .5 ? "rgba(194,51,74,.55)" : (Math.random() < .5 ? "rgba(0,0,0,.8)" : "rgba(191,227,255,.35)");
      x.fillRect(Math.random() * c.width, Math.random() * c.height, Math.random() * 200, 2 + Math.random() * 20);
    } else { x.fillStyle = "rgba(194,51,74,.18)"; x.fillRect(0, 0, c.width, c.height); }
    if (now() < end) requestAnimationFrame(frame);
    else { x.clearRect(0, 0, c.width, c.height); c.hidden = true; document.body.classList.remove("glitching"); }
  })();
}
function garble(s, rate) {
  var g = "▓▒░█#?/\\_01";
  return s.split("").map(function (ch) { return ch !== " " && Math.random() < rate ? g[Math.floor(Math.random() * g.length)] : ch; }).join("");
}

/* ======================= AUDIO (procedural) ======================= */
var AC = null, master = null, analyser = null, playing = null;
var TRACKS = [
  { id: "t1", name: "Vella Mar al anochecer", note: "Ciudad raíz Δ", root: 57, chord: [0, 7, 12, 16], bell: [0, 4, 7, 11, 14], tempo: 2600 },
  { id: "t2", name: "Campo abierto", note: "Pradera y bosque", root: 55, chord: [0, 7, 14, 19], bell: [0, 2, 7, 9, 14], tempo: 1900 },
  { id: "t3", name: "Mazmorra", note: "Pasillos de piedra", root: 50, chord: [0, 3, 7, 10], bell: [0, 3, 6, 10], tempo: 3400 },
  { id: "t4", name: "Campanario", note: "Señal inestable", root: 49, chord: [0, 1, 6, 13], bell: [0, 1, 6, 7], tempo: 4200 }
];
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function ensureAudio() {
  if (AC) return true;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = S.volume * 0.5;
    analyser = AC.createAnalyser(); analyser.fftSize = 256;
    master.connect(analyser); analyser.connect(AC.destination);
    return true;
  } catch (e) { return false; }
}
function stopTrack() {
  if (!playing) return;
  var c = playing; playing = null;
  clearInterval(c.timer);
  c.out.gain.setTargetAtTime(0, AC.currentTime, 0.4);
  setTimeout(function () { c.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 1500);
}
function playTrack(t) {
  if (!ensureAudio()) { toast("Audio", "Este navegador no permite sonido."); return; }
  AC.resume(); stopTrack();
  var out = AC.createGain(); out.gain.value = 0; out.connect(master);
  out.gain.setTargetAtTime(1, AC.currentTime, 0.8);
  var lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 2; lp.connect(out);
  var lfo = AC.createOscillator(); lfo.frequency.value = 0.07; var lg = AC.createGain(); lg.gain.value = 500;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  var nodes = [lfo];
  t.chord.forEach(function (iv, i) {
    [-6, 6].forEach(function (det) {
      var o = AC.createOscillator(); o.type = i === 0 ? "triangle" : "sawtooth";
      o.frequency.value = mtof(t.root + iv - 12); o.detune.value = det;
      var g = AC.createGain(); g.gain.value = i === 0 ? 0.09 : 0.035;
      o.connect(g); g.connect(lp); o.start(); nodes.push(o);
    });
  });
  var timer = setInterval(function () { bell(t, out); }, t.tempo);
  playing = { id: t.id, out: out, nodes: nodes, timer: timer };
  bell(t, out);
}
function bell(t, out) {
  if (!AC) return;
  var n = t.root + 12 + t.bell[Math.floor(Math.random() * t.bell.length)] + (Math.random() < .3 ? 12 : 0);
  var o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), g2 = AC.createGain();
  o.frequency.value = mtof(n); o2.frequency.value = mtof(n) * 2.76; g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out || master);
  var tt = AC.currentTime; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.12, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 3.5);
  o.start(tt); o2.start(tt); o.stop(tt + 3.6); o2.stop(tt + 3.6);
}
function ping(bad) {
  if (!AC || AC.state !== "running") return;
  var o = AC.createOscillator(), g = AC.createGain(); o.type = bad ? "square" : "sine";
  o.frequency.value = bad ? 110 : 1320; o.connect(g); g.connect(master);
  var t = AC.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(bad ? 0.08 : 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (bad ? 0.6 : 0.4));
  o.start(t); o.stop(t + 0.7);
}
document.addEventListener("visibilitychange", function () {
  if (!AC) return;
  if (document.hidden && !playing) AC.suspend(); else if (!document.hidden) AC.resume();
});

/* ======================= WALLPAPER ======================= */
var wall = $("#wall"), wx = wall.getContext("2d"), parts = [];
for (var i = 0; i < 50; i++) parts.push({ x: Math.random(), y: Math.random(), v: 0.0002 + Math.random() * 0.0006, s: Math.random() < .2 ? 2 : 1 });
function sizeWall() { var r = Math.min(devicePixelRatio || 1, 2); wall.width = innerWidth * r; wall.height = innerHeight * r; wx.setTransform(r, 0, 0, r, 0, 0); }
addEventListener("resize", sizeWall); sizeWall();
var lastDraw = 0;
function drawWall(ts) {
  requestAnimationFrame(drawWall);
  if (document.hidden || !$("#app").hidden && !$("#boot")) return; // app covers the wallpaper
  if (ts - lastDraw < 40) return; lastDraw = ts;
  var W = innerWidth, H = innerHeight, t = ts / 1000, mode = S ? S.wallpaper : "anillos";
  var g = wx.createLinearGradient(0, 0, 0, H);
  if (mode === "cielo") { g.addColorStop(0, "#1d3f63"); g.addColorStop(.6, "#5c6f8f"); g.addColorStop(1, "#c98c62"); }
  else { g.addColorStop(0, "#0b1622"); g.addColorStop(1, "#12263a"); }
  wx.fillStyle = g; wx.fillRect(0, 0, W, H);
  var cx = W * .5, cy = H * .42, R = Math.min(W, H) * .42;
  if (mode !== "datos") {
    for (var r = 0; r < 6; r++) {
      var rad = R * (0.35 + r * 0.16), a0 = t * (0.05 + r * 0.02) * (r % 2 ? -1 : 1);
      wx.lineWidth = 1; wx.strokeStyle = "rgba(191,227,255," + (0.06 + r * 0.02) + ")";
      wx.beginPath(); wx.arc(cx, cy, rad, 0, Math.PI * 2); wx.stroke();
      wx.strokeStyle = r === 3 ? "rgba(242,169,59,.5)" : "rgba(191,227,255,.3)"; wx.lineWidth = r === 3 ? 2 : 1.5;
      for (var s2 = 0; s2 < 3; s2++) { wx.beginPath(); wx.arc(cx, cy, rad, a0 + s2 * 2.09, a0 + s2 * 2.09 + 0.5 + r * 0.06); wx.stroke(); }
    }
  } else {
    wx.font = "12px JetBrains Mono, monospace";
    for (var c = 0; c < W / 16; c++) {
      var y = ((t * (20 + (c * 37) % 60) + c * 97) % (H + 200)) - 100;
      wx.fillStyle = "rgba(127,224,168,.25)"; wx.fillText(((c * 7 + Math.floor(t * 3)) % 2).toString(), c * 16, y);
    }
  }
  parts.forEach(function (p) {
    p.y -= p.v; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
    wx.fillStyle = "rgba(191,227,255,.45)"; wx.fillRect(p.x * W, p.y * H, p.s, p.s);
  });
}
requestAnimationFrame(drawWall);

/* ======================= NAVIGATION (Android back button works) ======================= */
var stack = [];
function current() { return stack[stack.length - 1]; }
function go(route) {
  stack.push(route);
  history.pushState({ depth: stack.length }, "");
  render();
}
function back() { if (stack.length) history.back(); }
window.addEventListener("popstate", function () {
  if (connTimer) { clearInterval(connTimer); connTimer = null; }
  stack.pop(); render();
});
$("#back").addEventListener("click", back);

var APPS = {
  gate:   { title: "The Realm", label: "The Realm", hero: true },
  mail:   { title: "Correo", label: "Correo" },
  bbs:    { title: "Foro", label: "Foro" },
  news:   { title: "Noticias", label: "Noticias" },
  audio:  { title: "Reproductor", label: "Audio" },
  config: { title: "Ajustes", label: "Ajustes" },
  readme: { title: "Léeme", label: "Léeme" }
};
var ORDER = ["gate", "mail", "bbs", "news", "audio", "config", "readme"];
var SVG = {
  gate: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><circle cx="18" cy="18" r="14"/><circle cx="18" cy="18" r="8" stroke="#f2a93b"/><path d="M18 2v6M18 28v6M2 18h6M28 18h6"/></svg>',
  mail: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><rect x="4" y="8" width="28" height="20" rx="2"/><path d="M4 10l14 10 14-10"/></svg>',
  bbs: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><path d="M5 7h20v13H13l-5 4v-4H5z"/><path d="M27 13h4v12h-3v4l-5-4h-8v-3"/></svg>',
  news: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><rect x="5" y="6" width="26" height="24" rx="2"/><path d="M9 12h18M9 17h8M9 21h8M9 25h8"/><rect x="20" y="16" width="7" height="9" stroke="#f2a93b"/></svg>',
  audio: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><path d="M13 26V8l15-3v18"/><circle cx="10" cy="26" r="3.5"/><circle cx="25" cy="23" r="3.5"/></svg>',
  config: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><circle cx="18" cy="18" r="5"/><path d="M18 4v5M18 27v5M4 18h5M27 18h5M8 8l3.5 3.5M24.5 24.5L28 28M8 28l3.5-3.5M24.5 11.5L28 8"/></svg>',
  readme: '<svg viewBox="0 0 36 36" fill="none" stroke="#bfe3ff" stroke-width="1.6"><path d="M9 4h13l6 6v22H9z"/><path d="M22 4v6h6M13 16h11M13 21h11M13 26h7"/></svg>'
};

function buildGrid() {
  var g = $("#grid"); g.innerHTML = "";
  ORDER.forEach(function (id) {
    var b = h("button", { class: "icon" + (APPS[id].hero ? " hero" : ""), id: "ic-" + id, onclick: function () { go({ app: id }); } });
    b.innerHTML = '<span class="tile">' + SVG[id] + '</span><span>' + APPS[id].label + '</span>';
    if (id === "mail" || id === "bbs" || id === "news") b.appendChild(h("span", { class: "badge", id: "bd-" + id, "data-n": "0", text: "0" }));
    g.appendChild(b);
  });
}

function counts() {
  return {
    mail: S.mails.filter(function (m) { return !m.read; }).length,
    bbs: S.threads.filter(function (t) { return S.readThreads.indexOf(t) === -1; }).length,
    news: S.news.filter(function (n) { return S.readNews.indexOf(n) === -1; }).length
  };
}
function refresh() {
  if (!S) return;
  var c = counts();
  [["#mailBadge", c.mail], ["#bd-mail", c.mail], ["#bd-bbs", c.bbs], ["#bd-news", c.news]].forEach(function (p) {
    var e = $(p[0]); if (e) { e.textContent = p[1]; e.setAttribute("data-n", p[1]); }
  });
  drawWidget();
  var r = current();
  if (r && !r.view && (r.app === "mail" || r.app === "bbs" || r.app === "news" || r.app === "gate" || r.app === "config")) render(true);
}
function drawWidget() {
  var w = $("#widget"); w.innerHTML = "";
  var last = S.mails.slice().sort(function (a, b) { return b.at - a.at; })[0];
  w.appendChild(h("h3", { text: "Último correo" }));
  if (last) {
    var d = byId(D.mails, last.id);
    w.appendChild(h("button", { class: "wl", onclick: function () { go({ app: "mail", id: last.id }); } },
      [h("b", { text: (last.read ? "" : "● ") + (d.from || garble("??????", .9)) }), h("small", { text: d.subject || "—" })]));
  } else w.appendChild(h("small", { text: "Bandeja vacía", style: "color:var(--glass-mute)" }));
  w.appendChild(h("hr"));
  w.appendChild(h("h3", { text: "Última área" }));
  var v = S.visited[S.visited.length - 1];
  w.appendChild(h("div", { class: "row" }, [
    h("button", { class: "wl", onclick: function () { if (v) { var p = v.key.split("|"); S.gate = { server: p[0], a: p[1], b: p[2], c: p[3] }; save(); } go({ app: "gate" }); } },
      [h("b", { text: v ? v.name : "Ninguna todavía" }), h("small", { text: v ? "Nivel " + v.level : "Abre The Realm para conectar" })]),
    h("span", { class: "badge", "data-n": String(S.pending.length), text: S.pending.length ? "…" : "" })
  ]));
}

var connTimer = null, audioRaf = null;
function render(soft) {
  var r = current(), app = $("#app");
  if (audioRaf && (!r || r.app !== "audio")) { cancelAnimationFrame(audioRaf); audioRaf = null; }
  var conn = $(".conn"); if (conn && (!r || r.view !== "conn")) conn.remove();
  var dock = $(".dock"); if (dock && (!r || r.app !== "gate" || r.view)) dock.remove();
  if (!r) {
    if (!app.hidden) { app.classList.add("closing"); setTimeout(function () { app.hidden = true; app.classList.remove("closing"); }, reduced ? 0 : 180); }
    drawWidget();
    return;
  }
  var body = $("#appBody"), scroll = body.scrollTop;
  if (app.hidden) { app.hidden = false; }
  $("#appTitle").textContent = APPS[r.app].title;
  if (r.view === "conn") return; // overlay handles itself
  body.innerHTML = "";
  RENDER[r.app](body, r);
  if (soft) body.scrollTop = scroll; else body.scrollTop = 0;
}

/* ======================= APPS ======================= */
var RENDER = {};
function listItem(unread, title, sub, when, onTap, cls) {
  return h("button", { class: "item" + (unread ? " unread" : "") + (cls ? " " + cls : ""), onclick: onTap },
    [h("span", { class: "dot" }), h("span", { class: "tx" }, [h("b", { text: title, class: cls || "" }), h("small", { text: sub })]), when ? h("span", { class: "when", text: when }) : null]);
}
function hhmm(t) { var d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

RENDER.mail = function (body, r) {
  if (r.id) {
    var m = S.mails.filter(function (x) { return x.id === r.id; })[0], d = byId(D.mails, r.id);
    if (!m) { body.appendChild(h("div", { class: "empty", text: "Este correo aún no ha llegado." })); return; }
    $("#appTitle").textContent = d.from || "?";
    body.appendChild(h("article", { class: "detail" }, [
      h("h3", { text: d.subject || garble("asunto perdido", .6), class: d.subject ? "" : "garble" }),
      h("div", { class: "meta", text: (d.from ? d.from + " <" + d.address + ">" : "Remitente desconocido") + " · " + hhmm(m.at) }),
      h("div", { class: "text" + (d.from ? "" : " garble"), text: d.body })
    ]));
    if (!m.read) { m.read = true; save(); fire("read_mail:" + r.id); setTimeout(refresh, 0); }
    return;
  }
  var list = h("div", { class: "list" });
  var ms = S.mails.slice().sort(function (a, b) { return b.at - a.at; });
  if (!ms.length) list.appendChild(h("div", { class: "empty", text: "Bandeja vacía. Los correos llegan solos según avanzas." }));
  ms.forEach(function (m) {
    var d = byId(D.mails, m.id);
    list.appendChild(listItem(!m.read, d.from || garble("??????????", .9), d.subject || garble("sin asunto", .7), hhmm(m.at),
      function () { go({ app: "mail", id: m.id }); }, d.from ? "" : "garble"));
  });
  body.appendChild(list);
};

RENDER.bbs = function (body, r) {
  if (r.id) {
    var t = byId(D.threads, r.id);
    $("#appTitle").textContent = t.board;
    var art = h("article", { class: "detail" }, [h("h3", { text: t.title }), h("div", { class: "meta", text: "Tablón: " + t.board + " · " + t.posts.length + " mensajes" })]);
    t.posts.forEach(function (p, i) {
      var del = !p.body;
      art.appendChild(h("div", { class: "post" + (del ? " deleted" : "") }, [h("div", { class: "who" }, [h("span", { class: "n", text: "#" + (i + 1) }), p.author]), del ? null : h("p", { text: p.body })]));
    });
    body.appendChild(art);
    if (S.readThreads.indexOf(r.id) === -1) { S.readThreads.push(r.id); save(); fire("read_thread:" + r.id); setTimeout(refresh, 0); }
    return;
  }
  var list = h("div", { class: "list" }), boards = {};
  S.threads.forEach(function (id) { var t = byId(D.threads, id); (boards[t.board] = boards[t.board] || []).push(t); });
  Object.keys(boards).forEach(function (b) {
    list.appendChild(h("div", { class: "group", text: b }));
    boards[b].forEach(function (t) {
      list.appendChild(listItem(S.readThreads.indexOf(t.id) === -1, t.title, t.posts.length + " mensajes · " + t.posts[0].author, "", function () { go({ app: "bbs", id: t.id }); }));
    });
  });
  body.appendChild(list);
};

RENDER.news = function (body, r) {
  if (r.id) {
    var n = byId(D.news, r.id);
    body.appendChild(h("article", { class: "detail" }, [h("h3", { text: n.title }), h("div", { class: "meta", text: "Diario de la Red · " + n.date }), h("div", { class: "text", text: n.body })]));
    if (S.readNews.indexOf(r.id) === -1) { S.readNews.push(r.id); save(); fire("read_news:" + r.id); setTimeout(refresh, 0); }
    return;
  }
  var list = h("div", { class: "list" });
  S.news.slice().reverse().forEach(function (id) {
    var n = byId(D.news, id);
    list.appendChild(listItem(S.readNews.indexOf(id) === -1, n.title, n.body.slice(0, 80) + "…", n.date, function () { go({ app: "news", id: id }); }));
  });
  body.appendChild(list);
};

RENDER.gate = function (body) {
  var st = S.gate;
  var wrap = h("div", { class: "gate" });
  var seg = h("div", { class: "seg", role: "group", "aria-label": "Servidor" });
  D.servers.forEach(function (s) {
    var ok = S.servers.indexOf(s.id) !== -1;
    var b = h("button", { class: "srv" + (st.server === s.id ? " sel" : ""), onclick: function () { st.server = s.id; save(); render(true); } }, [h("b", { text: s.symbol }), h("small", { text: ok ? s.name : "Bloqueado" })]);
    if (!ok) b.disabled = true;
    seg.appendChild(b);
  });
  wrap.appendChild(seg);
  [["Palabra 1 · elemento", D.wordsA, "a"], ["Palabra 2 · mazmorra", D.wordsB, "b"], ["Palabra 3 · terreno", D.wordsC, "c"]].forEach(function (c) {
    var known = c[1].filter(function (x) { return S.words.indexOf(x.id) !== -1; });
    var hid = c[1].length - known.length;
    var sec = h("section", { class: "wsec" }, [h("h4", {}, [c[0], h("span", { text: hid ? "+" + hid + " por descubrir" : "" })])]);
    var chips = h("div", { class: "chips" });
    known.forEach(function (x) {
      chips.appendChild(h("button", { class: "chip" + (st[c[2]] === x.id ? " sel" : "") + (S.newWords.indexOf(x.id) !== -1 ? " new" : ""), text: x.text,
        onclick: function () { st[c[2]] = st[c[2]] === x.id ? null : x.id; var k = S.newWords.indexOf(x.id); if (k !== -1) S.newWords.splice(k, 1); save(); render(true); } }));
    });
    sec.appendChild(chips); wrap.appendChild(sec);
  });
  var A = st.a && st.b && st.c ? HalcyonCore.generate(D, st.server, st.a, st.b, st.c) : null;
  if (A) wrap.appendChild(areaCard(A));
  else wrap.appendChild(h("p", { class: "desc", text: "Elige tres palabras. Cada combinación es un lugar distinto y siempre el mismo." }));
  if (S.visited.length) {
    var mem = h("section", { class: "wsec mem" }, [h("h4", { text: "Memorias" })]);
    S.visited.slice(-8).reverse().forEach(function (v) {
      mem.appendChild(h("button", { text: v.name + " · Nv " + v.level, onclick: function () { var p = v.key.split("|"); S.gate = { server: p[0], a: p[1], b: p[2], c: p[3] }; save(); render(); } }));
    });
    wrap.appendChild(mem);
  }
  body.appendChild(wrap);
  // sticky dock with address + Conectar
  var old = $(".dock"); if (old) old.remove();
  var sv = byId(D.servers, st.server);
  var lab = function (list, id) { var x = byId(list, id); return x ? x.text : "____"; };
  var btn = h("button", { class: "btn amber", text: "Conectar", onclick: function () { if (A) connect(A); } });
  if (!A) btn.disabled = true;
  document.body.appendChild(h("div", { class: "dock" }, [h("div", { class: "addr" }, [h("small", { text: "DIRECCIÓN" }), sv.symbol + ": " + lab(D.wordsA, st.a) + " " + lab(D.wordsB, st.b) + " " + lab(D.wordsC, st.c)]), btn]));
};
function areaCard(A) {
  var el = byId(D.elements, A.element);
  var card = h("article", { class: "card" + (A.corrupted ? " corrupt" : "") });
  card.appendChild(h("h3", { text: A.corrupted ? garble(A.name, .12) : A.name }));
  card.appendChild(h("div", { class: "lvl" }, [h("span", { text: "Nv" }), h("div", { class: "track" }, [h("div", { class: "fill", style: "width:" + A.level + "%" })]), h("b", { text: String(A.level) })]));
  var chip = h("span", { class: "tag el", text: el.name }); chip.style.background = el.color;
  card.appendChild(h("div", { class: "tags" }, [chip, h("span", { class: "tag", text: A.biomeName }), h("span", { class: "tag", text: A.time }), h("span", { class: "tag", text: A.weather })]));
  var dl = h("dl", { class: "facts" });
  [["Mazmorra", A.dungeonName + " · " + A.floors + " pisos"], ["Portales", A.portals + " en el campo"], ["Monstruos", A.monsters.join(", ")], ["Música", A.music]].forEach(function (r) { dl.appendChild(h("dt", { text: r[0] })); dl.appendChild(h("dd", { text: r[1] })); });
  card.appendChild(dl);
  card.appendChild(h("p", { class: "desc", text: A.description }));
  if (A.corrupted) card.appendChild(h("div", { class: "warn", text: "AVISO: la señal de esta área es inestable. Lumen Interactive no garantiza la integridad de los datos." }));
  return card;
}
function connect(A) {
  go({ app: "gate", view: "conn" });
  var dock = $(".dock"); if (dock) dock.remove();
  var bar = h("i"), log = h("div", { class: "log" });
  var box = h("div", { class: "box" }, [h("div", { text: "Conectando con " + A.name + " …" }), h("div", { class: "prog" }, [bar]), log]);
  var ov = h("div", { class: "conn" }, [box]);
  document.body.appendChild(ov);
  var sv = byId(D.servers, A.serverId);
  var lines = [
    "Servidor " + sv.symbol + " " + sv.name + " · OK",
    "Descargando área · " + A.biomeName + ", " + A.time.toLowerCase() + ", " + A.weather.toLowerCase(),
    "Campo explorado. Portales mágicos: " + A.portals,
    "Encuentros: " + A.monsters.join(", "),
    A.dungeonName + " de " + A.floors + " pisos completada",
    "Estatua al fondo de la mazmorra. Obtienes: " + A.treasure
  ];
  if (A.corrupted) lines.splice(3, 0, garble("Se oye una campana. Tres golpes.", .25), "ERROR 0x1F · datos de objeto no válidos");
  var i = 0;
  connTimer = setInterval(function () {
    if (i < lines.length) {
      var l = lines[i++]; bar.style.width = (i / lines.length * 100) + "%";
      var row = h("div", { text: "> " + l }); if (/ERROR|campana/.test(l)) row.className = "garble"; log.appendChild(row);
      if (A.corrupted && i === 4) glitch(1400);
      return;
    }
    clearInterval(connTimer); connTimer = null;
    if (!S.visited.some(function (v) { return v.key === A.key; })) S.visited.push({ key: A.key, name: A.name, level: A.level, at: now() });
    save();
    box.appendChild(h("button", { class: "btn block", text: "Volver a la Puerta", onclick: back }));
    fire("visit_any"); fire("visit:" + A.key); if (A.corrupted) fire("visit_corrupted");
  }, A.corrupted ? 900 : 650);
}

RENDER.audio = function (body) {
  var pad = h("div", { class: "pad" });
  var cv = h("canvas", { class: "viz", height: "64" });
  pad.appendChild(cv);
  var list = h("div", { class: "stack" });
  TRACKS.forEach(function (t) {
    var on = playing && playing.id === t.id;
    list.appendChild(h("div", { class: "track" + (on ? " on" : "") }, [
      h("div", {}, [h("b", { text: t.name }), h("small", { text: t.note })]),
      h("button", { class: on ? "btn ghost" : "btn", text: on ? "Parar" : "Reproducir", style: on ? "color:var(--steel)" : "", onclick: function () { if (on) stopTrack(); else playTrack(t); render(true); } })
    ]));
  });
  pad.appendChild(list);
  var vol = h("input", { type: "range", id: "vol", min: "0", max: "1", step: "0.05", value: String(S.volume) });
  vol.addEventListener("input", function () { S.volume = +vol.value; if (master) master.gain.value = S.volume * .5; save(); });
  pad.appendChild(h("div", { class: "field" }, [h("label", { for: "vol", text: "Volumen" }), vol]));
  pad.appendChild(h("p", { text: "La música se genera en el momento. Sigue sonando mientras navegas por el OS.", style: "color:var(--glass-mute);font-size:13px" }));
  body.appendChild(pad);
  var cx = cv.getContext("2d");
  (function viz() {
    audioRaf = requestAnimationFrame(viz);
    var W = cv.width = cv.clientWidth, H = 64;
    cx.fillStyle = "#0d1b29"; cx.fillRect(0, 0, W, H);
    if (!analyser) return;
    var d = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(d);
    var n = 32, bw = W / n;
    for (var k = 0; k < n; k++) { var v = d[k * 2] / 255; cx.fillStyle = k % 8 === 0 ? "#f2a93b" : "#4c86b3"; cx.fillRect(k * bw + 1, H - v * H, bw - 2, v * H); }
  })();
};

RENDER.config = function (body) {
  var pad = h("div", { class: "pad" });
  var name = h("input", { id: "cfg-name", value: S.handle, maxlength: "16" });
  name.addEventListener("change", function () { S.handle = name.value.trim() || "Kai"; save(); $("#helloName").textContent = "Hola, " + S.handle; toast("Ajustes", "Nombre guardado"); });
  var wp = h("select", { id: "cfg-wall" });
  [["anillos", "Anillos"], ["datos", "Lluvia de datos"], ["cielo", "Cielo de Vella Mar"]].forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); if (S.wallpaper === o[0]) op.selected = true; wp.appendChild(op); });
  wp.addEventListener("change", function () { S.wallpaper = wp.value; save(); });
  var vib = h("input", { type: "checkbox", id: "cfg-vib" }); vib.checked = !!S.vibrate;
  vib.addEventListener("change", function () { S.vibrate = vib.checked; save(); });
  pad.appendChild(h("div", { class: "field" }, [h("label", { for: "cfg-name", text: "Nombre de usuario" }), name]));
  pad.appendChild(h("div", { class: "field" }, [h("label", { for: "cfg-wall", text: "Fondo" }), wp]));
  pad.appendChild(h("label", { class: "switch", for: "cfg-vib" }, ["Vibrar con los avisos", vib]));

  pad.appendChild(h("h3", { text: "Aplicación" }));
  if (isStandalone()) pad.appendChild(h("p", { text: "Estás usando Halcyon OS instalada." }));
  else pad.appendChild(h("button", { class: "btn block", text: deferredPrompt ? "Instalar en este dispositivo" : "Cómo instalarla", onclick: function () { offerInstall(true); } }));

  pad.appendChild(h("h3", { text: "Progreso" }));
  pad.appendChild(h("p", { text: S.words.length + " palabras clave · " + S.visited.length + " áreas · " + S.mails.length + " correos · " + S.pending.length + " eventos en espera" }));
  var conf = h("div", { class: "confirm" }, [h("p", { text: "Se borrará todo el progreso de este dispositivo." }),
    h("div", { class: "stack" }, [h("button", { class: "btn danger block", text: "Borrar progreso", onclick: function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.replace(location.pathname); } }),
      h("button", { class: "btn ghost block", text: "Cancelar", style: "color:var(--steel)", onclick: function () { conf.hidden = true; } })])]);
  conf.hidden = true;
  pad.appendChild(h("div", { class: "stack" }, [
    h("button", { class: "btn block", text: "Adelantar eventos pendientes", onclick: function () { tick(true); render(true); } }),
    h("button", { class: "btn ghost block", text: "Reiniciar partida…", style: "color:var(--steel)", onclick: function () { conf.hidden = false; } })
  ]));
  pad.appendChild(conf);
  body.appendChild(pad);
};

RENDER.readme = function (body) {
  var pad = h("div", { class: "pad" });
  pad.innerHTML =
    '<h3>Halcyon OS · edición móvil</h3>' +
    '<p>El escritorio de <b>The Realm</b>, un MMO que no existe. La historia avanza con lo que lees y con las áreas que visitas, y sigue avanzando aunque cierres la app.</p>' +
    '<h3>Cómo se juega</h3><ul>' +
    '<li>Lee el correo. Los mensajes nuevos llegan solos.</li>' +
    '<li>Abre <b>The Realm</b>, elige servidor y tres palabras, y pulsa <b>Conectar</b>.</li>' +
    '<li>Las palabras nuevas llegan por correo, foro y noticias.</li>' +
    '<li>Toca un aviso para ir directo a lo que anuncia.</li>' +
    '<li>Si no quieres esperar, en Ajustes puedes adelantar los eventos.</li></ul>' +
    '<h3>Instalar</h3><p>Desde Ajustes puedes instalarla en la pantalla de inicio. Funciona sin conexión una vez instalada.</p>';
  body.appendChild(pad);
};

/* ======================= HOME / BOOT ======================= */
function clock() {
  var d = new Date();
  $("#clock").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  $("#dateLine").textContent = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
$("#statusMail").addEventListener("click", function () { go({ app: "mail" }); });

function boot() {
  var lines = ["HALCYON BIOS 4.1 · memoria 65536K", "Cargando núcleo ........ ", "Montando red móvil ... ", "Comprobando cliente The Realm ... ", "Sincronizando buzón ... "];
  var log = $("#bootlog"), i = 0, returning = !!lsGet(SAVE_KEY);
  $("#handle").value = S.handle;
  (function step() {
    if (i < lines.length) {
      log.appendChild(h("div", {}, [lines[i], i > 0 ? h("span", { class: "ok", text: "OK" }) : null])); i++;
      setTimeout(step, reduced || returning ? 50 : 240 + Math.random() * 180); return;
    }
    $("#login").hidden = false;
  })();
  $("#login").addEventListener("submit", function (e) {
    e.preventDefault();
    S.handle = $("#handle").value.trim() || "Kai"; save();
    ensureAudio(); if (AC) AC.resume();
    $("#boot").remove();
    $("#helloName").textContent = "Hola, " + S.handle;
    refresh();
    fire("boot");
    tick();
    // home-screen shortcuts: /?app=mail, /?app=gate
    var want = new URLSearchParams(location.search).get("app");
    if (want && APPS[want]) go({ app: want });
  });
}

function start(data) {
  D = data;
  S = freshState();
  try { var raw = lsGet(SAVE_KEY); if (raw) { var p = JSON.parse(raw); for (var k in p) S[k] = p[k]; } } catch (e) {}
  if (!S.gate) S.gate = { server: "delta", a: null, b: null, c: null };
  history.replaceState({ depth: 0 }, "");
  buildGrid(); clock(); setInterval(clock, 10000); setInterval(tick, 500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
  boot();
}

fetch("realm_data.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(function () {
  $("#bootlog").textContent = "No se pudieron cargar los datos del mundo (realm_data.json). Comprueba la conexión y recarga.";
});
})();
