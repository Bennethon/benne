import{t as e}from"../benne-play.js";e(({B:e})=>{e.whenEnterRoom(()=>{e.player.moveTo.now(`enter-from-door`),e.player.face(`R`)}),e.whenEnterRoomAfterFade(()=>{e.character(`henry`).say(`Hey, Hank!`),e.character(`henry`).say(`Come here!`),e.player.walkTo(`henry`),e.player.say(`What's up?`),e.character(`henry`).walkTo(`henry-fountain`),e.character(`henry`).face(`L`),e.character(`henry`).say(`Check out this fountain!`),e.player.walkTo(`FountainOff`),e.player.face(`R`),e.wait(1),e.player.say(`What about it?`),e.character(`henry`).say(`I need you to turn it on. It's really important.`),e.player.say(`Uh, ok.`)});let t=()=>{e.walkToClicked(),e.player.faceClicked(),e.state.getFlag(`unlockedDoor`)?e.room.changeTo(`apartment`):e.say`Hank: The door is locked.`};e.whenOpen(`door`,t),e.whenUse(`door`,t),e.whenLookAt(`door`,()=>{e.faceClicked(),e.say`Hank: It's the door to the apartment.`}),e.whenLookAt(`FountainOff`,()=>{e.faceClicked(),e.say`
    Hank: It's a fountain.
    Hank: It's not running.
    `}),e.whenLookAt(`FountainOn`,()=>{e.faceClicked(),e.say`
    Hank: The fountain is running!.
    `}),e.whenLookAt(`Rock`,()=>{e.faceClicked(),e.say`
    Hank: It's a weird looking, out of place rock.
    `}),e.whenPush(`Rock`,()=>{e.walkToClicked(),e.player.faceClicked(),e.player.say(`I think I can move it.`),e.prop(`Rock`).hide(),e.prop(`RockMoved`).show(),e.player.say(`Huh, some weird lever hidden under the rock.`)}),e.whenLookAt(`RockMoved`,()=>{e.faceClicked(),e.say`
    Hank: I wonder what this lever does...
    `})});