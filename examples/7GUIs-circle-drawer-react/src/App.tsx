import Header from '@/components/Header';
import Stage from '@/components/Stage';
import { Color, Size, Undo } from '@/components/Controls';
import { Redo } from '@/components/Controls';
import Footer from '@/components/Footer.tsx';
import { CircleContext } from './machine.ts';

function App() {
  return (
    <CircleContext.Provider
    // options={{
    //   inspect: (ev) => {
    //     console.log("snapshot", ev.snapshot?.value);
    //   },
    // }}
    >
      <Header>
        <Undo />
        <Size />
        <Color />
        <Redo />
      </Header>
      <Stage />
      <Footer />
    </CircleContext.Provider>
  );
}

export default App;
