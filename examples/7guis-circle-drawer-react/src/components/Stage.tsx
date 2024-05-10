import { CircleContext } from "../machine";
import { getCircleUnderPointer } from "../utils";
import Circle from "@/components/Circle";

function Stage() {
  const { send } = CircleContext.useActorRef();
  const { circles } = CircleContext.useSelector((state) => state.context);

  const onStageTouched = (e: React.PointerEvent) => {
    const currentPosition = { x: e.clientX, y: e.clientY };
    const circleUnderPointer = getCircleUnderPointer(circles, currentPosition);

    send({
      type: "STAGE_TOUCHED",
      currentPosition,
      circleUnderPointer,
    });
  };

  return (
    <main onPointerDown={onStageTouched}>
      {circles.map((circle: Circle) => {
        return <Circle key={circle?.id} circle={circle} />;
      })}
    </main>
  );
}

export default Stage;
