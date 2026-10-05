import { registerRoomScript } from '@engine/scripting';

registerRoomScript(({ B }) => {

  B.whenEnterRoom(() => {
    B.gui('verbs').hide();
    B.gui('title-buttons').show();
  });


  B.whenEnterRoomAfterFade(() => {
    B.sound.playMusic('trapped');
  });
});
