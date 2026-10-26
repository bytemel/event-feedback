// POST: create a survey and get its private results key.
// GET ?slug=: what the form needs. With the results key (x-manage-key), or on the demo, also the answers.
import { db, migrate, allow, hash } from "../lib/db.js";
import { json, readJson, route, fail } from "../lib/http.js";
import { newSlug, newKey, surveyInput, nps, DEMO } from "../lib/core.js";

export const POST = route(async (request) => {
  await migrate();
  if (!(await allow(request, "survey", 5, 60))) throw fail(429, "That is a lot of surveys. Try again in an hour.");
  const input = surveyInput(await readJson(request));
  const sql = db();
  await sql`delete from event_feedback.surveys where not is_demo and created_at < now() - interval '90 days'`;
  const slug = newSlug();
  const key = newKey();
  await sql`insert into event_feedback.surveys (slug, event, question, key_hash) values (${slug}, ${input.event}, ${input.question}, ${hash(key)})`;
  return json({ ok: true, slug, key }, 201);
});

export const GET = route(async (request) => {
  await migrate();
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-z0-9]{3,16}$/.test(slug)) throw fail(404, "No survey here.");
  const sql = db();
  if (slug === "demo") await ensureDemo(sql);
  const [s] = await sql`select id, slug, event, question, key_hash, is_demo from event_feedback.surveys where slug = ${slug}`;
  if (!s) throw fail(404, "No survey here. Check the link.");
  const survey = { slug: s.slug, event: s.event, question: s.question, demo: s.is_demo };
  const key = request.headers.get("x-manage-key") || "";
  const results = s.is_demo || (!!key && hash(key) === s.key_hash);
  if (key && !results) throw fail(403, "That results link is not valid for this survey.");
  if (!results) return json({ ok: true, survey });
  const rows = await sql`
    select score, worked, change, answer, again, seeded, created_at
    from event_feedback.responses where survey_id = ${s.id} order by created_at desc limit 2000`;
  const again = { yes: 0, maybe: 0, no: 0 };
  for (const r of rows) if (r.again) again[r.again]++;
  return json({
    ok: true,
    survey,
    results: {
      ...nps(rows.map((r) => r.score)),
      again,
      seeded: rows.filter((r) => r.seeded).length,
      responses: rows.map((r) => ({ score: r.score, worked: r.worked, change: r.change, answer: r.answer, again: r.again, seeded: r.seeded, at: new Date(r.created_at).toISOString() })),
    },
  });
});

// The demo survey starts with sample answers (seeded=true) so the results page has something to show.
async function ensureDemo(sql) {
  const [existing] = await sql`select id from event_feedback.surveys where slug = 'demo'`;
  if (existing) {
    // Keep the demo tidy: visitor answers older than a week go, sample answers stay.
    await sql`delete from event_feedback.responses where survey_id = ${existing.id} and not seeded and created_at < now() - interval '7 days'`;
    return;
  }
  const [s] = await sql`
    insert into event_feedback.surveys (slug, event, question, key_hash, is_demo)
    values ('demo', ${DEMO.event}, ${DEMO.question}, ${hash(newKey())}, true)
    on conflict (slug) do nothing returning id`;
  if (!s) return;
  const rows = DEMO.answers.map(([score, worked, change, answer, again], i) => ({ score, worked, change, answer, again, mins: (DEMO.answers.length - i) * 7 }));
  await sql`
    insert into event_feedback.responses (survey_id, score, worked, change, answer, again, seeded, created_at)
    select ${s.id}, x.score, x.worked, x.change, x.answer, x.again, true, now() - make_interval(mins => x.mins)
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(score int, worked text, change text, answer text, again text, mins int)`;
}
