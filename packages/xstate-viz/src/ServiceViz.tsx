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
    const { unsubscribe } = service.subscribe(_ => {
      setActors(getChildActors(service));
    });

    return unsubscribe;
  }, []);

  return (
    <div data-xviz="service">
      <div data-xviz="service-machine">
        <MachineViz machine={service.machine} state={service.state} />
      </div>
      <div data-xviz="service-children">
        {actors.map(actor => {
          return <ServiceViz service={actor as any} key={actor.id} />;
        })}
      </div>
    </div>
  );
}
