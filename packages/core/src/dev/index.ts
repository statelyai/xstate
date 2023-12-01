import isDevelopment from '#is-development';
import { AnyActor, DevToolsAdapter } from '../types.ts';

interface DevInterface {
  services: Set<AnyActor>;
  register(service: AnyActor): void;
  onRegister(listener: ServiceListener): void;
}
type ServiceListener = (service: AnyActor) => void;

export interface XStateDevInterface {
  register: (service: AnyActor) => void;
  unregister: (service: AnyActor) => void;
  onRegister: (listener: ServiceListener) => {
    unsubscribe: () => void;
  };
  services: Set<AnyActor>;
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
export function getGlobal(): typeof globalThis | undefined {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  if (isDevelopment) {
    console.warn(
      'XState could not find a global object in this environment. Please let the maintainers know and raise an issue here: https://github.com/statelyai/xstate/issues'
    );
  }
}

function getDevTools(): DevInterface | undefined {
  const w = getGlobal();
  if (!!(w as any).__xstate__) {
    return (w as any).__xstate__;
  }

  return undefined;
}

export function registerService(service: AnyActor) {
  if (typeof window === 'undefined') {
    return;
  }

  const devTools = getDevTools();

  if (devTools) {
    devTools.register(service);
  }
}

export const devToolsAdapter: DevToolsAdapter = (service) => {
  if (typeof window === 'undefined') {
    return;
  }

  const devTools = getDevTools();

  if (devTools) {
    devTools.register(service);
  }
};
