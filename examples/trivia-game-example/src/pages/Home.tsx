import BigTitle from "../components/layout/BigTitle";
import StartGame from "../components/game/StartGame";
import GeneralModal from "../components/layout/Modal";

const App: React.FC = () => {
  return (
    <>
        <BigTitle />
        <StartGame />
        <GeneralModal />
    </>
  );
};

export default App;
