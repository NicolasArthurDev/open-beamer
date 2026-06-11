import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compile, type LatexEngine } from './index';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures');

function detectEngine(): LatexEngine | null {
  for (const candidate of ['lualatex', 'xelatex'] as const) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // not installed — try the next
    }
  }
  return null;
}

function fontspecAvailable(): boolean {
  try {
    const out = execFileSync('kpsewhich', ['luaotfload.sty'], { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

const engine = detectEngine();
const hasFontspec = fontspecAvailable();

async function compileFixture(name: string) {
  const work = mkdtempSync(join(tmpdir(), `ob-engine-${name}-`));
  try {
    cpSync(join(fixturesDir, name), work, { recursive: true });
    const result = await compile({
      projectDir: work,
      mainFile: 'main.tex',
      engine: engine ?? 'lualatex',
      passes: 2,
    });
    if (result.status !== 0) {
      console.error(`--- ${name} LaTeX log tail ---\n`, result.log.slice(-3000));
    }
    // Capture the size before the dir is removed in `finally`.
    const pdfSize = result.pdfPath ? statSync(result.pdfPath).size : 0;
    return { ...result, pdfSize };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

describe('@open-beamer/engine', () => {
  it.runIf(engine)(`compiles the core fixture to a PDF (2 passes, ${engine})`, async () => {
    const result = await compileFixture('sample');
    expect(result.status).toBe(0);
    expect(result.pdfPath).not.toBeNull();
    expect(result.pdfSize).toBeGreaterThan(1000);
  });

  it.runIf(engine && hasFontspec)('compiles the fontspec fixture to a PDF', async () => {
    const result = await compileFixture('fontspec');
    expect(result.status).toBe(0);
    expect(result.pdfPath).not.toBeNull();
  });

  it.skipIf(!engine || hasFontspec)(
    'skipped: fontspec/luaotfload not installed in this TeX Live',
    () => {
      expect(hasFontspec).toBe(false);
    },
  );

  it.skipIf(engine)('skipped: no local lualatex/xelatex found', () => {
    expect(engine).toBeNull();
  });
});
