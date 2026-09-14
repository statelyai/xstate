import './styles/reset.css';
import './styles/styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import FlightContext from './machines/flightMachine';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlightContext.Provider>
      <App />
    </FlightContext.Provider>
  </React.StrictMode>
);
