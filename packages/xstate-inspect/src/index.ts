import { Interpreter } from 'xstate';

export type ServiceListener = (service: Interpreter<any>) => void;

export interface InspectorOptions {
  url: string;
}

declare global {
  interface Window {
    __xstate__: {
      register: (service: Interpreter<any>) => void;
      onRegister: (listener: ServiceListener) => void;
    };
  }
}

const defaultInspectorOptions = {
  url: 'http://localhost:3001'
};

export function inspect(
  iframe: HTMLIFrameElement | null = document.querySelector(
    'iframe[data-xstate]'
  ),
  options?: Partial<InspectorOptions>
) {
  const resolvedOptions = { ...defaultInspectorOptions, ...options };

  if (!iframe) {
    console.warn(
      'No suitable <iframe> found to embed the inspector. Please pass an <iframe> element to `inspect(iframe)` or create an <iframe data-xstate></iframe> element.'
    );

    return;
  }

  const services = new Set<Interpreter<any>>();
  const serviceListeners = new Set<ServiceListener>();

  window.__xstate__ = {
    register: (service) => {
      services.add(service);
    },
    onRegister: (listener) => {
      serviceListeners.add(listener);
      services.forEach((service) => listener(service));
    }
  };

  iframe.addEventListener('load', () => {
    window.__xstate__.onRegister((service) => {
      iframe.contentWindow?.postMessage(
        {
          type: 'service.register',
          machine: JSON.stringify(service.machine),
          state: JSON.stringify(service.state || service.initialState),
          id: service.id
        },
        '*'
      );

      service.subscribe((state) => {
        iframe.contentWindow?.postMessage(
          {
            type: 'service.state',
            state: JSON.stringify(state),
            id: service.id
          },
          '*'
        );
      });
    });
  });

  iframe.setAttribute('src', resolvedOptions.url);
}
