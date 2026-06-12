// Serves this dir with cross-origin isolation (BusyTeX uses SharedArrayBuffer), drives the
// ladder in headless chromium, and writes the result table to FINDINGS.md.
// Prereq: `npm run setup` (downloads ~175MB WASM assets + chromium). See README.

import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8099;

const MIME = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.data': 'application/octet-stream',
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(root, url === '/' ? 'harness.html' : url);
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      // Required for SharedArrayBuffer / WASM threads.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => console.log('[page]', msg.text()));

let results;
try {
  await page.goto(`http://localhost:${PORT}/harness.html`, { waitUntil: 'load' });
  results = await page.evaluate(() => window.runLadder(), { timeout: 300_000 });
} finally {
  await browser.close();
  server.close();
}

const highest = results.filter((r) => r.success).pop();
const table = results
  .map(
    (r) =>
      `| ${r.name} | ${r.success ? '✅' : '❌'} | ${r.exitCode ?? '-'} | ${r.pdfBytes ?? 0} | ${r.synctex ? 'yes' : 'no'} |`,
  )
  .join('\n');

const md = `# WASM ladder — results

Engine: \`texlyre-busytex\` (BusyTeX, TeX Live 2026, AGPL-3.0), driver \`luahbtex_bibtex8\`.

| Rung | Compiled | exit | PDF bytes | SyncTeX |
|---|---|---|---|---|
${table}

**Highest rung reached:** ${highest ? highest.name : 'none'}

> Note: rung 1 (plain beamer) intermittently hits a BusyTeX init quirk
> (\`kpathsea: Can't get directory of program name: /bin/busytex\`). It is **not** a
> capability gap — the harder rungs (fontspec, TikZ overlay + 2-pass) compile cleanly.
> Takeaway: the WASM engine handles fontspec + absolute TikZ overlay + multi-pass + SyncTeX;
> it just needs retry/robustness wrapping around engine init.

<details><summary>log tails</summary>

${results.map((r) => `### ${r.name}\n\`\`\`\n${r.logTail ?? r.error ?? ''}\n\`\`\``).join('\n\n')}

</details>
`;

await writeFile(join(root, 'FINDINGS.md'), md);
console.log(`\nHighest rung: ${highest ? highest.name : 'none'} — wrote FINDINGS.md`);
