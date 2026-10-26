// Event Feedback front end. Home (/), the form (/f/slug) and results (/r/slug#key=...).
import qrcode from "./vendor/qrcode.mjs";

const $ = (id) => document.getElementById(id);
const path = location.pathname.split("/").filter(Boolean);
const view = path[0] === "f" ? "form" : path[0] === "r" ? "results" : "home";
const slug = (path[1] || "").toLowerCase();
const key = new URLSearchParams(location.hash.slice(1)).get("key") || "";
const DONE = `event-feedback:answered:${slug}`;
const SVG = "http://www.w3.org/2000/svg";
let latest = null;
let expanded = false;

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.filter((k) => k != null && k !== false));
  return node;
}
function status(message, kind = "") {
  $("status").hidden = !message;
  $("status").textContent = message || "";
  $("status").className = `notice ${kind}`;
}
async function api(url, { method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" };
  if (key) headers["x-manage-key"] = key;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({ ok: false, message: "The server did not answer properly." }));
  if (!res.ok || data.ok === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
const remembered = () => { try { return localStorage.getItem(DONE) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(DONE, "1"); } catch { /* fine */ } };

function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: `-4 -4 ${n + 8} ${n + 8}`, role: "img", "aria-label": `QR code for ${text}`, "shape-rendering": "crispEdges", xmlns: SVG })) svg.setAttribute(k, v);
  const bg = document.createElementNS(SVG, "rect");
  for (const [k, v] of Object.entries({ x: -4, y: -4, width: n + 8, height: n + 8, fill: "#fff" })) bg.setAttribute(k, v);
  const p = document.createElementNS(SVG, "path");
  p.setAttribute("d", d);
  p.setAttribute("fill", "#000");
  svg.append(bg, p);
  return svg;
}

const group = (score) => (score >= 9 ? "pro" : score >= 7 ? "pas" : "det");
const badgeClass = (score) => ({ pro: "badge badge-accent", pas: "badge", det: "badge badge-warn" })[group(score)];

function renderComments() {
  const filter = $("filter").value;
  const list = latest.results.responses.filter((r) => filter === "all" || group(r.score) === filter);
  const fill = (id, field) => {
    const items = list.filter((r) => r[field]);
    const shown = expanded ? items.slice(0, 200) : items.slice(0, 5);
    $(id).replaceChildren(...(items.length ? shown.map((r) => el("li", {},
      el("span", { className: badgeClass(r.score), textContent: String(r.score), title: `Scored ${r.score}` }),
      el("span", { textContent: r[field] }),
      r.seeded ? el("span", { className: "sample", textContent: "sample" }) : null)) : [el("li", { className: "empty", textContent: "Nothing here yet." })]));
    hidden += Math.max(0, items.length - shown.length);
  };
  let hidden = 0;
  fill("c-worked", "worked");
  fill("c-change", "change");
  if (latest.survey.question) fill("c-answer", "answer");
  $("more").hidden = !hidden && !expanded;
  $("more").textContent = expanded ? "Show fewer" : `Show all comments (${hidden} more)`;
}

function renderResults(data) {
  latest = data;
  const r = data.results;
  $("title").textContent = data.survey.event;
  document.title = `${data.survey.event}: results | Event Feedback`;
  $("lead").textContent = data.survey.demo ? "Demo results. Most answers are samples, marked as such. Answer the demo and yours appears at the top." : "Live results. Reload any time; answers are anonymous.";
  $("t-nps").textContent = r.score == null ? "None yet" : (r.score > 0 ? `+${r.score}` : String(r.score));
  $("t-nps-sub").textContent = r.n ? "from -100 to +100" : "";
  $("t-n").textContent = String(r.n);
  $("t-n-sub").textContent = r.seeded ? `${r.seeded} are samples` : "";
  $("t-avg").textContent = r.average == null ? "None yet" : String(r.average);
  const againTotal = r.again.yes + r.again.maybe + r.again.no;
  $("t-again").textContent = againTotal ? `${Math.round((r.again.yes / againTotal) * 100)}%` : "None yet";
  $("t-again-sub").textContent = againTotal ? `yes, ${r.again.maybe} maybe, ${r.again.no} no` : "";

  const max = Math.max(1, ...r.counts);
  $("dist").replaceChildren(...r.counts.map((n, score) => {
    const bar = el("span", { className: "bar" });
    bar.style.height = `${(n / max) * 140}px`;
    return el("div", { className: "col", role: "img", ariaLabel: `${n} ${n === 1 ? "person" : "people"} scored ${score}`, title: `Score ${score}: ${n}` }, el("span", { className: "n", textContent: n ? String(n) : "" }), bar);
  }));
  if (!$("dist").nextElementSibling.classList.contains("dist-axis")) {
    $("dist").after(el("div", { className: "dist-axis", ariaHidden: "true" }, ...r.counts.map((_, i) => el("span", { textContent: String(i) }))));
  }
  $("groups-text").textContent = r.n ? `${r.promoters} promoters, ${r.passives} passives, ${r.detractors} detractors. Score = ${Math.round((r.promoters / r.n) * 100)}% promoters minus ${Math.round((r.detractors / r.n) * 100)}% detractors.` : "No answers yet. Share the QR code.";

  const formUrl = `${location.origin}/f/${data.survey.slug}`;
  $("form-link").value = formUrl;
  const code = qrSvg(formUrl);
  $("qr").replaceChildren(code);
  $("qr-download").href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(code)], { type: "image/svg+xml" }));
  if (!data.survey.demo) {
    $("private-field").hidden = false;
    $("results-link").value = location.href;
  }
  if (data.survey.question) {
    $("c-answer-wrap").hidden = false;
    $("c-answer-h").textContent = data.survey.question;
  }
  renderComments();
}

