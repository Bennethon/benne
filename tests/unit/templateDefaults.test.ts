import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const templates = readdirSync('game-templates', { withFileTypes: true })
  .filter((e) => e.isDirectory() && !/^[._]/.test(e.name))
  .map((e) => e.name);

describe('starter templates', () => {
  it.each(templates)('%s ships with every debug overlay off', (template) => {
    const config = JSON.parse(readFileSync(path.join('game-templates', template, 'game-config.json'), 'utf8')) as {
      debug?: Record<string, unknown>;
    };
    for (const [key, value] of Object.entries(config.debug ?? {})) {
      expect(value, `debug.${key}`).toBe(false);
    }
  });
});
