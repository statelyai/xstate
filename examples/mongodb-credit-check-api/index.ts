import { createCreditCheckApp } from './app';
import { closeDurableActors, initDbConnection } from './services/actorService';

initDbConnection()
  .then(() => {
    const server = createCreditCheckApp().listen(4242, () => {
      console.log('Server listening on port 4242');
    });
    process.once('SIGINT', () => {
      server.close(() => {
        void closeDurableActors().catch((error) => {
          console.error(error);
          process.exitCode = 1;
        });
      });
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
