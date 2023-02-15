import { ActorRef, ActorSystem, ActorSystemInfo } from './types.js';

const children = new Map<string, ActorRef<any>>();

let sessionIdIndex = 0;

export interface Registry {
  bookId(): string;
  register(id: string, actor: ActorRef<any>): string;
  get(id: string): ActorRef<any> | undefined;
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

export function createSystem<T extends ActorSystemInfo>(): ActorSystem<T> {
  const children = new Map<string, ActorRef<any>>();
  const keyedActors = new Map<keyof T['actors'], ActorRef<any> | undefined>();

  return {
    register: (actorRef) => {
      const id = `x:${sessionIdIndex++}`;
      children.set(id, actorRef);
      return id;
    },
    unregister: (actorRef) => {
      children.delete(actorRef.id);
    },
    get: (key) => {
      return keyedActors.get(key) as T['actors'][any];
    },
    set: (key, actorRef) => {
      keyedActors.set(key, actorRef);
    }
  };
}
