import { t, setLang, getLang, applyStatic, LANGS } from "./i18n.js?v=1795542303";
import { music } from "./music.js?v=1795542303";
import { Q } from "./questions.js?v=1795472675";

const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
Q.forEach(q => q.id = slug(q.c + "-" + q.o[q.a]));
const BASE = Q.length;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const BASE_T = 20, LET = ["A", "B", "C", "D"];
let T = BASE_T; // seconds to answer; clip questions get longer (see beginAnswers)
const SCREENS = ["setup", "lobby", "join", "phone", "play", "end"];
let mode = "host", cat = "mix", per = 10;
const show = id => {
  music.want(id !== "join" && id !== "phone");
  SCREENS.forEach(s => $(s).classList.toggle("hide", s !== id));
  document.body.classList.toggle("ingame", id === "play" || id === "lobby");
  $("board").classList.toggle("hide", !(id === "play" || id === "end" || (id === "setup" && mode === "local")));
};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
const vid = $("vid");
const SITE = location.host + location.pathname.replace(/index\.html$/, "");
function renderHowto() {
  $("howto").innerHTML = `<span class="howline">${esc(t("On your phone, go to"))}</span><b class="joinurl">${esc(SITE.replace(/\/$/, ""))}</b>` +
    `<span class="howline">${esc(t("Then tap {join} and enter this code.", { join: "\u0001" })).replace("\u0001", `<b>${esc(t("Join a game"))}</b>`)}</span>`;
}
// QR code that opens this site's join screen with the room code filled in.
function joinLink(code) {
  const u = new URL(location.href); u.hash = ""; u.pathname = u.pathname.replace(/index\.html$/, "");
  u.searchParams.set("join", code); return u.toString();
}
function renderQR(code) {
  const el = $("joinQR"); if (!el || typeof qrcode !== "function") return;
  const qr = qrcode(0, "M"); qr.addData(joinLink(code)); qr.make();
  el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/* ---------- clips + custom questions (files in the repo) ---------- */
let clips = {}, CUSTOM = [], clipsReady = false;
const ck = q => q.clip || q.id;
const hasClip = q => !!clips[ck(q)];
function updateCount() {
  const n = Object.keys(clips).length;
  $("clipCount").textContent = !clipsReady ? t("Loading clips…") : n ? (n > 1 ? t("{n} clips ready", { n }) : t("1 clip ready")) : t("No clips yet. See Admin for how to add them.");
}
function rebuildQ() {
  Q.length = BASE;
  for (const d of CUSTOM) {
    if (!d || !d.key) continue;
    const kind = d.kind === "tv" ? "tv" : "movie";
    if (d.clip) clips[d.key] = { u: d.clip };
    if (d.scene && Array.isArray(d.scene.o) && d.scene.o.length === 4)
      Q.push({ c: "Name that scene", t: kind, custom: 1, q: kind === "tv" ? "Which show is this scene from?" : "Which movie is this scene from?", o: d.scene.o.map(String), a: +d.scene.a || 0, id: d.key });
    (Array.isArray(d.hard) ? d.hard : []).forEach((h, i) => {
      if (h && h.q && Array.isArray(h.o) && h.o.length === 4)
        Q.push({ c: "Clip challenge", t: kind, hard: 1, custom: 1, clip: d.key, q: String(h.q), o: h.o.map(String), a: +h.a || 0, id: d.key + "-h" + i });
    });
  }
}
const getJSON = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
(async () => {
  const [cm, cu] = await Promise.all([getJSON("data/clips.json"), getJSON("data/custom.json")]);
  if (cm && typeof cm === "object") for (const [k, v] of Object.entries(cm)) if (typeof v === "string" && v) clips[k] = { u: v };
  if (Array.isArray(cu)) CUSTOM = cu;
  rebuildQ(); clipsReady = true; updateCount();
})();

/* ---------- peer-to-peer link (PeerJS) ---------- */
// The free PeerJS service only introduces phones to the TV; after that they talk directly.
// For testing or a self-hosted broker: ?peerhost=HOST&peerport=PORT&peerpath=/&peersecure=0
function peerOpts() {
  const u = new URLSearchParams(location.search), o = { debug: 0 };
  if (u.get("peerhost")) { o.host = u.get("peerhost"); o.port = +(u.get("peerport") || 443); o.path = u.get("peerpath") || "/"; o.secure = u.get("peersecure") !== "0" }
  return o;
}
const PEERPFX = "reelsmart-tv-";
const peerOK = () => typeof window.Peer === "function";
const myKey = (() => { try { let k = localStorage.getItem("reelsmart-k"); if (!k) { k = Math.random().toString(36).slice(2, 12); localStorage.setItem("reelsmart-k", k) } return k } catch (e) { return Math.random().toString(36).slice(2, 12) } })();

/* ---------- marquee bulbs ---------- */
const bulbs = $("bulbs");
const drawBulbs = () => {
  const w = bulbs.clientWidth, h = bulbs.clientHeight, step = 26; let html = "", k = 0;
  for (let x = 8; x < w - 8; x += step) { const d = (k++ % 3) * .4; html += `<i style="left:${x - 5}px;top:4px;animation-delay:${d}s"></i><i style="left:${x - 5}px;bottom:4px;animation-delay:${d}s"></i>` }
  for (let y = step; y < h - step / 2; y += step) { const d = (k++ % 3) * .4; html += `<i style="left:4px;top:${y - 5}px;animation-delay:${d}s"></i><i style="right:4px;top:${y - 5}px;animation-delay:${d}s"></i>` }
  bulbs.innerHTML = html;
};
const bulbObs = new ResizeObserver(drawBulbs); bulbObs.observe(bulbs);

/* ---------- setup ---------- */
let players = [];
try { const s = JSON.parse(localStorage.getItem("reelsmart-players") || "[]"); if (Array.isArray(s)) players = s.slice(0, 12).map(n => ({ n: String(n), s: 0 })) } catch (e) { }
if (!players.length) players = [{ n: "Team Popcorn", s: 0 }, { n: "Team Nachos", s: 0 }];
const savePlayers = () => { try { localStorage.setItem("reelsmart-players", JSON.stringify(players.map(p => p.n))) } catch (e) { } };
const renderChips = () => { $("chips").innerHTML = players.map((p, i) => `<span class="chip">${esc(p.n)}<button type="button" data-i="${i}" aria-label="Remove ${esc(p.n)}">×</button></span>`).join("") || '<span class="note">Add at least one player.</span>' };
const renderBoard = on => { $("board").innerHTML = players.map((p, i) => `<div class="score${i === on ? " on" : ""}"><span>${esc(p.n)}</span><span>${p.s}</span></div>`).join("") };
$("addForm").addEventListener("submit", e => { e.preventDefault(); const v = $("pname").value.trim(); if (v && players.length < 12) { players.push({ n: v, s: 0 }); $("pname").value = ""; savePlayers(); renderChips(); renderBoard(-1) } });
$("chips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; players.splice(+b.dataset.i, 1); savePlayers(); renderChips(); renderBoard(-1) });
const pick = (id, fn) => $(id).addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); fn(b.dataset.v) });
pick("catPick", v => cat = v); pick("lenPick", v => per = +v); pick("modePick", v => { mode = v; applyMode() });
function applyMode() {
  $("localPlayers").classList.toggle("hide", mode !== "local");
  $("lenLabel").textContent = mode === "local" ? t("Questions per player") : t("Questions");
  $("startBtn").textContent = mode === "local" ? t("Roll the film") : t("Open the lobby");
  $("setupWarn").classList.add("hide");
  $("modeNote").textContent = mode === "host"
    ? t("TV + phones: put this page on the TV. Players open the same site on their phones and tap Join a game. Everyone answers every question; faster right answers score more.")
    : t("One screen: players take turns on this device. 20 seconds per question, 100 points for a right answer plus up to 100 for speed. Keys 1–4 answer.");
  show("setup"); renderBoard(-1);
}
function buildDeck(n) {
  const needsClip = q => q.hard || q.c === "Name that scene";
  const ok = q => !needsClip(q) || hasClip(q);
  const pool0 = shuffle(Q.filter(q => ok(q) && (cat === "all" ? true : cat === "hard" ? q.hard : !q.hard && (cat === "mix" || (cat === "clips" ? hasClip(q) : q.t === cat)))));
  const seen = new Set(), first = [], rest = [];
  for (const q of pool0) { const k = q.clip || q.e || q.id; (seen.has(k) ? rest : first).push(q); seen.add(k) }
  return [...first, ...rest].slice(0, n).map(q => { if (q.o.length < 3) return q; const idx = shuffle(q.o.map((_, i) => i)); return { ...q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) } });
}
function warn(t) { const w = $("setupWarn"); w.textContent = t; w.classList.remove("hide") }

