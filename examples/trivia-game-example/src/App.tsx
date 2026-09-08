import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import Home from './pages/Home';
import Trivia from './pages/Trivia';
import { TriviaMachineContext } from './context/AppContext';
import triviaMachine from './triviaMachine';

const TriviaRoute = () => {
  const hasStarted = TriviaMachineContext.useSelector((state) =>
    state.matches('startTrivia')
  );
  return hasStarted ? <Trivia /> : <Navigate to="/" replace />;
};

const App = () => {
  const navigate = useNavigate();
  return (
    <React.Fragment>
      <TriviaMachineContext.Provider
        logic={triviaMachine.provide({
          actions: {
            goToTriviaPage: () => {
              void navigate('/trivia');
            }
          }
        })}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trivia" element={<TriviaRoute />} />
        </Routes>
      </TriviaMachineContext.Provider>
    </React.Fragment>
  );
};

export default App;
