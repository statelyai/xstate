import { Actor } from './Actor';

const children = new Map<string, Actor>();

let sessionIdIndex = 0;

export interface Registry {
  bookId(): string;
  register(id: string, actor: Actor): string;
  get(id: string): Actor | undefined;
  free(id: string): void;
}

export const registry: Registry = {
  bookId() {
    return `x:${sessionIdIndex++}`;
  },
  register(id, actor) {
    children.set(id, actor);
    return id;
  },
  get(id) {
    return children.get(id);
  },
  free(id) {
    children.delete(id);
  }
};
