import * as React from 'react';
import { Interpreter, Actor, State } from 'xstate';
import { MachineViz } from './MachineViz';

export function ServiceViz({ service }: { service: Interpreter<any, any> }) {
  const [state, setState] = React.useState<State<any, any>>(service.state);

  React.useEffect(() => {
    const sub = service.subscribe((currentState) => {
      setState(currentState);
    });

    return sub.unsubscribe;
  }, []);

  if (!state) {
    return null;
  }

  return (
    <div data-xviz="service">
      <div data-xviz="service-id">{service.id}</div>
      <div data-xviz="service-machine">
        <MachineViz machine={service.machine} state={service.state} />
      </div>
    </div>
  );
}
