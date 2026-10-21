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
