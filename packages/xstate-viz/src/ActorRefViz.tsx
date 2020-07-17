import * as React from 'react';
import { useContext } from 'react';
import { ServicesContext, ServiceDataContext } from './InspectorViz';

export const ActorRefViz: React.FC<{ actorRefId: string }> & {
  Parent: React.FC;
} = ({ actorRefId, children = actorRefId }) => {
  const service = useContext(ServicesContext);

  if (!service?.state?.context.services[actorRefId]) {
    return <span>{children}</span>;
  }

  return (
    <a
      data-xviz="invoke-link"
      href="javascript:;"
      title={`Go to actor "${actorRefId}"`}
      onClick={() => {
        service.send({ type: 'service.select', id: actorRefId });
      }}
    >
      {children}
    </a>
  );
};

ActorRefViz.Parent = () => {
  const serviceData = useContext(ServiceDataContext);

  if (!serviceData || !serviceData.parent) {
    return <em>parent</em>;
  }

  const { parent } = serviceData;

  return (
    <ActorRefViz actorRefId={parent}>
      <em>parent</em>
    </ActorRefViz>
  );
};
