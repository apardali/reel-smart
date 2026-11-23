import { Q } from "./questions.js";
import { loadFirebase, configured, setupBanner, ADMIN_EMAIL } from "./fb.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
Q.forEach(q => q.id = slug(q.c + "-" + q.o[q.a]));
const LET = ["A", "B", "C", "D"];
const MAXMB = 100;
const SCREENS = ["signin", "verify", "enroll", "tools"];
const show = id => SCREENS.forEach(s => $(s).classList.toggle("hide", s !== id));
const msg = (id, t, warn) => { const n = $(id); n.textContent = t; n.classList.toggle("warn", !!warn) };
setupBanner($("setupBanner"));

/* marquee bulbs */
const bulbs = $("bulbs");
const drawBulbs = () => { const w = bulbs.clientWidth, h = bulbs.clientHeight, step = 26; let html = "", k = 0;
  for (let x = 8; x < w - 8; x += step) { const d = (k++ % 3) * .4; html += `<i style="left:${x - 5}px;top:4px;animation-delay:${d}s"></i><i style="left:${x - 5}px;bottom:4px;animation-delay:${d}s"></i>` }
  for (let y = step; y < h - step / 2; y += step) { const d = (k++ % 3) * .4; html += `<i style="left:4px;top:${y - 5}px;animation-delay:${d}s"></i><i style="right:4px;top:${y - 5}px;animation-delay:${d}s"></i>` }
  bulbs.innerHTML = html };
const bulbObs = new ResizeObserver(drawBulbs); bulbObs.observe(bulbs);

let FB = null, resolver = null, totpSecret = null, clips = {}, CUSTOM = [], listening = false;

if (!configured) { $("loginBtn").disabled = true; msg("loginMsg", "Add your Firebase details to js/firebase-config.js first (see README).", true) }
else init();

async function init() {
  FB = await loadFirebase();
  const { A, auth } = FB;
  A.onAuthStateChanged(auth, u => route(u));
}

async function route(u) {
  if (!u || u.isAnonymous) { show("signin"); return }
  if ((u.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await FB.A.signOut(FB.auth); show("signin"); msg("loginMsg", "That account isn't an admin for this game.", true); return;
  }
  if (!u.emailVerified) { show("verify"); return }
  const enrolled = FB.A.multiFactor(u).enrolledFactors.some(f => f.factorId === "totp");
  if (!enrolled) { show("enroll"); startEnroll(); return }
  const tok = await u.getIdTokenResult();
  if ((tok.claims.firebase || {}).sign_in_second_factor !== "totp") {
    await FB.A.signOut(FB.auth); show("signin"); msg("loginMsg", "Please sign in again with your Authenticator code."); return;
  }
  $("who").textContent = u.email; show("tools"); startData();
}

/* ---------- sign in ---------- */
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!FB) return;
  const btn = $("loginBtn"); btn.disabled = true; msg("loginMsg", "Signing in…");
  try {
    await FB.A.signInWithEmailAndPassword(FB.auth, $("email").value.trim(), $("pw").value);
    msg("loginMsg", "");
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") {
      resolver = FB.A.getMultiFactorResolver(FB.auth, err);
      $("loginForm").classList.add("hide"); $("totpForm").classList.remove("hide"); $("totp").focus(); msg("loginMsg", "");
    } else {
      msg("loginMsg", err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found" ? "Email or password is wrong." : err.code === "auth/too-many-requests" ? "Too many tries. Wait a few minutes and try again." : "Couldn't sign in. Check your connection and try again.", true);
      $("resetBtn").classList.remove("hide");
    }
  } finally { btn.disabled = false }
});
$("totpForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!resolver) return;
  const btn = $("totpBtn"); btn.disabled = true;
  try {
    const hint = resolver.hints.find(h => h.factorId === "totp") || resolver.hints[0];
    const assertion = FB.A.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, $("totp").value.trim());
    await resolver.resolveSignIn(assertion);
    resolver = null; $("totp").value = ""; $("totpForm").classList.add("hide"); $("loginForm").classList.remove("hide"); $("pw").value = "";
  } catch (err) { msg("loginMsg", "That code didn't work. Check the time on your phone and try the newest code.", true) }
  finally { btn.disabled = false }
});
$("resetBtn").addEventListener("click", async () => {
  const em = $("email").value.trim(); if (!em) { msg("loginMsg", "Type your email above first.", true); return }
  try { await FB.A.sendPasswordResetEmail(FB.auth, em); msg("loginMsg", "If that's the admin account, a reset link is on its way.") } catch (e) { msg("loginMsg", "Couldn't send the reset email.", true) }
});
document.querySelectorAll("[data-signout]").forEach(b => b.addEventListener("click", () => FB && FB.A.signOut(FB.auth)));

