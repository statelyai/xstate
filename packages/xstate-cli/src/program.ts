import { Command } from 'commander';
import { scan } from './scan';

export const program = new Command();

program.version('0.0.1');

program
  .command('scan <glob>')
  .description('Scan files for machines')
  .action(scan);
