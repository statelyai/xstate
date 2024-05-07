import { expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { generateDate } from "./utils/index.ts";
import FlightContext from "./machines/flightMachine.ts";
import App from "./App";

const YESTERDAY = generateDate(-1);
const LAST_WEEK = generateDate(-7);

describe("Flight Booker", () => {
  it("Ensure book button is disabled when depart date is in the past.", () => {
    render(
      <FlightContext.Provider>
        <App />
      </FlightContext.Provider>
    );
    const departInput = screen.getByLabelText("Depart Date");
    const bookButton = screen.getByRole("button");
    fireEvent.change(departInput, { target: { value: YESTERDAY } });
    expect(bookButton).toBeDisabled();
  });

  it("Ensure Return Date input is showing when return flight is selected.", () => {
    render(
      <FlightContext.Provider>
        <App />
      </FlightContext.Provider>
    );
    const flightSelect = screen.getByLabelText("Trip Type");
    fireEvent.change(flightSelect, { target: { value: "roundTrip" } });
    const returnInput = screen.getByLabelText("Return Date");
    expect(returnInput).toBeInTheDocument();
  });

  it("Ensure book button is disabled when return date is before start date.", () => {
    render(
      <FlightContext.Provider>
        <App />
      </FlightContext.Provider>
    );
    const flightSelect = screen.getByLabelText("Trip Type");
    fireEvent.change(flightSelect, { target: { value: "roundTrip" } });
    const returnInput = screen.getByLabelText("Return Date");
    fireEvent.change(returnInput, { target: { value: LAST_WEEK } });
    const bookButton = screen.getByRole("button");
    expect(bookButton).toBeDisabled();
  });
});
