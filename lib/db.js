// Neon Postgres over HTTP. One query per request, no pool to manage, works on Vercel functions.
// The tables live in their own schema so this app can share a database with others.
import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

let sql = null;
let ready = null;

export function db() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("DATABASE_URL is not set"), { status: 503 });
  sql ??= neon(process.env.DATABASE_URL);
  return sql;
}

// Creates the tables on the first request after a cold start. Every statement is idempotent,
// so a fresh Neon database needs no setup step. The same SQL is in schema.sql for reading.
export function migrate() {
  ready ??= db().transaction((q) => [
    q`create schema if not exists event_feedback`,
    q`create table if not exists event_feedback.surveys (
        id bigserial primary key,
        slug text not null unique,
        event text not null,
        question text not null default '',
        key_hash text not null,
        is_demo boolean not null default false,
        created_at timestamptz not null default now())`,
    q`create table if not exists event_feedback.responses (
        id bigserial primary key,
        survey_id bigint not null references event_feedback.surveys(id) on delete cascade,
        score int not null check (score between 0 and 10),
        worked text not null default '',
        change text not null default '',
        answer text not null default '',
        again text not null default '' check (again in ('', 'yes', 'maybe', 'no')),
        seeded boolean not null default false,
        created_at timestamptz not null default now())`,
    q`create index if not exists responses_survey on event_feedback.responses (survey_id, created_at)`,
    q`create table if not exists event_feedback.hits (
        bucket text primary key,
        n int not null,
        expires_at timestamptz not null)`,
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

export const hash = (s) => createHash("sha256").update(String(s)).digest("hex");

// The caller's IP, hashed so the table never stores a raw address.
export function clientId(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  return hash(`event-feedback:${ip}`).slice(0, 32);
}

// Fixed-window rate limit in Postgres: at most `max` calls per `minutes` for one action and caller.
export async function allow(request, action, max, minutes) {
  const bucket = `${action}:${clientId(request)}`;
  const [row] = await db()`
    insert into event_feedback.hits (bucket, n, expires_at)
    values (${bucket}, 1, now() + make_interval(mins => ${minutes}))
    on conflict (bucket) do update set
      n = case when hits.expires_at < now() then 1 else hits.n + 1 end,
      expires_at = case when hits.expires_at < now() then excluded.expires_at else hits.expires_at end
    returning n`;
  return row.n <= max;
}
