import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Trivia from './pages/Trivia';
import { TriviaMachineContext } from './context/AppContext';

/**
 * The machine owns "a game is in progress"; the router just follows it. Keeping
 * `navigate` out of the machine leaves the machine free of React dependencies.
 */
const RouteSync = () => {
  const navigate = useNavigate();
  const isPlaying = TriviaMachineContext.useSelector((state) =>
    state.matches('startTrivia')
  );

  useEffect(() => {
    navigate(isPlaying ? '/trivia' : '/');
  }, [isPlaying, navigate]);

  return null;
};

const App = () => {
  return (
    <TriviaMachineContext.Provider>
      <RouteSync />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trivia" element={<Trivia />} />
      </Routes>
    </TriviaMachineContext.Provider>
  );
};

export default App;