/* ---------- email verification ---------- */
$("sendVerify").addEventListener("click", async () => {
  try { await FB.A.sendEmailVerification(FB.auth.currentUser); msg("verifyMsg", "Sent. Click the link in the email, then come back and sign in again.") }
  catch (e) { msg("verifyMsg", e.code === "auth/too-many-requests" ? "Already sent recently. Check your inbox and spam folder." : "Couldn't send it. Try again.", true) }
});

/* ---------- Authenticator enrollment ---------- */
async function startEnroll() {
  msg("enrollMsg", "Preparing your setup key…");
  try {
    const u = FB.auth.currentUser;
    const session = await FB.A.multiFactor(u).getSession();
    totpSecret = await FB.A.TotpMultiFactorGenerator.generateSecret(session);
    const url = totpSecret.generateQrCodeUrl(u.email, "Reel Smart");
    $("secretKey").textContent = totpSecret.secretKey.replace(/(.{4})/g, "$1 ").trim();
    $("otpLink").href = url;
    const draw = () => { if (window.qrcode) { const qr = window.qrcode(0, "M"); qr.addData(url); qr.make(); $("qr").innerHTML = qr.createSvgTag(4, 0) } else $("qr").classList.add("hide") };
    if (window.qrcode) draw(); else setTimeout(draw, 1500);
    msg("enrollMsg", "");
  } catch (e) {
    msg("enrollMsg", e.code === "auth/requires-recent-login" ? "For safety, sign out and sign in again, then set up the Authenticator." : e.code === "auth/operation-not-allowed" ? "Authenticator sign-in isn't turned on in Firebase yet (README step 4)." : "Couldn't start Authenticator setup. Try signing in again.", true);
  }
}
$("enrollForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!totpSecret) return;
  const btn = $("enrollBtn"); btn.disabled = true;
  try {
    const assertion = FB.A.TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, $("enrollCode").value.trim());
    await FB.A.multiFactor(FB.auth.currentUser).enroll(assertion, "Authenticator");
    msg("enrollMsg", "Authenticator is on. Sign in again with your password and a code.");
    setTimeout(() => FB.A.signOut(FB.auth), 1800);
  } catch (err) { msg("enrollMsg", "That code didn't match. Try the newest code from the app.", true) }
  finally { btn.disabled = false }
});

/* ---------- data ---------- */
function startData() {
  if (listening) return; listening = true;
  const { F, db } = FB;
  F.onSnapshot(F.collection(db, "clips"), sn => { const m = {}; sn.forEach(d => m[d.id] = d.data()); clips = m; renderClips(); renderMine() });
  F.onSnapshot(F.collection(db, "custom"), sn => { CUSTOM = sn.docs.map(d => ({ key: d.id, ...d.data() })); renderMine() });
}
const tabs = ["add", "bulk", "attach", "mine"];
$("tabPick").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  $("tabPick").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  tabs.forEach(t => $("tab-" + t).classList.toggle("hide", t !== b.dataset.v));
  if (b.dataset.v === "attach") renderClips();
});

