import { Q } from "./questions.js";
import { loadFirebase, configured, setupBanner } from "./fb.js";

const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
Q.forEach(q => q.id = slug(q.c + "-" + q.o[q.a]));
const BASE = Q.length;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const T = 20, LET = ["A", "B", "C", "D"];
const SCREENS = ["setup", "lobby", "join", "phone", "play", "end"];
let mode = "host", cat = "mix", per = 5;
const show = id => {
  SCREENS.forEach(s => $(s).classList.toggle("hide", s !== id));
  document.body.classList.toggle("ingame", id === "play" || id === "lobby");
  $("board").classList.toggle("hide", !(id === "play" || id === "end" || (id === "setup" && mode === "local")));
};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
const vid = $("vid");
setupBanner($("setupBanner"));
$("siteUrl").textContent = location.host + location.pathname.replace(/index\.html$/, "");

/* ---------- Firebase ---------- */
let FB = null, ME = null, clips = {}, CUSTOM = [], clipsReady = false;
const ck = q => q.clip || q.id;
const hasClip = q => !!clips[ck(q)];
function updateCount() {
  const n = Object.keys(clips).length;
  $("clipCount").textContent = !configured ? "Clips are off until Firebase is set up." : !clipsReady ? "Loading clips…" : n ? `${n} clip${n > 1 ? "s" : ""} ready` : "No clips yet. Add them in Admin.";
}
function rebuildQ() {
  Q.length = BASE;
  for (const d of CUSTOM) {
    if (!d || !d.key) continue;
    const kind = d.kind === "tv" ? "tv" : "movie";
    if (d.scene && Array.isArray(d.scene.o) && d.scene.o.length === 4)
      Q.push({ c: "Name that scene", t: kind, custom: 1, q: kind === "tv" ? "Which show is this scene from?" : "Which movie is this scene from?", o: d.scene.o.map(String), a: +d.scene.a || 0, id: d.key });
    (Array.isArray(d.hard) ? d.hard : []).forEach((h, i) => {
      if (h && h.q && Array.isArray(h.o) && h.o.length === 4)
        Q.push({ c: "Clip challenge", t: kind, hard: 1, custom: 1, clip: d.key, q: String(h.q), o: h.o.map(String), a: +h.a || 0, id: d.key + "-h" + i });
    });
  }
}
const ready = (async () => {
  if (!configured) { clipsReady = true; updateCount(); return false }
  try {
    FB = await loadFirebase();
    const { A, F, auth, db } = FB;
    await new Promise(res => { const un = A.onAuthStateChanged(auth, u => { if (u) { ME = u; un(); res() } }); });
    F.onSnapshot(F.collection(db, "clips"), sn => { const m = {}; sn.forEach(d => { const v = d.data(); if (v && v.u) m[d.id] = v }); clips = m; clipsReady = true; updateCount() }, () => { clipsReady = true; updateCount() });
    F.onSnapshot(F.collection(db, "custom"), sn => { CUSTOM = sn.docs.map(d => ({ key: d.id, ...d.data() })); rebuildQ() }, () => { });
    return true;
  } catch (e) { console.error(e); clipsReady = true; updateCount(); return false }
})();
// Sign in anonymously unless someone (the admin) is already signed in on this browser.
(async () => {
  if (!configured) return;
  try { const { A, auth } = await loadFirebase(); await auth.authStateReady(); if (!auth.currentUser) await A.signInAnonymously(auth) } catch (e) { console.error(e) }
})();

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
  $("lenLabel").textContent = mode === "local" ? "Questions per player" : "Questions";
  $("startBtn").textContent = mode === "local" ? "Roll the film" : "Open the lobby";
  $("setupWarn").classList.add("hide");
  $("modeNote").textContent = mode === "host"
    ? "TV + phones: put this page on the TV. Players open the same site on their phones and tap Join a game. Everyone answers every question; faster right answers score more."
    : "One screen: players take turns on this device. 20 seconds per question, 100 points for a right answer plus up to 100 for speed. Keys 1–4 answer.";
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
let deck = [], idx = 0, timer = null, left = 0, locked = false, answering = false;
function paintQuestion(q, label, turnText, tiles) {
  $("qnum").textContent = label; $("pts").textContent = "";
  $("turn").textContent = turnText; $("cat").textContent = q.c; $("qtext").textContent = q.q;
  $("opts").innerHTML = q.o.map((o, i) => `<button class="opt${tiles ? " tile L" + i : ""}" data-i="${i}" ${tiles ? 'tabindex="-1"' : ""}><b>${tiles ? LET[i] : i + 1}</b><span>${esc(o)}</span></button>`).join("");
  $("result").textContent = ""; $("nextBtn").classList.add("hide");
  const c = clips[ck(q)];
  if (c) {
    $("emoji").classList.add("hide"); $("screen").classList.remove("hide"); $("answerArea").classList.add("hide"); $("revealBtn").classList.remove("hide");
    vid.src = c.u; vid.currentTime = 0; const pr = vid.play(); if (pr && pr.catch) pr.catch(() => { });
    $("qtext").textContent = "Watch the clip…"; return true;
  }
  stopVideo(); $("screen").classList.add("hide"); $("revealBtn").classList.add("hide");
  $("emoji").textContent = q.e || ""; $("emoji").classList.toggle("hide", !q.e); return false;
}
function stopVideo() { vid.pause(); if (vid.getAttribute("src")) { vid.removeAttribute("src"); vid.load() } }
function startTimer(onTick, onEnd) {
  $("qtext").textContent = deck[idx].q; $("revealBtn").classList.add("hide"); $("answerArea").classList.remove("hide");
  left = T; $("bar").style.width = "100%"; clearInterval(timer);
  timer = setInterval(() => { left -= .1; $("bar").style.width = Math.max(0, left / T * 100) + "%"; onTick && onTick(); if (left <= 0) onEnd() }, 100);
}
vid.addEventListener("ended", () => { if (!$("play").classList.contains("hide")) beginAnswers() });
vid.addEventListener("error", () => { if (!$("play").classList.contains("hide") && vid.getAttribute("src")) { $("result").textContent = "That clip wouldn't play, so here's the question without it."; $("screen").classList.add("hide"); beginAnswers() } });
$("revealBtn").addEventListener("click", () => { vid.pause(); beginAnswers() });
function beginAnswers() { if (answering) return; answering = true; if (mode === "host") hostBeginAnswer(); else startTimer(null, () => answer(-1)) }

