import * as React from "react";
import { useContext } from "react";
import { StateNode } from "xstate";
import { ServicesContext, ServiceDataContext } from "./InspectorViz";

export const ActorRefViz: React.FC<{ actorRefId: string }> & {
  Parent: React.FC;
} = ({ actorRefId, children = actorRefId }) => {
  const service = useContext(ServicesContext);

  const serviceForId = Object.values(
    service?.state?.context.services || {}
  ).find((s) => {
    return s.id === actorRefId;
  });

  if (!serviceForId) {
    return <span>{children}</span>;
  }

  return (
    <a
      data-xviz="actorRef"
      data-xviz-link
      href="#"
      title={`Go to actor "${actorRefId}"`}
      onClick={(e) => {
        e.preventDefault();
        service.send({
          type: "service.select",
          sessionId: serviceForId.sessionId,
        });
      }}
    >
      {children}
    </a>
  );
};

export const SessionIdViz: React.FC<{
  sessionId: string;
  type?: "origin" | "dest";
}> & {
  Parent: React.FC;
} = ({ sessionId, children, type }) => {
  const inspectorService = useContext(ServicesContext);

  const services = Object.values(
    inspectorService?.state?.context.services || {}
  );

  const serviceForSession = services.find((service) => {
    return service.state._sessionid === sessionId;
  });

  const displayText = children || (
    <>
      <span data-xviz="actorRef-name">
        {serviceForSession?.id || serviceForSession?.machine.id}
      </span>{" "}
      <span data-xviz="actorRef-id">{sessionId}</span>
    </>
  );

  if (!serviceForSession) {
    return <span data-xviz="actorRef">{displayText}</span>;
  }

  return (
    <a
      data-xviz="actorRef"
      data-xviz-link
      data-xviz-type={type}
      data-xviz-status={serviceForSession.status}
      href="#"
      title={`Go to actor "${serviceForSession.id}"`}
      onClick={(e) => {
        e.preventDefault();
        inspectorService.send({
          type: "service.select",
          sessionId: serviceForSession.sessionId,
        });
      }}
    >
      {displayText}
    </a>
  );
};

SessionIdViz.Parent = ({ children }) => {
  const serviceData = useContext(ServiceDataContext);

  if (!serviceData || !serviceData.parent) {
    return null;
  }

  const { parent } = serviceData;

  return <SessionIdViz sessionId={parent}></SessionIdViz>;
};

ActorRefViz.Parent = () => {
  const serviceData = useContext(ServiceDataContext);

  console.log(serviceData);

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
