import { CircleContext } from "@/machine";

type Props = {
  circle: Circle;
  isSelected: boolean;
};

function Circle({ circle, isSelected }: Props) {
  const { send } = CircleContext.useActorRef();

  if (!circle?.position || !circle?.radius) return;

  return (
    <div
      key={`circle.id`}
      className="circle"
      style={{
        background: circle.color,
        top: circle.position.y - circle.radius,
        left: circle.position.x - circle.radius,
        width: circle.radius * 2,
        height: circle.radius * 2,
        outline: isSelected ? `2px solid ${circle.color}` : "none",
        zIndex: isSelected ? 1 : 0,
      }}
      onPointerDown={(e) => {
        if (!isSelected) return;
        send({
          type: "START_DRAG",
          position: { x: e.clientX, y: e.clientY },
        });
      }}
    />
  );
}

export default Circle;
