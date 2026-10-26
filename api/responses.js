// POST: one answer to a survey. Event wifi puts a whole room behind one IP, so the limit is generous;
// the form also remembers on the device that it already answered.
import { db, migrate, allow } from "../lib/db.js";
import { json, readJson, route, fail } from "../lib/http.js";
import { responseInput } from "../lib/core.js";

export const POST = route(async (request) => {
  await migrate();
  const body = await readJson(request, 4 * 1024);
  const slug = String(body.slug || "");
  if (!/^[a-z0-9]{3,16}$/.test(slug)) throw fail(404, "No survey here.");
  if (!(await allow(request, `answer:${slug}`, 60, 60))) throw fail(429, "Too many answers from this network. Try again later.");
  const sql = db();
  const [s] = await sql`select id, question from event_feedback.surveys where slug = ${slug}`;
  if (!s) throw fail(404, "This survey is closed or the link is wrong.");
  const r = responseInput(body, { hasQuestion: !!s.question });
  const [count] = await sql`select count(*)::int as n from event_feedback.responses where survey_id = ${s.id}`;
  if (count.n >= 2000) throw fail(409, "This survey is full.");
  await sql`
    insert into event_feedback.responses (survey_id, score, worked, change, answer, again)
    values (${s.id}, ${r.score}, ${r.worked}, ${r.change}, ${r.answer}, ${r.again})`;
  return json({ ok: true }, 201);
});
