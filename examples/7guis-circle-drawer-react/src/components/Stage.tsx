import { useEffect, useRef } from "react";
import { CircleContext } from "../machine";
import { getCircleUnderPointer } from "../utils";
import Circle from "@/components/Circle";

function Stage() {
  const stage = useRef<HTMLDivElement>(null);
  const { send } = CircleContext.useActorRef();
  const { circles, selectedCircleId } = CircleContext.useSelector(
    (state) => state.context
  );

  function onStageTouched(e: React.PointerEvent) {
    const currentPosition = { x: e.clientX, y: e.clientY };
    const selectedCircle = getCircleUnderPointer(circles, currentPosition);

    send({
      type: "STAGE_TOUCHED",
      selectedCircle,
      currentPosition,
    });
  }

  useEffect(() => {
    function onDrag(e: PointerEvent) {
      send({
        type: "DRAG",
        position: { x: e.clientX, y: e.clientY },
      });
    }
    function onDragEnd(e: PointerEvent) {
      send({
        type: "END_DRAG",
        position: { x: e.clientX, y: e.clientY },
        id: selectedCircleId!,
      });
    }

    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", onDragEnd);

    return () => {
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onDragEnd);
    };
  }, [send, selectedCircleId]);

  return (
    <main ref={stage} data-testid="stage" onPointerDown={onStageTouched}>
      {circles.map((circle, i) => {
        if (!circle?.position || !circle?.radius) return;
        const isSelected = selectedCircleId === circle.id;
        return (
          <Circle
            key={circle.id}
            testid={i + 1}
            circle={circle}
            isSelected={isSelected}
          />
        );
      })}
    </main>
  );
}

export default Stage;
