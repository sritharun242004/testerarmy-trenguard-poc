import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import test from 'node:test';

test('server honors isolated benchmark data paths ahead of the legacy alias', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proofforge-isolation-'));
  const children: ChildProcess[] = [];
  async function start(fileName: string) {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    assert(address && typeof address !== 'string');
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
    const base = `http://127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      env: {
        PATH: process.env.PATH, HOME: process.env.HOME, HOST: '127.0.0.1', PORT: String(address.port),
        PROOFFORGE_DATA_FILE: path.join(directory, fileName),
        PROOFORGE_DATA_FILE: path.join(directory, 'legacy-should-not-exist.json'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let output = '';
    child.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr?.on('data', (data: Buffer) => { output += data.toString(); });
    const deadline = Date.now() + 10_000;
    while (!output.includes(`listening at ${base}`)) {
      assert.equal(child.exitCode, null, output);
      assert(Date.now() < deadline, 'Isolated server startup timed out');
      await sleep(25);
    }
    return base;
  }
  try {
    const first = await start('first.json');
    const second = await start('second.json');
    const created = await fetch(`${first}/api/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerName: 'Ada Lovelace', productId: 'proofforge-notebook', quantity: 2 }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).order.totalCents, 2598);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'first.json'), 'utf8')).orders.length, 1);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'second.json'), 'utf8')).orders.length, 0);
    assert.deepEqual((await (await fetch(`${second}/api/orders`)).json()).orders, []);
    await assert.rejects(access(path.join(directory, 'legacy-should-not-exist.json')), { code: 'ENOENT' });
  } finally {
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      const closed = once(child, 'close');
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 3_000);
      try { await closed; } finally { clearTimeout(force); }
    }
    await rm(directory, { recursive: true, force: true });
  }
});
