# Build Decision

## Current State
- This repo is the standalone HireVue-prep MVP workspace.
- The repo was bootstrapped from scratch because the existing `elevateos` worktree is scoped too narrowly to be a clean fit.
- The implementation now has a working text-first vertical slice with seeded demo users, seeded templates, async evaluation, and admin inspection.

## Chosen Stack
- Next.js App Router
- TypeScript
- PostgreSQL via Prisma
- NextAuth credentials session layer
- DB-backed evaluation job queue with a worker process
- Server-side AI evaluation abstraction with a demo fallback and optional provider swap

## Why This Scope
- It gives a real vertical slice: sign in, start a session, answer questions, enqueue async scoring, fetch a structured report, and inspect history.
- It is small enough to ship and demo without pretending to have a full media pipeline or enterprise platform.
- It keeps the seams needed for later audio, transcription, team mode, billing, and stronger compliance work.

## Intentionally Deferred
- Live video capture and media upload pipeline
- Transcription provider integration
- Object storage and signed uploads
- Billing/subscriptions
- Enterprise team/workspace mode
- Production observability stack beyond structured logs and audit rows
- Formal database RLS hardening unless later required by the hosting model