/* ---------- shared question view ---------- */
let autoQ = null, clipQ = null;
const ANSWERS_AT = 25; // seconds of clip before the answers appear
let deck = [], idx = 0, timer = null, left = 0, locked = false, answering = false;
function paintQuestion(q, label, turnText, tiles) {
  T = BASE_T;
  $("qnum").textContent = label; $("pts").textContent = "";
  $("turn").textContent = turnText; $("cat").textContent = t(q.c); $("qtext").textContent = t(q.q);
  $("opts").innerHTML = q.o.map((o, i) => `<button class="opt${tiles ? " tile L" + i : ""}" data-i="${i}" ${tiles ? 'tabindex="-1"' : ""}><b>${tiles ? LET[i] : i + 1}</b><span>${esc(t(o))}</span></button>`).join("");
  $("result").textContent = ""; $("nextBtn").classList.add("hide");
  const c = clips[ck(q)];
  if (c) {
    $("emoji").classList.add("hide"); $("screen").classList.remove("hide"); $("answerArea").classList.add("hide"); $("revealBtn").classList.remove("hide");
    vid.src = c.u; vid.currentTime = 0; const pr = vid.play(); if (pr && pr.catch) pr.catch(() => { });
    $("qtext").textContent = t("Watch the clip…");
    // The question shows after 2 s; the answers pop up once most of the clip has played
    // (25 s in, or just before the end of a shorter clip). The clip keeps playing.
    clearTimeout(autoQ); const myQ = q;
    autoQ = setTimeout(() => { if (deck[idx] === myQ && !answering) $("qtext").textContent = t(myQ.q) }, 2000);
    clipQ = myQ;
    return true;
  }
  stopVideo(); $("screen").classList.add("hide"); $("revealBtn").classList.add("hide");
  $("emoji").textContent = q.e || ""; $("emoji").classList.toggle("hide", !q.e); return false;
}
function stopVideo() { vid.pause(); if (vid.getAttribute("src")) { vid.removeAttribute("src"); vid.load() } }
function startTimer(onTick, onEnd) {
  $("qtext").textContent = t(deck[idx].q); $("revealBtn").classList.add("hide"); $("answerArea").classList.remove("hide");
  left = T; $("bar").style.width = "100%"; clearInterval(timer);
  timer = setInterval(() => { left -= .1; $("bar").style.width = Math.max(0, left / T * 100) + "%"; onTick && onTick(); if (left <= 0) onEnd() }, 100);
}
vid.addEventListener("timeupdate", () => {
  if (!clipQ || answering || deck[idx] !== clipQ || $("play").classList.contains("hide")) return;
  const d = vid.duration, at = isFinite(d) && d > 0 ? Math.min(ANSWERS_AT, Math.max(1, d - 1.5)) : ANSWERS_AT;
  if (vid.currentTime >= at) beginAnswers();
});
// Background music pauses while a clip plays.
vid.addEventListener("playing", () => music.duck(true));
["pause", "ended", "emptied"].forEach(e => vid.addEventListener(e, () => music.duck(false)));
vid.addEventListener("ended", () => { if (!$("play").classList.contains("hide")) beginAnswers() });
vid.addEventListener("error", () => { if (!$("play").classList.contains("hide") && vid.getAttribute("src")) { $("result").textContent = t("That clip wouldn't play, so here's the question without it."); $("screen").classList.add("hide"); beginAnswers() } });
$("revealBtn").addEventListener("click", () => { vid.pause(); beginAnswers() });
function beginAnswers() {
  if (answering) return; answering = true;
  // Clip questions: enough time to watch the rest of the clip, plus 10 seconds (20–75 s).
  if (!$("screen").classList.contains("hide") && isFinite(vid.duration) && vid.duration > 0)
    T = Math.min(75, Math.max(BASE_T, Math.ceil(vid.duration - vid.currentTime) + 10)); if (mode === "host") hostBeginAnswer(); else startTimer(null, () => answer(-1)) }

