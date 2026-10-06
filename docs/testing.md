# BENNE regression testing

This suite tests the engine under `src/engine`, content under `src/game`, the two `game-templates`, editor host code under `benne-editor/src`, preview bundles under `src/editor`, and the shipped scaffold/VSIX. Tests use actual implementations. The browser fixture is a separate, small game; tests never switch the developer's active game template.

## Running the suite

Use Node 24 or newer and the committed lockfiles:

```sh
npm ci
npm ci --prefix benne-editor
npx playwright install chromium
npm run test:ci
npm run test:coverage
npm run test:extension
npm run test:e2e
npm run test:artifacts -- --vsix
```

On headless Linux, run extension and Electron tests through `xvfb-run -a`. Playwright's `npx playwright install --with-deps chromium` installs Linux browser dependencies where necessary. The VS Code host downloads its pinned version on first run. Chromium and VS Code downloads require network access; ordinary unit tests do not.

| Command | Contract |
| --- | --- |
| `npm test` | Fast deterministic Vitest logic tests |
| `npm run check` | Engine, tests and extension type checking; correctness lint; content validation; BenneScript handle generation (`check:generated`); the generated half of `docs/bennescript-api.md` is up to date with the JSDoc (`check:docs`) |
| `npm run test:ci` | Checks, unit tests, existing desktop logic and blocker/pathfinding regressions |
| `npm run test:coverage` | Unit coverage with minimums on critical modules; HTML and LCOV under `coverage/` |
| `npm run test:extension` | Real VS Code extension-host integration tests |
| `npm run test:e2e` | Real Phaser runtime and pointer input in Chromium |
| `npm run test:playthrough` | Real game in `src/game` on the Vite dev server: scripted playthrough from title to credits through the dev/test hooks (`src/engine/testing/benneTestHooks.ts`), plus a smoke test for every Play From entry point in BENNE Play. Cutscene clips go to `test-results/playthrough/cutscenes/` (needs `ffmpeg` on PATH) |
| `npm run test:templates` | Each game template (`game-templates/9-verb`, `2-click`) in a throwaway workspace (`scripts/template-workspace.mjs`), played through the dev/test hooks; checks every spoken line in order, flags, inventory, prop state, the active player and the menus |
| `npm run test:artifacts -- --vsix` | Temporary production/template builds, web ZIP structure, extracted VSIX and plugin resolution |
| `npm run test:nightly` | Local aggregate of fast, host, browser and artifact suites |
| `npm run test:release` | Local aggregate including VSIX checks |
| `npm run test:desktop:smoke` | Existing Electron startup smoke test; requires a production build |
| `npm run test:webgl` | Existing Electron graphics loss/restoration and startup-failure tests |

`BENNE_BROWSER_MATRIX=1 npm run test:e2e` also runs Firefox and WebKit (install those browsers first). `BENNE_SOAK=1 npm run test:e2e` extends the lifecycle test to 100 transitions. `VSCODE_TEST_VERSION=1.85.2 npm run test:extension` checks the minimum supported VS Code release line. Environment-variable examples use POSIX shell syntax.

## Implemented coverage

| Area and source | Regression assertions |
| --- | --- |
| `pathfinding.ts`, `walkable.ts` | Deterministic seeded polygon/hole routes, safe segments, unreachable partitions and partial paths, existing blocker regressions |
| `verbs/resolvePointerVerb.ts`, `dispatchVerb.ts` | Pointer profiles, selected verb/inventory, walking/cancellation, handler precedence and disabled fallback |
| `gameState/GameStateManager.ts`, `characterInventory.ts` | Historical v1/v2 snapshots, per-character inventory, snapshot flush hooks, named saves, malformed input, storage failures |
| `scenes/roomScriptModules.ts`, `RoomTransitionHookRegistry.ts` | Ordering, clearing, thrown callbacks, load deduplication, concurrent room isolation, retry after failure |
| `scripts/lib/bennescriptTransform.mjs`, `src/engine/bennescript/` | The transform's output and build errors; one test per sequencing rule (design doc §5), blocks, the interrupt and save policies, dialogs and sub-dialogs; the handle API against a fake game; parity with every feature of the old API (`bennescript*.test.ts`) |
| `scripts/lib/generateGameHandles.mjs`, `benneSpeakers.mjs`, `benneVerbs.mjs` | Generated modules for synthetic games, naming, collisions, reserved names and verbs, speaker resolution (`handleGenerator.test.mjs`) |
| `gui/guiGridLayout.ts`, character/animation helpers | Grid allocation/spans/placement, Aseprite tag families, facing/mirroring, feet and trimmed-frame transforms, region defaults, follow normalization |
| `inspectorJsonDocument.ts`, `roomPolygonPatch.ts` | Actual VS Code dirty-document edits, disk persistence, unrelated-field preservation, missing-target no-op, finite coordinates, queue overlap/nesting/failure |
| `scaffoldPayload.ts`, `playFromDiscovery.ts`, script and voice helpers | Non-destructive creation/update, custom package settings, semver, handler and launch-target discovery, existing voice-ID contracts |
| Browser fixture in `tests/fixtures/game` | Left/right actions execute once, room round trips, named save/load across rooms and refresh, load versus enter hooks, bounded listener/object counts, real hit coordinates after resize |
| `scripts/lib/validate-game-content.mjs` | JSON parsing, ID/reference consistency, control types/grid references, dimensions/polygons, asset confinement/existence, font and atlas references/ranges |
| Artifact pipeline | Boot/template parity checked before synchronization, both standalone games build, desktop logic passes for each scaffold, all preview/host bundles exist, ZIP root is playable, installed completion plugin resolves |

