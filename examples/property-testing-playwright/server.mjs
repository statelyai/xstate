import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT ?? 5310);

createServer(async (request, response) => {
  const path = (request.url ?? '/').split('?')[0];
  const file = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  try {
    const body = await readFile(new URL(file, `file://${root}`));
    response.writeHead(200, {
      'content-type': file.endsWith('.html') ? 'text/html' : 'text/plain'
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(port);
