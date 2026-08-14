import { useActor } from '@xstate/react';
import { useEffect } from 'react';
import './App.css';
import { Dialog } from './Dialog';
import { modalMachine, ModalId } from './modalMachine';

const titles: Record<ModalId, string> = {
  sheet: 'Share this project',
  form: 'Invite a teammate',
  confirm: 'Discard this invite?'
};

function App() {
  const [state, send] = useActor(modalMachine);
  const { stack } = state.context;

  const open = (modal: ModalId) =>
    send({
      type: 'open',
      modal,
      // Whatever had focus becomes this modal's return target.
      returnFocusTo: (document.activeElement as HTMLElement | null)?.id || null
    });

  const close = () => send({ type: 'close' });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Escape pops only the topmost dialog.
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <section id="app">
      <h1>Stacked dialogs</h1>
      <p>
        Open the sheet, then the form inside it, then the confirm inside the
        form. Escape closes one level at a time and focus returns to whatever
        opened it.
      </p>
      <button id="open-sheet" onClick={() => open('sheet')}>
        Share project
      </button>
      <p className="meta">
        stack:{' '}
        {stack.length ? stack.map((e) => e.modal).join(' → ') : '(empty)'}
      </p>

      {stack.map((entry, index) => (
        <Dialog
          key={`${entry.modal}-${index}`}
          title={titles[entry.modal]}
          returnFocusTo={entry.returnFocusTo}
          isTop={index === stack.length - 1}
        >
          {entry.modal === 'sheet' && (
            <>
              <p>Anyone with the link can view this project.</p>
              <div className="actions">
                <button id="open-form" onClick={() => open('form')}>
                  Invite a teammate
                </button>
                <button className="ghost" onClick={close}>
                  Done
                </button>
              </div>
            </>
          )}

          {entry.modal === 'form' && (
            <>
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                placeholder="ada@example.com"
              />
              <div className="actions">
                <button id="open-confirm" onClick={() => open('confirm')}>
                  Cancel invite
                </button>
                <button className="ghost" onClick={close}>
                  Send
                </button>
              </div>
            </>
          )}

          {entry.modal === 'confirm' && (
            <>
              <p>The draft invite will be lost.</p>
              <div className="actions">
                <button onClick={close}>Keep editing</button>
                <button className="ghost" onClick={close}>
                  Discard
                </button>
              </div>
            </>
          )}
        </Dialog>
      ))}
    </section>
  );
}

export default App;
