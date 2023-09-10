import express from 'express';
import bodyParser from 'body-parser';
import { callManager } from './callManager';

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

interface AnswerRequest {
  uuid: string;
}

interface DtmfRequest {
  uuid: string;
  dtmf: string;
}

interface EventRequest {
  uuid: string;
  status: 'completed' | string;
}

app.post('/answer', (req, res) => {
  const { uuid } = req.body as AnswerRequest;

  callManager.createCall(uuid);

  const ncco = callManager.getNcco(uuid);

  res.json(ncco);
});

app.post('/dtmf', (req, res) => {
  const { uuid, dtmf } = req.body as DtmfRequest;

  callManager.updateCall(uuid, `DTMF-${dtmf}`);

  const ncco = callManager.getNcco(uuid);

  res.json(ncco);
});

app.post('/event', (req, res) => {
  if ((req.body as EventRequest).status === 'completed') {
    callManager.endCall((req.body as EventRequest).uuid);
  }

  res.json({ status: 'OK' });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
