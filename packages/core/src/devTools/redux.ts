import { State } from '../State';
import { Interpreter } from '../interpreter';

interface ReduxDevToolsOptions {
  [key: string]: any;
}

export function createAdapter(options: ReduxDevToolsOptions) {
  return (service: Interpreter<any, any>) => {
    if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect(
        {
          name: service.id,
          autoPause: true,
          stateSanitizer: (state: State<any, any>): object => {
            return {
              value: state.value,
              context: state.context,
              actions: state.actions
            };
          },
          ...options,
          features: {
            jump: false,
            skip: false,
            ...(options ? options.features : undefined)
          }
        },
        service.machine
      );

      service.subscribe((state) => {
        devTools.send(state.event, state);
      });
    }
  };
}
