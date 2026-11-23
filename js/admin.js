import { Q } from "./questions.js?v=1795472675";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
Q.forEach(q => q.id = slug(q.c + "-" + q.o[q.a]));
const LET = ["A", "B", "C", "D"];

// Which GitHub repo is this? apardali.github.io/reel-smart → apardali/reel-smart
const host = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "apardali";
const repoName = location.hostname.endsWith(".github.io") ? (location.pathname.split("/")[1] || "reel-smart") : "reel-smart";
const GH = `https://github.com/${host}/${repoName}`;

const bulbs = $("bulbs");
const drawBulbs = () => { const w = bulbs.clientWidth, h = bulbs.clientHeight, step = 26; let html = "", k = 0;
  for (let x = 8; x < w - 8; x += step) { const d = (k++ % 3) * .4; html += `<i style="left:${x - 5}px;top:4px;animation-delay:${d}s"></i><i style="left:${x - 5}px;bottom:4px;animation-delay:${d}s"></i>` }
  for (let y = step; y < h - step / 2; y += step) { const d = (k++ % 3) * .4; html += `<i style="left:4px;top:${y - 5}px;animation-delay:${d}s"></i><i style="right:4px;top:${y - 5}px;animation-delay:${d}s"></i>` }
  bulbs.innerHTML = html };
const bulbObs = new ResizeObserver(drawBulbs); bulbObs.observe(bulbs);
const msg = (t, w) => { const n = $("aStatus"); n.textContent = t; n.classList.toggle("warn", !!w) };

$("tabPick").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
  $("tabPick").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  ["add", "have"].forEach(t => $("tab-" + t).classList.toggle("hide", t !== b.dataset.v)); if (b.dataset.v === "have") loadHave() });

let aKind = "movie", aFile = null, aUrl = null;
$("aKind").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("aKind").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); aKind = b.dataset.v });
$("aScene").addEventListener("change", e => $("sceneFields").classList.toggle("hide", !e.target.checked));
$("aFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return; aFile = f;
  if (aUrl) URL.revokeObjectURL(aUrl); aUrl = URL.createObjectURL(f); $("aPrev").src = aUrl; $("aPrev").classList.remove("hide");
  $("aFileName").textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`;
  if (!$("aTitle").value.trim()) $("aTitle").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
  msg(f.size > 95 * 1048576 ? "GitHub only accepts files under 100 MB. Trim or compress this clip first." : "", f.size > 95 * 1048576);
});
let hardN = 0;
$("addHard").addEventListener("click", () => {
  if ($("hardCards").children.length >= 3) return; const i = hardN++;
  const d = document.createElement("div"); d.className = "rcard";
  d.innerHTML = `<div class="row" style="justify-content:space-between"><h4 style="margin:0">Clip challenge question</h4><button type="button" class="ghost exit" data-rm>Remove</button></div>
   <input type="text" data-f="q" maxlength="200" placeholder="Question, e.g. What falls from the ceiling in this scene?">
   ${[0, 1, 2, 3].map(o => `<div class="oprow"><input type="radio" name="ans${i}" value="${o}" ${o === 0 ? "checked" : ""} aria-label="Mark option ${LET[o]} correct"><input type="text" data-o="${o}" maxlength="80" placeholder="Option ${LET[o]}"></div>`).join("")}
   <div class="status" style="margin-top:6px">Tick the correct answer. The order is shuffled in each game.</div>`;
  d.querySelector("[data-rm]").addEventListener("click", () => d.remove()); $("hardCards").append(d);
});
$("build").addEventListener("click", () => {
  const title = $("aTitle").value.trim();
  if (!title) { msg("Add the movie or show title.", true); return }
  let scene = null;
  if ($("aScene").checked) { const dis = [0, 1, 2].map(i => $("dis" + i).value.trim()); if (dis.some(x => !x)) { msg("Add three wrong answers for Name that scene.", true); return } scene = { o: [title, ...dis], a: 0 } }
  const hard = [];
  for (const card of $("hardCards").children) {
    const q = card.querySelector("[data-f=q]").value.trim(); const o = [0, 1, 2, 3].map(i => card.querySelector(`[data-o="${i}"]`).value.trim());
    const r = card.querySelector("input[type=radio]:checked");
    if (!q && o.every(x => !x)) continue;
    if (!q || o.some(x => !x) || !r) { msg("Each Clip challenge question needs the question and all four options.", true); return }
    hard.push({ q, o, a: +r.value });
  }
  if (!scene && !hard.length) { msg("Add Name that scene answers or at least one Clip challenge question.", true); return }
  let key = slug("Name that scene-" + title) || "clip";
  if (Q.some(q => q.id === key)) key = key.slice(0, 70) + "-" + Math.random().toString(36).slice(2, 6);
  const ext = aFile ? ((aFile.name.match(/\.[a-z0-9]+$/i) || [".mp4"])[0].toLowerCase()) : ".mp4";
  const file = slug(title) + ext;
  const entry = { key, title, kind: aKind, clip: "clips/" + file, scene, hard };
  $("fname").textContent = file; $("json").textContent = JSON.stringify(entry, null, 2);
  $("upLink").href = `${GH}/upload/main/clips`; $("editLink").href = `${GH}/edit/main/data/custom.json`;
  $("steps").classList.remove("hide"); msg(""); $("steps").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("json").textContent); $("copy").textContent = "Copied" } catch (e) { const r = document.createRange(); r.selectNodeContents($("json")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("copy").textContent = "Selected: press Ctrl/Cmd+C" } setTimeout(() => $("copy").textContent = "Copy", 2500) });

async function loadHave() {
  const get = u => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [cm, cu] = await Promise.all([get("data/clips.json"), get("data/custom.json")]);
  const rows = [];
  for (const [k, v] of Object.entries(cm || {})) { const q = Q.find(x => x.id === k); rows.push({ t: q ? q.o[q.a] : k, s: "Built-in · " + v }) }
  for (const d of (Array.isArray(cu) ? cu : [])) rows.push({ t: d.title || d.key, s: `Added by you · ${(d.scene ? 1 : 0) + (d.hard || []).length} questions · ${d.clip || "no clip"}` });
  $("haveList").innerHTML = rows.length ? rows.sort((a, b) => a.t.localeCompare(b.t)).map(r => `<div class="cl"><div><div class="t">${esc(r.t)}</div><div class="s">${esc(r.s)}</div></div></div>`).join("") : '<p class="note">No clips yet.</p>';
}
