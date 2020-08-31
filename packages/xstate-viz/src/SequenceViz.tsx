import * as React from "react";
import { AnyEventObject, SCXML } from "xstate";
import { TimestampViz } from "./TimestampViz";
import { ActorRefViz, SessionIdViz } from "./ActorRefViz";
import { EventTypeViz } from "./EventViz";
import { JSONViz } from "./JSONViz";
import { Popover } from "./Popover";

export interface SCXMLSequenceEvent extends SCXML.Event<AnyEventObject> {
  dest: string;
  origin: string;
  timestamp: number;
}

function getParticipants(events: SCXMLSequenceEvent[]): string[] {
  const services = new Set<string>();

  events.forEach((event) => {
    services.add(event.origin);
    services.add(event.dest);
  });

  return Array.from(services);
}

export const SequenceDiagramViz: React.FC<{
  events: SCXMLSequenceEvent[];
}> = ({ events }) => {
  const participants = getParticipants(events);

  return (
    <div
      data-xviz="sequenceDiagram"
      style={{
        // @ts-ignore
        "--xviz-participants": participants.length,
        "--xviz-events": events.length,
      }}
    >
      {participants.map((participantId, i) => {
        return (
          <React.Fragment key={participantId}>
            <div
              data-xviz="sequenceDiagram-participant"
              style={{
                // @ts-ignore
                "--xviz-participant": i,
              }}
            >
              <div data-xviz="sequenceDiagram-participant-id">
                <SessionIdViz sessionId={participantId} />
              </div>
            </div>
            <div
              data-xviz="sequenceDiagram-lifeline"
              style={{
                // @ts-ignore
                "--xviz-participant": i,
              }}
            ></div>
          </React.Fragment>
        );
      })}
      {events.map((event, i) => {
        const originIndex = participants.indexOf(event.origin);
        const destinationIndex = participants.indexOf(event.dest);

        const dir = Math.sign(destinationIndex - originIndex);

        return (
          <>
            <div
              data-xviz="sequenceDiagram-eventLog"
              style={{
                gridRow: i + 1 + 1,
              }}
            >
              {/* <JSONViz value={event.data} valueKey="event" /> */}
            </div>
            <div
              data-xviz="sequenceDiagram-event"
              key={i}
              style={{
                // @ts-ignore
                "--xviz-origin": originIndex,
                "--xviz-dest": destinationIndex,
                gridRow: i + 1 + 1,
              }}
              data-xviz-dir={dir}
              data-xviz-event={event.name}
            >
              <div
                data-xviz="eventObject"
                data-xviz-origin={event.origin}
                data-xviz-dest={event.dest}
              >
                <div data-xviz="eventObject-name">
                  <EventTypeViz eventType={event.name} />
                </div>
              </div>
              <svg
                data-xviz="sequenceDiagram-event-arrow"
                data-xviz-dir={dir}
                width="100%"
                height=".5rem"
                viewBox="0 0 10 10"
                preserveAspectRatio={
                  dir === 1 ? "xMaxYMid meet" : "xMinYMid meet"
                }
              >
                {dir === 1 ? (
                  <polygon points="0,0 10,5 0,10 0,0" fill="#fff"></polygon>
                ) : dir === -1 ? (
                  <polygon points="10,0 0,5 10,10 10,0" fill="#fff"></polygon>
                ) : null}
              </svg>
            </div>
          </>
        );
      })}
    </div>
  );
};
