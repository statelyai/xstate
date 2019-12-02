import { Interpreter } from '.';
import { IS_PRODUCTION } from './environment';

type AnyInterpreter = Interpreter<any, any, any>;
interface DevInterface {
  services: Set<AnyInterpreter>;
  register(service: AnyInterpreter): void;
  onRegister(listener: ServicesListener): void;
}

type ServicesListener = (service: Set<AnyInterpreter>) => void;

function getDevTools(): DevInterface | undefined {
  const w = window as Window & { __xstate__?: DevInterface };
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