/* ---------- one-screen mode ---------- */
function startLocal() {
  if (!players.length) { $("pname").focus(); return }
  deck = buildDeck(per * players.length);
  if (!deck.length) { warn(t("No questions available for that category yet. Add clips in Admin or pick another category.")); return }
  players.forEach(p => p.s = 0); idx = 0; show("play"); ask();
}
function ask() {
  const q = deck[idx], p = idx % players.length; locked = false; answering = false; clearInterval(timer);
  renderBoard(p);
  if (!paintQuestion(q, t("Question {i} of {n}", { i: idx + 1, n: deck.length }), t("{name}, you're up", { name: players[p].n }), false)) beginAnswers();
}
function answer(i) {
  if (mode !== "local" || locked || !answering) return; locked = true; clearInterval(timer);
  const q = deck[idx], p = players[idx % players.length];
  [...$("opts").children].forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add("right"); else if (k === i) b.classList.add("wrong") });
  if (i === q.a) { const pts = 100 + Math.round(Math.max(0, left) / T * 100); p.s += pts; $("result").textContent = t("Correct! +{n} points", { n: pts }); $("pts").textContent = `+${pts}` }
  else $("result").textContent = (i < 0 ? t("Time's up.") : t("Not quite.")) + " " + t("It was {a}.", { a: t(q.o[q.a]) });
  renderBoard(idx % players.length);
  const nb = $("nextBtn"); nb.textContent = idx + 1 < deck.length ? t("Next question") : t("See the results"); nb.classList.remove("hide"); nb.focus();
}
function next() { stopVideo(); if (mode === "host") { hostNext(); return } idx++; if (idx < deck.length) ask(); else finish() }
function finish() {
  stopVideo(); show("end"); const r = [...players].sort((a, b) => b.s - a.s);
  const tie = r.length > 1 && r[0].s === r[1].s;
  $("winner").textContent = r.length === 1 ? t("{name} scored {n}", { name: r[0].n, n: r[0].s }) : tie ? t("It's a tie at the top!") : t("{name} takes the Oscar", { name: r[0].n });
  $("podium").innerHTML = r.map((p, i) => `<li><span>${i + 1}. ${esc(p.n)}</span><span class="n">${t("{n} pts", { n: p.s })}</span></li>`).join("");
  renderBoard(-1);
}
$("opts").addEventListener("click", e => { const b = e.target.closest(".opt"); if (b) answer(+b.dataset.i) });
$("nextBtn").addEventListener("click", next);
$("startBtn").addEventListener("click", () => mode === "local" ? startLocal() : openLobby());
$("againBtn").addEventListener("click", () => mode === "local" ? startLocal() : hostStart());
$("newBtn").addEventListener("click", goHome);
$("exitBtn").addEventListener("click", goHome);
function goHome() {
  clearTimeout(autoQ); clearInterval(timer); clearTimeout(autoNext); locked = true; answering = false; stopVideo();
  if (H) closeRoom();
  players.forEach(p => p.s = 0); show("setup"); renderBoard(-1); window.scrollTo(0, 0);
}
document.addEventListener("keydown", e => {
  if ($("play").classList.contains("hide") || e.target.tagName === "INPUT") return;
  const n = +e.key;
  if (mode === "local" && !locked && answering && n >= 1 && n <= deck[idx].o.length) answer(n - 1);
  else if ((e.key === "Enter" || e.key === " ") && !$("nextBtn").classList.contains("hide") && document.activeElement !== $("nextBtn")) { e.preventDefault(); next() }
});

