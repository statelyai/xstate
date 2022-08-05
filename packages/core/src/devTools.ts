import { IS_PRODUCTION } from './environment';
import { AnyInterpreter } from './types';

type ServiceListener = (service: AnyInterpreter) => void;

export interface XStateDevInterface {
  register: (service: AnyInterpreter) => void;
  unregister: (service: AnyInterpreter) => void;
  onRegister: (
    listener: ServiceListener
  ) => {
    unsubscribe: () => void;
  };
  services: Set<AnyInterpreter>;
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
  if (!IS_PRODUCTION) {
    console.warn(
      'XState could not find a global object in this environment. Please let the maintainers know and raise an issue here: https://github.com/statelyai/xstate/issues'
    );
  }
}

function getDevTools(): XStateDevInterface | undefined {
  const global = getGlobal();
  if (global && '__xstate__' in global) {
    return (global as any).__xstate__;
  }

  return undefined;
}

export function registerService(service: AnyInterpreter) {
  if (!getGlobal()) {
    return;
  }

  const devTools = getDevTools();

  if (devTools) {
    devTools.register(service);
  }
}
