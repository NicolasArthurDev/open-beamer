// Private benchmark: compile the proprietary A&M `amclean` theme as a worst-case smoke test.
// The assets (logos, licensed fonts, confidential covers) are NOT part of this repo — this
// script copies them from the local apresentacao-latex-am plugin into a gitignored tmp dir.
// Never committed, never run in CI. Usage: pnpm engine:bench:amclean
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '../../../../apresentacao-latex-am/skills/codar-latex/assets');
const workDir = resolve(here, '../.bench-amclean');
const engine = 'lualatex';

if (!existsSync(join(assetsDir, 'exemplo.tex'))) {
  console.error(`amclean assets not found at: ${assetsDir}`);
  console.error(
    'This private benchmark needs the apresentacao-latex-am plugin checked out locally.',
  );
  process.exit(2);
}

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
// Copy everything except Windows Zone.Identifier markers.
cpSync(assetsDir, workDir, {
  recursive: true,
  filter: (src) => !src.endsWith(':Zone.Identifier'),
});

console.log(`Compiling amclean exemplo.tex with ${engine} (2 passes)...`);
let status = 0;
for (let pass = 1; pass <= 2; pass++) {
  try {
    execFileSync(engine, ['-interaction=nonstopmode', '-halt-on-error', 'exemplo.tex'], {
      cwd: workDir,
      stdio: 'inherit',
    });
  } catch (err) {
    status = err?.status ?? 1;
    console.error(`\nPass ${pass} failed (exit ${status}). See log above.`);
    break;
  }
}

const pdf = join(workDir, 'exemplo.pdf');
if (status === 0 && existsSync(pdf)) {
  console.log(`\n✅ amclean compiled: ${pdf} (${statSync(pdf).size} bytes)`);
  console.log('Open it to confirm the chrome (rule, eyebrow, wordmark, gantt, stats) renders.');
} else {
  console.error(
    '\n❌ amclean did not produce a PDF. Record the missing packages in docs/phase-0-findings.md.',
  );
  process.exit(1);
}
