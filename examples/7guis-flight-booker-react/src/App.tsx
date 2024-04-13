import FlightContext from "./machines/flightMachine";
import { BookButton, Header } from "./components";
import { DateSelector, TripSelector } from "./components";
import { TODAY } from "./utils";

export default function App() {
  const { send } = FlightContext.useActorRef();
  const state = FlightContext.useSelector((state) => state);
  const { departDate, returnDate } = state.context;
  const isRoundTrip = state.matches({ booking: "roundTrip" });
  const isBooked = state.matches("booked");

  const isValidDepartDate = departDate >= TODAY;
  const isValidReturnDate = returnDate >= departDate;

  return (
    <dialog>
      <Header>Book Flight</Header>
      <TripSelector
        id="Trip Type"
        isBooked={isBooked}
        tripType={isRoundTrip ? "roundTrip" : "oneWay"}
      />
      <DateSelector
        id="Depart Date"
        value={departDate}
        isValidDate={isValidDepartDate}
        disabled={isBookeda
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          send({
            type: "CHANGE_DEPART_DATE",
            value: e.currentTarget.value,
          })
        }
      />
      <DateSelector
        id="Return Date"
        value={returnDate}
        isValidDate={isValidReturnDate}
        disabled={!isRoundTrip || isBooked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          send({
            type: "CHANGE_RETURN_DATE",
            value: e.currentTarget.value,
          })
        }
      />
      <BookButton
        eventType={isRoundTrip ? "BOOK_RETURN" : "BOOK_DEPART"}
        isBooked={isBooked}
      />
    </dialog>
  );
}
