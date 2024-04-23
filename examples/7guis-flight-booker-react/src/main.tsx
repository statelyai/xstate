import React from "react";
import ReactDOM from "react-dom/client";
import { FlightContext } from "./machine.ts";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlightContext.Provider>
      <App />
    </FlightContext.Provider>
  </React.StrictMode>
);
