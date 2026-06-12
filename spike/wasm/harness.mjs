import { RUNGS } from '/ladder.mjs';
import { BusyTexRunner, LuaLatex } from '/node_modules/texlyre-busytex/dist/index.js';

const out = document.getElementById('out');
const log = (m) => {
  out.textContent += `${m}\n`;
};

// Driven by run.mjs via page.evaluate. Returns one result per rung.
window.runLadder = async () => {
  const results = [];
  const runner = new BusyTexRunner({
    busytexBasePath: '/public/busytex',
    // default engineMode 'combined' → busytex.js/.wasm (the build the assets ship).
    catalogDataPackages: [
      '/public/busytex/texlive-basic.js',
      '/public/busytex/texlive-recommended.js',
      '/public/busytex/texlive-extra.js',
    ],
  });
  await runner.initialize(true);
  const lualatex = new LuaLatex(runner);

  for (const rung of RUNGS) {
    log(`compiling ${rung.name}…`);
    try {
      const res = await lualatex.compile({
        input: rung.input,
        rerun: rung.rerun,
        driver: 'luahbtex_bibtex8',
        verbose: 'info',
      });
      results.push({
        name: rung.name,
        success: !!res.success && !!res.pdf,
        exitCode: res.exitCode,
        pdfBytes: res.pdf ? res.pdf.length : 0,
        synctex: !!res.synctex,
        logTail: (res.log || '').slice(-1200),
      });
      log(`  → success=${!!res.success} pdf=${res.pdf ? res.pdf.length : 0}B`);
    } catch (err) {
      results.push({ name: rung.name, success: false, error: String(err) });
      log(`  → threw: ${err}`);
    }
  }

  runner.terminate();
  return results;
};
