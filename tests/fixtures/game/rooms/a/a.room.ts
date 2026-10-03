import { registerRoomScript } from '@engine/scripting';
registerRoomScript(({ B }) => {
  B.whenEnterRoom(() => { B.state.setVariable('entered', Number(B.state.getVariable('entered') ?? 0) + 1); });
  B.whenLoadedRoom(() => { B.state.setFlag('loaded', true); });
  B.whenUse('door', () => { B.room.changeTo('b'); });
  B.whenUse('save', () => { B.state.save('checkpoint'); });
  B.whenUse('load', () => { B.state.load('checkpoint'); });
  B.whenUse('count', () => { B.state.setVariable('count', Number(B.state.getVariable('count') ?? 0) + 1); });
  B.whenLookAt('count', () => { B.state.setFlag('looked', true); });
  B.whenUse('reset', () => { B.state.reset(); B.room.changeTo('a'); });
  B.playFrom('seeded', () => { B.state.setFlag('seeded', true); });
});
