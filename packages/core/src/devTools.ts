import { Interpreter } from '.';
import { AnyInterpreter } from './types';

type ServiceListener = (service: AnyInterpreter) => void;

export interface XStateDevInterface {
  register: (service: Interpreter<any>) => void;
  unregister: (service: Interpreter<any>) => void;
  onRegister: (
    listener: ServiceListener
  ) => {
    unsubscribe: () => void;
  };
  services: Set<Interpreter<any>>;
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
export function getGlobal() {
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

  return undefined;
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
