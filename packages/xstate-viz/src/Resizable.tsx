import { useMachine } from "@xstate/react";
import { useEffect } from "react";
import { assign, createMachine } from "xstate";

const resizeMachine = createMachine<
  { x: number; dx: number; width: number },
  MouseEvent
>({
  context: {
    x: 0,
    dx: 0,
    width: 300,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        mousedown: {
          target: "resizing",
          actions: assign({
            x: (_, e) => e.clientX,
            dx: 0,
          }),
        },
      },
    },
    resizing: {
      on: {
        mousemove: {
          actions: assign({
            dx: (ctx, e) => {
              return ctx.x - e.clientX;
            },
          }),
        },
        mouseup: {
          target: "idle",
          actions: assign({
            width: (ctx) => ctx.width + ctx.dx,
            dx: 0,
          }),
        },
      },
    },
  },
});

export const Resizable: React.FC<{}> = ({ children, ...attrs }) => {
  const [state, send] = useMachine(resizeMachine);

  useEffect(() => {
    const handler = (e) => {
      send(e);
    };
    document.body.addEventListener("mousemove", handler);
    document.body.addEventListener("mouseup", handler);

    return () => {
      document.body.removeEventListener("mousemove", handler);
      document.body.removeEventListener("mouseup", handler);
    };
  }, []);

  return (
    <div
      data-xviz-resizable
      {...attrs}
      style={{
        // @ts-ignore
        "--dx": state.context.dx,
        "--w": state.context.width,
        width: `calc(1px * (var(--w) + var(--dx)))`,
      }}
    >
      <div
        data-xviz-resizable-handle="left"
        onMouseDown={(e) => {
          send(e as MouseEvent);
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: "10px",
          zIndex: 10,
          cursor: "ew-resize",
        }}
      ></div>
      {children}
    </div>
  );
};
