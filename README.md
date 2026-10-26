# Event Feedback

Post-event feedback before people leave the room. One QR code on the last slide, 30 seconds on a phone, and the organiser sees the Net Promoter Score live.

**Live demo: [answer the demo survey](https://event-feedback-ten.vercel.app/f/demo), then [see the results](https://event-feedback-ten.vercel.app/r/demo)** (the demo started with sample answers, marked "sample")

## The problem it fixes

Community events send a Google Form two days later. By then 1 in 10 people answer, and only the ones who loved it or hated it. Asking in the room, on the last slide, while people still hold their phones, gets the middle too.

## What it does

- **Five quick questions.** A 0 to 10 "would you recommend this event?", what worked, what to change, one optional question of your own, and "would you come again?".
- **Anonymous.** No name, no email, nothing to sign in to.
- **Live results.** Net Promoter Score (% scoring 9 or 10 minus % scoring 0 to 6), the 0 to 10 spread, average, the come-again share, and every comment with its score. Filter comments to the detractors to see what to fix first.
- **QR code and CSV.** Download the QR as SVG for slides and posters. Export answers as a spreadsheet-safe CSV (formula cells defused).
- **Built for event wifi.** A whole room shares one IP, so the rate limit is per survey and generous (60 an hour), and each phone remembers it already answered.
- **No sign-up.** Creating a survey returns a private results link (`/r/<slug>#key=...`). The key stays in the URL fragment and only its SHA-256 is stored.

One bug the tests caught: `Number("")` is `0` in JavaScript, so a skipped score would have been stored as a 0, a detractor. Scores are now parsed strictly.

## Stack

- Static HTML, CSS and vanilla JS in `public/` (QR codes: vendored [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4, MIT)
- Vercel Functions (Web `Request`/`Response`) in `api/`
- [Neon](https://neon.tech) serverless Postgres over HTTP (`@neondatabase/serverless`, the only dependency)

The app creates its own tables on the first request (`lib/db.js`) in an `event_feedback` schema. `schema.sql` holds the same SQL for reading.

## Run your own

1. Fork, then import the repo on Vercel.
2. Add Neon from the Vercel Marketplace (Storage tab). It sets `DATABASE_URL`.
3. Deploy. Open `/` and make a survey.

Locally: `npm install`, `vercel env pull`, `vercel dev`. Tests: `npm test`.

## Files

| Path | What |
|---|---|
| `lib/core.js` | Input rules, Net Promoter Score, CSV, demo answers |
| `lib/db.js` | Neon client, idempotent migration, Postgres rate limit |
| `api/surveys.js` | Create a survey, read it (results with the key) |
| `api/responses.js` | Save one answer |
| `public/` | Home, the form and the results page |

MIT licence. Built by [Timothy Mwangi](https://timmwangi.com).
