import FlightContext from '../machines/flightMachine';

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

  const successMessage = (
    <>
      <h2>You booked a flight!</h2>
      <p>
        <span>Departs:</span> {state.context.departDate}
      </p>
      <p>
        <span>Returns:</span> {state.context.returnDate}
      </p>
    </>
  );

  return (
    <>
      <dialog open={isBooking || isBooked}>
        {isBooking ? <p>Booking...</p> : successMessage}
      </dialog>
      <button onClick={bookFlight} disabled={!canBook}>
        {isBooking ? 'Booking' : isBooked ? 'Booked!' : 'Book'}
      </button>
    </>
  );
}
