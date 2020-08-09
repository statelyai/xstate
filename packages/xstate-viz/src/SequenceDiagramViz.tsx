import * as React from "react";
import { EventObject, SCXML } from "xstate";

export interface SCXMLSequenceEvent extends SCXML.Event<EventObject> {
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
        display: "grid",
        // gridTemplateColumns: `repeat(${participants.length}, min-content)`,
        gridAutoRows: "min-content",
      }}
    >
      {participants.map((d, i) => {
        return (
          <React.Fragment key={d}>
            <div
              data-xviz="sequenceDiagram-participant"
              style={{
                // @ts-ignore
                "--xviz-participant": i,
              }}
            >
              <div data-xviz="sequenceDiagram-participant-id">{d}</div>
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

        const min = Math.min(originIndex, destinationIndex);
        const max = Math.max(originIndex, destinationIndex);

        const dir = Math.sign(destinationIndex - originIndex);

        return (
          <div
            data-xviz="sequenceDiagram-event"
            key={i}
            style={{
              // @ts-ignore
              "--xviz-origin": originIndex,
              "--xviz-dest": destinationIndex,
              // gridColumnStart: min + 1,
              // gridColumnEnd: max + 1,
              gridRow: i + 1 + 1,
            }}
            data-xviz-dir={dir === 1 ? "right" : dir === -1 ? "left" : "self"}
          >
            <div data-xviz="eventObject">
              <div data-xviz="eventObject-name">{event.name}</div>
            </div>
            {dir === 1 ? (
              <svg
                width="100%"
                height="14"
                preserveAspectRatio="xMaxYMid slice"
                viewBox="0 0 1400 14"
              >
                <polygon
                  points="1400,7 1385,1 1390,6 0,6 0,8 1390,8 1385,13 1400,7"
                  fill="#fff"
                ></polygon>
              </svg>
            ) : dir === -1 ? (
              <svg
                width="100%"
                height="14"
                preserveAspectRatio="xMinYMid slice"
                viewBox="0 0 1400 14"
              >
                <polygon
                  points="0,7 15,1 10,6 1400,6 1400,8 10,8 15,13 0,7"
                  fill="#fff"
                ></polygon>
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
