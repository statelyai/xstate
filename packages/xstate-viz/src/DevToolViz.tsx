import * as React from 'react';
import { Interpreter, Unsubscribable } from 'xstate';
import { ServiceViz } from './ServiceViz';

type ServicesListener = (services: Set<Interpreter<any, any, any>>) => void;

class LocalDevTools {
  services = new Set<Interpreter<any, any, any>>();
  listeners = new Set<ServicesListener>();
  constructor() {}

  register(service: Interpreter<any, any, any>) {
    this.services.add(service);

    service.onStop(() => {
      this.services.delete(service);
      this.listeners.forEach((listener) => {
        listener(this.services);
      });
    });

    this.listeners.forEach((listener) => {
      listener(this.services);
    });
  }

  onRegister(listener: ServicesListener): Unsubscribable {
    this.listeners.add(listener);

    listener(this.services);

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      }
    };
  }
}

const localDevTools = new LocalDevTools();

// setup local dev tools globally
(globalThis as any).__xstate__ = localDevTools;

export const DevToolViz: React.FC = () => {
  const [services, setServices] = React.useState<Interpreter<any, any, any>[]>(
    []
  );

  React.useEffect(() => {
    const sub = localDevTools.onRegister((serviceSet) => {
      setServices(Array.from(serviceSet));
    });

    return sub.unsubscribe;
  }, []);

  return (
    <div data-xviz="devtool">
      {services.map((service) => {
        return <ServiceViz service={service} key={service.sessionId} />;
      })}
    </div>
  );
};
