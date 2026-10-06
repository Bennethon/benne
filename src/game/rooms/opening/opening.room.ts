import { cutscene, waitForClick } from '@benne/script';
import { guis, music, rooms } from '@game';
import { room } from './opening.ids';

const paragraphs = [
  'In 1965, top scientists in MIT laboratories started working on "Project Time Travel".\n\nThey discovered that time travel was possible, but it could only be achieved via the use of a special substance: "Timeonium".',
  'Timeonium was not naturally occurring, and could only be synthesized in a lab.\n\nThis was a long and laborious process. It took 50 years to synthesize enough Timeonium for just a few time jumps.',
  'The year is 2027. Humanity is on the brink of disaster.\n\nUnable to stem advancement, artificial intelligence was poised to take over the world.\n\nThe MIT scientists decided to finally use their Timeonium to go back in time...\nand stop AI from ever being invented!',
];

room.onEnter(() => {
  guis.verbs.hide()
})

room.onEnterAfterFade(() => {
  music.intro.play()
  const text = guis.openingText.controls.text
  text.alpha = 0
  guis.openingText.show()

  // A click finishes the fade it lands in, or ends the hold; the skip key skips everything.
  cutscene(() => {
    for (const paragraph of paragraphs) {
      text.text = paragraph
      text.fadeTo(1, 1.2, { clickToSkip: true })
      waitForClick({ timeout: 10 })
      text.fadeTo(0, 1.2, { clickToSkip: true })
    }
  })
  rooms.hallway27.goTo()
})