function upload(file, base, progEl) {
  return new Promise((res, rej) => {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".mp4"])[0].toLowerCase();
    const path = `clips/${base}-${Date.now()}${ext}`;
    const r = FB.S.ref(FB.storage, path);
    const task = FB.S.uploadBytesResumable(r, file, { contentType: file.type || "video/mp4", cacheControl: "public,max-age=31536000" });
    if (progEl) { progEl.classList.remove("hide"); progEl.firstElementChild.style.width = "0" }
    task.on("state_changed", s => { if (progEl) progEl.firstElementChild.style.width = (s.bytesTransferred / s.totalBytes * 100) + "%" }, rej,
      async () => { try { res({ u: await FB.S.getDownloadURL(r), path, n: file.name }) } catch (e) { rej(e) } });
  });
}
async function removeStorage(path) { if (!path) return; try { await FB.S.deleteObject(FB.S.ref(FB.storage, path)) } catch (e) { } }
async function setClip(qid, file, progEl) {
  const old = clips[qid];
  const c = await upload(file, qid.slice(0, 60), progEl);
  await FB.F.setDoc(FB.F.doc(FB.db, "clips", qid), { ...c, updated: FB.F.serverTimestamp() });
  if (old && old.path && old.path !== c.path) await removeStorage(old.path);
}
const tooBig = f => f.size > MAXMB * 1048576;

