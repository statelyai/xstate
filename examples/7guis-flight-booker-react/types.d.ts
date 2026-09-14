import React from 'react';

declare global {
  type Input = React.InputHTMLAttributes<HTMLInputElement>;
  type Select = React.SelectHTMLAttributes<HTMLSelectElement>;

  type EventType = 'BOOK_DEPART' | 'BOOK_RETURN';

  type FlightData = {
    departDate: string;
    returnDate: string;
  };

  type TripSelectorProps = {
    isBooking: boolean;
    isBooked: boolean;
    tripType: 'oneWay' | 'roundTrip';
  } & React.InputHTMLAttributes<HTMLSelectElement>;
}
