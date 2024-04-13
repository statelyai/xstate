import "./styles/reset.css";
import "./styles/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import FlightContext from "./machines/flightMachine.ts";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlightContext.Provider>
      <App />
    </FlightContext.Provider>
  </React.StrictMode>
);
