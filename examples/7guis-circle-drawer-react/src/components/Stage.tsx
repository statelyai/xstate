import { CircleContext } from "../machine";
import { getCircleUnderPointer } from "../utils";
import Circle from "@/components/Circle";

function Stage() {
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

  return (
    <main onPointerDown={onStageTouched}>
      {circles.map((circle, i) => {
        if (!circle?.position || !circle?.radius) return;
        const isSelected = selectedCircleId === circle.id;
        return (
          <Circle key={circle.id} circle={circle} isSelected={isSelected} />
        );
      })}
    </main>
  );
}

export default Stage;
