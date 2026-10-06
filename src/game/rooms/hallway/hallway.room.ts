import { faceClicked, inventory, player, playFrom, wait, walkToClicked } from '@benne/script';
import { dialogs, flags, items, music, rooms } from '@game';
import { room, bullitenBoard, cleanBot, doorToLab, exit, hank, jensen, points } from './hallway.ids';

playFrom('talkedToJensen', () => {
  room.visitCount = 3
  flags.jensenCrying = false
  flags.jensenBlockingDoor = false
  flags.gotMission = true
  inventory.add(items.timeonium)
})

playFrom('fromPlaza', () => {
  room.visitCount = 2
  room.last = rooms.plaza
})

room.onEnter(() => {
  if (room.isFirstVisit) {
    flags.jensenBlockingDoor = true
    jensen.show()
  } else if (room.cameFrom(rooms.plaza)) {
    music.lab.play()
    jensen.hide()
    flags.jensenCrying = false
    flags.jensenBlockingDoor = false
    hank.moveTo(points.enterFromPlaza)
    hank.face('D')
  }

  if (!flags.leftMitFirstTime) {
    jensen.show()
  }
})

room.onEnterAfterFade(() => {
  if (room.isFirstVisit) {
    Jensen: "*mumble* ... *grumble*"
    Jensen: "AI ... *grumble*"
    Jensen: "kill us all..."
  }
})

jensen.onLook(() => {
  faceClicked()
  Hank: "He looks agitated."
})

jensen.onTalkTo(() => {
  player.walkTo(points.hallwayPoint1)
  player.face('L')
  Hank: "Hey buddy!"
  if (flags.jensenCrying) {
    Jensen: "*SOB*"
  } else if (flags.gotMission) {
    Jensen: "What are you waiting for?"
    Jensen: "Let's go find those time machine parts!"
  } else {
    jensen.face('D')
    if (!flags.spokeWithJensenFirstTime) {
      Jensen: "AHH!"
    } else {
      Jensen: "WHAT?!"
    }
    dialogs.jensenInHallway.start()
  }
})

exit.onUse(() => {
  if (flags.jensenCrying) {
    walkToClicked()
    wait(1)
    player.face('D')
    Hank: "I feel bad leaving the smelly man crying."
    Jensen: "*SOB*"
  } else if (flags.jensenBlockingDoor) {
    faceClicked()
    Hank: "I can't get past that smelly man."
  } else {
    walkToClicked()
    rooms.plaza.goTo()
  }
})

jensen.onUseItem(items.timeonium, () => {
  if (!flags.jensenCrying) {
    faceClicked()
    Hank: "This stuff might be my ticket home. I don't want to just give it away!"
    return
  }
  player.walkTo(points.hallwayPoint1)
  player.face('L')
  Hank: "Mr. Jensen? Is this that Timeonium stuff you were talking about?"
  jensen.face('R')
  Jensen: "*sniff* ...wha?"
  wait(0.75)
  Jensen: "YES! YOU STILL HAVE IT!"
  Jensen: "This changes everything."
  Jensen: "It looks like there's just enough for one more jump..."
  jensen.face('L')
  Jensen: "Yes... with this I can finally complete my mission!"
  Hank: "Hey now, wait a minute! I need to use this to get back home."
  jensen.face('R')
  Jensen: "WHAT? Fool! Don't you see this horrible future?"
  Jensen: "I need to go back in time and prevent AI from ever being invented!"
  Hank: "I don't care. I want to go home. I'm not going to let you have it."
  jensen.face('L')
  Jensen: "Idiot!"
  Jensen: "Unless..."
  jensen.face('R')
  Jensen: "Yes! Hank, I will help you."
  Jensen: "The time machine can work again. It has just been stripped of a few essential parts over the years."
  Jensen: "We need a temporal focusing lens,"
  Jensen: "a power regulator,"
  Jensen: "and a control relay."
  Jensen: "Get those for me and we'll get you back to where you came from."
  Jensen: "*heh heh*"
  Hank: "Why can't you get them?"
  Jensen: "You want me to get the parts AND fix the time machine?"
  Jensen: "You have to put in some effort here, pal."
  Jensen: "I'm sure you can scrounge up that stuff from somewhere nearby."
  flags.jensenBlockingDoor = false
  flags.jensenCrying = false
  flags.gotMission = true
})

bullitenBoard.onLook(() => {
  walkToClicked()
  Hank: "Not a lot going on these days."
})

cleanBot.onLook(() => {
  faceClicked()
  Hank: "Is that some kind of cleaning robot?"
  Hank: "It looks like it's doing a good job."
})

doorToLab.onLook(() => {
  faceClicked()
  Hank: "That's the door back to the lab."
})

doorToLab.onUse(() => {
  walkToClicked()
  rooms.lab.goTo()
})

exit.onLook(() => {
  faceClicked()
  Hank: "It's the door to the outside world!"
})
