import * as React from "react";
import { StateNode } from "xstate";
import { SessionIdViz } from "./ActorRefViz";
import { ServiceDataContext } from "./InspectorViz";

export const StateNodeKeyViz: React.FC<{ stateNode: StateNode }> = ({
  stateNode,
}) => {
  const serviceData = React.useContext(ServiceDataContext);

  const stateNodeKey = (
    <span data-xviz="stateNode-key-text">{stateNode.key}</span>
  );

  if (stateNode.parent || !serviceData) {
    return <div data-xviz="stateNode-key">{stateNodeKey}</div>;
  }

  return (
    <div data-xviz="stateNode-key">
      {serviceData.parent && (
        <>
          <SessionIdViz.Parent /> →{" "}
        </>
      )}
      <SessionIdViz sessionId={serviceData.sessionId}></SessionIdViz>
    </div>
  );
};
