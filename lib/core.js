// Pure rules: survey and response input, the Net Promoter Score, CSV export, demo answers.
import { randomBytes } from "node:crypto";

export class InputError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

export const newSlug = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase();
export const newKey = () => randomBytes(24).toString("base64url");

const clean = (v, max, label, required = false) => {
  const s = String(v ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (required && !s) throw new InputError(`Add the ${label}.`);
  if (s.length > max) throw new InputError(`Keep the ${label} under ${max} characters.`);
  return s;
};

export function surveyInput(body) {
  return { event: clean(body.event, 80, "event name", true), question: clean(body.question, 120, "extra question") };
}

export function responseInput(body, { hasQuestion = false } = {}) {
  // Number("") and Number(null) are 0, which would silently count a skipped answer as a detractor.
  const raw = body.score;
  const score = (typeof raw === "number" || (typeof raw === "string" && /^\d{1,2}$/.test(raw))) ? Number(raw) : NaN;
  if (!Number.isInteger(score) || score < 0 || score > 10) throw new InputError("Pick a score from 0 to 10.");
  const again = String(body.again ?? "");
  if (!["", "yes", "maybe", "no"].includes(again)) throw new InputError("Pick yes, maybe or no.");
  return {
    score,
    worked: clean(body.worked, 500, "answer about what worked"),
    change: clean(body.change, 500, "answer about what to change"),
    answer: hasQuestion ? clean(body.answer, 500, "answer") : "",
    again,
  };
}

// Net Promoter Score: % who gave 9 or 10 minus % who gave 0 to 6. Ranges from -100 to 100.
export function nps(scores) {
  const counts = Array(11).fill(0);
  for (const s of scores) counts[s]++;
  const n = scores.length;
  const promoters = counts[9] + counts[10];
  const detractors = counts.slice(0, 7).reduce((a, b) => a + b, 0);
  const passives = n - promoters - detractors;
  return {
    n,
    counts,
    promoters,
    passives,
    detractors,
    score: n ? Math.round(((promoters - detractors) / n) * 100) : null,
    average: n ? Math.round((scores.reduce((a, b) => a + b, 0) / n) * 10) / 10 : null,
  };
}

// Spreadsheet-safe CSV: quotes every cell and defuses formulas (=, +, -, @) so Excel will not run them.
export function toCsv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

// Sample answers for the demo survey. Stored with seeded=true and labelled "sample" in the UI.
export const DEMO = {
  event: "Demo Hub Demo Day",
  question: "Which pitch stood out, and why?",
  answers: [
    [10, "Pitches were tight and on time.", "Longer networking after.", "The water startup, they showed real numbers.", "yes"],
    [9, "Good mix of investors in the room.", "The sound at the back was weak.", "", "yes"],
    [9, "", "Share the deck links after.", "The agritech one, clear customer story.", "yes"],
    [8, "Venue was easy to reach.", "Start on time.", "", "maybe"],
    [10, "Judges asked hard questions.", "", "The fintech for chamas.", "yes"],
    [7, "Food was good.", "Fewer speeches before the pitches.", "", "maybe"],
    [6, "", "It ran 50 minutes late.", "", "maybe"],
    [9, "Met two people I will follow up with.", "Name tags with company names.", "The edtech team.", "yes"],
    [4, "", "Could not hear the pitches from the side room.", "", "no"],
    [10, "Best demo day this year.", "", "The water startup.", "yes"],
    [8, "Clear agenda.", "A Q&A slot for the audience.", "", "yes"],
    [9, "Felt like a real community.", "More women founders on stage.", "The health one.", "yes"],
  ],
};
