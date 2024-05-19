import { Button, Modal } from "react-bootstrap";
import { TriviaMachineContext } from "../../context/AppContext";

export default function GeneralModal() {
  const triviaActorRef = TriviaMachineContext.useActorRef()
  const state = TriviaMachineContext.useSelector((state) => state)
  return (
        <Modal
          show={state.matches("instructionModal")}
          onHide={() => triviaActorRef.send({type: "user.close"})}
          backdrop="static"
          keyboard={false}
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <h2>Instructions</h2>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ul>
              <li>You will have to guess the identity of 10 characters.</li>
              <li>For each right character you get +10 points!</li>
              <li>You have 3 chances to be wrong or YOU LOSE!</li>
              <li>You can use the clues for every question</li>
            </ul>
            <h2 className="text-center font-weight-bold">
              SHOW ME WHAT YOU GOT!
            </h2>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => triviaActorRef.send({type: "user.close"})} variant="secondary">
              <h3>NOPE!</h3>
            </Button>
            <Button className="btn btn-primary" onClick={() => triviaActorRef.send({type: "user.accept"})}>
              <h3>LET'S DO IT</h3>
            </Button>
          </Modal.Footer>
        </Modal>
  );
}
