import * as React from "react";

import { StateNodeViz } from "./StateNodeViz";
import { StateContext } from "./StateContext";
import { EdgesViz } from "./EdgesViz";

import { Tracker } from "./tracker";
import {
  State,
  StateMachine,
  createMachine,
  assign,
  interpret,
  StateNode,
  EventObject,
} from "xstate";
import { getAllEdges } from "./utils";
import { useTracked, useTracking } from "./useTracker";
import { useMachine, useService } from "@xstate/react";
import {
  machineVizMachine,
  StateNodeTapEvent,
  EventTapEvent,
  EventCommitEvent,
} from "./machineVizMachine";
import { MachineMeasure, MachineRectMeasurements } from "./MachineMeasure";
import { Popover } from "./Popover";
import { ResultBox } from "./types";
import Editor from "./Editor";
import { useState } from "react";

interface CanvasCtx {
  zoom: number;
  scroll: {
    x: number;
    y: number;
  };
}

const canvasMachine = createMachine<CanvasCtx>({
  initial: "active",
  context: {
    zoom: 1,
    scroll: { x: 0, y: 0 },
  },
  states: {
    active: {
      on: {
        wheel: {
          actions: [
            assign({
              scroll: (ctx, e) => ({
                x: ctx.scroll.x - e.deltaX,
                y: ctx.scroll.y - e.deltaY,
              }),
            }),
          ],
        },
        // zoom: {
        //   actions: [
        //     assign({
        //       zoom: (ctx, e) => ctx.zoom + e.value
        //     })
        //   ]
        // }
      },
    },
  },
});

interface MachineVizProps {
  state?: State<any, any>;
  machine: StateMachine<any, any, any>;
  onStateNodeTap?: ({ stateNodeId: string }) => void;
  onEventTap?: (data: EventTapEvent) => void;
  onCanvasTap?: () => void;
  style?: React.CSSProperties;
  mode: "read" | "play";
  selection?: Array<string | StateNode>;
}

export function useConstant<T>(fn: () => T): T {
  const ref = React.useRef<ResultBox<T>>();

  if (!ref.current) {
    ref.current = { v: fn() };
  }

  return ref.current.v;
}

const EventPopover: React.FC<{
  data: EventTapEvent;
  onSubmit: (data: EventObject) => void;
  onClickAddData: () => void;
}> = ({ data, onClickAddData, children }) => {
  const [rawData, setRawData] = useState("{}");
  return (
    <Popover
      trackingId={data.trackingId}
      actions={
        <>
          <button>Send</button>
          <button>Add Data</button>
        </>
      }
    >
      <div>
        Event: <strong>{data.eventType}</strong>
      </div>
    </Popover>
  );
};

const MachineVizContainer: React.FC<MachineVizProps> = ({
  style,
  machine,
  mode = "play",
}) => {
  const canvasService = useConstant(() => interpret(canvasMachine).start());
  const { service, tracker } = React.useContext(StateContext);
  const ref = useTracking(`machine:${machine.id}`);
  const groupRef = React.useRef<SVGGElement | null>(null);
  const [
    measurements,
    setMeasurements,
  ] = React.useState<MachineRectMeasurements | null>(null);
  const [machineVizState, send] = useService(service);
  const popoverData = machineVizState.context.popover;

  React.useLayoutEffect(() => {
    canvasService.subscribe(({ context }) => {
      if (!groupRef.current) {
        return;
      }

      const {
        scroll: { x, y },
        zoom,
      } = context;

      groupRef.current.setAttribute(
        "style",
        `transform: translate(${x}px, ${y}px) scale(${zoom})`
      );
    });
  }, [machine]);

  React.useEffect(() => {
    tracker.updateAll();
  }, [machine]);

  return (
    <div
      data-xviz="machine-container"
      data-xviz-mode={mode}
      ref={ref}
      style={{
        // @ts-ignore
        "--xviz-color-foreground": "white",
        "--xviz-color-background": "black",
        "--xviz-active-color": "rgb(19, 129, 201)",
        "--xviz-border-width": "2px",
        "--xviz-stroke-width": "var(--xviz-border-width)",
        // '--xviz-zoom': zoom,
        "--xviz-zoom": 1,
        ...style,
      }}
      onWheel={(e) => {
        canvasService.send(e);
      }}
    >
      {!measurements && (
        <MachineMeasure
          machine={machine}
          onMeasure={(m) => {
            setMeasurements(m);
          }}
        />
      )}
      {measurements && (
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "100%",
            overflow: "visible",
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.persist();

            service.send({
              type: "canvas.tap",
            });
          }}
          // viewBox={'0 0 100 100'}
          // viewBox={`0 0 ${100 / zoom} ${100 / zoom}`}
        >
          <g data-xviz="machine-group" ref={groupRef}>
            <EdgesViz
              edges={getAllEdges(machine)}
              machine={machine}
              measurements={measurements}
            />

            <foreignObject
              data-xviz="machine-foreignObject"
              x={0}
              y={0}
              width={1000}
              height={1000}
            >
              <div data-xviz="machine" title={`machine: #${machine.id}`}>
                <StateNodeViz stateNode={machine} />
              </div>
              <div data-xviz="popovers">
                {popoverData && (
                  <EventPopover
                    data={popoverData}
                    onSubmit={(eventData) => {
                      send({
                        ...machineVizState.context.popover!,
                        type: "event.commit",
                        data: eventData,
                      });
                    }}
                  ></EventPopover>
                )}
              </div>
            </foreignObject>
          </g>
        </svg>
      )}
      {/* <div data-xviz="controls">
        <button
          data-xviz="button"
          onClick={() => {
            service.send('zoom', { value: -0.1 });
          }}
        >
          -
        </button>
        <button
          data-xviz="button"
          onClick={() => {
            service.send('zoom', { value: 0.1 });
          }}
        >
          +
        </button>
      </div> */}
    </div>
  );
};

export function MachineViz({
  machine,
  state,
  onStateNodeTap,
  onEventTap,
  onCanvasTap,
  selection = [],
  mode = "play",
}: MachineVizProps) {
  const [, , service] = useMachine(machineVizMachine, {
    actions: {
      stateNodeTapped: (_, e) => onStateNodeTap?.(e as StateNodeTapEvent),
      eventTapped: (_, e) => onEventTap?.(e as EventTapEvent),
      canvasTapped: () => onCanvasTap?.(),
    },
  });
  const tracker = React.useMemo(() => new Tracker(), []);

  const selectionNodes = selection.map((sn) => {
    return typeof sn === "string" ? machine.getStateNodeById(sn) : sn;
  });

  return (
    <StateContext.Provider
      value={{ state, tracker, service, selection: selectionNodes }}
    >
      <MachineVizContainer machine={machine} state={state} mode={mode} />
    </StateContext.Provider>
  );
}
