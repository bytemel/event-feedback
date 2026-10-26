-- The app runs these itself on first request (lib/db.js). Kept here so you can read the shape.
create schema if not exists event_feedback;

create table if not exists event_feedback.surveys (
  id bigserial primary key,
  slug text not null unique,
  event text not null,
  question text not null default '',   -- the organiser's one optional extra question
  key_hash text not null,              -- sha256 of the private results key; the key itself is never stored
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists event_feedback.responses (
  id bigserial primary key,
  survey_id bigint not null references event_feedback.surveys(id) on delete cascade,
  score int not null check (score between 0 and 10),
  worked text not null default '',
  change text not null default '',
  answer text not null default '',
  again text not null default '' check (again in ('', 'yes', 'maybe', 'no')),
  seeded boolean not null default false,  -- sample answers on the demo survey
  created_at timestamptz not null default now()
);
create index if not exists responses_survey on event_feedback.responses (survey_id, created_at);

create table if not exists event_feedback.hits (
  bucket text primary key,
  n int not null,
  expires_at timestamptz not null
);
