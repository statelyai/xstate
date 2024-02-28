import { useEffect, useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { AnyStateMachine, createMachine, getInitialSnapshot } from 'xstate';
import {
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { useMachine } from '@xstate/react';

const machine = createMachine({
  initial: 'home',
  states: {
    home: {
      on: {
        NEXT: 'about'
      }
    },
    about: {
      on: {
        NEXT: 'dashboard'
      }
    },
    dashboard: {
      always: {
        guard: () => true,
        target: 'home'
      },
      on: {
        NEXT: 'home'
      }
    }
  }
});

function useRouteMachine<T extends AnyStateMachine>(machine: T) {
  const location = useLocation();
  const navigate = useNavigate();
  const key = location.pathname.slice(1);
  let initialState;
  try {
    initialState = machine.resolveState({
      value: key as any,
      context: {}
    });
  } catch {
    initialState = getInitialSnapshot(machine);
  }
  const [state, send] = useMachine(machine, {
    snapshot: initialState
  });

  useEffect(() => {
    // { dashboard: 'profile' }
    // (exercise left to reader)
    const newLocation = ('/' + state.value) as string;
    // { value: 'about' } -> '/about'
    console.log(newLocation, location.pathname);

    if ('/' + newLocation !== location.pathname) {
      navigate(newLocation);
    }
  }, [state]);

  return [state, send];
}

export default function App() {
  return (
    <div>
      <h1>Basic Example</h1>

      <p>
        This example demonstrates some of the core features of React Router
        including nested <code>&lt;Route&gt;</code>s,{' '}
        <code>&lt;Outlet&gt;</code>s, <code>&lt;Link&gt;</code>s, and using a
        "*" route (aka "splat route") to render a "not found" page when someone
        visits an unrecognized URL.
      </p>

      {/* Routes nest inside one another. Nested route paths build upon
            parent route paths, and nested route elements render inside
            parent route elements. See the note about <Outlet> below. */}
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="home" element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Using path="*"" means "match anything", so this route
                acts like a catch-all for URLs that we don't have explicit
                routes for. */}
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </div>
  );
}

function Layout() {
  return (
    <div>
      {/* A "layout route" is a good place to put markup you want to
          share across all the pages on your site, like navigation. */}
      <nav>
        <ul>
          <li>
            <Link to="/home">Home</Link>
          </li>
          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li>
            <Link to="/nothing-here">Nothing Here</Link>
          </li>
        </ul>
      </nav>

      <hr />

      {/* An <Outlet> renders whatever child route is currently active,
          so you can think about this <Outlet> as a placeholder for
          the child routes we defined above. */}
      <Outlet />
    </div>
  );
}

function Home() {
  const [state, send] = useRouteMachine(machine);
  return (
    <div>
      <h2>Home</h2>
      <button onClick={() => send({ type: 'NEXT' })}>Next</button>
    </div>
  );
}

function About() {
  const [state, send] = useRouteMachine(machine);

  return (
    <div>
      <h2>About</h2>
      <button onClick={() => send({ type: 'NEXT' })}>Next</button>
    </div>
  );
}

function Dashboard() {
  const [state, send] = useRouteMachine(machine);

  return (
    <div>
      <h2>Dashboard</h2>
      <button onClick={() => send({ type: 'a' })}>Next</button>
    </div>
  );
}

function NoMatch() {
  const [state, send] = useRouteMachine(machine);
  console.log(state);
  return (
    <div>
      <h2>Nothing to see here!</h2>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </div>
  );
}
