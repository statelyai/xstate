/**
 * A deliberately tiny formula engine: cell references, numbers, `+ - * /`,
 * parentheses, and `SUM(A1:B3)`. Anything else is a scope cut (see the README).
 */

export type CellMap = Record<string, string>;

const REF = /^([A-Z])(\d+)$/;

const cellName = (col: number, row: number) =>
  `${String.fromCharCode(65 + col)}${row + 1}`;

/** Expands `A1:B3` into every cell name in that rectangle. */
const expandRange = (from: string, to: string): string[] => {
  const a = REF.exec(from);
  const b = REF.exec(to);

  if (!a || !b) {
    return [];
  }

  const [c1, c2] = [a[1].charCodeAt(0) - 65, b[1].charCodeAt(0) - 65].sort(
    (x, y) => x - y
  );
  const [r1, r2] = [Number(a[2]) - 1, Number(b[2]) - 1].sort((x, y) => x - y);
  const names: string[] = [];

  for (let col = c1; col <= c2; col++) {
    for (let row = r1; row <= r2; row++) {
      names.push(cellName(col, row));
    }
  }

  return names;
};

type Token = string;

const tokenize = (source: string): Token[] =>
  source.match(/SUM|[A-Z]\d+|\d+(\.\d+)?|[-+*/(),:]/g) ?? [];

/**
 * Recursive-descent parser over the token list. `resolve` turns a cell
 * reference into a number, which is where dependency traversal happens.
 */
const parseExpression = (
  tokens: Token[],
  resolve: (ref: string) => number
): number => {
  let index = 0;

  const peek = () => tokens[index];
  const eat = () => tokens[index++];

  const primary = (): number => {
    const token = eat();

    if (token === undefined) {
      throw new Error('unexpected end of formula');
    }

    if (token === '(') {
      const value = additive();
      if (eat() !== ')') throw new Error('missing )');
      return value;
    }

    if (token === '-') {
      return -primary();
    }

    if (token === 'SUM') {
      if (eat() !== '(') throw new Error('SUM needs (');
      const from = eat()!;
      if (eat() !== ':') throw new Error('SUM needs a range');
      const to = eat()!;
      if (eat() !== ')') throw new Error('missing )');
      return expandRange(from, to).reduce((sum, ref) => sum + resolve(ref), 0);
    }

    if (REF.test(token)) {
      return resolve(token);
    }

    const value = Number(token);

    if (Number.isNaN(value)) {
      throw new Error(`unexpected token ${token}`);
    }

    return value;
  };

  const multiplicative = (): number => {
    let value = primary();

    while (peek() === '*' || peek() === '/') {
      value = eat() === '*' ? value * primary() : value / primary();
    }

    return value;
  };

  const additive = (): number => {
    let value = multiplicative();

    while (peek() === '+' || peek() === '-') {
      value =
        eat() === '+' ? value + multiplicative() : value - multiplicative();
    }

    return value;
  };

  const result = additive();

  if (index !== tokens.length) {
    throw new Error('trailing input');
  }

  return result;
};

/**
 * Evaluates every cell. Resolution is depth-first through each formula's
 * references, so a cell is only computed after everything it depends on —
 * a topological pass with memoisation. Cycles are detected via `visiting`
 * and reported as `#CYCLE`.
 */
export const evaluateAll = (cells: CellMap): Record<string, string> => {
  const values: Record<string, string> = {};
  const visiting = new Set<string>();
  const memo = new Map<string, number>();

  const valueOf = (ref: string): number => {
    const cached = memo.get(ref);

    if (cached !== undefined) {
      return cached;
    }

    const raw = (cells[ref] ?? '').trim();

    if (raw === '') {
      return 0;
    }

    if (!raw.startsWith('=')) {
      const literal = Number(raw);
      return Number.isNaN(literal) ? 0 : literal;
    }

    if (visiting.has(ref)) {
      throw new Error('#CYCLE');
    }

    visiting.add(ref);

    try {
      const value = parseExpression(
        tokenize(raw.slice(1).toUpperCase()),
        valueOf
      );
      memo.set(ref, value);
      return value;
    } finally {
      visiting.delete(ref);
    }
  };

  for (const ref of Object.keys(cells)) {
    const raw = (cells[ref] ?? '').trim();

    if (raw === '') {
      continue;
    }

    if (!raw.startsWith('=')) {
      values[ref] = raw;
      continue;
    }

    try {
      const value = valueOf(ref);
      values[ref] = Number.isFinite(value) ? String(value) : '#ERR';
    } catch (error) {
      values[ref] = (error as Error).message === '#CYCLE' ? '#CYCLE' : '#ERR';
    }
  }

  return values;
};
