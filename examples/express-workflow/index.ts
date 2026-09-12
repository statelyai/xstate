import { createWorkflowApp } from './app';

createWorkflowApp().listen(4242, () => {
  console.log('Server listening on port 4242');
});