/* ---------- add a new clip ---------- */
let aKind = "movie", aFile = null, aUrl = null;
$("aKind").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("aKind").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); aKind = b.dataset.v });
$("aScene").addEventListener("change", e => $("sceneFields").classList.toggle("hide", !e.target.checked));
$("aFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  if (!f.type.startsWith("video/")) { msg("aStatus", "That file isn't a video. Try an .mp4, .mov or .webm clip.", true); return }
  aFile = f; if (aUrl) URL.revokeObjectURL(aUrl); aUrl = URL.createObjectURL(f);
  $("aPrev").src = aUrl; $("aPrev").classList.remove("hide");
  $("aFileName").textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`;
  if (!$("aTitle").value.trim()) $("aTitle").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
  msg("aStatus", tooBig(f) ? `This clip is over ${MAXMB} MB. Trim or compress it first.` : "", tooBig(f));
});
let hardN = 0;
function addHardCard() {
  if ($("hardCards").children.length >= 3) return;
  const i = hardN++;
  const d = document.createElement("div"); d.className = "rcard"; d.dataset.h = i;
  d.innerHTML = `<div class="row" style="justify-content:space-between"><h4 style="margin:0">Clip challenge question</h4><button type="button" class="ghost exit" data-rm>Remove</button></div>
   <input type="text" data-f="q" maxlength="200" placeholder="Question, e.g. What falls from the ceiling in this scene?">
   ${[0, 1, 2, 3].map(o => `<div class="oprow"><input type="radio" name="ans${i}" value="${o}" ${o === 0 ? "checked" : ""} aria-label="Mark option ${LET[o]} correct"><input type="text" data-o="${o}" maxlength="80" placeholder="Option ${LET[o]}"></div>`).join("")}
   <div class="status" style="margin-top:6px">Tick the correct answer. The order is shuffled in each game.</div>`;
  d.querySelector("[data-rm]").addEventListener("click", () => d.remove());
  $("hardCards").append(d);
}
$("addHard").addEventListener("click", addHardCard);
$("aSave").addEventListener("click", async () => {
  const title = $("aTitle").value.trim();
  if (!aFile) { msg("aStatus", "Choose a video clip first.", true); return }
  if (tooBig(aFile)) { msg("aStatus", `This clip is over ${MAXMB} MB. Trim or compress it first.`, true); return }
  if (!title) { msg("aStatus", "Add the movie or show title.", true); return }
  let scene = null;
  if ($("aScene").checked) {
    const dis = [0, 1, 2].map(i => $("dis" + i).value.trim());
    if (dis.some(x => !x)) { msg("aStatus", "Add three wrong answers for Name that scene.", true); return }
    scene = { o: [title, ...dis], a: 0 };
  }
  const hard = [];
  for (const card of $("hardCards").children) {
    const q = card.querySelector("[data-f=q]").value.trim(); const o = [0, 1, 2, 3].map(i => card.querySelector(`[data-o="${i}"]`).value.trim());
    const r = card.querySelector("input[type=radio]:checked");
    if (!q && o.every(x => !x)) continue;
    if (!q || o.some(x => !x) || !r) { msg("aStatus", "Each Clip challenge question needs the question and all four options.", true); return }
    hard.push({ q, o, a: +r.value });
  }
  if (!scene && !hard.length) { msg("aStatus", "Add Name that scene answers or at least one Clip challenge question.", true); return }
  let key = slug("Name that scene-" + title) || "clip";
  if (Q.some(q => q.id === key) || CUSTOM.some(d => d.key === key) || clips[key]) key = key.slice(0, 70) + "-" + Math.random().toString(36).slice(2, 6);
  const btn = $("aSave"); btn.disabled = true; msg("aStatus", "Uploading the clip…");
  try {
    await setClip(key, aFile, $("aProg"));
    msg("aStatus", "Saving the questions…");
    await FB.F.setDoc(FB.F.doc(FB.db, "custom", key), { key, title, kind: aKind, scene, hard, created: FB.F.serverTimestamp() });
    msg("aStatus", `Saved! "${title}" is in the game now.`);
    aFile = null; $("aFile").value = ""; $("aFileName").textContent = ""; $("aTitle").value = ""; [0, 1, 2].forEach(i => $("dis" + i).value = ""); $("hardCards").innerHTML = "";
    $("aPrev").pause(); $("aPrev").removeAttribute("src"); $("aPrev").classList.add("hide"); $("aProg").classList.add("hide");
  } catch (e) { console.error(e); msg("aStatus", e && e.code === "storage/unauthorized" ? "Upload refused. Sign out and back in with your Authenticator code." : "Couldn't save. Check your connection and try again.", true) }
  finally { btn.disabled = false }
});

/* ---------- bulk import ---------- */
const norm = s => s.toLowerCase().normalize("NFKD").replace(/\.[a-z0-9]+$/, "").replace(/\b(the|movie|film|clip|scene)\b/g, "").replace(/[^a-z0-9]/g, "");
function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 3) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n] }
function matchFile(name) {
  const n = norm(name); let best = null, bd = 9;
  for (const q of Q) { if (q.c !== "Name that scene") continue; const t = norm(q.o[q.a]); const dd = t === n ? 0 : lev(t, n); if (dd < bd) { bd = dd; best = q } }
  return bd <= 2 ? best : null;
}
$("bFiles").addEventListener("change", async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  const rows = files.map(f => ({ f, q: matchFile(f.name) }));
  const ok = rows.filter(r => r.q && !tooBig(r.f) && r.f.type.startsWith("video/"));
  $("bList").innerHTML = rows.map(r => `<div class="cl"><div><div class="t">${esc(r.f.name)}</div><div class="s ${r.q && !tooBig(r.f) ? "has" : ""}">${tooBig(r.f) ? `Over ${MAXMB} MB, skipped` : r.q ? "→ " + esc(r.q.o[r.q.a]) : "No match. Add it under Add a new clip."}</div></div><div class="s" data-st="${esc(r.f.name)}"></div></div>`).join("");
  let done = 0; const prog = $("bProg"); prog.classList.remove("hide"); prog.firstElementChild.style.width = "0";
  for (const r of ok) {
    msg("bStatus", `Uploading ${done + 1} of ${ok.length}: ${r.f.name}`);
    const cell = [...$("bList").querySelectorAll("[data-st]")].find(x => x.dataset.st === r.f.name);
    try { await setClip(r.q.id, r.f, null); if (cell) cell.textContent = "Uploaded" } catch (err) { if (cell) cell.textContent = "Failed" }
    done++; prog.firstElementChild.style.width = (done / ok.length * 100) + "%";
  }
  msg("bStatus", `Done. ${done} clip${done === 1 ? "" : "s"} uploaded${rows.length - ok.length ? `, ${rows.length - ok.length} skipped` : ""}.`);
});

/* ---------- built-in questions ---------- */
let busy = {}, preview = null;
function renderClips() {
  const el = $("clipList"); if (!el || $("tab-attach").classList.contains("hide")) return;
  const term = $("clipSearch").value.trim().toLowerCase();
  el.innerHTML = [["movie", "Movies"], ["tv", "TV shows"]].map(([t, label]) => {
    const rows = Q.filter(q => !q.hard && q.t === t && (!term || (q.q + " " + q.o[q.a] + " " + q.c).toLowerCase().includes(term)));
    if (!rows.length) return "";
    return `<h3>${label}</h3>` + rows.map(q => { const c = clips[q.id];
      return `<div class="cl" data-id="${q.id}"><div><div class="t">${esc(q.o[q.a])}</div><div class="s">${esc(q.c)}: ${esc(q.e ? q.e + " " + q.q : q.q)}</div>
      <div class="s${c ? " has" : ""}">${busy[q.id] ? "Uploading…" : c ? "Clip: " + esc(c.n || "attached") : "No clip"}</div></div>
      <div class="acts"><label class="up${c ? " ghost" : ""}" style="margin:0"><input type="file" accept="video/*" data-act="file" ${busy[q.id] ? "disabled" : ""}>${c ? "Replace" : "Add clip"}</label>
      ${c ? `<button class="ghost" data-act="play">${preview === q.id ? "Hide" : "Preview"}</button><button class="ghost" data-act="del">Remove</button>` : ""}</div>
      ${c && preview === q.id ? `<video src="${esc(c.u)}" controls playsinline></video>` : ""}</div>` }).join("");
  }).join("") || '<p class="note">No questions match that search.</p>';
}
$("clipSearch").addEventListener("input", renderClips);
$("clipList").addEventListener("change", async e => {
  const i = e.target; if (i.dataset.act !== "file") return; const f = i.files[0]; i.value = ""; if (!f) return;
  const id = i.closest(".cl").dataset.id;
  if (!f.type.startsWith("video/") || tooBig(f)) { msg("cStatus", tooBig(f) ? `Over ${MAXMB} MB. Trim or compress it first.` : "That file isn't a video.", true); return }
  busy[id] = true; renderClips();
  try { await setClip(id, f, null); msg("cStatus", `Saved ${f.name}.`) } catch (err) { msg("cStatus", `Couldn't upload ${f.name}.`, true) }
  busy[id] = false; renderClips();
});
$("clipList").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return; const id = b.closest(".cl").dataset.id;
  if (b.dataset.act === "play") { preview = preview === id ? null : id; renderClips(); return }
  if (b.dataset.act === "del") {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap again to remove"; return }
    const c = clips[id]; try { await FB.F.deleteDoc(FB.F.doc(FB.db, "clips", id)); if (c) await removeStorage(c.path) } catch (err) { msg("cStatus", "Couldn't remove it.", true) }
  }
});

