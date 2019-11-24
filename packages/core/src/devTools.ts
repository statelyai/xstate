import { Interpreter } from '.';
import { IS_PRODUCTION } from './environment';

interface DevInterface {
  services: Set<Interpreter<any, any>>;
  register(service: Interpreter<any, any>): void;
  onRegister(listener: ServicesListener): void;
}

type ServicesListener = (service: Set<Interpreter<any, any>>) => void;

function initDevTools(): DevInterface | undefined {
  if (IS_PRODUCTION || typeof window === 'undefined') return;

  const w = window as Window & { __xstate__?: DevInterface };
  const services = new Set<Interpreter<any, any>>();
  const serviceListeners = new Set<ServicesListener>();

  w.__xstate__ = w.__xstate__ || {
    services,
    register(service) {
      services.add(service);
      serviceListeners.forEach(listener => listener(services));
    },
    onRegister(listener) {
      serviceListeners.add(listener);
      listener(services);
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
