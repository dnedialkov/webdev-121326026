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
