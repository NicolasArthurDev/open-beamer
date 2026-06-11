import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
  const { projectDir, mainFile, engine = 'lualatex', passes = 2 } = options;
  const pdfPath = join(projectDir, mainFile.replace(/\.tex$/, '.pdf'));

  let log = '';
  let status = 0;

  for (let pass = 0; pass < passes; pass++) {
    try {
      const { stdout, stderr } = await execFileAsync(
        engine,
        ['-interaction=nonstopmode', '-halt-on-error', mainFile],
        { cwd: projectDir, maxBuffer: 64 * 1024 * 1024 },
      );
      log += stdout + stderr;
    } catch (err) {
      const e = err as ExecError;
      log += (e.stdout ?? '') + (e.stderr ?? '');
      status = typeof e.code === 'number' ? e.code : 1;
      break;
    }
  }

  const produced = status === 0 && existsSync(pdfPath) && statSync(pdfPath).size > 0;
  return {
    status: produced ? 0 : status || 1,
    pdfPath: produced ? pdfPath : null,
    log,
  };
}
