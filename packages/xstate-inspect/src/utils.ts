import safeStringify from 'fast-safe-stringify';
import { MaybeLazy } from './types';

export function getLazy<T>(value: MaybeLazy<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export function stringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return safeStringify(value);
  }
}
