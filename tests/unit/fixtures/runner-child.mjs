import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (mode === 'keeper') {
  process.on('SIGTERM', () => {});
  const server = createServer((_request, response) => response.end('alive'));
  server.listen(0, '127.0.0.1', () => {
    console.log(`KEEPER ${process.pid} http://127.0.0.1:${server.address().port}`);
    process.send?.('ready');
  });
} else if (mode === 'open-pipe') {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'keeper'], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  child.once('message', () => {
    child.disconnect();
    child.unref();
    // The runner exits successfully, but its descendant still owns the pipes.
    process.stdout.write('1 passed\n', () => process.exit(0));
  });
} else if (mode === 'pass') {
  console.log('1 passed');
} else if (mode === 'crash') {
  console.error('fixture startup failure');
  process.exitCode = 1;
} else if (mode.startsWith('app-')) {
  if (mode === 'app-ignore-term') process.on('SIGTERM', () => {});
  const server = createServer((request, response) => {
    if (mode === 'app-health-hang') return;
    response.writeHead(200, { 'content-type': 'application/json' });
    if (mode === 'app-body-hang' || (mode === 'app-oracle-hang' && request.url !== '/health')) {
      response.write('{');
      return;
    }
    response.end(JSON.stringify(request.url === '/health'
      ? { status: 'ok', mutationId: process.env.PROOFFORGE_MUTATION || null, mutationMarker: 'fixture' }
      : { orders: [] }));
  });
  if (mode === 'app-noisy') {
    await new Promise(resolve => process.stdout.write('o'.repeat(2_097_152), resolve));
    await new Promise(resolve => process.stderr.write('e'.repeat(2_097_152), resolve));
  }
  server.listen(Number(process.env.PORT), '127.0.0.1', () => {
    console.log('fixture ready');
    console.error('fixture diagnostic');
  });
} else {
  throw new Error(`Unknown fixture mode: ${mode}`);
}
