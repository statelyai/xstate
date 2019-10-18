import { Actor } from './Actor';

const children = new Map<string, Actor>();
const idMap = new Map<Actor, string>();

let pidIndex = 0;

export interface Registry {
  register(actor: Actor): string;
  get(id: string): Actor | undefined;
  lookup(actor: Actor): string | undefined;
}

export const registry: Registry = {
  register(actor) {
    const id = `x:${pidIndex++}`;
    children.set(id, actor);
    idMap.set(actor, id);

    return id;
  },
  get(id) {
    return children.get(id);
  },
  lookup(actorRef) {
    return idMap.get(actorRef);
  }
};
