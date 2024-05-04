import { CircleContext, DEFAULT_CIRCLE_RADIUS } from "@/machine";
import { getCircleById } from "@/utils";

function Size() {
  const { send } = CircleContext.useActorRef();
  const { circles, selectedCircleId } = CircleContext.useSelector(
    (state) => state.context
  );
  const selectedCircle = getCircleById(circles, selectedCircleId);

  return (
    <div className="size-input">
      <div className="end-cap" style={{width: "6ch"}}>
        {selectedCircle?.radius || DEFAULT_CIRCLE_RADIUS}px
      </div>
      <label className="visually-hidden" htmlFor="size">
        Change Size
      </label>
      <input
        id="size"
        type="range"
        min="10"
        max="125"
        disabled={!selectedCircle}
        value={selectedCircle?.radius || DEFAULT_CIRCLE_RADIUS}
        onPointerDown={() => {
          if (!selectedCircle) return;
          send({
            type: "START_EDIT",
          });
        }}
        onChange={(e) =>
          send({
            type: "EDIT",
            setting: "radius",
            value: parseInt(e.currentTarget.value),
          })
        }
        onPointerUp={(e) => {
          send({
            type: "END_EDIT",
            setting: "radius",
            value: parseInt(e.currentTarget.value),
          });
        }}
      />
    </div>
  );
}

export default Size;
