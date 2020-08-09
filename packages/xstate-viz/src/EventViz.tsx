import * as React from "react";
import { useContext } from "react";
import { StateContext } from "./StateContext";
import {
  serializeTransition,
  isBuiltinEvent,
  toDelayString,
  getPartialStateValue,
  isActive,
} from "./utils";
import { ActionViz } from "./ActionViz";
import { useTracking } from "./useTracker";
import { formatInvocationId } from "./InvokeViz";
import { TransitionDefinition } from "xstate";

interface EventVizProps {
  transition: TransitionDefinition<any, any>;
  index: number;
}

function getEventMeta(eventType: string): Record<string, any> | undefined {
  if (eventType.startsWith("xstate.after")) {
    const [, delay] = eventType.match(/^xstate\.after\((.*)\)#.*$/);

    return { delay };
  }

  return undefined;
}

function stringify(value: any): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return JSON.stringify(value);
}

export const EventTypeViz: React.FC<{ event: string }> = ({ event }) => {
  if (event.startsWith("done.state.")) {
    return (
      <div data-xviz="event-type" data-xviz-keyword="done">
        <em data-xviz="event-type-keyword">onDone</em>
      </div>
    );
  }

  if (event.startsWith("done.invoke.")) {
    const match = event.match(/^done\.invoke\.(.+)$/);
    return (
      <div data-xviz="event-type" data-xviz-keyword="done">
        <em data-xviz="event-type-keyword">done:</em>{" "}
        <div data-xviz="event-type-text">
          {match ? formatInvocationId(match[1]) : "??"}
        </div>
      </div>
    );
  }

  if (event.startsWith("error.platform.")) {
    const match = event.match(/^error\.platform\.(.+)$/);
    return (
      <div data-xviz="event-type" data-xviz-keyword="error">
        <em data-xviz="event-type-keyword">error:</em>{" "}
        <div data-xviz="event-type-text">{match ? match[1] : "??"}</div>
      </div>
    );
  }

  if (event.startsWith("xstate.after")) {
    const [, delay] = event.match(/^xstate\.after\((.*)\)#.*$/);

    return (
      <div data-xviz="event-type" data-xviz-keyword="after">
        <em data-xviz="event-type-keyword">after</em>{" "}
        <div data-xviz="event-type-text">{toDelayString(delay)}</div>
      </div>
    );
  }

  if (event === "") {
    return (
      <div data-xviz="event-type" data-xviz-keyword="always">
        <em data-xviz="event-type-keyword">always</em>
      </div>
    );
  }

  return (
    <div data-xviz="event-type">
      <div data-xviz="event-type-text">{event}</div>
    </div>
  );
};

export function EventViz({ transition, index }: EventVizProps) {
  const { state, service } = useContext(StateContext);
  const ref = useTracking(serializeTransition(transition, index));

  const meta = getEventMeta(transition.eventType);

  const triggered =
    !!state &&
    state.event.type === transition.eventType &&
    state.history?.matches(getPartialStateValue(transition.source));

  const active = state ? isActive(state, transition.source) : false;

  const eventTarget =
    transition.target && transition.target.length
      ? transition.target[0]
      : transition.source;

  return (
    <div
      data-xviz="event"
      data-xviz-event={transition.eventType}
      data-xviz-index={index}
      data-xviz-builtin={isBuiltinEvent(transition.eventType) || undefined}
      data-xviz-transient={transition.eventType === "" || undefined}
      data-xviz-guarded={!!transition.cond || undefined}
      data-xviz-triggered={triggered || undefined}
      data-xviz-active={active || undefined}
      title={`event: ${transition.eventType} → #${eventTarget.id}`}
      onClick={(e) => {
        e.stopPropagation();
        service.send({
          type: "event.tap",
          eventType: transition.eventType,
          index,
          stateNodeId: transition.source.id,
        });
      }}
    >
      <div data-xviz="event-label" ref={ref}>
        <EventTypeViz event={transition.eventType} />

        {transition.cond && (
          <div data-xviz="event-cond" data-xviz-name={transition.cond.name}>
            <div data-xviz="event-cond-name">{transition.cond.name}</div>
          </div>
        )}
      </div>
      <div data-xviz="event-targets">
        {transition.target &&
          transition.target.map((target) => {
            return (
              <div data-xviz="event-target" key={target.id}>
                #{target.id}
              </div>
            );
          })}
      </div>
      {meta && (
        <div data-xviz="event-meta">
          {Object.entries(meta).map(([key, value]) => {
            return (
              <div data-xviz="event-meta-entry" data-xviz-key={key} key={key}>
                <div data-xviz="event-meta-key">{key}</div>
                <div data-xviz="event-meta-value">{stringify(value)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div data-xviz="actions">
        {transition.actions.map((action, i) => {
          return <ActionViz action={action} key={i} />;
        })}
      </div>
    </div>
  );
}
