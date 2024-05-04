import Header from "@/components/Header";
import Stage from "@/components/Stage";
import { Controls } from "@/components/Controls";
import { Undo } from "@/components/Controls";
import { Redo } from "@/components/Controls";
import Footer from "@/components/Footer.tsx";
import { CircleContext } from "./machine.ts";

function App() {
  return (
    <CircleContext.Provider>
      <Header>
        <Undo />
        <Controls />
        <Redo />
      </Header>
      <Stage />
      <Footer />
    </CircleContext.Provider>
  );
}

export default App;
