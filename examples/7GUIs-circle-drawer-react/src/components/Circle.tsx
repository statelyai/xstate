import { CircleContext } from '@/machine';

type Props = {
  circle: Circle;
};

function Circle({ circle }: Props) {
  const { send } = CircleContext.useActorRef();
  const isSelected = CircleContext.useSelector(
    (state) => state.context.selectedCircleId === circle?.id
  );

  if (!circle?.position || !circle?.radius) return;

  return (
    <div
      className="circle"
      style={{
        background: circle.color,
        transform: `translate(${circle.position.x - circle.radius}px, ${
          circle.position.y - circle.radius
        }px)`,
        width: circle.radius * 2,
        height: circle.radius * 2,
        outline: isSelected ? `2px solid ${circle.color}` : 'none',
        zIndex: isSelected ? 1 : 0
      }}
      onPointerDown={(e) => {
        send({
          type: 'START_DRAG',
          position: { x: e.clientX, y: e.clientY },
          isSelected
        });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    />
  );
}

export default Circle;
