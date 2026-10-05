import { registerRoomScript } from '@engine/scripting';

const FADE_MS = 1200;
const HOLD_SECONDS = 10;

const paragraphs = [
  'In 1965, top scientists in MIT laboratories started working on "Project Time Travel".\n\nThey discovered that time travel was possible, but it could only be achieved via the use of a special substance: "Timeonium".',
  'Timeonium was not naturally occurring, and could only be synthesized in a lab.\n\nThis was a long and laborious process. It took 50 years to synthesize enough Timeonium for just a few time jumps.',
  'The year is 2027. Humanity is on the brink of disaster.\n\nUnable to stem advancement, artificial intelligence was poised to take over the world.\n\nThe MIT scientists decided to finally use their Timeonium to go back in time...\nand stop AI from ever being invented!',
];

type OpeningTween = {
  complete: () => void;
};

registerRoomScript(({ B, roomScene }) => {
  B.whenEnterRoom(() => {
    B.gui('verbs').hide();
  });

  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('intro');

    const line = B.gui('opening-text').control('text');
    line.setAlpha(0);
    line.text = paragraphs[0]!;
    B.gui('opening-text').show();

    let unregisterSkip: (() => void) | null = null;

    const disarm = (): void => {
      unregisterSkip?.();
      unregisterSkip = null;
      roomScene.clearScriptedDialogClickToSkip();
    };

    const armClick = (onClick: () => void): void => {
      disarm();
      roomScene.setScriptedDialogClickToSkip(onClick);
    };

    /**
     * Snap the line and finish its tween. A left-click uses the same hook as
     * click-to-skip dialogue, which still fires while this enter cutscene swallows gameplay input.
     */
    const finishTween = (tween: OpeningTween, alpha: number): void => {
      disarm();
      line.setAlpha(alpha);
      tween.complete();
    };

    for (let i = 0; i < paragraphs.length; i++) {
      const next = paragraphs[i + 1];
      let advance = false;

      line.tweenTo(
        {
          alpha: 1,
          onStart: (tween) => {
            let done = false;
            armClick(() => {
              if (done) {
                return;
              }
              done = true;
              advance = true;
              finishTween(tween, 1);
            });
          },
          onComplete: () => {
            disarm();
          },
        },
        FADE_MS,
      );

      line.tweenTo(
        {
          alpha: 1,
          onStart: (tween) => {
            if (advance || roomScene.isCutsceneSkipFastForwarding()) {
              advance = false;
              roomScene.time.delayedCall(0, () => tween.complete());
              return;
            }
            let done = false;
            const finish = (): void => {
              if (done) {
                return;
              }
              done = true;
              finishTween(tween, 1);
            };
            armClick(finish);
            unregisterSkip = roomScene.registerCutsceneSkipFinisher(finish);
          },
          onComplete: () => {
            advance = false;
            disarm();
          },
        },
        HOLD_SECONDS * 1000,
      );

      line.tweenTo(
        {
          alpha: 0,
          onStart: (tween) => {
            let done = false;
            armClick(() => {
              if (done) {
                return;
              }
              done = true;
              finishTween(tween, 0);
            });
          },
          onComplete: () => {
            disarm();
            if (next !== undefined) {
              line.text = next;
            }
          },
        },
        FADE_MS,
      );
    }

    B.room.changeTo('hallway27');
  });
});
