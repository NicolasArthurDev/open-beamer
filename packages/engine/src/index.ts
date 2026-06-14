import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// LaTeX log markers that mean another compilation pass is needed (cross-references,
// labels, or `remember picture` coordinates not yet stable).
const NEEDS_RERUN = /Rerun to get|undefined references|may have changed|rerunfilecheck/i;

export type LatexEngine = 'lualatex' | 'xelatex';

export interface CompileOptions {
  /** Directory containing the main `.tex` file and its assets. */
  projectDir: string;
  /** Entry `.tex` filename, relative to `projectDir`. */
  mainFile: string;
  /** LaTeX engine binary to invoke. Defaults to `lualatex`. */
  engine?: LatexEngine;
  /** Number of compilation passes. Beamer `remember picture` needs at least 2. */
  passes?: number;
  /**
   * Directory for generated output (`.pdf`/`.aux`/`.log`), via `-output-directory`.
   * Keeps the source dir clean so a file watcher on it doesn't loop. Created if missing.
   * Defaults to `projectDir` (output alongside the source).
   */
  outDir?: string;
}

export interface CompileResult {
  /** `0` when a PDF was produced; otherwise the failing engine exit code (or `1`). */
  status: number;
  /** Absolute path to the produced PDF, or `null` on failure. */
  pdfPath: string | null;
  /** Concatenated stdout/stderr of every pass — the LaTeX log. */
  log: string;
}

interface ExecError {
  code?: number;
  stdout?: string;
  stderr?: string;
}

export async function compile(options: CompileOptions): Promise<CompileResult> {
  const { projectDir, mainFile, engine = 'lualatex', passes = 2, outDir } = options;
  const pdfDir = outDir ?? projectDir;
  if (outDir) mkdirSync(outDir, { recursive: true });
  const pdfPath = join(pdfDir, mainFile.replace(/\.tex$/, '.pdf'));

  const args = ['-interaction=nonstopmode', '-halt-on-error', '-synctex=1'];
  if (outDir) args.push(`-output-directory=${outDir}`);
  args.push(mainFile);

  let log = '';
  let status = 0;

  for (let pass = 0; pass < passes; pass++) {
    let passLog = '';
    try {
      const { stdout, stderr } = await execFileAsync(engine, args, {
        cwd: projectDir,
        maxBuffer: 64 * 1024 * 1024,
      });
      passLog = stdout + stderr;
      log += passLog;
    } catch (err) {
      const e = err as ExecError;
      log += (e.stdout ?? '') + (e.stderr ?? '');
      status = typeof e.code === 'number' ? e.code : 1;
      break;
    }
    // Only run another pass when LaTeX says references/labels/picture positions changed.
    // Saves ~50% on simple decks (no cross-refs / `remember picture`).
    if (!NEEDS_RERUN.test(passLog)) break;
  }

  const produced = status === 0 && existsSync(pdfPath) && statSync(pdfPath).size > 0;
  return {
    status: produced ? 0 : status || 1,
    pdfPath: produced ? pdfPath : null,
    log,
  };
}