Node tests deliberately mock only the Phaser surface needed by pure logic. They are not evidence of rendering correctness. Browser tests run real Phaser and actual game boot code in an isolated temporary workspace. The test-only state observer is read-only and is not imported by production entries. Tests fail on browser exceptions, console errors, failed requests and HTTP errors. Retries are disabled so intermittent failures remain visible.

Artifact builds run sequentially in a temporary checkout because the production build commands generate files and synchronize scaffold content. They do not build over the developer's game. Subprocess output is retained under `test-results/artifacts`; browser traces, screenshots and video are retained on failure under `test-results/browser` and `playwright-report`.

## CI gates

`.github/workflows/regression.yml` runs fast checks, Chromium journeys, the pinned VS Code host and artifact/VSIX builds on pull requests and pushes to `master` or `main`. Monthly and manual runs add Firefox/WebKit, VS Code minimum/current across Linux/macOS/Windows, Windows packaging, and Electron graphics checks. The monthly run starts on the first day of the month at 06:23 UTC. Run the workflow manually on the release candidate and require success before publishing a release. Scheduled and manual browser runs include the transition soak. Linux CI runs browsers with a virtual display and Mesa software rendering so Firefox can create a WebGL context. Resize assertions account for each browser’s device pixel ratio. The Electron job configures its sandbox helper before launch; it does not disable sandboxing. `BENNE_TEST_SOFTWARE_GL=1` selects Chromium’s explicit SwiftShader WebGL backend in the Electron test scripts only ([Chromium documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)); it leaves production launch settings unchanged. Electron tests use a parent process to enforce a 75-second exit deadline and delete temporary profiles after Chromium releases its file handles, including on Windows. Failed jobs upload diagnostic artifacts.

All workflow artifacts expire after three days. Windows uploads contain the distributable ZIP only, avoiding another retained copy of the unpacked application. These retention rules apply to new uploads; existing artifacts keep their original expiration dates. GitHub Actions billing limits belong to the account, not this workflow. For a free personal account, configure a product-level Actions budget of $0 for the whole account with **Stop usage when budget limit is reached** enabled at [Budgets and alerts](https://github.com/settings/billing/budgets). Do not enable paid overages for CI. Once the included allowance is exhausted, hosted checks may be blocked until it resets; the local suites remain available.

These jobs are configured but must complete on the repository's CI runners before claiming platform compatibility. GitHub branch protection must separately designate required jobs; this change does not modify repository settings.

## Content baseline and coverage policy

The 2-click template references four missing rooms (`bathroom`, `diningRoom`, `garage`, `outsideOffice`). Those four diagnostics are recorded explicitly in `tests/fixtures/content-baseline.json`. New errors fail validation, and stale baseline entries also fail so fixes cannot leave permanent allowances. Restore/remove the authored references intentionally, then delete their baseline entries. Validation never rewrites content. Warnings describe incomplete authoring geometry and are not currently blocking.

Coverage reports include untested modules rather than hiding them: the initial unit line coverage across engine/editor code is approximately 5%. Browser and extension-host execution is not merged into that number. Separate minimums protect pathfinding, room-script loading, inventory normalization, pointer routing and Play From discovery. Increase these floors as cases are added; avoid a blanket high target that encourages tests mirroring implementation.

## Remaining coverage to develop

The suite is a regression foundation, not proof that every feature works. Prioritize these additions alongside changes to the relevant features:

1. **Editor webviews:** real Inspector, room/character/GUI preview and PDC interaction journeys; drag/resize/delete, stale selection, invalid host messages, undo/redo and save/reopen. Current tests cover host persistence and bundle production, not these graphical interactions.
2. **Runtime feature fixtures:** every GUI control's pointer/keyboard behavior; inventory drag/drop and item combinations; dialog option consumption and cancellation; speech skip/voice fallback; audio mixing/fades; video completion/interruption; cutscene and multi-character following across rooms. Current pure grid/dispatch/state cases cover only portions of these contracts.
3. **Rendering:** reviewed screenshot baselines for pixel alignment, Aseprite animation/trim, GUI layers and previews at several resolutions/DPRs. Pin browser, fonts and OS; review visual diffs rather than auto-updating them.
4. **Shipped applications:** launch the extracted web ZIP in a browser and the actual packaged Windows executable. Current artifact checks build them and inspect ZIP structure; the Electron smoke test runs the source wrapper.
5. **Completion behavior:** open a generated game with the packaged extension and exercise actual TypeScript completions/diagnostics. The VSIX test proves plugin module resolution, not language-server behavior.
6. **Long sessions and hardware:** extend the soak to inventory/dialog/media and monitor trends in retained objects/memory; manually smoke test native GPU, fullscreen, audio devices and OS focus transitions before releases.

For each regression, first add a failing test at the narrowest useful layer, fix the defect, and retain the case. Use the real host/browser when DOM, VS Code, Phaser rendering, focus or input semantics matter. Keep fixtures minimal and independent of the evolving demo game. Record deterministic seeds and save fixtures; do not mask failures with sleeps, retries, regenerated snapshots or content rewrites.
