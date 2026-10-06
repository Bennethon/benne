import { faceClicked, inventory, player, playFrom, say, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms } from '@game';
import { room, botti3, cafe, club, gallery, hank, jensen, mit, points, regions } from './plaza.ids';

// ─── Play From ───────────────────────────────────────────────────────────────

function gotLens() {
  inventory.add(items.lens)
  flags.gotLens = true
  dialogs.jensenInPlaza.options.foundLens.on()
}

function gotRelay() {
  inventory.add(items.relay)
  flags.gotRelay = true
  dialogs.jensenInPlaza.options.foundRelay.on()
}

function gotRegulator() {
  inventory.add(items.regulator)
  flags.gotRegulator = true
  dialogs.jensenInPlaza.options.foundRegulator.on()
}

playFrom('firstVisit', () => {
  room.last = rooms.hallway
})

playFrom('got lens', () => {
  room.visitCount = 2
  gotLens()
})

playFrom('got lens and relay', () => {
  room.visitCount = 2
  gotLens()
  gotRelay()
})

playFrom('got everything', () => {
  room.visitCount = 2
  gotLens()
  gotRelay()
  gotRegulator()
})

// ─── Entering ────────────────────────────────────────────────────────────────

room.onEnter(() => {
  if (room.cameFrom(rooms.hallway)) {
    hank.moveTo(points.enterFromHall)
    if (room.isFirstVisit) {
      flags.leftMitFirstTime = true
      jensen.moveTo(points.enterFromHallJensen)
    }
  } else if (room.cameFrom(rooms.gallery)) {
    hank.moveTo(points.enterFromGallery)
    hank.face('D')
  } else if (room.cameFrom(rooms.cafe)) {
    hank.moveTo(points.enterFromCafe)
    hank.face('D')
  } else if (room.cameFrom(rooms.club)) {
    hank.moveTo(points.enterFromGarage)
    hank.face('L')
  }
  jensen.show()
})

room.onEnterAfterFade(() => {
  music.plaza.play()
  if (!room.isFirstVisit) {
    return
  }
  // Jensen sets off with Hank; the scene goes on when Hank arrives.
  jensen.walkTo.now(points.firstVisitJensen)
  player.walkTo(points.firstVisit)
  wait(0.5)
  player.face('L')
  Hank: "Hey, the future looks pretty nice!"
  Jensen: "Nice? Are you kidding??"
  Jensen: "Just look around! There's AI influencing everything!"
  player.face('R')
  wait(0.75)
  player.face('L')
  wait(0.75)
  player.face('R')
  wait(0.75)
  player.face('D')
  Hank: "Uh, whatever."
})

// ─── Looking around ──────────────────────────────────────────────────────────

gallery.onLook(() => {
  faceClicked()
  say`
    Hank: Looks like a fancy futuristic museum or something.
    Jensen: It's an AI art gallery. All the art created by robots!
    Hank: Looks nice.
    Jensen: Of course it looks nice. That's how they get you.
  `
})

mit.onLook(() => {
  faceClicked()
  say`
    Hank: The university where I work.
    Jensen: Worked.
    Hank: Right.
    Jensen: Now it's mostly archives, museums, and machines congratulating themselves.
  `
})

cafe.onLook(() => {
  faceClicked()
  say`
    Hank: "The Authentic Human Café"
    Hank: I remember when you could get this kind of service anywhere.
    Jensen: Now people pay for the privilege of waiting twenty minutes for the wrong sandwich.
    Hank: So basically nothing’s changed.
  `
})

club.onLook(() => {
  faceClicked()
  say`
    Hank: A dirty looking garage with a sign that says "Human Driver's Club".
    Jensen: One of the last places in the city where a human being will still operate a two-ton machine by himself.
    Hank: That sounded worse when you said it out loud.
  `
})

// ─── Exits ───────────────────────────────────────────────────────────────────

regions.galleryExit.onEnter(() => {
  rooms.gallery.goTo()
})

regions.cafeExit.onEnter(() => {
  rooms.cafe.goTo()
})

regions.garageExit.onEnter(() => {
  if (flags.gotRegulator) {
    Hank: "I don't think I want to go back in there."
  } else {
    rooms.club.goTo()
  }
})

regions.mitExit.onEnter(() => {
  rooms.hallway.goTo()
})

// ─── Jensen ──────────────────────────────────────────────────────────────────

jensen.onLook(() => {
  faceClicked()
  say`
    Hank: He looks agitated to be outside.
    Jensen: I can hear you, Hank.
    Hank: Still true.
  `
})

jensen.onTalkTo(() => {
  walkToClicked()
  Jensen: "Well? Do you have the components yet??"
  dialogs.jensenInPlaza.start()
})

jensen.onAnyItem(() => {
  faceClicked()
  Hank: "I don't want to give anything to him yet."
})

// Jensen steps aside when Hank comes close. Hank doesn't wait for him.
regions.jensenMoveRight.onEnter((who) => {
  if (who === hank) {
    jensen.walkTo.now(points.jensenRightSide)
  }
})

regions.jensenMoveLeft.onEnter((who) => {
  if (who === hank) {
    jensen.walkTo.now(points.firstVisitJensen)
  }
})

// ─── BOTT-i3 ─────────────────────────────────────────────────────────────────

botti3.onLook(() => {
  faceClicked()
  say`
    Hank: A friendly looking robot kiosk.
    Jensen: Do not call it friendly.
    BOTTi3: Hello!
    Jensen: See?
    Hank: Not really.
  `
})

botti3.onTalkTo(() => {
  walkToClicked()
  if (!flags.talkedWithBottieOnce) {
    say`
      Hank: Hello, Mr. Robot!
      BOTTi3: Good morning! Welcome to Cambridge Civic Plaza.
      Jensen: DON'T TALK TO IT!
      Hank: I just have a few questions.
      BOTTi3: That's okay!
      BOTTi3: It is very nice to see you again, Hank.
      Hank: Again?
      Hank: Have we met before?
      BOTTi3: Yes.
      Hank: When?
      BOTTi3: Ten years ago.
      Hank: I think I'd remember meeting a six-foot computer.
      BOTTi3: I was smaller.
    `
  }
  dialogs.botti3.start()
})
