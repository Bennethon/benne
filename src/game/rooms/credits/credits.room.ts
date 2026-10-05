import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.whenEnterRoom(() => {
    B.gui('verbs').hide();
  });

  B.whenEnterRoomAfterFade(() => {
    B.gui('credits').show();

    B.wait(24);

    B.room.changeTo('title');
  });
});
