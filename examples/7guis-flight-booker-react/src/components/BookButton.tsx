import FlightContext from "../machines/flightMachine";

type Props = {
  isBooked: boolean;
  eventType: EventType;
};

export default function BookButton({ eventType, isBooked }: Props) {
  const { send } = FlightContext.useActorRef();
  const state = FlightContext.useSelector((state) => state);
  const isValidDepartDate = state.can({ type: eventType });
  const canBook = !isBooked && isValidDepartDate;

  return (
    <button onClick={() => send({ type: eventType })} disabled={!canBook}>
      {isBooked ? "Booked!" : "Book"}
    </button>
  );
}
