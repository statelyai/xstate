import chalk from 'chalk';

export default function slimChalk(color: string, str: string) {
  return chalk[color](str);
}
