---
title: Publishing Games
---

Every game created by the BENNE Editor includes browser and Windows packaging commands. Run them from the game's root folder after installing its npm dependencies.

## itch.io browser build

Run `npm run build:itch`. The command type-checks and builds the game, validates itch.io's file count and size limits, then writes `releases/<package-name>-itch.zip`. Upload that ZIP as an **HTML** project and mark it as playable in the browser. The ZIP contains `index.html` at its root. Vite uses relative asset URLs so the game works under itch.io's generated path.

To inspect the production build locally, run `npm run preview` and open the printed URL. Opening `dist/index.html` directly as a file does not reproduce web hosting.

## Windows desktop build

Run `npm run build:windows`. This creates a portable Windows ZIP in `releases/windows/` with Electron and an itch desktop app launch manifest. The first build may download an Electron runtime. Players extract the whole ZIP and run its `.exe`; they do not need Node.js.

If the Windows Electron runtime is already in the local Electron cache, BENNE uses it without downloading again. For a custom runtime ZIP, set `BENNE_ELECTRON_DIST` to its path.

The package's `name` supplies the archive name and save-data folder. Add `"benne": { "displayName": "My Game" }` to `package.json` to set the window and executable name. Add a PNG at `src/game/assets/images/icon.png` for the Windows icon; without it, Electron uses its default icon. The window starts at three times the internal resolution from `game-config.json`, limited by the screen size. You can change the factor with `benne.desktopWindowScale`.

For local desktop play, run `npm run desktop`. F11 or Alt+Enter toggles fullscreen; Escape leaves fullscreen. Browser and desktop saves are separate. `npm run test:desktop` checks the wrapper's path handling and browser/desktop bridge; `npm run test:desktop:smoke` checks the actual game window after a build.

Upload the Windows ZIP as a separate itch.io file marked **Windows**. The browser-playable checkbox belongs only on the HTML ZIP. Windows builds are unsigned and should be played on Windows before release.

## Script controls for desktop menus

`game.isDesktop` is `true` in desktop builds and `false` on the web or in editor previews. `game.quit()` closes the Electron app at that line of the script; in a browser it does nothing. For example, a game menu can show its Quit button only on desktop: `quit.visible = game.isDesktop`.

If WebGL cannot start or the graphics context is lost, the built game displays a readable message and offers a restart. Saved games remain available; restarting discards unsaved progress.
