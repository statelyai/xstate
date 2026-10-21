import { startServer } from './server';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const { port, close } = await startServer(0);
const base = `http://localhost:${port}`;

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await response.json();
  console.log(`${method} ${path} -> ${response.status}`, JSON.stringify(json));
  return json as any;
};

console.log(`KYC API listening on ${base}\n`);

// A clean applicant, reviewed by a human after the automated checks finish.
const { id } = await call('POST', '/applicants', {
  name: 'Ada Lovelace',
  country: 'GB'
});

await call('GET', `/applicants/${id}`); // still in automatedChecks
await call('POST', `/applicants/${id}/approve`, { reviewer: 'sam' }); // too early

await wait(400);
await call('GET', `/applicants/${id}`); // now in manualReview

await call('POST', `/applicants/${id}/request-info`, {
  reviewer: 'sam',
  question: 'proof of address?'
});
await call('POST', `/applicants/${id}/provide-info`, {
  answer: 'utility bill'
});
await call('POST', `/applicants/${id}/approve`, { reviewer: 'sam' });
await call('GET', `/applicants/${id}`);

// A sanctions hit still goes to manual review; the reviewer rejects it.
const flagged = await call('POST', '/applicants', {
  name: 'Jo Doe',
  country: 'XX'
});
await wait(400);
await call('POST', `/applicants/${flagged.id}/reject`, {
  reviewer: 'sam',
  reason: 'sanctions hit'
});

console.log('\ndemo: done');
close();
