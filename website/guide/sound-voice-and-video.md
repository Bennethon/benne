---
title: Sound, Voice, and Video
outline: deep
---

# Sound, Voice, and Video

BENNE supports four media paths for authored games:

- **Sound effects** for short one-shot clips.
- **Music** for the single background music slot.
- **Voice** clips attached to lines of dialogue.
- **Video** for full-screen cinematics.

All media files live under `src/game/assets/` and are discovered at build time. Each sound, music track and video gets a name in your scripts, made from its file name: `door-close.mp3` is `sfx.doorClose`, `my-cat-is-crazy.mp3` is `music.myCatIsCrazy`. The editor completes them, and a misspelt name is an error.

## File Locations

Put files in these folders:

| Media | Folder | Supported extensions | Example file | In scripts |
|-------|--------|----------------------|--------------|------------|
| SFX | `src/game/assets/audio/sfx/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `doorClose.mp3` | `sfx.doorClose` |
| Music | `src/game/assets/audio/music/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `my-cat-is-crazy.mp3` | `music.myCatIsCrazy` |
| Voice | `src/game/assets/audio/voice/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `hank42.mp3` | `Hank: "\|42\| …"` |
| Video | `src/game/assets/videos/` | `.mp4`, `.webm` | `intro.mp4` | `video.intro` |

If you provide multiple formats with the same stem, BENNE groups them as fallbacks. For example, `doorClose.mp3` and `doorClose.ogg` are both `sfx.doorClose`.

Two files whose names give the same script name (`door-close.mp3` and `doorClose.wav`) are an error; rename one. A few names are taken by the controls described below (`music.stop`, `music.isPlaying`, `music.current`, `sfx.stopAll`, and `pause`, `resume`, `seek`, `stop`, `isPlaying` and `current` on `video`), so a file with one of those names needs renaming too.

## Sound Effects

```ts
sfx.doorClose.play()
sfx.sweeping.play({ volume: 0.5 })
```

`play()` starts the sound and lets the script go on at once. Use `playAndWait()` when the next line should wait for the clip to finish:

```ts
sfx.doorClose.playAndWait()
rooms.outside.goTo()
```

Stop one sound, or every sound:

```ts
sfx.sweeping.stop()
sfx.stopAll()
if (sfx.sweeping.isPlaying) { … }
```

Inside a cutscene that the player skips, one-shot sounds don't play.

## Music

```ts
if (!music.isPlaying) {
  music.myCatIsCrazy.play()
}
```

There is one music slot. Starting a new track replaces the current one. Music continues across room changes unless you stop or replace it. `music.current` is the track playing now (or `null`), and `music.halloweenSpooky.isPlaying` checks one track.

Music can crossfade:

```ts
music.halloweenSpooky.play({ fadeSeconds: 2 })
```

If two music tracks are alternate versions of the same cue (say you add a spookier `halloween-spooky-full.mp3` alongside `halloween-spooky.mp3`), `sync: true` asks BENNE to align the incoming playback position with the outgoing track when the browser exposes that timing:

```ts
music.halloweenSpookyFull.play({ fadeSeconds: 1.5, sync: true })
```

Stop music with:

```ts
music.stop()
```

## Volumes

Default volume levels come from `src/game/game-config.json`:

```json
"audio": {
  "masterVolume": 1,
  "sfxVolume": 1,
  "musicVolume": 0.75,
  "dialogueVolume": 1
}
```

Effective volume is category volume multiplied by `masterVolume`, plus any per-call `volume` option. A settings menu changes the player's own SFX and music volume (0–1) through `settings`:

```ts
settings.sfxVolume = 0.8
settings.musicVolume = 0.6
```

Those session volume settings persist in save data. Voice uses `audio.dialogueVolume`.

## Voiced Dialogue

A spoken line can start with a voice marker:

```ts
Player: "|42| The old key fits perfectly."
Hank: "|17| This case just got a lot more complicated."
penny.say("|3| Humph!")
```

The marker is not shown to the player. BENNE strips it from the text, resolves the speaking character id, and plays a voice file from:

```text
src/game/assets/audio/voice/<characterId><number>.<ext>
```

For example:

- `Hank: "|17| ..."` looks for `src/game/assets/audio/voice/hank17.mp3`, `.ogg`, `.wav`, or `.m4a`.
- `Player: "|42| ..."` uses the character the player controls at that moment.

Voice playback follows the normal speech behavior: the script waits for the line, the Speaking Text overlay shows it, the talk animation plays, and the clip stops when the line is skipped.

### Conversation blocks

In a `say` block, put the marker after the speaker:

```ts
say`
  Hank: |1| Hey Penny!
  Penny: |1| Hi!
`
```

## Process Game Voice IDs

The BENNE Editor includes **Process Game Voice IDs** to assign these markers for you.

Open the BENNE sidebar, make sure nothing is selected in the main tree, then run **Process Game Voice IDs** from the **Actions** panel. The command asks:

1. **Preserve existing voice IDs?**
   - **Yes** keeps existing `|number|` markers and only fills missing ones.
   - **No** strips existing markers from dialogue lines and assigns fresh sequential IDs per character.
2. **Review changes first?**
   - **Yes** opens VS Code diffs for the planned edits before applying.
   - **No** writes the changes immediately.

The command scans `src/game/**/*.ts`, updates speech lines (`Hank: "…"`), `penny.say(…)` calls and `say` blocks, and stores per-character high-water marks in:

```text
.benne/voice-ids.json
```

That sidecar lets the editor continue numbering safely across future runs. The default path, **Preserve + Review**, is the safest workflow when you already have recorded files.

## Export Speaking Text as CSV

The BENNE Editor also includes **Export Speaking Text as CSV** in the same Actions panel. It scans the same supported `say` lines as **Process Game Voice IDs** and prompts for a `.csv` save location.

The exported spreadsheet has these columns:

- **Character** — the resolved character id for the speaker.
- **ID** — the `|number|` voice marker when present.
- **Script** — the script filename that contains the line.
- **Line** — the spoken text without the leading voice marker.

Use this export when planning recording sessions, checking coverage, or handing dialogue to another tool.

## Video

Put cinematic files under:

```text
src/game/assets/videos/
```

Then play them by name:

```ts
video.intro.play()
```

`play()` starts the video and lets the script continue. Use `playAndWait()` when the following script should wait until the video ends:

```ts
video.intro.playAndWait()
Hank: "What was that?"
```

A room shows one video at a time, so the controls act on whichever is playing:

```ts
video.pause()
video.resume()
video.seek(12)
video.stop()
if (video.isPlaying) { … }      // video.current is the playing video, or null
```

During video playback, BENNE hides generic HUD overlays such as verbs, menus, inventory, and dialog choices. Speaking Text and Display Text stay above the video, so you can layer dialogue or narration over a cinematic. The video also blocks clicks and other gameplay input while it is visible; **ESC** stops the active video. If the video is playing inside a skippable cutscene, one ESC press skips the whole cutscene, video included (see [BenneScript → Cutscenes](./bennescript#cutscenes-and-skipping)).

### Video Options

```ts
video.intro.play({
  volume: 0.8,
  loop: false,
  clickToSkip: true,
  onComplete: () => {
    flags.watchedIntro = true
  },
})
```

`onComplete` is a plain callback: it runs when the video ends, outside the script's sequence, so keep it to instant work such as setting a flag. To run a scene after the video, use `playAndWait()` and write the scene below it.

Video volume is `audio.masterVolume` multiplied by the per-playback `volume` option. `clickToSkip` defaults to `false`; when set to `true`, a primary click or tap stops the video. There is no separate video volume slider in the current engine.

::: warning VS Code video audio
BENNE Play runs inside a VS Code webview, whose codec support can differ from Chrome, Edge, or Brave. Some MP4 files show video frames but play no audio in VS Code when the audio track uses AAC.

For editor testing, prefer a webview-friendly track, for example:

```sh
ffmpeg -i Intro.mp4 -c:v copy -c:a libmp3lame -b:a 192k -movflags +faststart Intro-vscode.mp4
```
:::

## Practical Workflow

1. Add SFX, music, voice, and video files under the correct `src/game/assets/` folders.
2. Use `sfx`, `music` and `video` (from `@game`) in room, character, inventory, dialog, GUI, or global scripts.
3. Write dialogue normally, then run **Process Game Voice IDs** to insert voice markers.
4. Record or export voice clips with stems that match the markers, such as `hank1.mp3` and `penny1.mp3`.
5. Rebuild and test in BENNE Play.

For the full scripting surface, see [BenneScript](./bennescript). For default volume settings, see [Game Configuration](./game-configuration#audio).
