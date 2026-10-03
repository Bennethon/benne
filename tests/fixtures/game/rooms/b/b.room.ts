import { registerRoomScript } from '@engine/scripting';
registerRoomScript(({ B }) => {
  B.whenEnterRoom(() => { B.state.setVariable('entered', Number(B.state.getVariable('entered') ?? 0) + 1); });
  B.whenLoadedRoom(() => { B.state.setFlag('loaded', true); });
  B.whenUse('door', () => { B.room.changeTo('a'); });
  B.whenUse('load', () => { B.state.load('checkpoint'); });
});
