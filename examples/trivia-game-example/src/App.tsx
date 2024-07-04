import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Trivia from './pages/Trivia';
import { TriviaMachineContext } from './context/AppContext';
import triviaMachine from './triviaMachine';

const App = () => {
  const navigate = useNavigate();
  return (
    <React.Fragment>
      <TriviaMachineContext.Provider
        logic={triviaMachine.provide({
          actions: {
            goToTriviaPage: () => navigate('/trivia')
          }
        })}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trivia" element={<Trivia />} />
        </Routes>
      </TriviaMachineContext.Provider>
    </React.Fragment>
  );
};

export default App;
