import { Interpreter } from '.';
import { IS_PRODUCTION } from './environment';

type AnyInterpreter = Interpreter<any, any, any>;
interface DevInterface {
  services: Set<AnyInterpreter>;
  register(service: AnyInterpreter): void;
  onRegister(listener: ServicesListener): void;
}

type ServicesListener = (service: Set<AnyInterpreter>) => void;

function initDevTools(): DevInterface | undefined {
  if (IS_PRODUCTION || typeof window === 'undefined') return;

  const w = window as Window & { __xstate__?: DevInterface };
  const services = new Set<Interpreter<any, any, any>>();
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

export function registerService(service: AnyInterpreter) {
  if (IS_PRODUCTION || typeof window === 'undefined') return;

  const dev = initDevTools();

  dev && dev.register(service);
}
