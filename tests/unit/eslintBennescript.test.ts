/**
 * The BenneScript ESLint rules (scripts/lib/eslint-plugin-bennescript.mjs, decision 53) with the
 * game config, so timed actions are recognised by type as in a game. Typed linting needs files on
 * disk, so each probe is written to a throwaway game folder whose tsconfig extends this repo's
 * (`@benne/script` and `@game` resolve to the real engine and AI Apocalypse).
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { gameScriptsConfig } from '../../scripts/lib/eslint-plugin-bennescript.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'benne-lint-'));
writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify({ extends: path.resolve('tsconfig.json'), include: ['src'] }),
);
afterAll(() => rmSync(root, { recursive: true, force: true }));

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [gameScriptsConfig({ parser: tseslint.parser, tsconfigRootDir: root })],
});

let probes = 0;
async function lint(code: string, file = 'rooms/probe/probe{n}.room.ts'): Promise<string[]> {
  const filePath = path.join(root, 'src/game', file.replace('{n}', String((probes += 1))));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, code);
  const [result] = await eslint.lintFiles([filePath]);
  return result!.messages.map((m) => `${m.line} ${m.messageId ?? m.message}`);
}

describe('BenneScript lint rules', { timeout: 60000 }, () => {
  it('passes ordinary handlers', async () => {
    expect(
      await lint(`import { walkToClicked, wait, player, background } from '@benne/script';
import { rooms } from '@game';
const room = rooms.cafe;
function greet() {
  wait(1)
}
room.onEnter(() => {
  walkToClicked()
  greet()
  const t = player.walkTo.now({ x: 1, y: 1 })
  t.wait()
  if (Math.random() > 0.5) player.face('L')
  background(() => {
    wait(2)
  })
})
`),
    ).toEqual([]);
  });

  it('reports timed actions where nothing waits, and await', async () => {
    expect(
      await lint(`import { onUpdate, wait, background, player } from '@benne/script';
import { rooms } from '@game';
const room = rooms.cafe;
function helper() {
  wait(1)
}
room.onEnter(async () => {
  await wait(1)
  Math.random() > 0.5 && player.walkTo({ x: 1, y: 2 })
  setTimeout(() => wait(2), 10)
  ;[1].map(() => helper())
})
onUpdate(() => {
  player.face('L')
  helper()
  background(() => {
    wait(1)
  })
})
wait(3)
`),
    ).toEqual([
      '8 await',
      '9 notOwnLine',
      '10 notInHandler',
      '11 stepNotInHandler',
      '14 inUpdate',
      '15 stepInUpdate',
      '20 notInHandler',
    ]);
  });

  it('reports timed calls in plain .ts files', async () => {
    expect(
      await lint(`import { wait } from '@benne/script';\nexport function pause() {\n  wait(1)\n}\n`, 'helpers{n}.ts'),
    ).toEqual(['3 notInHandler']);
  });
});
