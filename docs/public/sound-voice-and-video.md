---
title: Sound, Voice, and Video
outline: deep
---

# Sound, Voice, and Video

BENNE supports four media paths for authored games:

- **Sound effects** for short one-shot clips.
- **Music** for the single background music slot.
- **Voice** clips attached to `say` lines.
- **Video** for full-screen cinematics.

All media files live under `src/game/assets/` and are discovered at build time. You reference files by their basename stem, not by a full path.

## File Locations

Put files in these folders:

| Media | Folder | Supported extensions | Example script id |
|-------|--------|----------------------|-------------------|
| SFX | `src/game/assets/audio/sfx/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `doorClose` |
| Music | `src/game/assets/audio/music/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `apartment-theme` |
| Voice | `src/game/assets/audio/voice/` | `.mp3`, `.ogg`, `.wav`, `.m4a` | `hank42` |
| Video | `src/game/assets/videos/` | `.mp4`, `.webm` | `intro` |

If you provide multiple formats with the same stem, BENNE groups them as fallbacks. For example, `doorClose.mp3` and `doorClose.ogg` are both referenced as `doorClose`.

## Sound Effects

Use `B.sound.play` for one-shot sound effects:

```ts
B.sound.play('doorClose');
B.sound.play('sparkle', { volume: 0.5 });
```

The blocking form queues after prior Bennescript steps, so it respects sequences like walking, waiting, and speaking. Use `.now` when you want the sound to begin immediately:

```ts
B.sound.play.now('click');
```

Use `playAndWait` when the next scripted beat should wait for the clip to finish:

```ts
B.sound.playAndWait('doorOpen');
B.room.changeTo('outside');
```

You can stop all active SFX, or only instances with a specific stem:

```ts
B.sound.stop();
B.sound.stop('alarm');
```

## Music

Use `B.sound.playMusic` for background music:

```ts
if (!B.sound.isMusicPlaying()) {
  B.sound.playMusic('apartment-theme');
}
```

There is one logical music slot. Starting a new track replaces the current one. Music continues across room changes unless you explicitly stop or replace it.

Music can crossfade:

```ts
B.sound.playMusic('outside-night', { fadeSeconds: 2 });
```

If two music tracks are alternate versions of the same cue, `sync: true` asks BENNE to align the incoming playback position with the outgoing track when the browser exposes that timing:

```ts
B.sound.playMusic('battle-high', { fadeSeconds: 1.5, sync: true });
```

Stop music with:

```ts
B.sound.stopMusic();
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

Effective volume is category volume multiplied by `masterVolume`, plus any per-call `volume` option. Runtime SFX and music slider changes are available through:

```ts
B.sound.setSfxVolume(0.8);
B.sound.setMusicVolume(0.6);
```

Those session volume settings persist in save data. Voice uses `audio.dialogueVolume`.

## Voiced Dialogue

A spoken line can start with a voice marker:

```ts
B.player.say('|42| The old key fits perfectly.');
B.character('hank').say('|17| This case just got a lot more complicated.');
```

The marker is not shown to the player. BENNE strips it from the text, resolves the speaking character id, and plays a voice file from:

```text
src/game/assets/audio/voice/<characterId><number>.<ext>
```

For example:

- `B.character('hank').say('|17| ...')` looks for `src/game/assets/audio/voice/hank17.mp3`, `.ogg`, `.wav`, or `.m4a`.
- `B.player.say('|42| ...')` uses the active player character id.
- A tagged line like `Hank: |5| Hello.` uses the resolved `Hank` speaker.

Voice playback follows the normal `say` behavior: it participates in the interaction queue, uses the Speaking Text overlay, triggers talk animations, and stops when the line is skipped.

### Tagged Templates

For multi-speaker dialogue, put the marker after the speaker prefix:

```ts
B.say`
  Hank: |1| Hey Penny!
  Penny: |1| Hi!
`;
```

For fixed-speaker tagged templates, put the marker at the start of the line:

```ts
B.character('penny').say`
  |2| Make me a sandwich and I'll give you the key.
`;
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

The command scans `src/game/**/*.ts`, updates direct `.say(...)` calls and tagged `B.say` templates, and stores per-character high-water marks in:

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

Then play them by basename:

```ts
B.video.play('intro');
```

`play` starts the video and lets the script continue. Use `playAndWait` when the following script should wait until the video ends:

```ts
B.video.playAndWait('intro');
B.player.say('What was that?');
```

Video controls are also available:

```ts
B.video.pause();
B.video.resume();
B.video.seek(12);
B.video.stop();
```

During video playback, BENNE hides generic HUD overlays such as verbs, menus, inventory, and dialog choices. Speaking Text and Display Text stay above the video, so you can layer dialogue or narration over a cinematic. The video also blocks clicks and other gameplay input while it is visible; **ESC** stops the active video.

### Video Options

```ts
B.video.play('intro', {
  volume: 0.8,
  loop: false,
  clickToSkip: true,
  onComplete: () => {
    B.state.setFlag('watchedIntro', true);
  }
});
```

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
2. Use `B.sound` and `B.video` in room, character, inventory, dialog, GUI, or global scripts.
3. Write dialogue normally, then run **Process Game Voice IDs** to insert voice markers.
4. Record or export voice clips with stems that match the markers, such as `hank1.mp3` and `penny1.mp3`.
5. Rebuild and test in BENNE Play.

For the full scripting surface, see [Bennescript](./bennescript). For default volume settings, see [Game Configuration](./game-configuration#audio).
