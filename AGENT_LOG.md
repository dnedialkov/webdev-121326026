# Agent log

One entry per agent session, newest at the bottom. Be honest: what went wrong is the useful part.

<!-- Copy this block for each session:

## YYYY-MM-DD · <short title>
- Goal:
- Delegated:
- Checkpoints:
- Went wrong:
- Changed by hand:

-->

## 2026-10-21 · Add the MCP npm command and record the session
- Goal: Create the missing package manifest with the `mcp` startup script and complete the session notes.
- Delegated: None.
- Checkpoints: `node mcp-server/check.mjs -- npm run --silent mcp` passed all 12 checks.
- Went wrong: The default Gemini CLI model had exhausted its daily quota; the description experiment was completed with `gemini-3.5-flash-lite`.
- Changed by hand: Added `package.json`, documented the startup command, and recorded this session's token usage.

## 2026-10-21 · Implement Slice 1 and Slice 2 (Database, Auth, Events, Registration, Organizer Management)
- Goal: Build Slice 1 (database, login, events list) and Slice 2 (registration, signup, cancellation, event creation and deletion with ownership checks).
- Delegated: None.
- Checkpoints: Tested login, event listing, signup/cancellation, event creation, and organizer deletion successfully via local server and PostgreSQL.
- Went wrong: PostgreSQL service was not initially running in the codespace and needed to be started and seeded; bcrypt hash format for seed password required update.
- Changed by hand: Created schema.sql, db connection, authentication and event service layers, routes, and HTML views.

## 2026-10-22 · Architecture Documentation & Concurrency Race Condition Fix
- Goal: Document architecture in SPEC.md, answer reviewer questions, and implement atomic database transaction locking (FOR UPDATE) to prevent signup race conditions.
- Delegated: None.
- Checkpoints: All automated tests pass successfully (`npm test`).
- Went wrong: Initial signup check lacked row-level locking for concurrent signups.
- Changed by hand: Updated `SPEC.md` under `## Architecture`, added `signupTransaction` in `src/db/eventRepo.js`, and updated `signupForEvent` in `src/services/eventService.js`.
- **Какво направи агентът без моя поръчка:**
  - **Допълнителни файлове:** Няма създадени нови файлове извън редакция на съществуващи (`SPEC.md`, `src/db/eventRepo.js`, `src/services/eventService.js`, `AGENT_LOG.md`).
  - **Зависимости:** Не са инсталирани или премахвани нови пакети в `package.json`.
  - **Променени тестове:** Тестовете не са променяни или олекотявани; всички съществуващи тестове остават непокътнати и минават успешно.
  - **Какво е запазено/махнато:** Запазено е цялостното разделяне на отговорностите (separation of concerns), като SQL транзакциите и заключването бяха изнесени в репозиторния слой, а бизнес правилата в сервизния слой. Никакъв код или тестове не са изтрити или компромисени.

## 2026-10-28 · Add Google OAuth sign-in
- Goal: Add a Google sign-in button and complete the OAuth callback at `/api/auth/google/callback`.
- Delegated: None.
- Checkpoints: `npm run coverage` passed, including 100% service coverage and the 80% overall line-coverage gate.
- Went wrong: The first focused test run lacked Google client configuration in one test; the test setup was corrected and the full coverage command passed.
- Changed by hand: Added state-checked Google OAuth, verified-email account matching/creation, secure session regeneration, callback setup documentation, and AC-15 tests. No dependencies or secrets were added.
