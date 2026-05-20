import type { GuiData } from '../types/gui';

const guiJsonModules = import.meta.glob('./guis/**/*.gui.json', { eager: true }) as Record<
  string,
  { default: GuiData }
>;

export function getAllGuiData(): GuiData[] {
  return Object.values(guiJsonModules).map((m) => m.default);
}

export function getGuiDataById(id: string): GuiData | undefined {
  return getAllGuiData().find((g) => g.id === id);
}

/** Font manifest keys referenced by any GUI `controls` entry of type `text`, `button`, or `textInput`. */
export function collectFontIdsReferencedByGuiControls(): string[] {
  const ids = new Set<string>();
  for (const gui of getAllGuiData()) {
    for (const c of gui.controls ?? []) {
      if (c.type === 'text' || c.type === 'button' || c.type === 'textInput') {
        ids.add(c.font);
      }
    }
  }
  return [...ids];
}