/* ---------- one-screen mode ---------- */
function startLocal() {
  if (!players.length) { $("pname").focus(); return }
  deck = buildDeck(per * players.length);
  if (!deck.length) { warn("No questions available for that category yet. Add clips in Admin or pick another category."); return }
  players.forEach(p => p.s = 0); idx = 0; show("play"); ask();
}
function ask() {
  const q = deck[idx], p = idx % players.length; locked = false; answering = false; clearInterval(timer);
  renderBoard(p);
  if (!paintQuestion(q, `Question ${idx + 1} of ${deck.length}`, `${players[p].n}, you're up`, false)) beginAnswers();
}
function answer(i) {
  if (mode !== "local" || locked || !answering) return; locked = true; clearInterval(timer);
  const q = deck[idx], p = players[idx % players.length];
  [...$("opts").children].forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add("right"); else if (k === i) b.classList.add("wrong") });
  if (i === q.a) { const pts = 100 + Math.round(Math.max(0, left) / T * 100); p.s += pts; $("result").textContent = `Correct! +${pts} points`; $("pts").textContent = `+${pts}` }
  else $("result").textContent = (i < 0 ? "Time's up. " : "Not quite. ") + `It was ${q.o[q.a]}.`;
  renderBoard(idx % players.length);
  const nb = $("nextBtn"); nb.textContent = idx + 1 < deck.length ? "Next question" : "See the results"; nb.classList.remove("hide"); nb.focus();
}
function next() { stopVideo(); if (mode === "host") { hostNext(); return } idx++; if (idx < deck.length) ask(); else finish() }
function finish() {
  stopVideo(); show("end"); const r = [...players].sort((a, b) => b.s - a.s);
  const tie = r.length > 1 && r[0].s === r[1].s;
  $("winner").textContent = r.length === 1 ? `${r[0].n} scored ${r[0].s}` : tie ? "It's a tie at the top!" : `${r[0].n} takes the Oscar`;
  $("podium").innerHTML = r.map((p, i) => `<li><span>${i + 1}. ${esc(p.n)}</span><span class="n">${p.s} pts</span></li>`).join("");
  renderBoard(-1);
}
$("opts").addEventListener("click", e => { const b = e.target.closest(".opt"); if (b) answer(+b.dataset.i) });
$("nextBtn").addEventListener("click", next);
$("startBtn").addEventListener("click", () => mode === "local" ? startLocal() : openLobby());
$("againBtn").addEventListener("click", () => mode === "local" ? startLocal() : hostStart());
$("newBtn").addEventListener("click", goHome);
$("exitBtn").addEventListener("click", goHome);
function goHome() {
  clearInterval(timer); clearTimeout(autoNext); locked = true; answering = false; stopVideo();
  if (H) closeRoom();
  players.forEach(p => p.s = 0); show("setup"); renderBoard(-1); window.scrollTo(0, 0);
}
document.addEventListener("keydown", e => {
  if ($("play").classList.contains("hide") || e.target.tagName === "INPUT") return;
  const n = +e.key;
  if (mode === "local" && !locked && answering && n >= 1 && n <= deck[idx].o.length) answer(n - 1);
  else if ((e.key === "Enter" || e.key === " ") && !$("nextBtn").classList.contains("hide") && document.activeElement !== $("nextBtn")) { e.preventDefault(); next() }
});