/* ---------- TV host mode ----------
   Nothing about a game is kept anywhere: scores live only in the TV's memory. */
let H = null, autoNext = null;
const CODECH = "ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () => Array.from({ length: 4 }, () => CODECH[Math.floor(Math.random() * CODECH.length)]).join("");
function closeRoom() {
  const h = H; H = null; if (!h) return;
  for (const c of h.conns.values()) { try { c.send({ t: "state", st: { phase: "closed", code: h.code } }) } catch (e) { } }
  setTimeout(() => { try { h.peer.destroy() } catch (e) { } }, 400);
}
addEventListener("pagehide", () => { if (H) closeRoom() });
function openLobby() {
  if (!peerOK()) { warn(t("Couldn't load the phone connection. Check your internet connection and reload.")); return }
  const btn = $("startBtn"); btn.disabled = true; btn.textContent = t("Opening the lobby…");
  let tries = 0;
  const attempt = () => {
    const code = newCode();
    const peer = new window.Peer(PEERPFX + code.toLowerCase(), peerOpts());
    let opened = false;
    peer.on("open", () => {
      opened = true; btn.disabled = false; btn.textContent = t("Open the lobby");
      H = { code, peer, conns: new Map(), phase: "lobby", rid: "", i: 0, players: new Map(), answers: {}, deadline: 0, gains: {} };
      $("roomCode").textContent = code; renderQR(code); show("lobby"); renderLobby();
    });
    peer.on("connection", conn => {
      conn.on("data", d => onPhoneMsg(conn, d));
      conn.on("close", () => { if (!H || H.peer !== peer) return; for (const [k, c] of H.conns) if (c === conn) { H.conns.delete(k); syncPlayers() } });
    });
    peer.on("disconnected", () => { if (H && H.peer === peer) { try { peer.reconnect() } catch (e) { } } });
    peer.on("error", err => {
      if (!opened && err && err.type === "unavailable-id" && tries++ < 5) { peer.destroy(); attempt(); return }
      if (!opened) { btn.disabled = false; btn.textContent = t("Open the lobby"); peer.destroy(); warn(t("Couldn't open a lobby. Check your internet connection and try again.")) }
    });
  };
  attempt();
}
function onPhoneMsg(conn, d) {
  if (!H || !d || typeof d !== "object") return;
  const k = String(d.k || "").slice(0, 20); if (!k) return;
  if (d.t === "hello") {
    const n = String(d.name || "Player").trim().slice(0, 18) || "Player";
    const old = H.conns.get(k); if (old && old !== conn) { try { old.close() } catch (e) { } }
    H.conns.set(k, conn);
    const pl = H.players.get(k); if (pl) pl.n = n; else H.players.set(k, { k, n, s: 0, on: true });
    syncPlayers(); sendState(conn); return;
  }
  if (d.t === "ans" && H.phase === "answer" && d.rid === H.rid && d.i === H.i && !(k in H.answers) && H.players.has(k) && Number.isInteger(d.c) && d.c >= 0 && d.c < deck[H.i].o.length) {
    H.answers[k] = { c: d.c, left: Math.max(0, (H.deadline - Date.now()) / 1000) };
    hostWrite(); renderHostBoard(); hostAnsweredNote();
    const on = [...H.players.values()].filter(p => p.on); if (on.length && on.every(p => p.k in H.answers)) hostReveal();
  }
}
function syncPlayers() {
  if (!H) return;
  for (const pl of H.players.values()) pl.on = H.conns.has(pl.k) && H.conns.get(pl.k).open !== false;
  hostWrite();
  if (H.phase === "lobby") renderLobby();
  else { renderHostBoard(); if (H.phase === "answer") { hostAnsweredNote(); const on = [...H.players.values()].filter(p => p.on); if (on.length && on.every(p => p.k in H.answers)) hostReveal() } }
}
function renderLobby() {
  const ps = [...H.players.values()];
  $("lobbyList").innerHTML = ps.map(p => `<span class="chip${p.on ? "" : " off"}">${esc(p.n)}</span>`).join("");
  const on = ps.filter(p => p.on).length;
  $("lobbyNote").textContent = on ? (on > 1 ? t("{n} players in. Start when everyone's here.", { n: on }) : t("1 player in. Start when everyone's here.")) : t("Waiting for players…");
  $("hostGo").disabled = !on;
}
$("hostGo").addEventListener("click", hostStart);
$("lobbyExit").addEventListener("click", goHome);
function hostStart() {
  if (!H) { openLobby(); return }
  deck = buildDeck(per);
  if (!deck.length) { show("lobby"); $("lobbyNote").textContent = t("No questions available for that category yet. Exit and pick another category."); return }
  for (const p of H.players.values()) p.s = 0;
  H.rid = Math.random().toString(36).slice(2, 8); idx = 0; hostAsk();
}
function hostAsk() {
  clearTimeout(autoNext); clearInterval(timer);
  H.i = idx; H.answers = {}; H.gains = {}; locked = false; answering = false;
  show("play");
  const hasC = paintQuestion(deck[idx], t("Question {i} of {n}", { i: idx + 1, n: deck.length }), clips[ck(deck[idx])] ? t("Eyes on the screen") : t("Answer on your phone"), true);
  renderHostBoard();
  if (hasC) { H.phase = "watch"; hostWrite() } else beginAnswers();
}
function hostBeginAnswer() {
  H.phase = "answer"; H.deadline = Date.now() + T * 1000;
  $("turn").textContent = t("Answer on your phone"); hostAnsweredNote();
  startTimer(null, hostReveal); hostWrite();
}
function hostAnsweredNote() { const on = [...H.players.values()].filter(p => p.on).length; $("result").textContent = t("{a} of {n} answered", { a: Object.keys(H.answers).length, n: on }) }
function hostReveal() {
  if (!H || H.phase !== "answer") return;
  clearInterval(timer); H.phase = "reveal"; answering = false;
  const q = deck[idx];
  for (const p of H.players.values()) { const a = H.answers[p.k]; let g = 0; if (a && a.c === q.a) { g = 100 + Math.round(a.left / T * 100); p.s += g } H.gains[p.k] = { g, r: !!(a && a.c === q.a) } }
  [...$("opts").children].forEach((b, k) => b.classList.add(k === q.a ? "right" : "dim"));
  const right = Object.values(H.gains).filter(x => x.r).length;
  $("result").textContent = t("It's {l}: {a}. {n} got it right.", { l: LET[q.a], a: t(q.o[q.a]), n: right });
  renderHostBoard(true); hostWrite();
  const nb = $("nextBtn"); let n = 10; const lab = () => nb.textContent = (idx + 1 < deck.length ? t("Next question") : t("See the results")) + ` (${n})`; lab(); nb.classList.remove("hide");
  clearTimeout(autoNext); const tick = () => { n--; if (n <= 0) { next(); return } lab(); autoNext = setTimeout(tick, 1000) }; autoNext = setTimeout(tick, 1000);
}
function hostNext() { clearTimeout(autoNext); idx++; if (idx < deck.length) hostAsk(); else hostEnd() }
function hostEnd() {
  H.phase = "end"; stopVideo(); show("end");
  const r = [...H.players.values()].sort((a, b) => b.s - a.s);
  const tie = r.length > 1 && r[0].s === r[1].s;
  $("winner").textContent = !r.length ? t("Game over") : r.length === 1 ? t("{name} scored {n}", { name: r[0].n, n: r[0].s }) : tie ? t("It's a tie at the top!") : t("{name} takes the Oscar", { name: r[0].n });
  $("podium").innerHTML = r.map((p, i) => `<li><span>${i + 1}. ${esc(p.n)}</span><span class="n">${t("{n} pts", { n: p.s })}</span></li>`).join("");
  renderHostBoard(); hostWrite();
}
function renderHostBoard(rev) {
  if (!H) return; const r = [...H.players.values()].sort((a, b) => b.s - a.s);
  $("board").innerHTML = r.map(p => {
    const g = H.gains[p.k];
    const tag = H.phase === "answer" ? (p.k in H.answers ? '<span class="tick">✓</span> ' : "") : (rev && g ? (g.r ? `<span class="gain">+${g.g}</span> ` : "✗ ") : "");
    return `<div class="score${p.on ? "" : " off"}"><span>${esc(p.n)}</span><span>${tag}${p.s}</span></div>`;
  }).join("") || '<div class="score"><span>No players yet</span><span></span></div>';
}
function buildState() {
  const q = deck[H.i];
  const st = { code: H.code, rid: H.rid, phase: H.phase, i: H.i, total: deck.length, lang: getLang(),
    players: [...H.players.values()].map(p => ({ k: p.k, n: p.n, s: p.s, a: p.k in H.answers, g: (H.gains[p.k] || {}).g || 0, r: !!(H.gains[p.k] || {}).r })) };
  if (q && (st.phase === "answer" || st.phase === "reveal" || st.phase === "watch")) { st.q = { c: q.c, q: q.q, o: q.o }; if (st.phase === "reveal") st.correct = q.a }
  return st;
}
function sendState(conn) { if (!H) return; try { conn.send({ t: "state", st: buildState() }) } catch (e) { } }
function hostWrite() { if (!H) return; const st = buildState(); for (const c of H.conns.values()) { try { c.send({ t: "state", st }) } catch (e) { } } }

