# HireVue Preparation

Full-stack web application for structured HireVue-style interview preparation. Provides interview templates, a question bank, async AI-evaluated practice sessions, and feedback reports.

## What It Does

- Credentials-based sign-in (demo accounts + self-registration)
- Seeded interview templates and question bank
- Session creation, answer submission, and structured feedback reports
- Async evaluation pipeline with a separate worker process
- Attempt history for users and admin inspection APIs
- Single-scroll demo frontend at `/`

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | NextAuth credentials sessions |
| Evaluation | DB-backed async job queue + worker process |

## Local Setup

```bash
cp .env.example .env
# Set DATABASE_URL, NEXTAUTH_SECRET
npm install
npm run db:generate
npm run db:push        # or db:migrate
npm run db:seed        # seeds demo users and templates
npm run dev            # app on http://localhost:3000
npm run worker         # evaluation worker (separate terminal)
```

Default `DATABASE_URL` if not set: `postgresql://postgres:postgres@localhost:5432/interview_prep`

## Demo Credentials

Default values are in `.env.example`:

| Role | Variable |
|---|---|
| Admin | `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` |
| User | `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` |

## Design Notes

- Text-first by design — audio/video upload intentionally deferred
- Secrets stay server-side only
- The homepage is the primary demo surface

## License

MIT