import { IS_PRODUCTION } from '../environment';
import { AnyInterpreter, DevToolsAdapter } from '../types';

interface DevInterface {
  services: Set<AnyInterpreter>;
  register(service: AnyInterpreter): void;
  onRegister(listener: ServiceListener): void;
}
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

function getDevTools(): DevInterface | undefined {
  const w = globalThis;
  if (!!w.__xstate__) {
    return w.__xstate__;
  }

  return undefined;
}

export function registerService(service: AnyInterpreter) {
  if (IS_PRODUCTION || typeof window === 'undefined') {
    return;
  }

  const devTools = getDevTools();

  if (devTools) {
    devTools.register(service);
  }
}

export const devToolsAdapter: DevToolsAdapter = (service) => {
  if (IS_PRODUCTION || typeof window === 'undefined') {
    return;
  }

  const devTools = getDevTools();

  if (devTools) {
    devTools.register(service);
  }
};
