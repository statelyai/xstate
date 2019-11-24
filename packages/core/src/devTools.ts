import { Interpreter } from '.';
import { IS_PRODUCTION } from './environment';

type ServiceListener = (service: Interpreter<any, any>) => void;

declare interface DevInterface {
  services: Set<Interpreter<any, any>>;
  register(service: Interpreter<any, any>): void;
  onRegister(listener: ServiceListener): void;
}

function initDevTools(): DevInterface | undefined {
  if (IS_PRODUCTION || typeof window === 'undefined') return;

  const w = window as Window & { __xstate__?: DevInterface };
  const services = new Set<Interpreter<any, any>>();
  const serviceListeners = new Set<ServiceListener>();

  w.__xstate__ = w.__xstate__ || {
    services,
    register(service) {
      services.add(service);
      serviceListeners.forEach(listener => listener(service));
    },
    onRegister(listener) {
      serviceListeners.add(listener);
    }
  };

  return w.__xstate__;
}

if (!IS_PRODUCTION) {
  initDevTools();
}

export function registerService(service: Interpreter<any, any>) {
  if (IS_PRODUCTION || typeof window === 'undefined') return;

  const dev = initDevTools();

  dev && dev.register(service);
}
