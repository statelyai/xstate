import * as React from 'react';
import { Interpreter, Actor } from 'xstate';
import { MachineViz } from './MachineViz';

function getChildActors(service: Interpreter<any, any>): Actor<any, any>[] {
  const actors: Actor<any, any>[] = [];

  service.children.forEach(child => {
    actors.push(child);
  });

  return actors;
}

export function ServiceViz({ service }: { service: Interpreter<any, any> }) {
  const [actors, setActors] = React.useState<Array<Actor<any, any>>>([]);

  React.useEffect(() => {
    const { unsubscribe } = service.subscribe(state => {
      setActors(getChildActors(service));
    });

    return unsubscribe;
  }, []);

  return (
    <div>
      <details open={!service.parent || true}>
        <summary>{service.id}</summary>

        <MachineViz machine={service.machine} state={service.state} />
      </details>
      <div>
        <strong>{service.id}</strong>
      </div>
      <ul>
        {actors.map(actor => {
          return (
            <li>
              <ServiceViz service={actor as any} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
