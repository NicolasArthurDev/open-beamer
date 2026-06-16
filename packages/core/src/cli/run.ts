import { Command } from 'commander';
import { dev } from './dev.ts';

export async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.name('nitex-studio').description('nitex-studio dev server and live PDF preview');

  program
    .command('dev')
    .description('Start the dev server with live PDF preview')
    .option('-p, --port <port>', 'port to listen on', (v) => Number.parseInt(v, 10))
    .option('--host [host]', 'expose the server on the network')
    .option('--open', 'open the browser on start')
    .action(async (opts: { port?: number; host?: string | boolean; open?: boolean }) => {
      await dev(opts);
    });

  await program.parseAsync(argv, { from: 'user' });
}
