# Interview Prep Backend

Standalone MVP for a HireVue-style interview preparation backend.

## What It Does
- credentials sign-in with demo users or self-registered users
- seeded interview templates and question bank
- interview session creation and answer submission
- async evaluation and structured feedback reports
- attempt history for users
- admin inspection APIs for operators
- a polished single-scroll frontend demo at `/`

## Stack
- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma
- NextAuth credentials sessions
- DB-backed evaluation job queue with a separate worker process

## Local Run
1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and any provider overrides you want.
3. Install dependencies with `npm install`.
4. Run `npm run db:generate`.
5. Apply schema changes with `npm run db:push` or `npm run db:migrate`.
6. Seed demo users and templates with `npm run db:seed`.
7. Start the app with `npm run dev`.
8. Start the worker with `npm run worker`.
9. Open `http://localhost:3000` for the frontend demo.

The seed and worker steps require a reachable PostgreSQL server. The repo defaults to `postgresql://postgres:postgres@localhost:5432/interview_prep` if `DATABASE_URL` is not set.

## Demo Credentials
- Admin: `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`
- User: `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`
- Default values live in `.env.example`.

## Notes
- The MVP is text-first by design.
- Audio/video upload is intentionally deferred.
- Secrets stay server-side only.
- The homepage is the demo surface for collaborator reviews and Cloud Run previews.