/* ---------- TV host mode (Firestore room) ----------
   Nothing about a game is kept. Scores live only in the TV's memory; the room
   document is just the live channel to the phones and is deleted when the TV
   leaves the game (or closes the page). */
async function closeRoom() {
  const h = H; H = null; if (!h || !FB) return;
  if (h.unsub) h.unsub();
  const { F, db } = FB;
  try { await F.updateDoc(h.ref, { "state.phase": "closed" }) } catch (e) { }
  try { const ps = await F.getDocs(F.collection(db, "rooms", h.code, "players")); await Promise.all(ps.docs.map(d => F.deleteDoc(d.ref))) } catch (e) { }
  try { await F.deleteDoc(h.ref) } catch (e) { }
}
addEventListener("pagehide", () => { if (H) closeRoom() });
let H = null, autoNext = null;
const CODECH = "ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () => Array.from({ length: 4 }, () => CODECH[Math.floor(Math.random() * CODECH.length)]).join("");
async function openLobby() {
  if (!configured) { warn("TV + phones needs Firebase set up first (see README). One screen mode works now."); return }
  const btn = $("startBtn"); btn.disabled = true; btn.textContent = "Opening the lobby…";
  try {
    if (!await ready || !ME) throw new Error("not ready");
    const { F, db } = FB;
    let code = null;
    for (let t = 0; t < 6 && !code; t++) {
      const c = newCode();
      try { await F.setDoc(F.doc(db, "rooms", c), { hostUid: ME.uid, created: F.serverTimestamp(), expiresAt: new Date(Date.now() + 6 * 3600e3), state: { phase: "lobby", code: c, players: [] } }); code = c }
      catch (e) { /* code taken by another host: try another */ }
    }
    if (!code) throw new Error("no code");
    H = { code, ref: F.doc(db, "rooms", code), phase: "lobby", rid: "", i: 0, players: new Map(), answers: {}, deadline: 0, gains: {} };
    H.unsub = F.onSnapshot(F.collection(db, "rooms", code, "players"), sn => syncPlayers(sn.docs.map(d => ({ k: d.id, ...d.data() }))));
    $("roomCode").textContent = code; show("lobby"); renderLobby();
  } catch (e) { console.error(e); warn("Couldn't open a lobby. Check your connection and try again.") }
  finally { btn.disabled = false; btn.textContent = "Open the lobby" }
}
function syncPlayers(list) {
  if (!H) return; let changed = false; const here = new Set();
  for (const p of list) {
    here.add(p.k);
    const n = String(p.name || "Player").slice(0, 18);
    let pl = H.players.get(p.k);
    if (!pl) { pl = { k: p.k, n, s: 0, on: true }; H.players.set(p.k, pl); changed = true }
    else if (pl.n !== n || !pl.on) { pl.n = n; pl.on = true; changed = true }
    const a = p.ans;
    if (H.phase === "answer" && a && a.rid === H.rid && a.i === H.i && !(p.k in H.answers) && Number.isInteger(a.c) && a.c >= 0 && a.c < deck[H.i].o.length) {
      H.answers[p.k] = { c: a.c, left: Math.max(0, (H.deadline - Date.now()) / 1000) }; changed = true;
    }
  }
  for (const pl of H.players.values()) if (!here.has(pl.k) && pl.on) { pl.on = false; changed = true }
  if (!changed) return;
  hostWrite();
  if (H.phase === "lobby") renderLobby();
  else { renderHostBoard(); if (H.phase === "answer") { hostAnsweredNote(); const on = [...H.players.values()].filter(p => p.on); if (on.length && on.every(p => p.k in H.answers)) hostReveal() } }
}
function renderLobby() {
  const ps = [...H.players.values()];
  $("lobbyList").innerHTML = ps.map(p => `<span class="chip${p.on ? "" : " off"}">${esc(p.n)}</span>`).join("");
  const on = ps.filter(p => p.on).length;
  $("lobbyNote").textContent = on ? `${on} player${on > 1 ? "s" : ""} in. Start when everyone's here.` : "Waiting for players…";
  $("hostGo").disabled = !on;
}
$("hostGo").addEventListener("click", hostStart);
$("lobbyExit").addEventListener("click", goHome);
function hostStart() {
  if (!H) { openLobby(); return }
  deck = buildDeck(per);
  if (!deck.length) { show("lobby"); $("lobbyNote").textContent = "No questions available for that category yet. Exit and pick another category."; return }
  for (const p of H.players.values()) p.s = 0;
  H.rid = Math.random().toString(36).slice(2, 8); idx = 0; hostAsk();
}
function hostAsk() {
  clearTimeout(autoNext); clearInterval(timer);
  H.i = idx; H.answers = {}; H.gains = {}; locked = false; answering = false;
  show("play");
  const hasC = paintQuestion(deck[idx], `Question ${idx + 1} of ${deck.length}`, clips[ck(deck[idx])] ? "Eyes on the screen" : "Answer on your phone", true);
  renderHostBoard();
  if (hasC) { H.phase = "watch"; hostWrite() } else beginAnswers();
}
function hostBeginAnswer() {
  H.phase = "answer"; H.deadline = Date.now() + T * 1000;
  $("turn").textContent = "Answer on your phone"; hostAnsweredNote();
  startTimer(null, hostReveal); hostWrite();
}
function hostAnsweredNote() { const on = [...H.players.values()].filter(p => p.on).length; $("result").textContent = `${Object.keys(H.answers).length} of ${on} answered` }
function hostReveal() {
  if (!H || H.phase !== "answer") return;
  clearInterval(timer); H.phase = "reveal"; answering = false;
  const q = deck[idx];
  for (const p of H.players.values()) { const a = H.answers[p.k]; let g = 0; if (a && a.c === q.a) { g = 100 + Math.round(a.left / T * 100); p.s += g } H.gains[p.k] = { g, r: !!(a && a.c === q.a) } }
  [...$("opts").children].forEach((b, k) => b.classList.add(k === q.a ? "right" : "dim"));
  const right = Object.values(H.gains).filter(x => x.r).length;
  $("result").textContent = `It's ${LET[q.a]}: ${q.o[q.a]}. ${right} got it right.`;
  renderHostBoard(true); hostWrite();
  const nb = $("nextBtn"); let n = 10; const lab = () => nb.textContent = (idx + 1 < deck.length ? "Next question" : "See the results") + ` (${n})`; lab(); nb.classList.remove("hide");
  clearTimeout(autoNext); const tick = () => { n--; if (n <= 0) { next(); return } lab(); autoNext = setTimeout(tick, 1000) }; autoNext = setTimeout(tick, 1000);
}
function hostNext() { clearTimeout(autoNext); idx++; if (idx < deck.length) hostAsk(); else hostEnd() }
function hostEnd() {
  H.phase = "end"; stopVideo(); show("end");
  const r = [...H.players.values()].sort((a, b) => b.s - a.s);
  const tie = r.length > 1 && r[0].s === r[1].s;
  $("winner").textContent = !r.length ? "Game over" : r.length === 1 ? `${r[0].n} scored ${r[0].s}` : tie ? "It's a tie at the top!" : `${r[0].n} takes the Oscar`;
  $("podium").innerHTML = r.map((p, i) => `<li><span>${i + 1}. ${esc(p.n)}</span><span class="n">${p.s} pts</span></li>`).join("");
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
let lastWrite = "";
function hostWrite() {
  if (!H || !FB) return;
  const q = deck[H.i];
  const st = { code: H.code, rid: H.rid, phase: H.phase, i: H.i, total: deck.length,
    players: [...H.players.values()].map(p => ({ k: p.k, n: p.n, s: p.s, a: p.k in H.answers, g: (H.gains[p.k] || {}).g || 0, r: !!(H.gains[p.k] || {}).r })) };
  if (q && (st.phase === "answer" || st.phase === "reveal" || st.phase === "watch")) { st.q = { c: q.c, q: q.q, o: q.o }; if (st.phase === "answer") st.secs = T; if (st.phase === "reveal") st.correct = q.a }
  const j = JSON.stringify(st); if (j === lastWrite) return; lastWrite = j;
  FB.F.updateDoc(H.ref, { state: st, updated: FB.F.serverTimestamp() }).catch(e => console.error(e));
}

/* ---------- phone controller ---------- */
let P = null;
$("toJoin").addEventListener("click", () => { show("join"); try { $("jname").value = localStorage.getItem("reelsmart-name") || "" } catch (e) { } $("jname").focus() });
$("joinBack").addEventListener("click", () => show("setup"));
$("jcode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "") });
$("joinForm").addEventListener("submit", async e => {
  e.preventDefault(); const w = $("joinWarn"); w.classList.add("hide");
  const fail = t => { w.textContent = t; w.classList.remove("hide") };
  const name = $("jname").value.trim().slice(0, 18), code = $("jcode").value.trim().toUpperCase();
  if (!name || code.length !== 4) { fail("Enter your name and the 4-letter code on the TV."); return }
  if (!configured) { fail("This site isn't connected to its game server yet."); return }
  const btn = $("joinBtn"); btn.disabled = true; btn.textContent = "Joining…";
  try {
    if (!await ready || !ME) throw new Error("not ready");
    const { F, db } = FB;
    const room = await F.getDoc(F.doc(db, "rooms", code));
    if (!room.exists() || (room.data().state || {}).phase === "closed") { fail(`Can't find room ${code}. Check the code on the TV.`); return }
    try { localStorage.setItem("reelsmart-name", name) } catch (e) { }
    const pref = F.doc(db, "rooms", code, "players", ME.uid);
    await F.setDoc(pref, { name, ans: null, joined: F.serverTimestamp() });
    P = { name, code, pref, st: room.data().state || null, mine: {}, sig: "" };
    P.unsub = F.onSnapshot(F.doc(db, "rooms", code), s => { if (!P) return; P.st = s.exists() ? (s.data().state || null) : { phase: "closed" }; renderPhone() });
    $("phCode").textContent = "Room " + code; $("phName").textContent = name; show("phone"); renderPhone();
  } catch (err) { console.error(err); fail("Couldn't join. Check your connection and try again.") }
  finally { btn.disabled = false; btn.textContent = "Join" }
});
$("phLeave").addEventListener("click", () => {
  if (P) { if (P.unsub) P.unsub(); FB.F.deleteDoc(P.pref).catch(() => { }) }
  P = null; show("setup");
});
function renderPhone() {
  if (!P) return; const st = P.st, b = $("phBody"), k = ME && ME.uid;
  const me = st && Array.isArray(st.players) ? st.players.find(p => p.k === k) : null;
  $("phScore").textContent = (me ? me.s : 0) + " pts";
  const msg = (t, s) => `<div class="pmsg">${esc(t)}${s ? `<small>${esc(s)}</small>` : ""}</div>`;
  if (!st) { b.innerHTML = msg("Connecting…", "Looking for the game on the TV."); return }
  if (st.phase === "closed") { b.innerHTML = msg("The host closed the game.", "Tap Leave to join another."); return }
  if (st.phase === "lobby") { const n = (st.players || []).length; b.innerHTML = msg("You're in!", `Watch the TV. ${n} player${n === 1 ? "" : "s"} so far.`); return }
  if (st.phase === "end") {
    const r = [...st.players].sort((a, c) => c.s - a.s); const pos = r.findIndex(p => p.k === k) + 1;
    b.innerHTML = msg(pos === 1 ? "You win!" : pos ? `You finished #${pos}` : "Game over", me ? `${me.s} points` : ""); return;
  }
  const head = `<div class="note" style="margin:10px 0 0">Question ${st.i + 1} of ${st.total} · ${esc(st.q ? st.q.c : "")}</div>`;
  if (st.phase === "watch") { b.innerHTML = head + msg("Watch the clip on the TV…", "Your answers will appear here."); return }
  const key = st.rid + ":" + st.i, mine = P.mine[key];
  const sig = st.phase + "|" + key + "|" + mine + "|" + (me && me.a);
  if (st.phase === "answer" && P.sig === sig && b.children.length) return;
  P.sig = sig;
  if (st.phase === "answer") {
    if (mine != null) { b.innerHTML = head + `<div class="pgrid2">${st.q.o.map((o, i) => `<button class="pb L${i} ${i === mine ? "pick" : "faded"}" disabled><i>${LET[i]}</i>${esc(o)}</button>`).join("")}</div>` + msg("Locked in!", "Waiting for everyone else."); return }
    b.innerHTML = head + `<div class="q" style="margin-top:8px">${esc(st.q.q)}</div><div class="pgrid2">${st.q.o.map((o, i) => `<button class="pb L${i}" data-c="${i}"><i>${LET[i]}</i>${esc(o)}</button>`).join("")}</div>`;
    return;
  }
  if (st.phase === "reveal") {
    const c = st.correct, right = me && me.r;
    b.innerHTML = head + `<div class="big">${right ? "Correct!" : "Not quite"}</div>` + msg(right ? `+${me.g} points` : `It was ${LET[c]}: ${st.q.o[c]}`, "Next question coming up on the TV.");
  }
}
$("phBody").addEventListener("click", e => {
  const btn = e.target.closest(".pb[data-c]"); if (!btn || !P || !P.st || P.st.phase !== "answer") return;
  const c = +btn.dataset.c, st = P.st; P.mine[st.rid + ":" + st.i] = c;
  FB.F.updateDoc(P.pref, { ans: { rid: st.rid, i: st.i, c } }).catch(() => { delete P.mine[st.rid + ":" + st.i]; renderPhone() });
  renderPhone();
});

renderChips(); applyMode(); updateCount();
