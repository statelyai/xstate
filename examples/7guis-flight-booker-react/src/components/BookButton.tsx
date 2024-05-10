import FlightContext from "../machines/flightMachine";

type Props = {
  isBooking: boolean;
  isBooked: boolean;
  eventType: EventType;
};

export default function BookButton({ eventType, isBooking, isBooked }: Props) {
  const { send } = FlightContext.useActorRef();
  const state = FlightContext.useSelector((state) => state);
  const isValidDepartDate = state.can({ type: eventType });
  const canBook = !isBooked && isValidDepartDate;

  const bookFlight = () => send({ type: eventType });

  return (
    <button onClick={bookFlight} disabled={!canBook}>
      {isBooking ? "Booking..." : "Book"}
    </button>
  );
}
