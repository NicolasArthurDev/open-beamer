import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDecks } from './open-beamer-plugin';

describe('findDecks', () => {
  it('lists deck ids that contain main.tex, sorted', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ob-decks-'));
    try {
      for (const id of ['zeta', 'alpha']) {
        mkdirSync(join(root, id), { recursive: true });
        writeFileSync(join(root, id, 'main.tex'), '\\documentclass{beamer}', 'utf8');
      }
      mkdirSync(join(root, 'no-main'), { recursive: true });
      expect(await findDecks(root)).toEqual(['alpha', 'zeta']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns [] when the presentations dir is missing', async () => {
    expect(await findDecks(join(tmpdir(), 'ob-does-not-exist-xyz'))).toEqual([]);
  });
});
