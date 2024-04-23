import { FlightContext } from "./machine";
import { DateInput } from "./DateInput";
import { useRef, useState } from "react";
import { X } from "lucide-react";

const Flight = () => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { send } = FlightContext.useActorRef();
  const state = FlightContext.useSelector((state) => state);

  const { startDate, returnDate } = state.context;
  const isValidDate = startDate && (!returnDate || returnDate >= startDate);
  const canSubmit = state.matches("booking") && isValidDate;

  const trip = state.matches({ booking: "roundTrip" }) ? "roundTrip" : "oneWay";

  return (
    <section>
      <button className="open" onClick={() => dialogRef.current?.showModal()}>
        Book a flight
      </button>
      <dialog ref={dialogRef}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1>
            Book Flight
            <button
              className="close"
              onClick={() => {
                dialogRef.current?.close();
              }}
            >
              <X />
            </button>
          </h1>
        </div>
        <form style={{ display: "flex", flexDirection: "column" }}>
          <select
            onChange={() => {
              send({ type: "CHANGE_TRIP" });
            }}
            value={trip}
          >
            <option value="oneWay">one way flight</option>
            <option value="roundTrip">return flight</option>
          </select>
          <DateInput
            value={startDate}
            onChange={(value: string) =>
              send({ type: "CHANGE_START_DATE", value })
            }
            label="Start date"
          />
          <DateInput
            value={returnDate}
            onChange={(value: string) =>
              send({ type: "CHANGE_RETURN_DATE", value })
            }
            disabled={trip === "oneWay" || !startDate}
            label="Return date"
          />
          <button
            type="button"
            onClick={() => send({ type: "BOOK" })}
            disabled={!canSubmit}
          >
            {state.matches("booking") && "Book"}
            {state.matches("booked") && "Success!"}
          </button>
        </form>
      </dialog>
    </section>
  );
};

const App = () => {
  return <Flight />;
};

export default App;