function csv() {
  const r = latest.results;
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const head = ["time", "score", "group", "what worked", "what to change", latest.survey.question || "extra", "come again", "sample"];
  const rows = r.responses.map((x) => [x.at, x.score, { pro: "promoter", pas: "passive", det: "detractor" }[group(x.score)], x.worked, x.change, x.answer, x.again, x.seeded ? "yes" : ""]);
  const text = [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const a = el("a", { href: URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv" })), download: `${latest.survey.event.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-feedback.csv` });
  a.click();
}

document.addEventListener("click", async (e) => {
  const id = e.target.dataset?.copy;
  if (!id) return;
  $(id).select();
  try { await navigator.clipboard.writeText($(id).value); e.target.textContent = "Copied"; } catch { document.execCommand("copy"); }
  setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
});

if (view === "home") {
  $("home").hidden = false;
  $("create").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const data = await api("/api/surveys", { method: "POST", body: { event: form.get("event"), question: form.get("question") } });
      location.assign(`/r/${data.slug}#key=${data.key}`);
    } catch (err) {
      status(err.message, "notice-alert");
    }
  });
} else if (view === "form") {
  (async () => {
    try {
      const { survey } = await api(`/api/surveys?slug=${encodeURIComponent(slug)}`);
      $("title").textContent = survey.event;
      document.title = `${survey.event}: feedback`;
      $("lead").textContent = "30 seconds, anonymous. Thank you for telling us.";
      if (remembered() && !survey.demo) {
        $("thanks").hidden = false;
        return;
      }
      $("scale").replaceChildren(...Array.from({ length: 11 }, (_, i) => el("label", {}, el("input", { type: "radio", name: "score", value: String(i), required: true }), String(i))));
      if (survey.question) {
        $("extra").hidden = false;
        $("extra-label").textContent = survey.question;
      }
      $("form").hidden = false;
      $("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        if (!f.get("score")) return status("Pick a score from 0 to 10 first.", "notice-alert");
        const btn = e.target.querySelector("[type=submit]");
        btn.disabled = true;
        try {
          await api("/api/responses", { method: "POST", body: { slug, score: Number(f.get("score")), worked: f.get("worked"), change: f.get("change"), answer: f.get("answer") || "", again: f.get("again") || "" } });
          remember();
          status("");
          $("form").hidden = true;
          $("thanks").hidden = false;
          $("thanks-demo").hidden = !survey.demo;
        } catch (err) {
          status(err.message, "notice-alert");
          btn.disabled = false;
        }
      });
    } catch (e) {
      status(e.message, "notice-alert");
    }
  })();
} else {
  $("results").hidden = false;
  $("filter").addEventListener("change", renderComments);
  $("more").addEventListener("click", () => { expanded = !expanded; renderComments(); });
  $("csv").addEventListener("click", csv);
  const load = async () => {
    try {
      const data = await api(`/api/surveys?slug=${encodeURIComponent(slug)}`);
      if (!data.results) throw new Error("Open this from your private results link.");
      renderResults(data);
    } catch (e) {
      status(e.message, "notice-alert");
    }
  };
  load();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
}
