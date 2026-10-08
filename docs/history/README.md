# Project history

Dated reviews, studies and work logs from BENNE's development. They record what was found, proposed and decided at the time.

**Don't treat them as current guidance.** They describe the code as it was. Several use the old `register*Script` / `B` scripting API, which no longer exists. For how things work now, read:

- [`docs/architecture.md`](../architecture.md): how the engine and editor fit together.
- [`docs/bennescript-api.md`](../bennescript-api.md) and [`docs/public/`](../public/): the scripting API and user guides.
- [`docs/bennescript-ergonomics-refactor.md`](../bennescript-ergonomics-refactor.md): the BenneScript design record. Its decision table explains why scripting works the way it does, and code comments cite its sections.
- [`docs/roadmap.md`](../roadmap.md): work these documents proposed that is still open.

## Documents

| Date | Document | What it was | What came of it |
| --- | --- | --- | --- |
| 2026-10-03 | [Engine review](2026-10-03-engine-review.md) | Codebase review and long-term roadmap. | Its scripting and editor-parsing recommendations led to the BenneScript refactor; most of the repository clean-up was done. Open items are in the roadmap. |
| 2026-10-03 | [Codex suggestions](2026-10-03-codex-suggestions.md) | A second, independent engineering review. | Script lifetimes and syntax-aware parsing were done by the refactor. Open items are in the roadmap. |
| 2026-10-05 | [Feasibility: custom language and native editor](2026-10-05-feasibility-custom-language-and-native-editor.md) | Whether to replace TypeScript scripting with a custom language, and the VS Code extension with a standalone app. | Recommended fixing script semantics inside TypeScript first, which became the BenneScript refactor. Neither the language nor the app was pursued. |
| 2026-10-05 to 2026-10-07 | [BenneScript refactor log](2026-10-05-bennescript-refactor-log.md) | Phase-by-phase log of the refactor, with checks and deviations from the spec. | Squash-merged into `master` as `b5ea9fc` on 2026-10-07. |
| 2026-10-07 | [BenneScript refactor review](2026-10-07-bennescript-refactor-review.md) | Code review of the refactor and the changes after it, with two follow-up rounds. | All eleven findings resolved; recorded as decision 56 in the design record. |

## Conventions

- **File names start with the date** the document was written (`YYYY-MM-DD-topic.md`).
- **Each document starts with an "Archived" line** saying what came of it. Otherwise documents are left as written. Paths, line numbers and file sizes in them describe the code at the time; relative links were updated when the files moved here.
- **Before archiving**, move anything still open into [`docs/roadmap.md`](../roadmap.md), and any lasting decision into the design record or [`docs/architecture.md`](../architecture.md).
- **Old names**: these files used to be `docs/engine-review-2026-10.md`, `docs/codex-suggestions.md`, `docs/feasibility-custom-language-and-native-editor.md`, `docs/bennescript-refactor-log.md` and `docs/bennescript-refactor-review-2026-10-07.md`. Mentions of those paths inside these documents mean the files here.
