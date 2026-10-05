## BenneScript refactor (branch: bennescript-refactor)

- The spec is `docs/bennescript-ergonomics-refactor.md`. Read §1–§11 and the
  §13 decisions table before changing scripting code. §14 is the phase plan.
- Progress so far is in `docs/bennescript-refactor-log.md`. Read it first.
- `src/game/` is a copy of the AI Apocalypse jam game, used as the test game.
  Do NOT run `set-template`, `sync-template-down` or `sync-boot-down`.
- The old `register*Script` / `B` API must keep working until Phase 6 deletes it.
- The baseline playthrough (`npm run test:playthrough`) must pass at the end of
  every phase.
- If the implementation must deviate from the spec, update the spec section and
  add a row to the §13 decisions table.
- At the end of a phase: run the phase's exit checks, append an entry to the
  progress log, then stop and report. Do not commit. Do not start the next phase.