/* ---------- your clips ---------- */
function renderMine() {
  const el = $("aList"); if (!el) return;
  if (!CUSTOM.length) { el.innerHTML = '<p class="note">None yet. Clips you add under "Add a new clip" show up here.</p>'; return }
  el.innerHTML = [...CUSTOM].sort((a, b) => ((b.created && b.created.seconds) || 0) - ((a.created && a.created.seconds) || 0)).map(d => {
    const n = (d.scene ? 1 : 0) + (Array.isArray(d.hard) ? d.hard.length : 0);
    return `<div class="cl" data-k="${esc(d.key)}"><div><div class="t">${esc(d.title || d.key)}</div><div class="s">${d.kind === "tv" ? "TV show" : "Movie"} · ${n} question${n === 1 ? "" : "s"}${d.scene ? " · Name that scene" : ""}${d.hard && d.hard.length ? " · Clip challenge" : ""}${clips[d.key] ? "" : " · clip missing"}</div></div>
    <div class="acts"><button class="ghost" data-act="del">Delete</button></div></div>`;
  }).join("");
}
$("aList").addEventListener("click", async e => {
  const b = e.target.closest("button[data-act=del]"); if (!b) return;
  if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap again to delete"; return }
  const k = b.closest(".cl").dataset.k; b.disabled = true;
  try { const c = clips[k]; await FB.F.deleteDoc(FB.F.doc(FB.db, "custom", k)); await FB.F.deleteDoc(FB.F.doc(FB.db, "clips", k)); if (c) await removeStorage(c.path) }
  catch (err) { b.disabled = false; b.textContent = "Couldn't delete" }
});
