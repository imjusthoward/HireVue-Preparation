# Demo Plan

## Credentials
- Admin: `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`
- User: `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`

## Happy Path
1. Sign in as the demo user.
2. Create a mock interview session from one of the seeded templates.
3. Submit text answers to the session questions.
4. Keep the worker running so evaluation jobs are processed asynchronously.
5. Fetch the structured feedback report for the session.
6. Review attempt history to show the session lifecycle persisted.
7. Sign in as the admin account and inspect sessions through the admin API.

## Seeded Templates
- Consulting case basics
- Finance core
- Product sense and execution
- Behavioral story bank

## What the Demo Shows
- A real auth boundary, not a fake guest mode
- Persisted sessions and answers in PostgreSQL
- Async job handling rather than synchronous scoring
- Rubric-based feedback with structured sections
- Admin-safe inspection of operator-facing data
- A polished root-page frontend demo for collaborator reviews and Cloud Run previews

## Keep It Honest
- Text-first only
- No live video capture
- No transcription provider
- No enterprise billing or team workspace mode