/* ---------- phone controller ---------- */
let P = null;
$("toJoin").addEventListener("click", () => { show("join"); try { $("jname").value = localStorage.getItem("reelsmart-name") || "" } catch (e) { } $("jname").focus() });
$("joinBack").addEventListener("click", () => show("setup"));
$("jcode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "") });
$("joinForm").addEventListener("submit", e => {
  e.preventDefault(); const w = $("joinWarn"); w.classList.add("hide");
  const fail = t => { w.textContent = t; w.classList.remove("hide") };
  const name = $("jname").value.trim().slice(0, 18), code = $("jcode").value.trim().toUpperCase();
  if (!name || code.length !== 4) { fail(t("Enter your name and the 4-letter code on the TV.")); return }
  if (!peerOK()) { fail(t("Couldn't load the connection. Check your internet and reload.")); return }
  try { localStorage.setItem("reelsmart-name", name) } catch (e) { }
  const btn = $("joinBtn"); btn.disabled = true; btn.textContent = t("Joining…");
  phoneConnect(name, code, ok => {
    btn.disabled = false; btn.textContent = t("Join");
    if (!ok) { fail(t("Can't find room {code}. Check the code on the TV, and that the TV is on the lobby screen.", { code })); return }
    $("phCode").textContent = t("Room {code}", { code }); $("phName").textContent = name; show("phone"); renderPhone();
  });
});
function phoneConnect(name, code, done) {
  if (P && P.peer) { try { P.peer.destroy() } catch (e) { } }
  const peer = new window.Peer(peerOpts());
  const keep = P && P.code === code ? P : null;
  P = { name, code, peer, conn: null, st: keep ? keep.st : null, mine: keep ? keep.mine : {}, sig: "", lost: false };
  let settled = false; const settle = ok => { if (!settled) { settled = true; clearTimeout(to); done && done(ok) } };
  const to = setTimeout(() => { settle(false); try { peer.destroy() } catch (e) { } }, 12000);
  peer.on("open", () => {
    const conn = peer.connect(PEERPFX + code.toLowerCase(), { reliable: true });
    P.conn = conn;
    conn.on("open", () => { conn.send({ t: "hello", k: myKey, name }); settle(true) });
    conn.on("data", d => { if (!P || P.conn !== conn || !d || d.t !== "state" || !d.st) return; P.st = d.st; P.lost = false; if (d.st.lang && d.st.lang !== getLang()) { setLang(d.st.lang); P.sig = ""; $("phCode").textContent = t("Room {code}", { code: P.code }) } renderPhone() });
    conn.on("close", () => { if (P && P.conn === conn && (!P.st || P.st.phase !== "closed")) { P.lost = true; P.sig = ""; renderPhone() } });
  });
  peer.on("error", err => { if (err && err.type === "peer-unavailable") { settle(false); try { peer.destroy() } catch (e) { } } else if (!settled) { settle(false) } else if (P) { P.lost = true; P.sig = ""; renderPhone() } });
}
$("phLeave").addEventListener("click", () => {
  if (P) { try { P.conn && P.conn.close() } catch (e) { } try { P.peer.destroy() } catch (e) { } }
  P = null; show("setup");
});
function renderPhone() {
  if (!P) return; const st = P.st, b = $("phBody"), k = myKey;
  const me = st && Array.isArray(st.players) ? st.players.find(p => p.k === k) : null;
  $("phScore").textContent = t("{n} pts", { n: me ? me.s : 0 });
  const msg = (t, s) => `<div class="pmsg">${esc(t)}${s ? `<small>${esc(s)}</small>` : ""}</div>`;
  if (P.lost) { b.innerHTML = msg(t("Lost connection to the TV."), t("Tap Reconnect. Your score is kept.")) + `<button class="start" id="reconn">${esc(t("Reconnect"))}</button>`; P.sig = ""; return }
  if (!st) { b.innerHTML = msg(t("Connecting…"), t("Looking for the game on the TV.")); return }
  if (st.phase === "closed") { b.innerHTML = msg(t("The host closed the game."), t("Tap Leave to join another.")); return }
  if (st.phase === "lobby") { const n = (st.players || []).length; b.innerHTML = msg(t("You're in!"), (n === 1 ? t("Watch the TV. 1 player so far.") : t("Watch the TV. {n} players so far.", { n }))); return }
  if (st.phase === "end") {
    const r = [...st.players].sort((a, c) => c.s - a.s); const pos = r.findIndex(p => p.k === k) + 1;
    b.innerHTML = msg(pos === 1 ? t("You win!") : pos ? t("You finished #{n}", { n: pos }) : t("Game over"), me ? t("{n} points", { n: me.s }) : ""); return;
  }
  const head = `<div class="note" style="margin:10px 0 0">${esc(t("Question {i} of {n}", { i: st.i + 1, n: st.total }))} · ${esc(st.q ? t(st.q.c) : "")}</div>`;
  if (st.phase === "watch") { b.innerHTML = head + msg(t("Watch the clip on the TV…"), t("Your answers will appear here.")); return }
  const key = st.rid + ":" + st.i, mine = P.mine[key];
  const sig = st.phase + "|" + key + "|" + mine + "|" + (me && me.a);
  if (st.phase === "answer" && P.sig === sig && b.children.length) return;
  P.sig = sig;
  if (st.phase === "answer") {
    if (mine != null) { b.innerHTML = head + `<div class="pgrid2">${st.q.o.map((o, i) => `<button class="pb L${i} ${i === mine ? "pick" : "faded"}" disabled><i>${LET[i]}</i>${esc(t(o))}</button>`).join("")}</div>` + msg(t("Locked in!"), t("Waiting for everyone else.")); return }
    b.innerHTML = head + `<div class="q" style="margin-top:8px">${esc(t(st.q.q))}</div><div class="pgrid2">${st.q.o.map((o, i) => `<button class="pb L${i}" data-c="${i}"><i>${LET[i]}</i>${esc(t(o))}</button>`).join("")}</div>`;
    return;
  }
  if (st.phase === "reveal") {
    const c = st.correct, right = me && me.r;
    b.innerHTML = head + `<div class="big">${esc(right ? t("Correct!") : t("Not quite"))}</div>` + msg(right ? t("+{n} points", { n: me.g }) : t("It was {l}: {a}.", { l: LET[c], a: t(st.q.o[c]) }), t("Next question coming up on the TV."));
  }
}
$("phBody").addEventListener("click", e => {
  if (e.target.id === "reconn" && P) { const { name, code } = P; e.target.disabled = true; e.target.textContent = t("Reconnecting…"); phoneConnect(name, code, ok => { if (!ok && P) { P.lost = true; renderPhone() } }); return }
  const btn = e.target.closest(".pb[data-c]"); if (!btn || !P || !P.st || P.st.phase !== "answer" || !P.conn) return;
  const c = +btn.dataset.c, st = P.st; P.mine[st.rid + ":" + st.i] = c;
  try { P.conn.send({ t: "ans", k: myKey, rid: st.rid, i: st.i, c }) } catch (err) { delete P.mine[st.rid + ":" + st.i] }
  renderPhone();
});

/* ---------- language ---------- */
const lp = $("langPick");
lp.innerHTML = LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join("");
lp.value = getLang();
lp.addEventListener("change", () => { setLang(lp.value); renderHowto(); applyMode(); updateCount(); if (H) hostWrite() });
applyStatic(); renderHowto();
renderChips(); applyMode(); updateCount();
// Arrived from the lobby QR code: open the join screen with the room code filled in.
{
  const jc = (new URLSearchParams(location.search).get("join") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  if (jc) { $("toJoin").click(); $("jcode").value = jc; if ($("jname").value) $("joinBtn").focus(); else $("jname").focus() }
}
/* ---------- music on/off ---------- */
const SPK = '<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3z"/>';
function paintMute(m) {
  document.querySelectorAll(".mutebtn").forEach(b => {
    b.querySelector(".mi").innerHTML = SPK + (m ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') + "</svg>";
    b.setAttribute("aria-pressed", m ? "true" : "false"); b.setAttribute("aria-label", m ? t("Turn music on") : t("Mute music"));
  });
}
document.querySelectorAll(".mutebtn").forEach(b => b.addEventListener("click", () => music.toggle()));
music.onChange(paintMute); paintMute(music.isMuted());
window.addEventListener("keydown", e => { if ((e.key === "m" || e.key === "M") && !e.target.closest("input,textarea,select")) music.toggle() });
