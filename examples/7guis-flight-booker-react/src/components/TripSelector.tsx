import FlightContext from '../machines/flightMachine';

export default function TripSelector({
  isBooking,
  isBooked,
  tripType,
  ...props
}: TripSelectorProps) {
  const { send } = FlightContext.useActorRef();

  return (
    <label>
      <span className="visually-hidden">{props.id}</span>
      <select
        disabled={isBooked || isBooking}
        value={tripType}
        onChange={() => {
          send({ type: 'CHANGE_TRIP_TYPE' });
        }}
        {...props}
      >
        <option value="oneWay">one way flight</option>
        <option value="roundTrip">return flight</option>
      </select>
    </label>
  );
}
